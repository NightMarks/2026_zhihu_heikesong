import crypto from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function beginOAuth(session, now = Date.now()) {
  const state = crypto.randomBytes(32).toString('base64url');
  session.oauthState = state;
  session.oauthStartedAt = now;
  return state;
}

export function consumeOAuth(session, returnedState, now = Date.now()) {
  const expected = session.oauthState;
  const startedAt = session.oauthStartedAt;
  delete session.oauthState;
  delete session.oauthStartedAt;

  if (!returnedState) throw oauthError('OAUTH_STATE_MISSING', 'OAuth 回调缺少 state');
  if (!expected || !startedAt) throw oauthError('OAUTH_STATE_INVALID', 'OAuth state 无效，请重新登录');
  if (now - startedAt > OAUTH_STATE_TTL_MS) {
    throw oauthError('OAUTH_STATE_EXPIRED', 'OAuth 授权已超时，请重新登录');
  }

  const actualBuffer = Buffer.from(String(returnedState));
  const expectedBuffer = Buffer.from(String(expected));
  if (actualBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw oauthError('OAUTH_STATE_INVALID', 'OAuth state 不匹配，请重新登录');
  }
  return true;
}

function oauthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
