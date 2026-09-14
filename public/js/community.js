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
    await Promise.allSettled([loadMore(), refreshFriendBadge()]);
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
        ? `<span class="pe" style="left:${Number(item.x)}%;top:${Number(item.y)}%;transform:translate(-50%,-50%) rotate(${Number(item.rotation)||0}deg) scale(${Number(item.scale)||1})"><img src="${toy.image}" alt="${bridge.escapeHtml(toy.name)}"></span>`
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
            ${post.mine ? `<button class="post-delete" onclick="ShaYuCommunity.deletePost('${post.id}')">🗑️ 删除</button>` : ''}
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
          ${post.mine ? `<button class="btn btn-sm btn-danger" onclick="ShaYuCommunity.deletePost('${post.id}')">🗑️ 删除这座沙盘</button>` : ''}
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

  async function deletePost(id) {
    if (!global.confirm('确定删除这座已发布的沙盘吗？删除后无法恢复。')) return;
    try {
      await bridge.api.deleteCommunityWork(id);
      items = items.filter(item => item.id !== id);
      bridge.closeModal('post-modal');
      renderFeed();
      bridge.toast('已删除这座沙盘');
    } catch (error) { bridge.toast(error.message || '删除失败'); }
  }

  async function openMatcher() {
    const state = bridge.getState();
    if (!state.tray?.length) return bridge.toast('先完成一座自己的沙盘，才能寻找共鸣');
    $('#match-modal-body').innerHTML = '<div class="resonance-loading"><span>🫧</span><p>正在比较沙具选择、空间结构与关注方向…</p></div>';
    $('#match-modal').classList.add('open');
    try {
      const data = await bridge.api.matchCommunityWorks({
        tray: state.tray,
        aspects: state.report?.analysisFocus || [],
      });
      renderMatches(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      $('#match-modal-body').innerHTML = `<div class="community-empty">${bridge.escapeHtml(error.message || '暂时无法寻找共鸣')}</div>`;
    }
  }

  function renderMatches(matches) {
    $('#match-modal-body').innerHTML = matches.length ? `
      <div class="resonance-intro"><span>RESONANCE MAP</span><h2>与你的沙盘产生回声</h2><p>匹配只比较作品结构与选择，不推断性格。分数越高，代表沙具类别、布局或关注方向越相近。</p></div>
      <div class="resonance-grid">${matches.map(match => `
        <article class="resonance-card">
          <div class="resonance-preview">${miniTrayHTML(match.work.tray)}<b>${match.score}<small>%</small></b></div>
          <div class="resonance-copy">
            <span class="resonance-author">${match.work.anonymous ? '👤' : '🧑'} ${bridge.escapeHtml(match.work.author?.nick || '知乎用户')}</span>
            <h3>${bridge.escapeHtml(match.work.title)}</h3>
            <div class="resonance-reasons">${match.reasons.map(reason => `<span>${bridge.escapeHtml(reason)}</span>`).join('')}</div>
            <div class="resonance-actions">
              <button class="btn btn-ghost btn-sm" onclick="ShaYuCommunity.openPost('${match.work.id}')">看看作品</button>
              <button class="btn btn-primary btn-sm" onclick="ShaYuCommunity.sendFriendRequest('${match.work.id}',this)">发送好友申请</button>
            </div>
          </div>
        </article>`).join('')}</div>`
      : '<div class="community-empty">还没有可匹配的公开沙盘。邀请队友先发布一座作品吧。</div>';
  }

  async function sendFriendRequest(workId, button) {
    if (button) button.disabled = true;
    try {
      await bridge.api.sendFriendRequest(workId, '我们的沙盘有一些相似之处，想和你认识、交流彼此的看法。');
      if (button) button.textContent = '申请已发送';
      bridge.toast('好友申请已送达，等待对方回应');
    } catch (error) {
      if (button) button.disabled = false;
      bridge.toast(error.message || '好友申请发送失败');
    }
  }

  async function refreshFriendBadge() {
    try {
      const data = await bridge.api.friendRequests();
      const pending = (data.incoming || []).filter(request => request.status === 'pending').length;
      const badge = $('#friend-request-count');
      if (badge) {
        badge.textContent = String(pending);
        badge.hidden = !pending;
      }
      return data;
    } catch { return { incoming: [], outgoing: [] }; }
  }

  async function openFriendRequests() {
    $('#friend-modal-body').innerHTML = '<div class="community-loading">正在读取好友申请…</div>';
    $('#friend-modal').classList.add('open');
    const data = await refreshFriendBadge();
    const incoming = data.incoming || [];
    const outgoing = data.outgoing || [];
    $('#friend-modal-body').innerHTML = `
      <div class="friend-request-head"><span>CONNECTIONS</span><h2>从相似的沙盘开始认识</h2><p>只有双方同意后才会成为好友，并解锁“仅好友可见”的作品。</p></div>
      <div class="friend-columns">
        <section><h3>收到的申请</h3>${incoming.length ? incoming.map(friendRequestCard).join('') : '<div class="friend-empty">暂时没有收到申请</div>'}</section>
        <section><h3>发出的申请</h3>${outgoing.length ? outgoing.map(friendRequestCard).join('') : '<div class="friend-empty">还没有发出申请</div>'}</section>
      </div>`;
  }

  function friendRequestCard(request) {
    const statusLabel = request.status === 'accepted' ? '已成为好友' : request.status === 'rejected' ? '已婉拒' : '等待回应';
    const actions = request.direction === 'incoming' && request.status === 'pending'
      ? `<div class="friend-actions"><button class="btn btn-primary btn-sm" onclick="ShaYuCommunity.respondFriendRequest('${request.id}','accepted')">接受</button><button class="btn btn-ghost btn-sm" onclick="ShaYuCommunity.respondFriendRequest('${request.id}','rejected')">婉拒</button></div>`
      : `<span class="friend-status ${request.status}">${statusLabel}</span>`;
    return `<article class="friend-request-card">
      <div class="friend-avatar">${request.user?.avatar ? `<img src="${bridge.escapeHtml(request.user.avatar)}" alt="" referrerpolicy="no-referrer">` : bridge.escapeHtml(request.user?.nick?.slice(0, 1) || '知')}</div>
      <div><b>${bridge.escapeHtml(request.user?.nick || '知乎用户')}</b><small>因《${bridge.escapeHtml(request.workTitle)}》而相遇</small><p>${bridge.escapeHtml(request.message)}</p>${actions}</div>
    </article>`;
  }

  async function respondFriendRequest(requestId, status) {
    try {
      await bridge.api.respondFriendRequest(requestId, status);
      bridge.toast(status === 'accepted' ? '你们已经成为好友' : '已婉拒这次申请');
      await openFriendRequests();
      await open();
    } catch (error) { bridge.toast(error.message || '处理申请失败'); }
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
        aspects: state.report?.analysisFocus || [],
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
          aspects: post.analysisFocus || [],
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
    deletePost,
    sharePost,
    openPublish,
    confirmPublish,
    migrateLegacyPosts,
    openMatcher,
    sendFriendRequest,
    openFriendRequests,
    respondFriendRequest,
  });
})(window);
