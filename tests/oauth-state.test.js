import test from 'node:test';
import assert from 'node:assert/strict';
import { beginOAuth, consumeOAuth, OAUTH_STATE_TTL_MS } from '../server/oauth-state.js';

test('OAuth state is random and consumed exactly once', () => {
  const session = {};
  const state = beginOAuth(session, 1_000);
  assert.match(state, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(consumeOAuth(session, state, 2_000), true);
  assert.throws(() => consumeOAuth(session, state, 2_001), error => error.code === 'OAUTH_STATE_INVALID');
});

test('OAuth state rejects missing, mismatched, and expired callbacks', () => {
  const missing = {};
  beginOAuth(missing, 1_000);
  assert.throws(() => consumeOAuth(missing, '', 2_000), error => error.code === 'OAUTH_STATE_MISSING');

  const mismatch = {};
  beginOAuth(mismatch, 1_000);
  assert.throws(() => consumeOAuth(mismatch, 'wrong', 2_000), error => error.code === 'OAUTH_STATE_INVALID');

  const expired = {};
  const state = beginOAuth(expired, 1_000);
  assert.throws(
    () => consumeOAuth(expired, state, 1_000 + OAUTH_STATE_TTL_MS + 1),
    error => error.code === 'OAUTH_STATE_EXPIRED',
  );
});
