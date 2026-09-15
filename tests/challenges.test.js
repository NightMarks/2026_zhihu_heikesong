import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJsonStore } from '../server/store.js';
import {
  DailyChallengeService,
  fallbackChallenge,
  isSafeHotTopic,
  themeForHotTopic,
} from '../server/challenges.js';

function fixture(t, generate) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-challenge-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return new DailyChallengeService({
    store: createJsonStore(path.join(directory, 'store.json')),
    generate,
  });
}

function generatedChallenge() {
  return {
    title: '给新变化留一个位置',
    primaryDimension: 'change',
    intro: '一个陌生元素将进入你的世界。',
    rounds: [
      { id: 'approach', type: 'approach', dimension: 'change', prompt: '让它进入。', constraints: { maxMoves: 3 } },
      { id: 'tradeoff', type: 'tradeoff', dimension: 'resource', prompt: '留下重要的。', constraints: { removeCount: 2 } },
      { id: 'relationship', type: 'relationship', dimension: 'relationship', prompt: '回应靠近。', constraints: { maxMoves: 3 } },
      { id: 'replay', type: 'replay', dimension: 'change', prompt: '主动接近未知。', constraints: { maxMoves: 3 } },
    ],
  };
}

test('unsafe Zhihu hot topics are excluded from challenge generation', () => {
  assert.equal(isSafeHotTopic({ title: '未成年人受害事件调查' }), false);
  assert.equal(isSafeHotTopic({ title: '地震死亡人数最新消息' }), false);
  assert.equal(isSafeHotTopic({ title: '人工智能进入课堂会带来哪些变化' }), true);
});

test('hot topics map to a neutral choice dimension', () => {
  assert.equal(themeForHotTopic({ title: '新技术进入日常生活，会发生哪些变化？' }).dimension, 'change');
  assert.equal(themeForHotTopic({ title: '怎样在有限时间里做取舍？' }).dimension, 'resource');
});

test('daily challenge remains stable for the same China date', async t => {
  let generations = 0;
  const service = fixture(t, async () => {
    generations += 1;
    return generatedChallenge();
  });

  const first = await service.getDaily({
    date: '2026-09-15',
    hotItems: [{ title: '人工智能进入课堂会带来哪些变化' }],
  });
  const second = await service.getDaily({
    date: '2026-09-15',
    hotItems: [{ title: '另一条安全内容' }],
  });

  assert.deepEqual(second, first);
  assert.equal(generations, 1);
  assert.equal(first.fallback, false);
  assert.equal(first.sourceTopic, '人工智能进入课堂会带来哪些变化');
});

test('invalid generated content falls back to an approved challenge', async t => {
  const service = fixture(t, async () => ({ title: '<script>alert(1)</script>' }));
  const result = await service.getDaily({ date: '2026-09-16', hotItems: [] });

  assert.deepEqual(result, fallbackChallenge('2026-09-16'));
  assert.equal(result.fallback, true);
  assert.equal(result.rounds.length, 4);
});
