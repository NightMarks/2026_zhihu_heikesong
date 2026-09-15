const ARCHETYPES = Object.freeze({
  'boundary-keeper': {
    name: '边界守望者',
    description: '近期多次先建立缓冲或确认条件，再接近变化。',
  },
  'active-connector': {
    name: '主动连接者',
    description: '近期多次由自己先移动，推动关系发生变化。',
  },
  'order-rebuilder': {
    name: '秩序重构者',
    description: '近期多次通过重新安排整体结构回应压力。',
  },
  'core-guardian': {
    name: '核心守护者',
    description: '近期在资源受限时多次优先保护重要元素。',
  },
});

export function computeArchetypes(confirmations, { minimum = 3 } = {}) {
  const accepted = (Array.isArray(confirmations) ? confirmations : [])
    .filter(item => ['confirmed', 'rewritten'].includes(item?.result) && ARCHETYPES[item?.archetypeId]);
  return Object.entries(ARCHETYPES).flatMap(([id, definition]) => {
    const evidence = accepted.filter(item => item.archetypeId === id);
    const dimensions = [...new Set(evidence.map(item => item.dimension).filter(Boolean))];
    if (evidence.length < minimum || dimensions.length < 2) return [];
    return [{
      id,
      ...definition,
      evidenceCount: evidence.length,
      dimensions,
    }];
  });
}

export function archetypeDefinition(id) {
  return ARCHETYPES[id] ? { id, ...ARCHETYPES[id] } : null;
}
