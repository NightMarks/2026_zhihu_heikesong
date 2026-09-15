(function exposeTrayDiff(global) {
  const MEANINGFUL_ACTIONS = new Set(['add', 'remove', 'move', 'scale', 'rotate', 'layer', 'clear']);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function distance(left, right) {
    return Math.hypot(number(left?.x) - number(right?.x), number(left?.y) - number(right?.y));
  }

  function angularDistance(left, right) {
    const difference = Math.abs(number(left) - number(right)) % 360;
    return Math.min(difference, 360 - difference);
  }

  function stableItems(items) {
    return Array.isArray(items)
      ? items.filter(item => item && typeof item.instanceId === 'string' && item.instanceId)
      : [];
  }

  function changedEntry(before, after) {
    return {
      instanceId: after.instanceId,
      toyId: after.toyId,
      before: { x: number(before.x), y: number(before.y), scale: number(before.scale, 1), rotation: number(before.rotation) },
      after: { x: number(after.x), y: number(after.y), scale: number(after.scale, 1), rotation: number(after.rotation) },
    };
  }

  function diffSnapshots(before = [], after = [], actions = []) {
    const beforeItems = stableItems(before);
    const afterItems = stableItems(after);
    const left = new Map(beforeItems.map(item => [item.instanceId, item]));
    const right = new Map(afterItems.map(item => [item.instanceId, item]));
    const common = afterItems.filter(item => left.has(item.instanceId));

    return {
      added: afterItems.filter(item => !left.has(item.instanceId)).map(item => structuredClone(item)),
      removed: beforeItems.filter(item => !right.has(item.instanceId)).map(item => structuredClone(item)),
      moved: common
        .filter(item => distance(left.get(item.instanceId), item) >= 2)
        .map(item => changedEntry(left.get(item.instanceId), item)),
      resized: common
        .filter(item => Math.abs(number(left.get(item.instanceId).scale, 1) - number(item.scale, 1)) >= 0.1)
        .map(item => changedEntry(left.get(item.instanceId), item)),
      rotated: common
        .filter(item => angularDistance(left.get(item.instanceId).rotation, item.rotation) >= 5)
        .map(item => changedEntry(left.get(item.instanceId), item)),
      firstMeaningfulAction: (Array.isArray(actions) ? actions : [])
        .find(action => action && MEANINGFUL_ACTIONS.has(action.type)) || null,
    };
  }

  global.ShaYuTrayDiff = Object.freeze({ diffSnapshots });
})(typeof window === 'undefined' ? globalThis : window);
