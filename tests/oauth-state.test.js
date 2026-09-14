import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginOAuth,
  consumeOAuth,
  confirmOAuth,
  stageOAuthConfirmation,
  OAUTH_STATE_TTL_MS,
} from '../server/oauth-state.js';

test('OAuth login attempt keeps a private nonce and is consumed exactly once', () => {
  const session = {};
  const nonce = beginOAuth(session, 1_000);
  assert.match(nonce, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(consumeOAuth(session, 2_000), nonce);
  assert.throws(() => consumeOAuth(session, 2_001), error => error.code === 'OAUTH_ATTEMPT_INVALID');
});

test('OAuth login attempt rejects missing and expired callbacks', () => {
  assert.throws(
    () => consumeOAuth({}, 1_000),
    error => error.code === 'OAUTH_ATTEMPT_INVALID',
  );

  const expired = {};
  beginOAuth(expired, 1_000);
  assert.throws(
    () => consumeOAuth(expired, 1_000 + OAUTH_STATE_TTL_MS + 1),
    error => error.code === 'OAUTH_ATTEMPT_EXPIRED',
  );
});

test('OAuth identity is activated only after a same-origin confirmation token', () => {
  const session = {};
  const nonce = beginOAuth(session, 1_000);
  const confirmationNonce = consumeOAuth(session, 2_000);
  const pendingLogin = {
    oauth: { token: 'oauth-token', expiresAt: 99_000 },
    user: { id: 'user-1', nick: '测试用户' },
    returnTo: '/game',
  };
  stageOAuthConfirmation(session, confirmationNonce, pendingLogin, 2_000);

  assert.throws(
    () => confirmOAuth(session, 'wrong-token', 2_001),
    error => error.code === 'OAUTH_CONFIRMATION_INVALID',
  );

  stageOAuthConfirmation(session, nonce, pendingLogin, 2_002);
  assert.deepEqual(confirmOAuth(session, nonce, 2_003), pendingLogin);
  assert.throws(
    () => confirmOAuth(session, nonce, 2_004),
    error => error.code === 'OAUTH_CONFIRMATION_INVALID',
  );
});
