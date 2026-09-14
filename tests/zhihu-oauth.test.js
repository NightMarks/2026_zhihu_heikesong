import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeUrl } from '../server/zhihu.js';

test('authorizeUrl includes one-time OAuth state', () => {
  const url = new URL(authorizeUrl('504', 'https://game.example/auth/callback', 'secure-state'));
  assert.equal(url.origin + url.pathname, 'https://openapi.zhihu.com/authorize');
  assert.equal(url.searchParams.get('app_id'), '504');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://game.example/auth/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'secure-state');
});
