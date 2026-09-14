/**
 * 沙游心语 · 服务端
 * ─────────────────────────────────────────────────────────
 * 提供：知乎 OAuth 登录、内容代理、互动回链校验、直答报告生成
 *
 * 安全约定：
 *   - Access Secret 与 app_key 只存在于服务端，绝不下发浏览器
 *   - OAuth access_token 存服务端 session，前端只拿一个 sid cookie
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as zh from './zhihu.js';
import * as cli from './cli-source.js';
import { beginOAuth, consumeOAuth } from './oauth-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── 配置 ──
const cfg = {
  port:        process.env.PORT || 3000,
  host:        process.env.HOST || '0.0.0.0',
  publicUrl:   process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '',
  secret:      process.env.ZHIHU_ACCESS_SECRET || '',
  appId:       process.env.ZHIHU_APP_ID || '',
  appKey:      process.env.ZHIHU_APP_KEY || '',
  redirectUri: process.env.ZHIHU_REDIRECT_URI || '',
};

// 读 .env（不引额外依赖，手写足够）
// 约定：真实环境变量优先级最高，.env 只用于补齐未在环境中设置的项，
// 这样 `ZHIHU_APP_ID=... npm start` 能可靠覆盖本地文件。
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const fileEnv = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    fileEnv[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const fill = (key, field) => {
    if (!process.env[key] && fileEnv[key]) cfg[field] = fileEnv[key];
  };
  fill('ZHIHU_ACCESS_SECRET', 'secret');
  fill('ZHIHU_APP_ID',        'appId');
  fill('ZHIHU_APP_KEY',       'appKey');
  fill('ZHIHU_REDIRECT_URI',  'redirectUri');
  fill('PUBLIC_URL',           'publicUrl');
  fill('HOST',                 'host');
  fill('PORT',                'port');
}

if (!cfg.redirectUri) {
  if (cfg.publicUrl) {
    const origin = cfg.publicUrl.replace(/\/$/, '');
    cfg.redirectUri = `${origin}/auth/callback`;
  } else {
    cfg.redirectUri = `http://127.0.0.1:${cfg.port}/auth/callback`;
  }
}

/**
 * 兜底从 macOS 钥匙串读取 app_key。
 * ─────────────────────────────────────────────────────────
 * 优先级：环境变量 > .env > 钥匙串。
 * 这样本地开发不必把密钥写进磁盘上的 .env，降低误提交风险；
 * 部署到 Cloudflare / Sealos 时用平台 Secret 注入环境变量即可，
 * 那边没有钥匙串，这段会自动跳过。
 */
if (!cfg.appKey && process.platform === 'darwin') {
  try {
    cfg.appKey = execFileSync('/usr/bin/security',
      ['find-generic-password', '-s', 'shayu-zhihu:oauth', '-a', 'app-key', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (cfg.appKey) cfg.appKeySource = 'keychain';
  } catch { /* 没存过就维持未配置状态，由 /api/capabilities 如实反映 */ }
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// ── 会话（内存版，生产应换 Redis） ──
const sessions = new Map();
const newSid = () => crypto.randomBytes(24).toString('hex');
function session(req, res) {
  let sid = req.cookies.sid;
  if (!sid || !sessions.has(sid)) {
    sid = newSid();
    sessions.set(sid, { created: Date.now() });
    res.cookie('sid', sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 864e5,
    });
  }
  return sessions.get(sid);
}

// ── 数据源探测：优先直连 HTTP API，其次回退本地已授权 CLI ──
let SOURCE = 'none';          // 'api' | 'cli' | 'none'
async function detectSource() {
  if (cfg.secret) { SOURCE = 'api'; return; }
  if (await cli.cliAvailable()) { SOURCE = 'cli'; return; }
  SOURCE = 'none';
}

/**
 * 回调地址是否为公网可达的 HTTPS 地址。
 * 知乎授权服务器必须能主动访问回调地址，127.0.0.1 / localhost / 内网段
 * 它都到不了，因此本地预览时登录必然失败。这里如实判定，
 * 让前端把按钮置为不可用并说明原因，而不是让用户点进去撞错误页。
 */
function isPublicRedirect(uri) {
  try {
    const u = new URL(uri);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h === '0.0.0.0') return false;
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false;
    const m = h.match(/^172\.(\d{1,3})\./);
    if (m && +m[1] >= 16 && +m[1] <= 31) return false;
    return true;
  } catch { return false; }
}

/* ══════════════════ 能力自检 ══════════════════ */
app.get('/api/capabilities', (req, res) => {
  const s = session(req, res);
  // token 过期则视为已登出，不静默沿用过期身份
  if (s.oauth && s.oauth.expiresAt && Date.now() > s.oauth.expiresAt) {
    delete s.oauth; delete s.user;
  }
  const credsReady    = !!(cfg.appId && cfg.appKey);
  const redirectReady = isPublicRedirect(cfg.redirectUri);
  res.json({
    contentApi: SOURCE !== 'none',
    sourceType: SOURCE,          // api = 直连；cli = 本地已授权 CLI
    oauth:      credsReady,
    // 凭证齐备 ≠ 能登录：还要回调地址是公网 HTTPS，前端据此区分三态
    oauthReady:    credsReady && redirectReady,
    redirectPublic: redirectReady,
    redirectUri:    cfg.redirectUri,   // 公开信息，便于用户核对开放平台登记值
    loggedIn:   !!s.user,
    user:       s.user || null,
    // 平台能力边界 —— 前端据此渲染 UI，不做虚假承诺
    canRead:  ['zhihu_search', 'global_search', 'hot_list', 'zhida',
               'user_contents', 'user_collections', 'user_followees'],
    canWrite: [],   // ← 开放平台没有任何写入端点
    writeNote: '知乎开放平台未提供赞同/评论/分享/发想法的写入接口，'
             + '站内互动只能由用户本人在知乎完成。',
  });
});

/* ══════════════════ OAuth 登录 ══════════════════ */

app.get('/auth/login', (req, res) => {
  if (!cfg.appId || !cfg.appKey) {
    return res.status(503).send(errPage(
      '未配置 OAuth 应用',
      '需要先向 product-platform@zhihu.com 申请 app_id 与 app_key，并写入 .env。'
    ));
  }
  // 本地回调无法完成真实授权：与其跳到知乎再撞错误页，不如在这里说清楚
  if (!isPublicRedirect(cfg.redirectUri)) {
    return res.status(503).send(errPage(
      '本地地址无法完成知乎登录',
      `当前回调地址是 <code>${escapeAttr(cfg.redirectUri)}</code>，属于本地/内网地址。`
      + '知乎授权服务器需要能主动回调到你的应用，因此必须先把站点部署到 '
      + 'Cloudflare、Sealos 等平台，取得公网 HTTPS 域名后，用 '
      + '<code>ZHIHU_REDIRECT_URI=https://&lt;你的域名&gt;/auth/callback</code> 启动，'
      + '并把完全相同的地址登记到知乎开放平台。'
    ));
  }
  const s = session(req, res);
  const state = beginOAuth(s);
  res.redirect(zh.authorizeUrl(cfg.appId, cfg.redirectUri, state));
});

app.get('/auth/callback', async (req, res) => {
  const s = session(req, res);
  // 实测回调参数名为 authorization_code，同时兼容 code
  const code = req.query.authorization_code || req.query.code;
  if (!code) return res.status(400).send(errPage('授权失败', '回调没有带回授权码。'));

  try {
    consumeOAuth(s, typeof req.query.state === 'string' ? req.query.state : '');
  } catch (error) {
    return res.status(400).send(errPage(
      '授权校验失败',
      `${escapeAttr(error.message)}。请回到首页重新点击「用知乎登录」。`,
    ));
  }

  try {
    const tok = await zh.exchangeToken(cfg.appId, cfg.appKey, cfg.redirectUri, code);
    s.oauth = { token: tok.access_token, expiresAt: Date.now() + (tok.expires_in || 3600) * 1000 };

    // ① 首选：OAuth 用户信息接口 —— 能同时拿到昵称与头像
    let profile = null;
    try {
      profile = await zh.oauthUserInfo(tok.access_token);
    } catch (e) {
      console.warn('[oauth] 用户信息接口不可用：', e.message);
    }

    // ② 兜底：从本人创作里取一次作者名（老路径，头像取不到）
    if (!profile?.nick) {
      try {
        const d = await zh.userContents(cfg.secret, tok.access_token, { limit: 1 });
        const nick = d?.Items?.[0]?.Author?.Name;
        if (nick) profile = { ...(profile || {}), nick };
      } catch { /* 内容为空不影响登录成功 */ }
    }

    s.user = {
      nick:     profile?.nick || '知乎用户',
      avatar:   profile?.avatar || null,     // 取不到就是 null，前端显示文字头像，不造假
      url:      profile?.url || null,
      headline: profile?.headline || null,
      loginAt:  Date.now(),
    };
    res.redirect('/?login=ok');
  } catch (e) {
    res.status(502).send(errPage('换取 token 失败', escapeAttr(e.message)));
  }
});

app.post('/auth/logout', (req, res) => {
  const s = session(req, res);
  delete s.oauth; delete s.user;
  res.json({ ok: true });
});

/* ══════════════════ 内容代理（只读） ══════════════════ */

const needSource = (req, res, next) =>
  SOURCE !== 'none' ? next()
    : res.status(503).json({ error: '未配置 ZHIHU_ACCESS_SECRET，且本地无已授权 CLI' });

function pageParams(query) {
  const parsedLimit = Number.parseInt(query.n, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);
  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
}

app.get('/api/search', needSource, async (req, res) => {
  try {
    const d = SOURCE === 'api'
      ? await zh.zhihuSearch(cfg.secret, req.query.q, +req.query.n || 5)
      : await cli.cliSearch(req.query.q, +req.query.n || 5);
    res.json({ items: (d.Items || []).map(slim) });
  } catch (e) { res.status(502).json({ error: e.message, code: e.code }); }
});

app.get('/api/hot', needSource, async (req, res) => {
  try {
    const d = SOURCE === 'api'
      ? await zh.hotList(cfg.secret, +req.query.n || 30)
      : await cli.cliHot(+req.query.n || 30);
    res.json({ items: d.Items || [] });
  } catch (e) { res.status(502).json({ error: e.message, code: e.code }); }
});

/** 读取当前登录用户的创作 —— 用于"互动回链校验" */
app.get('/api/me/contents', needSource, async (req, res) => {
  const s = session(req, res);
  if (SOURCE === 'api' && !s.oauth?.token) {
    return res.status(401).json({ error: '未登录知乎' });
  }
  try {
    const { limit, offset } = pageParams(req.query);
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const d = SOURCE === 'api'
      ? await zh.userContents(cfg.secret, s.oauth.token,
          { type, limit, offset })
      : await cli.cliMyContents(limit, offset, type);
    res.json({ items: d.Items || [], paging: d.Paging || null });
  } catch (e) { res.status(502).json({ error: e.message, code: e.code }); }
});

/** 读取当前登录用户关注的人，支持 offset 分页 */
app.get('/api/me/followees', needSource, async (req, res) => {
  const s = session(req, res);
  if (SOURCE === 'api' && !s.oauth?.token) {
    return res.status(401).json({ error: '未登录知乎' });
  }
  try {
    const { limit, offset } = pageParams(req.query);
    const d = SOURCE === 'api'
      ? await zh.userFollowees(cfg.secret, s.oauth.token, limit, offset)
      : await cli.cliMyFollowees(limit, offset);
    res.json({ items: d.Items || [], paging: d.Paging || null });
  } catch (e) { res.status(502).json({ error: e.message, code: e.code }); }
});

/* ══════════════════ 互动回链校验 ══════════════════ */
/**
 * 这是"把互动回归知乎"的真实实现路径：
 *   1. 用户在我们的页面点「去知乎回应」→ 新标签打开真实知乎页面
 *   2. 用户在知乎站内完成真实的赞同 / 评论 / 发想法
 *   3. 回到游戏，粘贴自己那条内容的链接
 *   4. 服务端用 user_contents 核对该内容确实属于当前登录账号
 *   5. 校验通过才发放灵感值
 *
 * 这样"互动"是 100% 真实发生在知乎的，我们只做归属校验，
 * 既不伪造 API，也不要求平台开放写权限。
 */
app.post('/api/verify-contribution', needSource, async (req, res) => {
  const s = session(req, res);
  // 直连模式必须 OAuth 登录；CLI 模式本身就是"本人账号"，可直接校验
  if (SOURCE === 'api' && !s.oauth?.token) {
    return res.status(401).json({ ok: false, error: '请先用知乎账号登录，才能校验你的创作归属' });
  }
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: '请提供你在知乎发布的内容链接' });

  // 从各种知乎 URL 形态中抽出内容 ID
  const id = extractId(url);
  if (!id) return res.status(400).json({ ok: false, error: '无法识别这个知乎链接' });

  try {
    // 拉取本人最近创作，逐页比对（最多查 3 页 = 150 条）
    let offset = 0, hit = null;
    for (let page = 0; page < 3 && !hit; page++) {
      const d = SOURCE === 'api'
        ? await zh.userContents(cfg.secret, s.oauth.token, { limit: 50, offset })
        : await cli.cliMyContents(50, offset);
      const items = d.Items || [];
      hit = items.find(it => (it.Url || '').includes(id));
      if (d.Paging?.IsEnd || !items.length) break;
      offset = parseInt(d.Paging?.NextOffset ?? (offset + 50), 10);
    }

    if (!hit) {
      return res.json({
        ok: false,
        error: '在你的知乎创作里没有找到这条内容。请确认：① 用的是本人账号 ② 内容已发布成功 ③ 链接正确',
      });
    }

    // 防重复领取
    s.claimed ??= new Set();
    if (s.claimed.has(id)) {
      return res.json({ ok: false, error: '这条内容已经领取过灵感值了' });
    }
    s.claimed.add(id);

    res.json({
      ok: true,
      reward: 3,             // 真实创作奖励高于单纯阅读
      content: {
        title: hit.Title, type: hit.ContentType, url: hit.Url,
        likes: hit.LikeCount, comments: hit.CommentCount,
      },
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

/* ══════════════════ 直答生成沙盘报告 ══════════════════ */
app.post('/api/report', needSource, async (req, res) => {
  const { features } = req.body || {};
  if (!features) return res.status(400).json({ error: '缺少沙盘结构特征' });

  const prompt = `你是一位沙盘游戏（Sandplay）的陪伴者，不是诊断者。
下面是一位来访者摆放的沙盘的客观结构数据：

${features}

请用温和、非评判的中文写一段解读，严格遵守：
1. 只描述你从结构中"看到"的，不推断人格、疾病或心理问题
2. 禁止出现任何诊断性词汇（抑郁、焦虑症、障碍、创伤等）
3. 不要替对方赋予沙具含义，象征意义由他本人决定
4. 分三段：整体氛围、结构观察、然后给出 3 个开放式问题
5. 总长度 300 字以内，语气平静克制，像一个安静的陪伴者

直接输出正文，不要标题和序号。`;

  try {
    const text = SOURCE === 'api'
      ? await zh.zhida(cfg.secret, [{ role: 'user', content: prompt }])
      : await cli.cliAnswer(prompt);
    res.json({ ok: true, text, source: SOURCE === 'api' ? 'zhida' : 'zhida-cli' });
  } catch (e) {
    // 直答不可用时告诉前端降级到本地规则引擎，不让页面白屏
    res.json({ ok: false, error: e.message, fallback: true });
  }
});

/* ══════════════════ 静态资源 ══════════════════ */
app.use(express.static(path.join(ROOT, 'public')));

/* ── 工具 ── */
function slim(it) {
  const t = (it.ContentText || '').replace(/<\/?em>/g, '').replace(/\s+/g, ' ').trim();
  return {
    title: (it.Title || '').replace(/ - 知乎$/, ''),
    author: it.AuthorName, badge: it.AuthorBadgeText,
    excerpt: t.slice(0, 160) + (t.length > 160 ? '…' : ''),
    url: it.Url, votes: it.VoteUpCount, comments: it.CommentCount,
    hotComments: (it.CommentInfoList || []).map(c => c.Content).slice(0, 2),
  };
}
function extractId(url) {
  const pats = [
    /zhihu\.com\/question\/\d+\/answer\/(\d+)/,
    /zhihu\.com\/answer\/(\d+)/,
    /zhuanlan\.zhihu\.com\/p\/(\d+)/,
    /zhihu\.com\/pin\/(\d+)/,
    /zhihu\.com\/question\/(\d+)/,
  ];
  for (const p of pats) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
/** 把不可信文本插进 HTML 前做转义 —— errPage 的 msg 允许富文本，故单独提供 */
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function errPage(title, msg) {
  return `<!doctype html><meta charset="utf-8">
  <div style="font-family:-apple-system,PingFang SC,sans-serif;max-width:520px;margin:80px auto;
              padding:28px 32px;border:1px solid #e8e1d5;border-radius:14px;line-height:1.8">
    <h2 style="margin:0 0 10px">${escapeAttr(title)}</h2>
    <p style="color:#6f665c;font-size:14px">${msg}</p>
    <a href="/" style="color:#5b8a72;font-weight:600;font-size:14px">← 返回</a>
  </div>`;
}

await detectSource();
app.listen(cfg.port, cfg.host, () => {
  const srcLabel = { api: '✓ 直连 HTTP API', cli: '✓ 本地已授权 CLI', none: '✗ 未配置（用离线示例数据）' };
  const displayUrl = cfg.publicUrl || `http://127.0.0.1:${cfg.port}`;
  console.log(`\n  沙游心语  →  ${displayUrl}\n`);
  console.log(`  内容数据源: ${srcLabel[SOURCE]}`);
  console.log(`  OAuth 登录 : ${cfg.appId && cfg.appKey ? '✓ 已配置' : '✗ 缺 app_id / app_key（登录按钮会提示）'}`);
  console.log(`  写入互动   : ✗ 平台不提供，由「跳转知乎 + 回链校验」实现\n`);
});
