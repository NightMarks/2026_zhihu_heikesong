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

test('home and report use the refreshed copy and ouroboros asset', () => {
  assert.match(html, /今天，你想摆放点什么？/);
  assert.doesNotMatch(html, /今天，你的内心想摆放点什么/);
  assert.doesNotMatch(app, /站内写互动/);
  assert.match(app, /168ad7adfda79d9bf130fcb38f5edc49\.jpg/);
});
