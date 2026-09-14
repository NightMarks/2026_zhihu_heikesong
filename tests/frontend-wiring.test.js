import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const community = fs.readFileSync(new URL('../public/js/community.js', import.meta.url), 'utf8');

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
