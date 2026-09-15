import { normalizeChallenge } from './challenge-schema.js';

const UNSAFE_TOPIC = /自杀|自残|自伤|死亡|身亡|遇难|地震|洪水|火灾|爆炸|灾难|重病|癌症|绝症|医疗求助|未成年人.{0,8}(受害|侵害)|儿童.{0,8}(受害|侵害)|性侵|强奸|家暴|家庭暴力|暴力事件|公共安全|失踪|指控|实名举报/i;

const THEMES = Object.freeze([
  { dimension: 'resource', pattern: /取舍|有限|预算|时间|资源|选择|保留/, label: '资源与取舍' },
  { dimension: 'relationship', pattern: /关系|朋友|同事|家庭|相处|沟通|合作|连接/, label: '关系与连接' },
  { dimension: 'boundary', pattern: /边界|隐私|距离|拒绝|空间|规则/, label: '边界与空间' },
  { dimension: 'control', pattern: /计划|秩序|失控|调整|安排|效率/, label: '控制与调整' },
  { dimension: 'change', pattern: /变化|改变|新|进入|转型|未来|人工智能|科技|趋势/, label: '变化与未知' },
]);

export function isSafeHotTopic(item) {
  const title = typeof item?.title === 'string' ? item.title.trim() : '';
  return Boolean(title) && title.length <= 180 && !UNSAFE_TOPIC.test(title);
}

export function themeForHotTopic(item) {
  const title = typeof item?.title === 'string' ? item.title : '';
  return THEMES.find(theme => theme.pattern.test(title)) || THEMES.at(-1);
}

function roundsFor(theme) {
  return [
    {
      id: 'approach', type: 'approach', dimension: theme.dimension,
      prompt: '一个陌生元素即将进入这座沙盘。请用不超过三次移动，表现你希望它如何进入。',
      constraints: { maxMoves: 3 },
    },
    {
      id: 'tradeoff', type: 'tradeoff', dimension: 'resource',
      prompt: '环境发生变化，需要暂时移走两件沙具。请选择它们，并重新安排你想留下的部分。',
      constraints: { removeCount: 2 },
    },
    {
      id: 'relationship', type: 'relationship', dimension: 'relationship',
      prompt: '沙盘中最孤立的元素希望靠近另一个元素。请决定是否回应，以及由谁移动。',
      constraints: { maxMoves: 3 },
    },
    {
      id: 'replay', type: 'replay', dimension: theme.dimension,
      prompt: '这一次，由沙盘中代表你的元素主动接近一个未知区域。请表现你会怎样开始。',
      constraints: { maxMoves: 3 },
    },
  ];
}

function templateChallenge(theme) {
  return {
    title: theme.dimension === 'resource' ? '留下真正重要的' : '为未知留一个位置',
    primaryDimension: theme.dimension,
    intro: `今天从“${theme.label}”出发，通过四次沙盘变化观察自己的选择方式。`,
    rounds: roundsFor(theme),
  };
}

export function fallbackChallenge(date) {
  const theme = THEMES.at(-1);
  return normalizeChallenge(templateChallenge(theme), {
    date,
    sourceTopic: '内置安全命题',
    fallback: true,
  });
}

export async function generateFromTemplate({ source }) {
  return templateChallenge(themeForHotTopic(source));
}

export class DailyChallengeService {
  constructor({ store, generate = generateFromTemplate }) {
    this.store = store;
    this.generate = generate;
  }

  async getDaily({ date, hotItems = [] }) {
    const cached = this.store.read(data => data.dailyChallenges.find(item => item.date === date));
    if (cached) return structuredClone(cached);

    const source = hotItems.find(isSafeHotTopic);
    if (!source) {
      const challenge = fallbackChallenge(date);
      this.store.update(data => data.dailyChallenges.push(challenge));
      return structuredClone(challenge);
    }

    let challenge;
    try {
      const generated = await this.generate({ date, source, theme: themeForHotTopic(source) });
      challenge = normalizeChallenge(generated, { date, sourceTopic: source.title });
    } catch {
      challenge = fallbackChallenge(date);
    }
    this.store.update(data => data.dailyChallenges.push(challenge));
    return structuredClone(challenge);
  }
}
