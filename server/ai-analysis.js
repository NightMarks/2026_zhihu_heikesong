import OpenAI from 'openai';

export const ANALYSIS_ASPECTS = Object.freeze([
  { id: 'narrative', label: '整体主题与故事线', hint: '观察沙盘像在讲述怎样的场景与进程' },
  { id: 'relationships', label: '角色关系与边界', hint: '关注人物、群体、距离、连接与保护' },
  { id: 'space', label: '空间布局与视觉重心', hint: '观察中心、四周、疏密、留白与方向' },
  { id: 'emotion', label: '情绪氛围与张力', hint: '描述画面带来的感受，不替用户下结论' },
  { id: 'resources', label: '支持资源与内在力量', hint: '寻找庇护、伙伴、通路与可用的力量' },
  { id: 'change', label: '变化线索与下一幕', hint: '探索冲突、过渡以及故事可能如何继续' },
  { id: 'reflection', label: '开放式自我探索问题', hint: '生成帮助用户自行赋予意义的问题' },
]);

export const DEFAULT_ASPECTS = Object.freeze(['narrative', 'space', 'reflection']);
const VALID_ASPECTS = new Set(ANALYSIS_ASPECTS.map(item => item.id));

export function normalizeAspects(input) {
  if (!Array.isArray(input)) return [...DEFAULT_ASPECTS];
  const unique = [...new Set(input.filter(id => typeof id === 'string' && VALID_ASPECTS.has(id)))];
  return unique.length ? unique.slice(0, 4) : [...DEFAULT_ASPECTS];
}

export function buildAnalysisMessages(features, aspectIds) {
  const selected = normalizeAspects(aspectIds);
  const labels = selected.map(id => ANALYSIS_ASPECTS.find(item => item.id === id)?.label).filter(Boolean);
  const safeFeatures = String(features || '').slice(0, 8000);

  return [
    {
      role: 'system',
      content: `你是“沙游心语”的沙盘叙事陪伴者。你的任务是帮助用户观察自己的作品，而不是进行心理诊断、人格判断或治疗建议。

必须遵守：
1. 只依据提供的沙具、位置、数量和结构数据作答，不虚构用户经历。
2. 把“客观观察”“可能的联想”“邀请用户思考的问题”清楚区分。
3. 使用“也许、可能、你可以感受一下”等开放表达，不把象征解释成标准答案。
4. 禁止诊断疾病、推断创伤、贴人格标签、预测风险，禁止制造恐慌。
5. 不引用心理量表，不声称结果科学有效；必要时提醒这不是心理测评。
6. 使用温和、具体、自然的简体中文，总长控制在 600—900 字。
7. 只分析用户选择的方向，每个方向使用一个清晰小标题；最后以“留给你的问题”结束，并给出 3 个开放问题。
8. 不要输出 Markdown 表格、代码块、免责声明套话或与沙盘无关的内容。`,
    },
    {
      role: 'user',
      content: `请根据下面的客观沙盘数据进行分析。

用户选择的分析方向：${labels.join('、')}

沙盘数据：
${safeFeatures}

请让各部分互相连贯，先描述看见的结构，再提供非确定性的联想，最后把解释权交还给用户。`,
    },
  ];
}

export function createAnalysisClient({ apiKey, baseURL, timeout = 60_000 }) {
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL, timeout, maxRetries: 1 });
}

export async function requestSandtrayAnalysis({ client, model, features, aspects }) {
  if (!client) throw new Error('未配置大模型 API Key');
  const messages = buildAnalysisMessages(features, aspects);
  const response = await client.chat.completions.create({ model, messages });
  const text = response?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('大模型没有返回分析内容');
  return { text, aspects: normalizeAspects(aspects), model };
}
