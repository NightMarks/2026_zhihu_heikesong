import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const community = fs.readFileSync(new URL('../public/js/community.js', import.meta.url), 'utf8');
const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
const loginJs = fs.readFileSync(new URL('../public/js/login.js', import.meta.url), 'utf8');

test('publish button calls the split community module', () => {
  assert.match(html, /onclick="ShaYuCommunity\.confirmPublish\(\)"/);
  assert.doesNotMatch(html, /onclick="confirmPublish\(\)"/);
  assert.match(community, /confirmPublish,/);
});

test('home and report use the refreshed copy and Liu Kanshan loader', () => {
  assert.match(html, /今天，你想摆放点什么？/);
  assert.doesNotMatch(html, /今天，你的内心想摆放点什么/);
  assert.doesNotMatch(app, /站内写互动/);
  assert.match(app, /liukanshan-thinking\.png/);
  assert.doesNotMatch(app, /ouroboros-loader/);
  assert.match(app, /function formatAiReport/);
  assert.match(app, /formatAiReport\(r\.aiText\)/);
  const imageMap = app.match(/const TOY_IMAGES=\{[\s\S]*?\n\};/)?.[0] || '';
  assert.doesNotMatch(imageMap, /\.(?:jpg|png)'/);
});

test('journey gate opens a dedicated OAuth and judge login page', () => {
  assert.match(app, /\/login\.html\?returnTo=/);
  assert.match(loginHtml, /知乎 OAuth 登录/);
  assert.match(loginHtml, /评委体验账号/);
  assert.match(loginHtml, /name="username"/);
  assert.match(loginHtml, /name="password"/);
  assert.doesNotMatch(loginHtml, /JUDGE_LOGIN_PASSWORD/);
  assert.match(loginJs, /\/auth\/judge/);
  assert.match(loginJs, /judgeLoginReady/);
});
