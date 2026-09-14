import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ASPECTS,
  buildAnalysisMessages,
  normalizeAspects,
  requestSandtrayAnalysis,
} from '../server/ai-analysis.js';

test('normalizeAspects keeps valid unique choices and limits selection to four', () => {
  assert.deepEqual(
    normalizeAspects(['space', 'space', 'emotion', 'unknown', 'resources', 'change', 'reflection']),
    ['space', 'emotion', 'resources', 'change'],
  );
  assert.deepEqual(normalizeAspects([]), [...DEFAULT_ASPECTS]);
  assert.deepEqual(normalizeAspects('space'), [...DEFAULT_ASPECTS]);
});

test('analysis prompt includes selected directions and non-diagnostic guardrails', () => {
  const messages = buildAnalysisMessages('沙具总数：3 件\n使用的沙具：桥、孩子、树', ['relationships', 'change']);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /不是进行心理诊断/);
  assert.match(messages[0].content, /禁止诊断疾病/);
  assert.match(messages[1].content, /角色关系与边界/);
  assert.match(messages[1].content, /变化线索与下一幕/);
  assert.match(messages[1].content, /桥、孩子、树/);
});

test('requestSandtrayAnalysis uses configured model and returns trimmed content', async () => {
  let request;
  const client = {
    chat: {
      completions: {
        create: async body => {
          request = body;
          return { choices: [{ message: { content: '  一段温和的观察。  ' } }] };
        },
      },
    },
  };

  const result = await requestSandtrayAnalysis({
    client,
    model: 'gpt-5.6-sol',
    features: '沙具总数：1 件',
    aspects: ['space'],
  });

  assert.equal(request.model, 'gpt-5.6-sol');
  assert.equal(request.messages.length, 2);
  assert.equal(result.text, '一段温和的观察。');
  assert.deepEqual(result.aspects, ['space']);
});

test('requestSandtrayAnalysis rejects an empty model response', async () => {
  const client = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: '' } }] }) } },
  };
  await assert.rejects(
    requestSandtrayAnalysis({ client, model: 'gpt-5.6-sol', features: '沙盘', aspects: ['space'] }),
    /没有返回分析内容/,
  );
});
