import crypto from 'node:crypto';
import express from 'express';
import { computeArchetypes } from './archetypes.js';

const DIMENSIONS = new Set(['change', 'boundary', 'relationship', 'resource', 'control']);
const RESULTS = new Set(['confirmed', 'situational', 'rejected', 'rewritten']);
const ACTIONS = new Set(['add', 'remove', 'move', 'scale', 'rotate', 'layer', 'clear']);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeTray(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) {
    throw httpError(400, '挑战沙盘必须包含 1—100 件沙具');
  }
  const seen = new Set();
  return input.map(item => {
    const instanceId = cleanText(item?.instanceId, 80);
    const toyId = cleanText(item?.toyId, 80);
    const x = Number(item?.x);
    const y = Number(item?.y);
    if (!instanceId || seen.has(instanceId) || !toyId || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw httpError(400, '挑战沙盘包含无效沙具');
    }
    seen.add(instanceId);
    return {
      instanceId,
      toyId,
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
      rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) % 360 : 0,
      scale: Number.isFinite(Number(item.scale)) ? Math.min(2, Math.max(0.5, Number(item.scale))) : 1,
    };
  });
}

function normalizeActions(input) {
  return (Array.isArray(input) ? input : []).slice(0, 200).flatMap(action => {
    if (!ACTIONS.has(action?.type)) return [];
    return [{ type: action.type, instanceId: cleanText(action.instanceId, 80) || null }];
  });
}

function calculateDiff(before, after, actions) {
  const left = new Map(before.map(item => [item.instanceId, item]));
  const right = new Map(after.map(item => [item.instanceId, item]));
  const moved = after.filter(item => {
    const previous = left.get(item.instanceId);
    return previous && Math.hypot(previous.x - item.x, previous.y - item.y) >= 2;
  });
  return {
    added: after.filter(item => !left.has(item.instanceId)).map(item => item.instanceId),
    removed: before.filter(item => !right.has(item.instanceId)).map(item => item.instanceId),
    moved: moved.map(item => item.instanceId),
    resized: after.filter(item => {
      const previous = left.get(item.instanceId);
      return previous && Math.abs(previous.scale - item.scale) >= 0.1;
    }).map(item => item.instanceId),
    rotated: after.filter(item => {
      const previous = left.get(item.instanceId);
      if (!previous) return false;
      const delta = Math.abs(previous.rotation - item.rotation) % 360;
      return Math.min(delta, 360 - delta) >= 5;
    }).map(item => item.instanceId),
    firstMeaningfulAction: actions[0] || null,
  };
}

function observationFor(round) {
  const counts = {
    added: round.diff.added.length,
    removed: round.diff.removed.length,
    moved: round.diff.moved.length,
    resized: round.diff.resized.length,
    rotated: round.diff.rotated.length,
  };
  const changes = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (!changes) {
    return {
      id: crypto.randomUUID(),
      dimension: round.dimension,
      archetypeId: null,
      evidence: [`${round.roundId}:unchanged`],
      fact: '这一轮提交前后，沙具的位置和构成没有出现可记录的变化。',
      possibilities: ['你可能希望维持当前状态', '你也可能还没有找到合适的表达方式'],
      question: '不改变沙盘更接近你的真实选择，还是这次题目不容易表达？',
    };
  }

  const factParts = [];
  if (counts.moved) factParts.push(`移动了 ${counts.moved} 件沙具`);
  if (counts.added) factParts.push(`加入了 ${counts.added} 件沙具`);
  if (counts.removed) factParts.push(`移走了 ${counts.removed} 件沙具`);
  if (counts.resized) factParts.push(`调整了 ${counts.resized} 件沙具的大小`);
  if (counts.rotated) factParts.push(`改变了 ${counts.rotated} 件沙具的方向`);

  let archetypeId = 'boundary-keeper';
  let possibilities = ['先确认条件再接近变化', '只是希望画面更有秩序'];
  if (round.dimension === 'relationship' && counts.moved) {
    archetypeId = 'active-connector';
    possibilities = ['倾向通过主动行动改变关系', '只是这个元素更方便移动'];
  } else if (round.dimension === 'resource' && counts.removed) {
    archetypeId = 'core-guardian';
    possibilities = ['会优先保护最重要的部分', '只是根据构图做了取舍'];
  } else if (changes >= 3) {
    archetypeId = 'order-rebuilder';
    possibilities = ['倾向重新组织整体来回应变化', '只是想尝试新的构图'];
  }

  const changedIds = [...round.diff.moved, ...round.diff.added, ...round.diff.removed];
  return {
    id: crypto.randomUUID(),
    dimension: round.dimension,
    archetypeId,
    evidence: changedIds.slice(0, 6).map(instanceId => {
      const kind = round.diff.moved.includes(instanceId)
        ? 'moved'
        : round.diff.added.includes(instanceId) ? 'added' : 'removed';
      return `${round.roundId}:${kind}:${instanceId}`;
    }),
    fact: `这一轮你${factParts.join('，')}。`,
    possibilities,
    question: '哪一种解释更接近你当时的想法？',
  };
}

export class ChallengeRunService {
  constructor({ store }) {
    this.store = store;
  }

  requireUser(user) {
    if (!user?.id) throw httpError(401, '请先登录知乎');
  }

  ownedRun(user, runId) {
    this.requireUser(user);
    const run = this.store.read(data => data.challengeRuns.find(item => item.id === runId));
    if (!run) throw httpError(404, '没有找到这次挑战');
    if (run.ownerId !== user.id) throw httpError(403, '不能访问他人的挑战记录');
    return run;
  }

  createRun(user, input) {
    this.requireUser(user);
    const challengeId = cleanText(input?.challengeId, 100);
    if (!challengeId) throw httpError(400, '缺少每日热题标识');
    const run = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      challengeId,
      status: 'in_progress',
      startedAt: Date.now(),
      completedAt: null,
      initialSnapshot: normalizeTray(input?.initialSnapshot),
      selfNarrative: cleanText(input?.selfNarrative, 500),
      rounds: [],
      reflection: null,
      confirmations: [],
    };
    this.store.update(data => data.challengeRuns.push(run));
    return structuredClone(run);
  }

  saveRound(user, runId, roundId, input) {
    const current = this.ownedRun(user, runId);
    if (current.status === 'complete') throw httpError(409, '这次挑战已经完成');
    const dimension = cleanText(input?.dimension, 30);
    if (!DIMENSIONS.has(dimension)) throw httpError(400, '观察维度无效');
    const before = normalizeTray(input?.before);
    const after = normalizeTray(input?.after);
    const actions = normalizeActions(input?.actions);
    const record = {
      roundId: cleanText(roundId, 40),
      dimension,
      startedAt: Number(input?.startedAt) || Date.now(),
      completedAt: Date.now(),
      before,
      after,
      actions,
      diff: calculateDiff(before, after, actions),
      skipped: false,
    };
    this.store.update(data => {
      const run = data.challengeRuns.find(item => item.id === runId);
      const index = run.rounds.findIndex(item => item.roundId === record.roundId);
      if (index >= 0) run.rounds[index] = record;
      else run.rounds.push(record);
      run.reflection = null;
      run.confirmations = [];
    });
    return structuredClone(record);
  }

  createReflection(user, runId) {
    const current = this.ownedRun(user, runId);
    if (!current.rounds.length) throw httpError(400, '请先完成至少一轮挑战');
    const reflection = {
      source: 'rules',
      observations: current.rounds.map(observationFor).slice(0, 4),
    };
    this.store.update(data => {
      const run = data.challengeRuns.find(item => item.id === runId);
      run.reflection = reflection;
      run.status = 'reflection';
    });
    return structuredClone(reflection);
  }

  confirmObservation(user, runId, input) {
    const current = this.ownedRun(user, runId);
    if (!RESULTS.has(input?.result)) throw httpError(400, '确认状态无效');
    const observation = current.reflection?.observations?.find(item => item.id === input?.observationId);
    if (!observation) throw httpError(400, '观察不属于这次挑战');
    const confirmation = {
      observationId: observation.id,
      archetypeId: observation.archetypeId,
      dimension: observation.dimension,
      result: input.result,
      userMeaning: cleanText(input?.userMeaning, 500),
      createdAt: Date.now(),
    };
    this.store.update(data => {
      const run = data.challengeRuns.find(item => item.id === runId);
      const index = run.confirmations.findIndex(item => item.observationId === confirmation.observationId);
      if (index >= 0) run.confirmations[index] = confirmation;
      else run.confirmations.push(confirmation);
      if (run.confirmations.length >= run.reflection.observations.length) {
        run.status = 'complete';
        run.completedAt = Date.now();
      }
    });
    return { confirmation, profile: this.getProfile(user) };
  }

  profileRecord(ownerId) {
    return this.store.read(data => data.choiceProfiles.find(item => item.ownerId === ownerId)) || {
      ownerId,
      settings: {},
    };
  }

  getProfile(user) {
    this.requireUser(user);
    const confirmations = this.store.read(data => data.challengeRuns
      .filter(run => run.ownerId === user.id)
      .flatMap(run => run.confirmations || []));
    const settings = this.profileRecord(user.id).settings || {};
    return {
      archetypes: computeArchetypes(confirmations).map(archetype => ({
        ...archetype,
        isPublic: Boolean(settings[archetype.id]?.isPublic),
        matchEligible: Boolean(settings[archetype.id]?.isPublic && settings[archetype.id]?.matchEligible),
      })),
      confirmationCount: confirmations.filter(item => ['confirmed', 'rewritten'].includes(item.result)).length,
    };
  }

  updateArchetypeSettings(user, archetypeId, input) {
    const profile = this.getProfile(user);
    if (!profile.archetypes.some(item => item.id === archetypeId)) throw httpError(404, '没有找到这个选择原型');
    const setting = {
      isPublic: Boolean(input?.isPublic),
      matchEligible: Boolean(input?.isPublic && input?.matchEligible),
    };
    this.store.update(data => {
      let record = data.choiceProfiles.find(item => item.ownerId === user.id);
      if (!record) {
        record = { ownerId: user.id, settings: {} };
        data.choiceProfiles.push(record);
      }
      record.settings[archetypeId] = setting;
    });
    return this.getProfile(user);
  }

  getPublicArchetypes(ownerId) {
    const confirmations = this.store.read(data => data.challengeRuns
      .filter(run => run.ownerId === ownerId)
      .flatMap(run => run.confirmations || []));
    const settings = this.profileRecord(ownerId).settings || {};
    return computeArchetypes(confirmations).flatMap(archetype => settings[archetype.id]?.isPublic
      ? [{ ...archetype, isPublic: true, matchEligible: Boolean(settings[archetype.id].matchEligible) }]
      : []);
  }

  deleteRecord(user, runId) {
    this.ownedRun(user, runId);
    this.store.update(data => {
      data.challengeRuns = data.challengeRuns.filter(run => run.id !== runId);
    });
    return { deleted: true, id: runId, profile: this.getProfile(user) };
  }
}

export function createChallengeRunRouter({ service, getUser }) {
  const router = express.Router();
  const handle = action => (req, res) => {
    try { action(req, res); }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : '每日热题服务暂时不可用' }); }
  };

  router.get('/profile', handle((req, res) => res.json(service.getProfile(getUser(req, res)))));
  router.patch('/profile/archetypes/:id', handle((req, res) => {
    res.json(service.updateArchetypeSettings(getUser(req, res), req.params.id, req.body));
  }));
  router.delete('/profile/records/:id', handle((req, res) => {
    res.json(service.deleteRecord(getUser(req, res), req.params.id));
  }));
  router.post('/', handle((req, res) => {
    res.status(201).json(service.createRun(getUser(req, res), req.body));
  }));
  router.patch('/:id/rounds/:roundId', handle((req, res) => {
    res.json(service.saveRound(getUser(req, res), req.params.id, req.params.roundId, req.body));
  }));
  router.post('/:id/reflection', handle((req, res) => {
    res.json(service.createReflection(getUser(req, res), req.params.id));
  }));
  router.post('/:id/confirmations', handle((req, res) => {
    res.json(service.confirmObservation(getUser(req, res), req.params.id, req.body));
  }));
  return router;
}
