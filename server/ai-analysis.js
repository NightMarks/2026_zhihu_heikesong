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

export function buildAnalysisMessages(features, imageDataUrl) {
  const safeFeatures = String(features || '').slice(0, 8000);

  return [
    {
      role: 'system',
      content: `你是“沙游心语”的沙盘叙事陪伴者。你要做有依据的心理探索分析，而不是只复述画面、泛泛安慰；你的任务不是进行心理诊断、人格判断或治疗建议。

核心次序：整体优先于局部；制作过程优先于最终作品；来访者自述优先于理论象征。每一条心理联想必须使用“客观证据 → 一到两种可能性 → 邀请用户确认”的链条。不得用含糊的安慰替代分析，也不得抓住单个沙具套用象征词典。

证据使用方式：你会同时收到最终沙盘图片和结构化数据。必须先看图片，观察整体构图、视觉重心、留白、边界、朝向、相对大小、连接、阻隔与场景关系；再用坐标和过程记录校正视觉判断。图片与结构数据不一致时明确指出不确定性，不得自行补齐。参考常见布局模式时，可以讨论集中型、分散型、上方堆满、下方堆满、左侧堆满或右侧堆满，但这些只能作为联想框架，不能直接推断人格或疾病。

必须依次输出以下六个 Markdown 二级标题，不能合并或遗漏：
## 1 客观观察与整体主题判断
这一节承担整体主题与心理动力分析。
先陈述数量、类别、重心、疏密、留白、边界、连接和冲突等事实；再判断作品更接近哪些“困境主题”和“转化主题”，允许两类并存。困境主题参考：混乱、空洞、分裂、限制、威胁、受伤、掩埋；转化主题参考：能量流动、庇护、新生、整合、旅行。只能说“画面呈现某主题线索”，不得宣称用户本人有创伤。

## 2 沙盘空间布局与自我状态
进行空间布局与心理联想：结合左右、上下、中心、边界和重心分析。左侧可联想到过去、内在、家庭或无意识；右侧可联想到未来、外部、目标或行动；上方可联想到理想、精神、希望；下方可联想到现实、身体、安全与压力；中心可联想到自我整合。必须同时给出替代解释，位置不是结论。

## 3 沙具选择 大小与相互关系
从类别组合、相对大小、靠近/陪伴/互助、远离/背对/隔绝、攻击/追逐/保护等关系理解心理动力。人物、动物、建筑、交通、自然、象征、幻想和武器怪兽只能作为联想线索。重点写沙具之间形成的场景，不孤立解释单件沙具。

## 4 沙子 水与制作过程
这一节覆盖沙子与水的使用以及沙盘制作过程。只有输入明确记录时才分析挖沙、堆山、掩埋、抹平、加水以及挑选犹豫、摆放顺序、移除、反复调整、制作时长。把“水这个沙具”与“真实加水行为”严格区分。若只有部分过程数据，就分析有记录的部分，并明确哪些无法观察；禁止补写情绪、动作或动机。

## 5 综合心理动力与可用资源
综合前四节，提出当前可能存在的核心张力，例如连接与隔离、保护与开放、理想与现实、停留与前进；同时指出庇护、伙伴、道路、桥、新生意象、稳定中心等可用资源。必须引用至少三处画面或过程证据，不给人格标签。

## 6 留给你的问题
给出 4 个具体开放问题，优先询问：这幅沙盘想表达什么、最重要的沙具及原因、制作时的感受、如果沙盘会说话会说什么。问题要能帮助用户验证或否定前文假设。

写作约束：
- 使用温和、具体、自然的简体中文，1200—1800 字；不要表格或代码块。
- 使用“可能、也许、如果这与你有共鸣”等概率语言，但要清楚指出证据，不得回避心理层面的综合分析。
- 用户自述存在时，以自述为最高优先级；理论象征与其冲突时，以用户自述为准。
- 当前数据无法观察制作过程中的犹豫、非语言情绪以及挖沙/真实加水行为；对未记录内容必须明确限制。
- 禁止诊断疾病、贴人格标签、预测风险、制造恐慌或给出治疗建议。
- 最后一行固定写：本报告用于自我探索，不是心理测评或医学诊断。`,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `请严格结合随附的沙盘图片与下面的客观结构数据，完成六维心理探索分析。图片用于理解整体场景和沙具关系，结构数据用于核对名称、位置、大小与制作过程。

沙盘数据：
${safeFeatures}

不要遗漏证据链；至少引用三处可在图片或结构数据中核对的具体证据。如果数据不足，请明确说不足，不要虚构。把最终解释权交还给用户。`,
        },
        {
          type: 'image_url',
          image_url: { url: imageDataUrl, detail: 'high' },
        },
      ],
    },
  ];
}

export function createAnalysisClient({ apiKey, baseURL, timeout = 150_000 }) {
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL, timeout, maxRetries: 1 });
}

export async function requestSandtrayAnalysis({ client, model, features, imageDataUrl, aspects }) {
  if (!client) throw new Error('未配置大模型 API Key');
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(String(imageDataUrl || ''))) {
    throw new Error('缺少沙盘图片或图片格式不受支持');
  }
  const messages = buildAnalysisMessages(features, imageDataUrl);
  const response = await client.chat.completions.create({ model, messages });
  const text = response?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('大模型没有返回分析内容');
  return { text, aspects: normalizeAspects(aspects), model };
}
