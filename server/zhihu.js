/**
 * 知乎开放平台客户端
 * ─────────────────────────────────────────────────────────
 * 封装：Bearer 鉴权、OAuth 授权码换 token、内容检索、热榜、直答
 *
 * ⚠️ 能力边界（已核对官方文档 2026-07）：
 *    平台只提供【读取】能力。没有任何写入端点 ——
 *    赞同 / 反对 / 评论 / 分享 / 发布想法 均无法通过 API 代用户执行。
 *    详见 docs 中的 http-api.md 与 user-api.md。
 */

const BASE = 'https://developer.zhihu.com';
const OAUTH = 'https://openapi.zhihu.com';

const ts = () => Math.floor(Date.now() / 1000).toString();

/** 组装开放平台数据接口的标准请求头 */
function headers(accessSecret, oauthToken) {
  const h = {
    'Authorization': `Bearer ${accessSecret}`,
    'X-Request-Timestamp': ts(),
    'Content-Type': 'application/json',
  };
  // 仅在"代表其他已授权用户"时携带
  if (oauthToken) h['X-OAuth-Token'] = oauthToken;
  return h;
}

/** 统一处理开放平台响应：Code 0 为成功 */
async function unwrap(res, label) {
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`${label}: 响应不是合法 JSON (HTTP ${res.status})`); }

  if (json.Code !== 0 && json.Code !== 20000) {
    const map = {
      10001: '参数错误',
      20001: '鉴权失败，请检查 Access Secret',
      30001: '触发频率限制',
      30002: '超出配额限制',
      90001: '知乎服务端内部错误',
    };
    const e = new Error(`${label}: ${map[json.Code] || json.Message || '未知错误'}`);
    e.code = json.Code;
    throw e;
  }
  return json.Data ?? json;
}

/* ══════════════════ 内容能力（只读） ══════════════════ */

/** 知乎站内搜索 · Count 最大 10 */
export async function zhihuSearch(secret, query, count = 10) {
  const p = new URLSearchParams({ Query: query, Count: String(Math.min(count, 10)) });
  const r = await fetch(`${BASE}/api/v1/content/zhihu_search?${p}`, { headers: headers(secret) });
  return unwrap(r, '知乎搜索');
}

/** 全网搜索 · Count 最大 20，支持 Filter 高级语法 */
export async function globalSearch(secret, query, count = 10, filter) {
  const p = new URLSearchParams({ Query: query, Count: String(Math.min(count, 20)) });
  if (filter) p.set('Filter', filter);
  const r = await fetch(`${BASE}/api/v1/content/global_search?${p}`, { headers: headers(secret) });
  return unwrap(r, '全网搜索');
}

/** 知乎热榜 · Limit 最大 30 */
export async function hotList(secret, limit = 30) {
  const p = new URLSearchParams({ Limit: String(Math.min(limit, 30)) });
  const r = await fetch(`${BASE}/api/v1/content/hot_list?${p}`, { headers: headers(secret) });
  return unwrap(r, '热榜');
}

/** 知乎直答 · Chat Completions 风格，用于生成沙盘报告 */
export async function zhida(secret, messages, model = 'zhida-thinking-1p5') {
  const r = await fetch(`${BASE}/api/v1/agent/chat/completions`, {
    method: 'POST',
    headers: headers(secret),
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { throw new Error('直答: 响应解析失败'); }
  if (j.Code && j.Code !== 0 && j.Code !== 20000) throw new Error(`直答: ${j.Message}`);
  return j?.choices?.[0]?.message?.content ?? '';
}

/* ══════════════════ OAuth 用户登录 ══════════════════ */

/** 构造知乎授权页地址，用户点击后跳转过去登录 */
export function authorizeUrl(appId, redirectUri, state) {
  const p = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `${OAUTH}/authorize?${p}`;
}

/**
 * 用授权码换取用户 access_token
 * 注意协议偏差：回调参数名是 authorization_code，
 * 但 token 交换接口的表单字段仍叫 code。
 */
export async function exchangeToken(appId, appKey, redirectUri, code) {
  const body = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const r = await fetch(`${OAUTH}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`换取 token 失败：${j.Message || JSON.stringify(j)}`);
  return j;   // { access_token, token_type, expires_in }
}

/**
 * 获取当前授权用户的基本信息（昵称、头像）
 * ─────────────────────────────────────────────────────────
 * 这里用的是 OAuth token 本身作 Bearer，而不是开放平台 Access Secret ——
 * 与 /api/v1/user/* 那组接口的鉴权方式不同，别混用。
 *
 * 实测：code 20000 表示成功；20004 = token 类型错误；20005 = token 无效。
 * 平台未公开该响应的字段 schema，因此下面对常见命名做了兼容映射，
 * 取不到时返回 null 字段，由上层降级显示，不伪造数据。
 */
export async function oauthUserInfo(oauthToken) {
  const r = await fetch(`${OAUTH}/user`, {
    headers: { 'Authorization': `Bearer ${oauthToken}` },
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); }
  catch { throw new Error(`用户信息: 响应不是合法 JSON (HTTP ${r.status})`); }

  // 成功码：0 / 20000；其余视为失败
  if (j.code !== undefined && j.code !== 0 && j.code !== 20000) {
    const e = new Error(`用户信息: ${typeof j.data === 'string' ? j.data : (j.message || '获取失败')}`);
    e.code = j.code;
    throw e;
  }

  const d = (j.data && typeof j.data === 'object') ? j.data : (j.Data || j);
  const pick = (...keys) => {
    for (const k of keys) {
      const v = d?.[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  return {
    nick:     pick('name', 'Name', 'fullname', 'Fullname', 'nickname', 'NickName'),
    avatar:   pick('avatar_url', 'AvatarUrl', 'avatar', 'Avatar', 'headimg_url', 'HeadImgUrl'),
    urlToken: pick('url_token', 'UrlToken', 'id', 'Id'),
    url:      pick('url', 'Url'),
    headline: pick('headline', 'Headline'),
  };
}

/* ══════════════════ 已登录用户的数据（只读） ══════════════════ */

/** 读取用户的创作内容（回答/文章/想法/问题） */
export async function userContents(secret, oauthToken, { type = 'all', limit = 20, offset = 0 } = {}) {
  const p = new URLSearchParams({
    ContentType: type, Limit: String(Math.min(limit, 50)), Offset: String(offset),
  });
  const r = await fetch(`${BASE}/api/v1/user/contents?${p}`, { headers: headers(secret, oauthToken) });
  return unwrap(r, '用户创作');
}

/** 读取用户近期收藏 */
export async function userCollections(secret, oauthToken, limit = 20) {
  const p = new URLSearchParams({ Limit: String(Math.min(limit, 50)) });
  const r = await fetch(`${BASE}/api/v1/user/collections?${p}`, { headers: headers(secret, oauthToken) });
  return unwrap(r, '用户收藏');
}

/** 读取用户关注列表 */
export async function userFollowees(secret, oauthToken, limit = 20, offset = 0) {
  const p = new URLSearchParams({ Limit: String(Math.min(limit, 50)), Offset: String(offset) });
  const r = await fetch(`${BASE}/api/v1/user/followees?${p}`, { headers: headers(secret, oauthToken) });
  return unwrap(r, '用户关注');
}
