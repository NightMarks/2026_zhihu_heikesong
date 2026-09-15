(function exposeState(global) {
  const STORAGE_KEY = 'shayu_v2';
  const INSPIRATION_REWARDS = Object.freeze({ open: 3, reflection: 1 });

  function fresh(categories) {
    return {
      v: 2,
      insp: Object.fromEntries(categories.map(category => [category.id, 0])),
      inspirationClaims: { open: {}, reflection: {} },
      unlocked: {},
      unlockCosts: {},
      tray: [],
      trayStory: '',
      trayProcess: { startedAt: null, lastEditedAt: null, editCount: 0, actions: {}, nextOrder: 1 },
      read: {},
      verified: {},
      posts: [],
      communityMigrated: {},
      report: null,
    };
  }

  function load(categories) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.v === 2) {
        saved.insp ||= {};
        saved.inspirationClaims ||= {};
        saved.inspirationClaims.open ||= {};
        saved.inspirationClaims.reflection ||= {};
        saved.unlockCosts ||= {};
        for (const category of categories) {
          if (typeof saved.insp[category.id] !== 'number') saved.insp[category.id] = 0;
        }
        saved.posts = Array.isArray(saved.posts) ? saved.posts : [];
        saved.communityMigrated ||= {};
        saved.trayStory = typeof saved.trayStory === 'string' ? saved.trayStory : '';
        saved.trayProcess ||= { startedAt: null, lastEditedAt: null, editCount: 0, actions: {}, nextOrder: 1 };
        saved.trayProcess.actions ||= {};
        saved.trayProcess.nextOrder ||= 1;
        return saved;
      }
    } catch { /* 损坏的浏览器存档会回退到新游戏 */ }
    return fresh(categories);
  }

  function ensureUnlockCosts(state, categories, random = Math.random) {
    state.unlockCosts ||= {};
    for (const category of categories) {
      for (const toy of category.toys) {
        const current = state.unlockCosts[toy.id];
        if (!Number.isInteger(current) || current < 1 || current > 3) {
          state.unlockCosts[toy.id] = Math.floor(random() * 3) + 1;
        }
      }
    }
    return state.unlockCosts;
  }

  function claimInspiration(state, categoryId, action, key) {
    const reward = INSPIRATION_REWARDS[action];
    if (!reward || !key) return 0;
    state.inspirationClaims ||= {};
    state.inspirationClaims[action] ||= {};
    if (state.inspirationClaims[action][key]) return 0;
    state.inspirationClaims[action][key] = Date.now();
    state.insp[categoryId] = (state.insp[categoryId] || 0) + reward;
    return reward;
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  global.ShaYuState = Object.freeze({
    load,
    save,
    ensureUnlockCosts,
    claimInspiration,
    INSPIRATION_REWARDS,
  });
})(window);
