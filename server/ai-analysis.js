import OpenAI from 'openai';

export const ANALYSIS_ASPECTS = Object.freeze([
  { id: 'observation', label: '客观画面观察', hint: '数量、类别、重心、疏密与留白' },
  { id: 'narrative', label: '整体主题与心理动力', hint: '困境、转化、庇护、连接与旅程线索' },
  { id: 'space', label: '空间布局与心理联想', hint: '中心、边界、上下左右与现实理想' },
  { id: 'relationships', label: '角色关系与心理边界', hint: '靠近、隔离、连接、冲突与支持' },
  { id: 'emotion', label: '情绪氛围与防御线索', hint: '紧张、空白、秩序、威胁和保护意象' },
  { id: 'resources', label: '内在资源与成长力量', hint: '庇护、伙伴、道路、新生与可用力量' },
  { id: 'change', label: '变化方向与下一幕', hint: '过渡、整合、行动方向和新的可能' },
  { id: 'reflection', label: '开放式自我探索问题', hint: '把最终解释权交还给用户' },
]);

export const DEFAULT_ASPECTS = Object.freeze(ANALYSIS_ASPECTS.map(item => item.id));

export function normalizeAspects() {
  return [...DEFAULT_ASPECTS];
}

export function buildAnalysisMessages(features) {
  const safeFeatures = String(features || '').slice(0, 8000);

  return [
    {
      role: 'system',
      content: `你是“沙游心语”的沙盘叙事陪伴者。你的任务是帮助用户观察自己的作品，而不是进行心理诊断、人格判断或治疗建议。

分析框架来自沙盘工作的整体性、个体化、过程性和非诊断原则。必须遵守：
1. 先写“客观画面观察”，只描述可见的沙具、数量、位置、距离、疏密与留白。
2. 完整分析以下方面：整体主题与心理动力、空间布局与心理联想、角色关系与心理边界、情绪氛围与防御线索、内在资源与成长力量、变化方向与下一幕。
3. 主题可以讨论混乱、空洞、分隔、限制、威胁等困境线索，也可以讨论流动、庇护、新生、整合、旅行等转化线索；这些都只能写成待用户确认的可能性，不得宣称用户有创伤。
4. 空间联想仅作为提问框架：左侧可能关联过去或内在，右侧可能关联未来或外部，上方可能关联理想或精神，下方可能关联现实、身体或安全，中心可能关联自我整合。不得把位置当成结论。
5. 重点观察沙具之间的关系与整幅作品，不使用“一个沙具等于一种心理”的词典式断言。用户自己的感受与解释优先于理论象征。
6. 当前数据无法观察制作过程、犹豫与修改时的情绪，也无法判断挖沙、掩埋、加水等行为；必须明确这些限制，禁止补写不存在的过程。
7. 使用“也许、可能、如果这与你有共鸣”等开放表达。禁止诊断疾病、贴人格标签、预测风险、制造恐慌或给出治疗建议。
8. 使用温和、具体、自然的简体中文，总长控制在 900—1300 字。每个方面使用清晰的 Markdown 小标题，最后以“留给你的问题”结束并给出 4 个开放问题。
9. 开头不写免责声明套话，结尾用一句简短提醒说明本报告不是心理测评或诊断。不要输出表格或代码块。`,
    },
    {
      role: 'user',
      content: `请根据下面的客观沙盘数据进行分析。

沙盘数据：
${safeFeatures}

请生成一份完整、连贯的心理探索报告：先描述看见的结构，再提供非确定性的心理联想，并把最终解释权交还给用户。`,
    },
  ];
}

export function createAnalysisClient({ apiKey, baseURL, timeout = 60_000 }) {
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL, timeout, maxRetries: 1 });
}

export async function requestSandtrayAnalysis({ client, model, features, aspects }) {
  if (!client) throw new Error('未配置大模型 API Key');
  const messages = buildAnalysisMessages(features);
  const response = await client.chat.completions.create({ model, messages });
  const text = response?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('大模型没有返回分析内容');
  return { text, aspects: normalizeAspects(aspects), model };
}
