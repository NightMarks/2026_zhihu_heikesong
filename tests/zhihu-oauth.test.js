import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeUrl, oauthUserInfo } from '../server/zhihu.js';

test('authorizeUrl includes one-time OAuth state', () => {
  const url = new URL(authorizeUrl('504', 'https://game.example/auth/callback', 'secure-state'));
  assert.equal(url.origin + url.pathname, 'https://openapi.zhihu.com/authorize');
  assert.equal(url.searchParams.get('app_id'), '504');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://game.example/auth/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'secure-state');
});

test('oauthUserInfo maps the official Zhihu profile fields without relying on numeric uid', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 20000,
    data: {
      uid: 9223372036854775807,
      hash_id: 'stable-hash-id',
      fullname: '知乎测试用户',
      avatar_path: 'https://picx.zhimg.com/avatar.png',
      headline: '写作者',
      description: '个人简介',
      url: 'https://www.zhihu.com/people/stable-hash-id',
    },
  }));

  const profile = await oauthUserInfo('oauth-token');
  assert.equal(profile.urlToken, 'stable-hash-id');
  assert.equal(profile.nick, '知乎测试用户');
  assert.equal(profile.avatar, 'https://picx.zhimg.com/avatar.png');
  assert.equal(profile.description, '个人简介');
});
