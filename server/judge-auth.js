import crypto from 'node:crypto';
import express from 'express';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const KEY_LENGTH = 64;

const DEMO_CONTENTS = Object.freeze([
  {
    IsDemo: true,
    ContentType: '体验记录',
    Title: '桥的另一边：一次关于连接的沙盘练习',
    Excerpt: '这是一条评委模式示例资料，用来展示用户中心和分页效果，不代表真实知乎创作。',
    LikeCount: 18,
    CommentCount: 3,
  },
  {
    IsDemo: true,
    ContentType: '体验记录',
    Title: '给小屋留一扇窗',
    Excerpt: '示例记录关注庇护、边界与开放空间，仅用于比赛功能体验。',
    LikeCount: 12,
    CommentCount: 2,
  },
  {
    IsDemo: true,
    ContentType: '体验记录',
    Title: '怪兽没有消失，但它离远了一点',
    Excerpt: '示例记录展示多次沙盘作品可以如何形成变化线索。',
    LikeCount: 27,
    CommentCount: 6,
  },
  {
    IsDemo: true,
    ContentType: '体验记录',
    Title: '从门到路：下一幕会发生什么',
    Excerpt: '这是评委账号中的演示内容，不会上传或伪装成知乎站内数据。',
    LikeCount: 9,
    CommentCount: 1,
  },
]);

const DEMO_FOLLOWEES = Object.freeze([
  { IsDemo: true, Fullname: '桥边的观察者', Headline: '关注人与人之间如何重新建立连接', FollowerCount: 328 },
  { IsDemo: true, Fullname: '看见留白', Headline: '记录空间、情绪与日常生活', FollowerCount: 215 },
  { IsDemo: true, Fullname: '沙盘漫游者', Headline: '把问题留在路上，也把答案放回生活', FollowerCount: 486 },
]);

export function hashJudgePassword(password, salt = crypto.randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('评委体验密码至少需要 12 个字符');
  }
  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(salt);
  const derived = crypto.scryptSync(password, saltBuffer, KEY_LENGTH);
  return `scrypt$${saltBuffer.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyJudgePassword(password, encoded) {
  try {
    if (typeof password !== 'string' || password.length > 512 || typeof encoded !== 'string') return false;
    const [algorithm, saltText, hashText, extra] = encoded.split('$');
    if (algorithm !== 'scrypt' || !saltText || !hashText || extra !== undefined) return false;
    const expected = Buffer.from(hashText, 'base64url');
    if (expected.length !== KEY_LENGTH) return false;
    const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function judgeAuthReady({ enabled, username, passwordHash } = {}) {
  return enabled === true && typeof username === 'string' && username.trim().length > 0
    && typeof passwordHash === 'string'
    && /^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(passwordHash);
}

export function createJudgeUser({ username, displayName } = {}) {
  const normalized = String(username || 'judge').trim();
  return {
    id: `judge-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 20)}`,
    nick: String(displayName || '评委体验账号').trim() || '评委体验账号',
    avatar: null,
    url: null,
    headline: '比赛评审专用体验身份 · 展示资料均为示例数据',
    description: '此账号不绑定任何真实知乎用户，也不会读取个人知乎数据。',
    authType: 'judge',
    loginAt: Date.now(),
  };
}

export function getJudgeData(kind, { limit = 20, offset = 0 } = {}) {
  const source = kind === 'contents' ? DEMO_CONTENTS : kind === 'followees' ? DEMO_FOLLOWEES : [];
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const items = source.slice(safeOffset, safeOffset + safeLimit).map(item => ({ ...item }));
  const nextOffset = safeOffset + items.length;
  const isEnd = nextOffset >= source.length;
  return {
    Items: items,
    Paging: {
      IsEnd: isEnd,
      ...(isEnd ? {} : { NextOffset: nextOffset }),
      Totals: source.length,
    },
  };
}

export function createJudgeAuthRouter({
  enabled,
  username,
  passwordHash,
  displayName = '评委体验账号',
  getSession,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS,
  now = () => Date.now(),
} = {}) {
  const router = express.Router();
  const failures = new Map();
  const ready = judgeAuthReady({ enabled, username, passwordHash });

  router.post('/', (req, res) => {
    if (!ready) return res.status(404).json({ error: '评委体验登录未启用' });
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const timestamp = now();
    const recent = (failures.get(key) || []).filter(value => timestamp - value < windowMs);
    failures.set(key, recent);
    if (recent.length >= maxAttempts) {
      return res.status(429).json({ error: '尝试次数过多，请稍后再试' });
    }

    const suppliedUser = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const suppliedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    // 两项都执行，避免因账号是否正确产生明显的响应时序差异。
    const usernameAccepted = safeTextEqual(suppliedUser, username.trim());
    const passwordAccepted = verifyJudgePassword(suppliedPassword, passwordHash);
    const accepted = usernameAccepted && passwordAccepted;
    if (!accepted) {
      recent.push(timestamp);
      failures.set(key, recent);
      return res.status(401).json({ error: '测试账号或密码不正确' });
    }

    failures.delete(key);
    const session = getSession(req, res);
    delete session.oauth;
    delete session.oauthConfirmation;
    delete session.oauthAttemptNonce;
    delete session.oauthStartedAt;
    session.user = createJudgeUser({ username, displayName });
    return res.json({
      ok: true,
      user: session.user,
      returnTo: safeReturnTo(req.body?.returnTo),
    });
  });

  return router;
}

function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value.slice(0, 1000);
}

function safeTextEqual(left, right) {
  const a = crypto.createHash('sha256').update(String(left)).digest();
  const b = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}
