const DIMENSIONS = new Set(['change', 'boundary', 'relationship', 'resource', 'control']);
const ROUND_TYPES = new Set(['approach', 'tradeoff', 'relationship', 'replay']);

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizeConstraints(input) {
  const constraints = {};
  const maxMoves = Number.parseInt(input?.maxMoves, 10);
  const removeCount = Number.parseInt(input?.removeCount, 10);
  if (Number.isInteger(maxMoves)) constraints.maxMoves = Math.min(10, Math.max(1, maxMoves));
  if (Number.isInteger(removeCount)) constraints.removeCount = Math.min(5, Math.max(1, removeCount));
  if (input?.cannotDelete === true) constraints.cannotDelete = true;
  return constraints;
}

function normalizeRound(input, index) {
  if (!input || typeof input !== 'object' || !ROUND_TYPES.has(input.type)) {
    throw new Error('每日热题轮次类型无效');
  }
  if (!DIMENSIONS.has(input.dimension)) throw new Error('每日热题观察维度无效');
  const prompt = cleanText(input.prompt, 240);
  if (!prompt) throw new Error('每日热题缺少轮次说明');
  return {
    id: cleanText(input.id, 40) || `round-${index + 1}`,
    type: input.type,
    dimension: input.dimension,
    prompt,
    constraints: normalizeConstraints(input.constraints),
  };
}

export function normalizeChallenge(input, { date, sourceTopic = '', fallback = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('每日热题日期无效');
  if (!input || typeof input !== 'object' || !DIMENSIONS.has(input.primaryDimension)) {
    throw new Error('每日热题结构无效');
  }
  const title = cleanText(input.title, 48);
  const intro = cleanText(input.intro, 240);
  if (!title || !intro) throw new Error('每日热题文案不完整');
  const rounds = Array.isArray(input.rounds)
    ? input.rounds.map(normalizeRound)
    : [];
  if (rounds.length !== 4 || rounds.at(-1).type !== 'replay') {
    throw new Error('每日热题必须包含三轮试炼和一次重演');
  }
  if (new Set(rounds.map(round => round.id)).size !== rounds.length) {
    throw new Error('每日热题轮次标识重复');
  }
  return {
    id: `${date}-${input.primaryDimension}`,
    date,
    title,
    sourceTopic: cleanText(sourceTopic, 120),
    primaryDimension: input.primaryDimension,
    intro,
    rounds,
    fallback: Boolean(fallback),
  };
}

export const challengeSchema = Object.freeze({ DIMENSIONS, ROUND_TYPES });
