import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CommunityService } from '../server/community.js';
import { createJsonStore } from '../server/store.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-community-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const service = new CommunityService(createJsonStore(path.join(directory, 'store.json')));
  const owner = { id: 'owner-1', nick: '沙盘主人', avatar: null };
  const visitor = { id: 'visitor-1', nick: '同行者', avatar: null };
  const input = {
    title: '桥的另一边',
    summary: '一座桥连接着两片区域。',
    visibility: 'public',
    anonymous: false,
    tray: [{ toyId: 'bridge', x: 50, y: 60 }],
  };
  return { service, owner, visitor, input };
}

test('public works are shared while private and friends works remain owner-only', t => {
  const { service, owner, visitor, input } = fixture(t);
  service.createWork(owner, input);
  service.createWork(owner, { ...input, title: '私人沙盘', visibility: 'private' });
  service.createWork(owner, { ...input, title: '好友沙盘', visibility: 'friends' });

  assert.equal(service.listWorks(visitor.id).items.length, 1);
  assert.equal(service.listWorks(owner.id).items.length, 3);
  assert.equal(service.listWorks(owner.id, { filter: 'mine' }).items.length, 3);
});

test('likes, collections and comments persist for other viewers', t => {
  const { service, owner, visitor, input } = fixture(t);
  const work = service.createWork(owner, input);
  service.toggleReaction(work.id, visitor.id, 'likedBy');
  service.toggleReaction(work.id, visitor.id, 'collectedBy');
  service.addComment(work.id, visitor, '我也在桥边停留了一会儿。');

  const ownerView = service.getWork(work.id, owner.id);
  const visitorView = service.getWork(work.id, visitor.id);
  assert.equal(ownerView.likes, 1);
  assert.equal(ownerView.collects, 1);
  assert.equal(ownerView.comments[0].author, '同行者');
  assert.equal(visitorView.liked, true);
  assert.equal(visitorView.collected, true);
});

test('community listing uses a stable cursor', t => {
  const { service, owner, input } = fixture(t);
  for (let i = 0; i < 3; i += 1) service.createWork(owner, { ...input, title: `作品 ${i}` });
  const first = service.listWorks(owner.id, { limit: 2 });
  const second = service.listWorks(owner.id, { limit: 2, cursor: first.nextCursor });
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 1);
  assert.notEqual(first.items[1].id, second.items[0].id);
});

test('a corrupt store becomes read-only instead of overwriting user data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-corrupt-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'store.json');
  fs.writeFileSync(file, '{broken json', 'utf8');
  const store = createJsonStore(file);
  assert.equal(store.readOnly, true);
  assert.throws(() => store.update(() => {}), /禁止写入/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken json');
});
