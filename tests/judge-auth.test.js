import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  createJudgeAuthRouter,
  createJudgeUser,
  getJudgeData,
  hashJudgePassword,
  judgeAuthReady,
  verifyJudgePassword,
} from '../server/judge-auth.js';

test('judge password hashes verify without storing the plaintext password', () => {
  const encoded = hashJudgePassword('a-long-review-password', Buffer.alloc(16, 7));
  assert.match(encoded, /^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(encoded, /a-long-review-password/);
  assert.equal(verifyJudgePassword('a-long-review-password', encoded), true);
  assert.equal(verifyJudgePassword('wrong-password', encoded), false);
  assert.equal(verifyJudgePassword('anything', 'broken-hash'), false);
});

test('judge login is ready only when every server-side setting is present', () => {
  const passwordHash = hashJudgePassword('review-password', Buffer.alloc(16, 3));
  assert.equal(judgeAuthReady({ enabled: true, username: 'judge', passwordHash }), true);
  assert.equal(judgeAuthReady({ enabled: false, username: 'judge', passwordHash }), false);
  assert.equal(judgeAuthReady({ enabled: true, username: '', passwordHash }), false);
});

test('judge identity and demo profile data are clearly marked as review-only', () => {
  const user = createJudgeUser({ username: 'judge', displayName: '黑客松评委' });
  assert.equal(user.authType, 'judge');
  assert.equal(user.nick, '黑客松评委');
  assert.match(user.id, /^judge-/);

  const firstPage = getJudgeData('contents', { limit: 2, offset: 0 });
  assert.equal(firstPage.Items.length, 2);
  assert.equal(firstPage.Paging.IsEnd, false);
  assert.equal(firstPage.Paging.NextOffset, 2);
  assert.equal(firstPage.Items.every(item => item.IsDemo === true), true);

  const followees = getJudgeData('followees', { limit: 20, offset: 0 });
  assert.equal(followees.Paging.IsEnd, true);
  assert.equal(followees.Items.every(item => item.IsDemo === true), true);
});

test('judge login creates a session and rejects unsafe return URLs', async t => {
  const session = {};
  const passwordHash = hashJudgePassword('correct horse battery staple', Buffer.alloc(16, 9));
  const app = express();
  app.use(express.json());
  app.use('/auth/judge', createJudgeAuthRouter({
    enabled: true,
    username: 'shayu_judge',
    passwordHash,
    displayName: '评委体验账号',
    getSession: () => session,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(`${origin}/auth/judge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'shayu_judge', password: 'wrong' }),
  });
  assert.equal(denied.status, 401);
  assert.equal(session.user, undefined);

  const accepted = await fetch(`${origin}/auth/judge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'shayu_judge',
      password: 'correct horse battery staple',
      returnTo: 'https://evil.example/steal',
    }),
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).returnTo, '/');
  assert.equal(session.user.authType, 'judge');
  assert.equal(session.oauth, undefined);
});

test('judge login rate limits repeated failures', async t => {
  const app = express();
  app.use(express.json());
  app.use('/auth/judge', createJudgeAuthRouter({
    enabled: true,
    username: 'judge',
    passwordHash: hashJudgePassword('correct-password', Buffer.alloc(16, 4)),
    getSession: () => ({}),
    maxAttempts: 2,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fail = () => fetch(`${origin}/auth/judge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'judge', password: 'wrong' }),
  });

  assert.equal((await fail()).status, 401);
  assert.equal((await fail()).status, 401);
  assert.equal((await fail()).status, 429);
});
