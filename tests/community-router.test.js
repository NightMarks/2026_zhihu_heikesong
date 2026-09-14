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
});
