import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { CommunityService, createCommunityRouter } from '../server/community.js';
import { createJsonStore } from '../server/store.js';

test('community router allows public reading but rejects anonymous writes', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-router-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const service = new CommunityService(createJsonStore(path.join(directory, 'store.json')));
  const app = express();
  app.use(express.json());
  app.use('/api/community', createCommunityRouter({ service, getUser: () => null }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const listing = await fetch(`${origin}/api/community`);
  assert.equal(listing.status, 200);
  assert.deepEqual(await listing.json(), { items: [], nextCursor: null });

  const publishing = await fetch(`${origin}/api/community`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '不能发布' }),
  });
  assert.equal(publishing.status, 401);
  assert.match((await publishing.json()).error, /登录知乎/);

  const matching = await fetch(`${origin}/api/community/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tray: [{ toyId: 'bridge', x: 50, y: 50 }] }),
  });
  assert.equal(matching.status, 401);

  const requests = await fetch(`${origin}/api/community/friend-requests`);
  assert.equal(requests.status, 401);
});

test('community router supports matching and the friend request lifecycle', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-router-friends-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const service = new CommunityService(createJsonStore(path.join(directory, 'store.json')));
  const owner = { id: 'owner', nick: '桥边的人' };
  const visitor = { id: 'visitor', nick: '寻找共鸣的人' };
  let currentUser = owner;
  const publicWork = service.createWork(owner, {
    title: '河岸的桥',
    summary: '一条通向远处的路。',
    visibility: 'public',
    tray: [{ toyId: 'bridge', x: 52, y: 58 }],
  });
  service.createWork(owner, {
    title: '朋友之间',
    summary: '成为好友后才会出现。',
    visibility: 'friends',
    tray: [{ toyId: 'door', x: 60, y: 45 }],
  });

  const app = express();
  app.use(express.json());
  app.use('/api/community', createCommunityRouter({ service, getUser: () => currentUser }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  currentUser = visitor;
  const matching = await fetch(`${origin}/api/community/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tray: [{ toyId: 'bridge', x: 50, y: 60 }] }),
  });
  assert.equal(matching.status, 200);
  const matches = await matching.json();
  assert.equal(matches.items[0].work.id, publicWork.id);

  const sent = await fetch(`${origin}/api/community/${publicWork.id}/friend-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '桥的方向很相似。' }),
  });
  assert.equal(sent.status, 201);
  const request = await sent.json();

  currentUser = owner;
  const accepted = await fetch(`${origin}/api/community/friend-requests/${request.id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'accepted' }),
  });
  assert.equal(accepted.status, 200);

  currentUser = visitor;
  const listing = await fetch(`${origin}/api/community`);
  assert.equal(listing.status, 200);
  assert.equal((await listing.json()).items.length, 2);

  currentUser = owner;
  const deleted = await fetch(`${origin}/api/community/${publicWork.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true, id: publicWork.id });
});
