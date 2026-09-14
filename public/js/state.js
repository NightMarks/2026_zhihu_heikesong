(function exposeState(global) {
  const STORAGE_KEY = 'shayu_v2';

  function fresh(categories) {
    return {
      v: 2,
      insp: Object.fromEntries(categories.map(category => [category.id, 0])),
      unlocked: {},
      tray: [],
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
        for (const category of categories) {
          if (typeof saved.insp[category.id] !== 'number') saved.insp[category.id] = 0;
        }
        saved.posts = Array.isArray(saved.posts) ? saved.posts : [];
        saved.communityMigrated ||= {};
        return saved;
      }
    } catch { /* 损坏的浏览器存档会回退到新游戏 */ }
    return fresh(categories);
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  global.ShaYuState = Object.freeze({ load, save });
})(window);
