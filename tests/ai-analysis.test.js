import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ASPECTS,
  buildAnalysisMessages,
  normalizeAspects,
  requestSandtrayAnalysis,
} from '../server/ai-analysis.js';

test('normalizeAspects always returns every analysis dimension', () => {
  assert.deepEqual(normalizeAspects(['space']), [...DEFAULT_ASPECTS]);
  assert.deepEqual(normalizeAspects([]), [...DEFAULT_ASPECTS]);
  assert.deepEqual(normalizeAspects('space'), [...DEFAULT_ASPECTS]);
});

const SAMPLE_IMAGE = 'data:image/jpeg;base64,c2FuZHRyYXk=';

test('analysis prompt combines the sandtray image with every psychological dimension', () => {
  const messages = buildAnalysisMessages('沙具总数：3 件\n使用的沙具：桥、孩子、树', SAMPLE_IMAGE);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /不是进行心理诊断/);
  assert.match(messages[0].content, /禁止诊断疾病/);
  assert.match(messages[0].content, /整体主题与心理动力/);
  assert.match(messages[0].content, /空间布局与心理联想/);
  assert.match(messages[0].content, /无法观察制作过程/);
  assert.match(messages[0].content, /整体主题判断/);
  assert.match(messages[0].content, /沙子与水的使用/);
  assert.match(messages[0].content, /沙盘制作过程/);
  assert.match(messages[0].content, /证据.*可能性.*确认/);
  assert.match(messages[0].content, /不得用含糊的安慰替代分析/);
  assert.match(messages[0].content, /来访者自述优先/);
  assert.match(messages[0].content, /集中型.*分散型/);
  assert.ok(Array.isArray(messages[1].content));
  assert.match(messages[1].content[0].text, /桥、孩子、树/);
  assert.deepEqual(messages[1].content[1], {
    type: 'image_url',
    image_url: { url: SAMPLE_IMAGE, detail: 'high' },
  });
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
    imageDataUrl: SAMPLE_IMAGE,
    aspects: ['space'],
  });

  assert.equal(request.model, 'gpt-5.6-sol');
  assert.equal(request.messages.length, 2);
  assert.equal(request.messages[1].content[1].image_url.url, SAMPLE_IMAGE);
  assert.equal(result.text, '一段温和的观察。');
  assert.deepEqual(result.aspects, [...DEFAULT_ASPECTS]);
});

test('requestSandtrayAnalysis rejects an empty model response', async () => {
  const client = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: '' } }] }) } },
  };
  await assert.rejects(
    requestSandtrayAnalysis({ client, model: 'gpt-5.6-sol', features: '沙盘', imageDataUrl: SAMPLE_IMAGE, aspects: ['space'] }),
    /没有返回分析内容/,
  );
});

test('requestSandtrayAnalysis requires a real sandtray image', async () => {
  const client = { chat: { completions: { create: async () => ({ choices: [] }) } } };
  await assert.rejects(
    requestSandtrayAnalysis({ client, model: 'gpt-5.6-sol', features: '沙盘' }),
    /缺少沙盘图片/,
  );
});
