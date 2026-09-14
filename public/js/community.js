(function exposeCommunity(global) {
  let bridge;
  let filter = 'all';
  let items = [];
  let nextCursor = null;
  let loading = false;
  let publishVisibility = 'public';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  function init(options) {
    bridge = options;
    $('#feed-filters')?.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      filter = button.dataset.f;
      $$('#feed-filters button').forEach(item => item.classList.toggle('active', item === button));
      open();
    });
    $('#vis-seg')?.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      publishVisibility = button.dataset.v;
      $$('#vis-seg button').forEach(item => item.classList.toggle('active', item === button));
    });
  }

  async function open() {
    items = [];
    nextCursor = null;
    renderFeed();
    await loadMore();
  }

  async function loadMore() {
    if (loading) return;
    loading = true;
    renderFeed();
    try {
      const data = await bridge.api.communityWorks({ filter, cursor: nextCursor || '', limit: 10 });
      items.push(...(Array.isArray(data.items) ? data.items : []));
      nextCursor = data.nextCursor || null;
    } catch (error) {
      bridge.toast(error.message || '读取线上社区失败');
    } finally {
      loading = false;
      renderFeed();
    }
  }

  function miniTrayHTML(tray = []) {
    return tray.map(item => {
      const toy = bridge.toyOf(item.toyId);
      return toy
        ? `<span class="pe" style="left:${Number(item.x)}%;top:${Number(item.y)}%;transform:translate(-50%,-50%) rotate(${Number(item.rotation)||0}deg) scale(${Number(item.scale)||1})">${toy.emoji}</span>`
        : '';
    }).join('');
  }

  function visibilityLabel(value) {
    return value === 'public' ? '公开' : value === 'friends' ? '仅好友' : '仅自己';
  }

  function renderFeed() {
    const root = $('#feed');
    if (!root) return;
    const cards = items.map(post => `
      <article class="card post-card" data-work-id="${post.id}">
        <div class="post-mini" onclick="ShaYuCommunity.openPost('${post.id}')">${miniTrayHTML(post.tray)}</div>
        <div class="post-body">
          <div class="post-title" onclick="ShaYuCommunity.openPost('${post.id}')">${bridge.escapeHtml(post.title)}</div>
          <div class="post-meta">
            <span>${post.anonymous && !post.mine ? '👤' : '🧑'} ${bridge.escapeHtml(post.author?.nick || '知乎用户')}</span>
            <span>${bridge.fmtTime(post.createdAt)}</span>
            <span class="privacy-tag ${post.visibility}">${visibilityLabel(post.visibility)}</span>
            ${post.mine ? '<span class="pill">我的</span>' : ''}
          </div>
          <div class="post-summary">${bridge.escapeHtml(post.summary)}</div>
          <div class="post-foot">
            <button class="${post.liked ? 'liked' : ''}" onclick="ShaYuCommunity.toggleLike('${post.id}')">❤️ ${post.likes}</button>
            <button class="${post.collected ? 'collected' : ''}" onclick="ShaYuCommunity.toggleCollect('${post.id}')">⭐ ${post.collects}</button>
            <button onclick="ShaYuCommunity.openPost('${post.id}')">💬 ${post.commentCount}</button>
            <button onclick="ShaYuCommunity.sharePost('${post.id}')">↗️ 分享</button>
          </div>
        </div>
      </article>`).join('');
    const empty = !items.length && !loading
      ? `<div class="card community-empty">${filter === 'mine' ? '你还没有发布过沙盘' : filter === 'collected' ? '还没有收藏任何帖子' : '线上社区还没有作品，来发布第一座沙盘吧'}</div>`
      : '';
    const more = nextCursor
      ? `<button class="btn btn-ghost community-more" onclick="ShaYuCommunity.loadMore()">${loading ? '读取中…' : '加载更多线上作品'}</button>`
      : loading ? '<div class="community-loading">正在读取线上社区…</div>' : '';
    root.innerHTML = cards + empty + more;
  }

  function replaceItem(updated) {
    const index = items.findIndex(item => item.id === updated.id);
    if (index >= 0) items[index] = updated;
    renderFeed();
  }

  async function toggleLike(id) {
    try { replaceItem(await bridge.api.toggleCommunityLike(id)); }
    catch (error) { bridge.toast(error.message); }
  }

  async function toggleCollect(id) {
    try {
      const updated = await bridge.api.toggleCommunityCollect(id);
      replaceItem(updated);
      bridge.toast(updated.collected ? '⭐ 已收藏到账号' : '已取消收藏');
    } catch (error) { bridge.toast(error.message); }
  }

  async function sharePost(id) {
    const post = items.find(item => item.id === id);
    if (!post) return;
    const url = `${location.origin}/?work=${encodeURIComponent(id)}`;
    const data = { title: post.title, text: `我在「沙游心语」看到了沙盘《${post.title}》`, url };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else {
      await navigator.clipboard?.writeText(`${data.text} ${url}`);
      bridge.toast('🔗 已复制作品链接');
    }
  }

  async function openPost(id) {
    try {
      const post = await bridge.api.communityWork(id);
      replaceItem(post);
      $('#post-modal-body').innerHTML = `
        <div class="post-detail-head">
          <div class="post-mini post-detail-tray">${miniTrayHTML(post.tray)}</div>
          <div class="post-detail-copy">
            <h2>${bridge.escapeHtml(post.title)}</h2>
            <div class="post-meta"><span>${post.anonymous && !post.mine ? '👤' : '🧑'} ${bridge.escapeHtml(post.author?.nick || '知乎用户')}</span><span>${bridge.fmtTime(post.createdAt)}</span>
            <span class="privacy-tag ${post.visibility}">${visibilityLabel(post.visibility)}</span></div>
            <p>${bridge.escapeHtml(post.summary)}</p>
          </div>
        </div>
        <div class="post-detail-actions">
          <button class="btn btn-sm ${post.liked ? 'btn-warm' : 'btn-ghost'}" onclick="ShaYuCommunity.reactInPost('${post.id}','like')">❤️ 点赞 ${post.likes}</button>
          <button class="btn btn-sm ${post.collected ? 'btn-warm' : 'btn-ghost'}" onclick="ShaYuCommunity.reactInPost('${post.id}','collect')">⭐ 收藏 ${post.collects}</button>
          <button class="btn btn-sm btn-ghost" onclick="ShaYuCommunity.sharePost('${post.id}')">↗️ 分享</button>
        </div>
        <h3 class="comment-heading">评论（${post.comments?.length || 0}）</h3>
        <div class="comment-list">
          ${post.comments?.length ? post.comments.map(comment => `<div class="comment-item">
            <span class="who">${bridge.escapeHtml(comment.author)}</span><span class="when">${bridge.fmtTime(comment.createdAt)}</span>
            <p>${bridge.escapeHtml(comment.text)}</p></div>`).join('')
            : '<div class="comment-empty">还没有评论，来留下第一句温柔的回应。</div>'}
        </div>
        <div class="comment-input-row">
          <input id="new-cmt" placeholder="友善地回应这份沙盘……" maxlength="300">
          <button class="btn btn-primary btn-sm" onclick="ShaYuCommunity.addComment('${post.id}')">发送</button>
        </div>`;
      $('#post-modal').classList.add('open');
    } catch (error) { bridge.toast(error.message || '读取作品失败'); }
  }

  async function reactInPost(id, kind) {
    try {
      const updated = kind === 'like'
        ? await bridge.api.toggleCommunityLike(id)
        : await bridge.api.toggleCommunityCollect(id);
      replaceItem(updated);
      await openPost(id);
    } catch (error) { bridge.toast(error.message); }
  }

  async function addComment(id) {
    const input = $('#new-cmt');
    const text = input?.value.trim();
    if (!text) return bridge.toast('先写点什么吧');
    try {
      const updated = await bridge.api.addCommunityComment(id, text);
      replaceItem(updated);
      await openPost(id);
    } catch (error) { bridge.toast(error.message); }
  }

  function openPublish() {
    const state = bridge.getState();
    if (!bridge.getCapabilities().loggedIn) return bridge.toast('请先登录知乎');
    if (!state.report) return bridge.toast('先生成沙盘报告');
    $('#publish-mini').innerHTML = miniTrayHTML(state.tray);
    $('#publish-summary').textContent = state.report.aiText || `${state.report.themeText} ${state.report.atmos}`;
    $('#publish-title').value = '';
    $('#publish-modal').classList.add('open');
  }

  async function confirmPublish() {
    const state = bridge.getState();
    const title = $('#publish-title').value.trim() || state.report.title;
    const anonymous = $('#anon-switch').classList.contains('on');
    try {
      await bridge.api.createCommunityWork({
        title,
        summary: state.report.aiText || `${state.report.themeText} ${state.report.atmos}`,
        tray: state.tray.map(({ toyId, x, y, rotation, scale }) => ({ toyId, x, y, rotation, scale })),
        visibility: publishVisibility,
        anonymous,
      });
      bridge.closeModal('publish-modal');
      bridge.toast(publishVisibility === 'public' ? '已发布，其他玩家现在可以看见' : '作品已安全保存');
      filter = 'mine';
      $$('#feed-filters button').forEach(button => button.classList.toggle('active', button.dataset.f === 'mine'));
      bridge.switchView('community');
    } catch (error) { bridge.toast(error.message || '发布失败'); }
  }

  async function migrateLegacyPosts() {
    const state = bridge.getState();
    if (!bridge.getCapabilities().loggedIn || !Array.isArray(state.posts)) return;
    const pending = state.posts.filter(post => post.mine && !state.communityMigrated?.[post.id]).slice(0, 20);
    let migrated = 0;
    for (const post of pending) {
      try {
        await bridge.api.createCommunityWork({
          title: post.title,
          summary: post.summary,
          tray: post.tray,
          visibility: post.vis,
          anonymous: post.anon,
        });
        state.communityMigrated[post.id] = true;
        migrated += 1;
      } catch { /* 保留未迁移标记，下次启动继续尝试 */ }
    }
    if (migrated) {
      bridge.saveState();
      bridge.toast(`已将 ${migrated} 个本机作品同步到线上社区`);
    }
  }

  global.ShaYuCommunity = Object.freeze({
    init,
    open,
    loadMore,
    openPost,
    toggleLike,
    toggleCollect,
    reactInPost,
    addComment,
    sharePost,
    openPublish,
    confirmPublish,
    migrateLegacyPosts,
  });
})(window);
