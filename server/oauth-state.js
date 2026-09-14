import crypto from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function beginOAuth(session, now = Date.now()) {
  const state = crypto.randomBytes(32).toString('base64url');
  // 知乎当前授权页未声明 state 参数，因此 nonce 只保留在服务端会话；
  // 回调换到身份后，必须再用它完成一次同源 POST 确认，防止登录注入。
  session.oauthAttemptNonce = state;
  session.oauthStartedAt = now;
  return state;
}

export function consumeOAuth(session, now = Date.now()) {
  const expected = session.oauthAttemptNonce;
  const startedAt = session.oauthStartedAt;
  delete session.oauthAttemptNonce;
  delete session.oauthStartedAt;

  if (!expected || !startedAt) {
    throw oauthError('OAUTH_ATTEMPT_INVALID', '没有找到本次 OAuth 登录请求，请重新登录');
  }
  if (now - startedAt > OAUTH_STATE_TTL_MS) {
    throw oauthError('OAUTH_ATTEMPT_EXPIRED', 'OAuth 授权已超时，请重新登录');
  }
  return expected;
}

export function stageOAuthConfirmation(session, nonce, pendingLogin, now = Date.now()) {
  session.oauthConfirmation = {
    nonceHash: hash(nonce),
    pendingLogin,
    startedAt: now,
  };
}

export function confirmOAuth(session, returnedNonce, now = Date.now()) {
  const pending = session.oauthConfirmation;
  delete session.oauthConfirmation;

  if (!pending || !returnedNonce) {
    throw oauthError('OAUTH_CONFIRMATION_INVALID', 'OAuth 登录确认已失效，请重新登录');
  }
  if (now - pending.startedAt > OAUTH_STATE_TTL_MS) {
    throw oauthError('OAUTH_CONFIRMATION_EXPIRED', 'OAuth 登录确认已超时，请重新登录');
  }

  const actualBuffer = Buffer.from(hash(returnedNonce));
  const expectedBuffer = Buffer.from(pending.nonceHash);
  if (actualBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw oauthError('OAUTH_CONFIRMATION_INVALID', 'OAuth 登录确认无效，请重新登录');
  }
  return pending.pendingLogin;
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64url');
}

function oauthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
