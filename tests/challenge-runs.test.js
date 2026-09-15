import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJsonStore } from '../server/store.js';
import { computeArchetypes } from '../server/archetypes.js';
import { ChallengeRunService } from '../server/challenge-runs.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-runs-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createJsonStore(path.join(directory, 'store.json'));
  return {
    store,
    service: new ChallengeRunService({ store }),
    owner: { id: 'owner-1', nick: '沙盘主人' },
    visitor: { id: 'visitor-1', nick: '同行者' },
  };
}

function tray(x = 10) {
  return [{ instanceId: 'bridge-1', toyId: 'bridge', x, y: 20, scale: 1, rotation: 0 }];
}

function evidence(result = 'confirmed') {
  return [
    { observationId: 'a', archetypeId: 'boundary-keeper', dimension: 'change', result },
    { observationId: 'b', archetypeId: 'boundary-keeper', dimension: 'boundary', result },
    { observationId: 'c', archetypeId: 'boundary-keeper', dimension: 'change', result },
  ];
}

test('only confirmed cross-context evidence creates an archetype', () => {
  assert.equal(computeArchetypes(evidence())[0].id, 'boundary-keeper');
  assert.equal(computeArchetypes(evidence('rewritten'))[0].id, 'boundary-keeper');
  assert.deepEqual(computeArchetypes(evidence('situational')), []);
  assert.deepEqual(computeArchetypes(evidence().map(item => ({ ...item, dimension: 'change' }))), []);
});

test('challenge runs are owner-only', t => {
  const { service, owner, visitor } = fixture(t);
  const run = service.createRun(owner, {
    challengeId: '2026-09-15-change',
    initialSnapshot: tray(),
    selfNarrative: '桥代表新的机会。',
  });

  assert.throws(
    () => service.saveRound(visitor, run.id, 'approach', { dimension: 'change', before: tray(), after: tray(50), actions: [] }),
    error => error.status === 403,
  );
});

test('reflection recomputes objective movement instead of trusting a client diff', t => {
  const { service, owner } = fixture(t);
  const run = service.createRun(owner, { challengeId: 'daily-1', initialSnapshot: tray() });
  service.saveRound(owner, run.id, 'approach', {
    dimension: 'change',
    before: tray(),
    after: tray(50),
    actions: [{ type: 'move', instanceId: 'bridge-1' }],
    diff: { moved: [] },
  });

  const reflection = service.createReflection(owner, run.id);
  assert.match(reflection.observations[0].fact, /移动了 1 件沙具/);
  assert.deepEqual(reflection.observations[0].evidence, ['approach:moved:bridge-1']);
});

test('archetype privacy controls public visibility and matching eligibility', t => {
  const { store, service, owner } = fixture(t);
  store.update(data => data.challengeRuns.push({ ownerId: owner.id, confirmations: evidence() }));

  assert.equal(service.getProfile(owner).archetypes[0].isPublic, false);
  service.updateArchetypeSettings(owner, 'boundary-keeper', { isPublic: true, matchEligible: true });
  assert.equal(service.getPublicArchetypes(owner.id)[0].matchEligible, true);

  service.updateArchetypeSettings(owner, 'boundary-keeper', { isPublic: false, matchEligible: true });
  assert.deepEqual(service.getPublicArchetypes(owner.id), []);
  assert.equal(service.getProfile(owner).archetypes[0].matchEligible, false);
});
