import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const community = fs.readFileSync(new URL('../public/js/community.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
const loginJs = fs.readFileSync(new URL('../public/js/login.js', import.meta.url), 'utf8');
const state = fs.readFileSync(new URL('../public/js/state.js', import.meta.url), 'utf8');

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

test('daily challenge routes are exposed to the browser client', () => {
  assert.match(server, /app\.get\('\/api\/challenges\/daily'/);
  assert.match(server, /app\.use\('\/api\/challenge-runs'/);
  assert.match(api, /dailyChallenge:\s*\(\)\s*=>\s*request\('\/api\/challenges\/daily'\)/);
  assert.match(api, /createChallengeRun:/);
  assert.match(api, /saveChallengeRound:/);
  assert.match(api, /createChallengeReflection:/);
  assert.match(api, /confirmChoiceObservation:/);
  assert.match(api, /choiceProfile:/);
  assert.match(api, /updateArchetypeSettings:/);
});

test('daily hot topic is a parallel homepage mode that reuses the tray editor', () => {
  assert.match(html, /data-view="report">沙盘报告<\/button>\s*<button data-view="challenge">每日热题<\/button>/);
  assert.match(html, /id="view-challenge"/);
  assert.match(html, /id="challenge-tray-banner"/);
  assert.ok(html.indexOf('js/tray-diff.js') < html.indexOf('js/challenge.js'));
  assert.ok(html.indexOf('js/challenge.js') < html.indexOf('app.js'));
  assert.match(app, /ShaYuChallenge\.init\(/);
  assert.match(app, /snapshotTray/);
  assert.match(app, /ShaYuChallenge\.recordAction\(action\)/);
  assert.match(state, /challengeDraft:\s*null/);
  assert.match(state, /choiceProfileCache:\s*null/);
});

test('challenge results reuse community publishing and optional archetype matching', () => {
  assert.match(html, /id="publish-archetypes"/);
  assert.match(community, /challengeResult/);
  assert.match(community, /publicArchetypes/);
  assert.match(community, /archetypeIds/);
  assert.match(community, /match-archetypes/);
  assert.match(community, /近期选择方式，会随新记录变化，不是心理诊断/);
});

test('starting a normal report clears stale daily challenge metadata', () => {
  const goReport = app.match(/function goReport\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(goReport, /state\.challengeResult=null/);
});
