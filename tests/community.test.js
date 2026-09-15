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
  const store = createJsonStore(path.join(directory, 'store.json'));
  const service = new CommunityService(store);
  const owner = { id: 'owner-1', nick: '沙盘主人', avatar: null };
  const visitor = { id: 'visitor-1', nick: '同行者', avatar: null };
  const input = {
    title: '桥的另一边',
    summary: '一座桥连接着两片区域。',
    visibility: 'public',
    anonymous: false,
    tray: [{ toyId: 'bridge', x: 50, y: 60 }],
  };
  return { store, service, owner, visitor, input };
}

function seedArchetype(store, ownerId, { isPublic = true, matchEligible = true } = {}) {
  store.update(data => {
    data.challengeRuns.push({
      ownerId,
      confirmations: [
        { observationId: `${ownerId}-1`, archetypeId: 'boundary-keeper', dimension: 'change', result: 'confirmed' },
        { observationId: `${ownerId}-2`, archetypeId: 'boundary-keeper', dimension: 'boundary', result: 'confirmed' },
        { observationId: `${ownerId}-3`, archetypeId: 'boundary-keeper', dimension: 'change', result: 'confirmed' },
      ],
    });
    data.choiceProfiles.push({
      ownerId,
      settings: { 'boundary-keeper': { isPublic, matchEligible } },
    });
  });
}

function createLegacyStoreFile(t, data) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'store.json');
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  return file;
}

test('legacy stores gain challenge collections without losing community data', t => {
  const legacyWork = { id: 'legacy-work' };
  const file = createLegacyStoreFile(t, {
    version: 1,
    works: [legacyWork],
    friendRequests: [],
    friendships: [],
  });
  const store = createJsonStore(file);

  assert.deepEqual(store.read(data => data.works), [legacyWork]);
  assert.deepEqual(store.read(data => data.dailyChallenges), []);
  assert.deepEqual(store.read(data => data.challengeRuns), []);
  assert.deepEqual(store.read(data => data.choiceProfiles), []);
});

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

test('sandtray matching ranks structurally similar public works first', t => {
  const { service, input } = fixture(t);
  const closeOwner = { id: 'close-owner', nick: '桥边的人' };
  const farOwner = { id: 'far-owner', nick: '山里的人' };
  const seeker = { id: 'seeker', nick: '寻找共鸣的人' };
  const close = service.createWork(closeOwner, {
    ...input,
    title: '门与桥',
    tray: [
      { toyId: 'bridge', x: 48, y: 55 },
      { toyId: 'door', x: 65, y: 50 },
      { toyId: 'cabin', x: 30, y: 58 },
    ],
    aspects: ['relationships', 'change'],
  });
  service.createWork(farOwner, {
    ...input,
    title: '龙与剑',
    tray: [
      { toyId: 'dragon', x: 10, y: 10 },
      { toyId: 'sword', x: 90, y: 90 },
    ],
    aspects: ['emotion'],
  });

  const matches = service.findMatches(seeker.id, {
    tray: [
      { toyId: 'bridge', x: 50, y: 60 },
      { toyId: 'key', x: 65, y: 48 },
      { toyId: 'castle', x: 28, y: 55 },
    ],
    aspects: ['relationships', 'change'],
  });

  assert.equal(matches[0].work.id, close.id);
  assert.ok(matches[0].score > matches[1].score);
  assert.ok(matches[0].reasons.some(reason => reason.includes('象征类')));

  const withoutTags = service.findMatches(seeker.id, {
    tray: [
      { toyId: 'bridge', x: 50, y: 60 },
      { toyId: 'key', x: 65, y: 48 },
      { toyId: 'castle', x: 28, y: 55 },
    ],
    aspects: ['relationships', 'change'],
    archetypeIds: [],
  });
  assert.deepEqual(withoutTags.map(match => match.score), matches.map(match => match.score));
});

test('challenge works expose only archetypes the owner keeps public', t => {
  const { store, service, owner, input } = fixture(t);
  seedArchetype(store, owner.id);
  const work = service.createWork(owner, {
    ...input,
    challenge: { id: 'daily-1', title: '为未知留一个位置' },
    mirrorCard: { title: '先留一条退路', confirmedText: '我会先确认边界。' },
    archetypeIds: ['boundary-keeper'],
  });

  assert.equal(work.challenge.id, 'daily-1');
  assert.deepEqual(work.publicArchetypes.map(item => item.id), ['boundary-keeper']);

  store.update(data => {
    data.choiceProfiles[0].settings['boundary-keeper'] = { isPublic: false, matchEligible: false };
  });
  assert.deepEqual(service.getWork(work.id, owner.id).publicArchetypes, []);
});

test('opt-in archetypes add a separate matching reason', t => {
  const { store, service, input } = fixture(t);
  const owner = { id: 'tag-owner', nick: '守望者' };
  const seeker = { id: 'tag-seeker', nick: '寻找者' };
  seedArchetype(store, owner.id);
  seedArchetype(store, seeker.id);
  service.createWork(owner, { ...input, archetypeIds: ['boundary-keeper'] });

  const [match] = service.findMatches(seeker.id, {
    tray: input.tray,
    aspects: [],
    archetypeIds: ['boundary-keeper'],
  });

  assert.ok(match.reasons.includes('主动公开的选择原型相近'));
  assert.equal(match.scoreBreakdown.archetype, 100);
});

test('accepted friend requests unlock friends-only works', t => {
  const { service, owner, visitor, input } = fixture(t);
  const publicWork = service.createWork(owner, input);
  service.createWork(owner, { ...input, title: '只和朋友分享', visibility: 'friends' });
  assert.equal(service.listWorks(visitor.id).items.length, 1);

  const request = service.sendFriendRequest(publicWork.id, visitor, '我们的沙盘很有共鸣。');
  assert.equal(service.listFriendRequests(owner).incoming[0].id, request.id);
  assert.throws(
    () => service.sendFriendRequest(publicWork.id, visitor, '重复申请'),
    error => error.status === 409,
  );
  assert.throws(
    () => service.respondFriendRequest(request.id, visitor, 'accepted'),
    error => error.status === 403,
  );

  service.respondFriendRequest(request.id, owner, 'accepted');
  assert.equal(service.listWorks(visitor.id).items.length, 2);
  assert.equal(service.listFriendRequests(visitor).outgoing[0].status, 'accepted');
});

test('only the owner can delete a published sandtray', t => {
  const { service, owner, visitor, input } = fixture(t);
  const work = service.createWork(owner, input);
  service.sendFriendRequest(work.id, visitor, '想认识你。');

  assert.throws(
    () => service.deleteWork(work.id, visitor.id),
    error => error.status === 403,
  );
  assert.deepEqual(service.deleteWork(work.id, owner.id), { deleted: true, id: work.id });
  assert.equal(service.listWorks(owner.id).items.length, 0);
  assert.equal(service.listFriendRequests(owner).incoming.length, 0);
});
