(function exposeUserCenter(global) {
  const PAGE_SIZE = 12;
  let bridge;
  let activeTab = 'contents';
  const pages = {
    contents: { items: [], offset: 0, end: false, loading: false },
    followees: { items: [], offset: 0, end: false, loading: false },
  };

  function init(options) {
    bridge = options;
  }

  async function open() {
    const capabilities = bridge.getCapabilities();
    if (!capabilities.loggedIn || !capabilities.user) {
      bridge.toast('请先登录');
      return;
    }
    bridge.switchView('user');
    renderProfile(capabilities.user);
    reset();
    renderTabs();
    await Promise.allSettled([loadContents(), loadFollowees()]);
  }

  function reset() {
    for (const page of Object.values(pages)) {
      page.items = [];
      page.offset = 0;
      page.end = false;
      page.loading = false;
    }
  }

  function setTab(tab) {
    if (!pages[tab]) return;
    activeTab = tab;
    renderTabs();
  }

  async function loadContents() {
    await loadPage('contents', options => global.ShaYuApi.contents(options));
  }

  async function loadFollowees() {
    await loadPage('followees', options => global.ShaYuApi.followees(options));
  }

  async function loadPage(kind, loader) {
    const page = pages[kind];
    if (page.loading || page.end) return;
    page.loading = true;
    renderList(kind);
    try {
      const data = await loader({ limit: PAGE_SIZE, offset: page.offset });
      const incoming = Array.isArray(data.items) ? data.items : [];
      page.items.push(...incoming);
      const next = Number(data.paging?.NextOffset);
      page.offset = Number.isFinite(next) ? next : page.offset + incoming.length;
      page.end = Boolean(data.paging?.IsEnd) || incoming.length < PAGE_SIZE;
    } catch (error) {
      bridge.toast(error.message || '读取知乎用户数据失败');
    } finally {
      page.loading = false;
      renderList(kind);
    }
  }

  function renderProfile(user) {
    const root = document.querySelector('#user-profile');
    if (!root) return;
    const nick = user.nick || '知乎用户';
    const judgeMode = user.authType === 'judge';
    const avatar = user.avatar
      ? `<img src="${bridge.escapeHtml(user.avatar)}" alt="${bridge.escapeHtml(nick)}的头像" referrerpolicy="no-referrer">`
      : `<span>${bridge.escapeHtml(nick.slice(0, 1) || '知')}</span>`;
    root.innerHTML = `<div class="profile-avatar">${avatar}</div>
      <div class="profile-copy">
        <div class="profile-eyebrow">${judgeMode ? 'JUDGE DEMO PROFILE' : 'ZHIHU PROFILE'}</div>
        <h1>${bridge.escapeHtml(nick)}</h1>
        <p>${bridge.escapeHtml(user.headline || '在知乎认真生活，也在沙盘里重新看见自己。')}</p>
        ${judgeMode ? '<small class="profile-demo-note">体验账号 · 以下为功能演示数据，不代表真实知乎用户</small>' : ''}
      </div>
      ${user.url ? `<a class="btn btn-zhihu btn-sm" href="${bridge.escapeHtml(user.url)}" target="_blank" rel="noopener noreferrer">查看知乎主页 ↗</a>` : ''}`;
  }

  function renderTabs() {
    document.querySelectorAll('[data-user-tab]').forEach(button => {
      const selected = button.dataset.userTab === activeTab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.querySelectorAll('[data-user-panel]').forEach(panel => {
      panel.hidden = panel.dataset.userPanel !== activeTab;
    });
  }

  function renderList(kind) {
    const page = pages[kind];
    const root = document.querySelector(`#user-${kind}-list`);
    const more = document.querySelector(`#user-${kind}-more`);
    if (!root || !more) return;

    if (!page.items.length && page.loading) {
      root.innerHTML = '<div class="user-empty">正在读取…</div>';
    } else if (!page.items.length) {
      root.innerHTML = `<div class="user-empty">${kind === 'contents' ? '暂时没有可展示的创作' : '暂时没有可展示的关注用户'}</div>`;
    } else {
      root.innerHTML = kind === 'contents'
        ? page.items.map(contentCard).join('')
        : page.items.map(followeeCard).join('');
    }

    more.hidden = page.end && !page.loading;
    more.disabled = page.loading;
    more.textContent = page.loading ? '读取中…' : '加载更多';
  }

  function contentCard(item) {
    const title = item.Title || item.title || '未命名创作';
    const url = item.Url || item.url || '';
    const type = item.ContentType || item.content_type || item.Type || '创作';
    const excerpt = item.Excerpt || item.excerpt || item.ContentText || '';
    const likes = item.LikeCount ?? item.VoteUpCount ?? 0;
    const comments = item.CommentCount ?? 0;
    return `<article class="user-content-card">
      <div class="content-kicker">${bridge.escapeHtml(type)}</div>
      ${url
        ? `<a href="${bridge.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${bridge.escapeHtml(title)}</a>`
        : `<strong>${bridge.escapeHtml(title)}</strong>`}
      ${excerpt ? `<p>${bridge.escapeHtml(String(excerpt).replace(/<[^>]+>/g, '').slice(0, 150))}</p>` : ''}
      <div class="content-stats"><span>▲ ${likes}</span><span>💬 ${comments}</span></div>
    </article>`;
  }

  function followeeCard(user) {
    const name = user.Fullname || user.Name || user.name || '知乎用户';
    const avatar = user.AvatarUrl || user.avatar_url || '';
    const url = user.Url || user.url || '';
    const headline = user.Headline || user.headline || '这个人很安静，还没有写简介';
    const followers = user.FollowerCount ?? user.follower_count;
    return `<article class="followee-card">
      <div class="followee-avatar">${avatar
        ? `<img src="${bridge.escapeHtml(avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
        : bridge.escapeHtml(name.slice(0, 1) || '知')}</div>
      <div>${url
        ? `<a href="${bridge.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${bridge.escapeHtml(name)}</a>`
        : `<strong>${bridge.escapeHtml(name)}</strong>`}
      <p>${bridge.escapeHtml(headline)}</p>${followers == null ? '' : `<small>${followers} 位关注者</small>`}</div>
    </article>`;
  }

  global.ShaYuUserCenter = Object.freeze({ init, open, setTab, loadContents, loadFollowees });
})(window);
