(function exposeChallenge(global) {
  let bridge;
  let model = { challenge: null, stage: 'intro', runId: null, roundIndex: 0, before: [], actions: [], reflection: null, confirmations: {} };

  const $ = selector => document.querySelector(selector);

  function init(options) {
    bridge = options;
    const draft = bridge.getState().challengeDraft;
    if (draft?.runId && draft?.challenge) model = { ...model, ...draft };
    renderTrayBanner();
  }

  function persist() {
    bridge.getState().challengeDraft = model.runId ? model : null;
    bridge.saveState();
  }

  function currentRound() {
    return model.challenge?.rounds?.[model.roundIndex] || null;
  }

  function constraintText(round) {
    if (round?.constraints?.removeCount) return `本轮需要移走 ${round.constraints.removeCount} 件沙具`;
    if (round?.constraints?.maxMoves) return `建议不超过 ${round.constraints.maxMoves} 次主要移动`;
    if (round?.constraints?.cannotDelete) return '本轮不能删除原有沙具';
    return '没有标准答案，按你的真实选择调整';
  }

  async function open() {
    const root = $('#challenge-area');
    if (!model.challenge) {
      root.innerHTML = '<div class="card challenge-loading">正在从知乎热榜准备今天的命题…</div>';
      try { model.challenge = await bridge.api.dailyChallenge(); }
      catch (error) {
        root.innerHTML = `<div class="card challenge-empty"><h2>每日热题暂时无法进入</h2><p>${bridge.escapeHtml(error.message)}</p></div>`;
        return;
      }
    }
    render();
  }

  function renderIntro() {
    const challenge = model.challenge;
    return `<div class="challenge-hero card">
      <span class="challenge-eyebrow">DAILY MIRROR · ${bridge.escapeHtml(challenge.date)}</span>
      <h1>${bridge.escapeHtml(challenge.title)}</h1>
      <p>${bridge.escapeHtml(challenge.intro)}</p>
      <div class="challenge-source">知乎议题：${bridge.escapeHtml(challenge.sourceTopic || '内置安全命题')}${challenge.fallback ? ' · 安全保底题' : ''}</div>
      <div class="challenge-principle">你不会选择测试答案，而是亲手改变沙盘。系统观察的是选择过程，不判断对错。</div>
      <button class="btn btn-primary" onclick="ShaYuChallenge.prepareInitial()">准备我的初始沙盘 →</button>
    </div>`;
  }

  function renderRoundSummary() {
    const round = currentRound();
    return `<div class="challenge-progress"><span>镜像试炼 ${model.roundIndex + 1} / ${model.challenge.rounds.length}</span><b>${bridge.escapeHtml(round.prompt)}</b><small>${bridge.escapeHtml(constraintText(round))}</small></div>`;
  }

  function renderReflection() {
    const observations = model.reflection?.observations || [];
    const complete = observations.length && observations.every(item => model.confirmations[item.id]);
    return `<div class="choice-mirror card">
      <span class="challenge-eyebrow">CHOICE MIRROR</span>
      <h1>你的选择镜鉴</h1>
      <p class="choice-mirror-lead">以下联想都来自本局真实变化。你拥有最终解释权，未经确认的内容不会进入长期图谱。</p>
      <div class="observation-list">${observations.map((observation, index) => {
        const result = model.confirmations[observation.id];
        return `<article class="observation-card ${result ? 'confirmed' : ''}">
          <span>事实 ${index + 1}</span><h3>${bridge.escapeHtml(observation.fact)}</h3>
          <p>${observation.possibilities.map(item => bridge.escapeHtml(item)).join('；也可能是：')}</p>
          <b>${bridge.escapeHtml(observation.question)}</b>
          ${result ? `<div class="confirmation-result">已记录：${bridge.escapeHtml(result)}</div>` : `<div class="confirmation-actions">
            <button onclick="ShaYuChallenge.confirm('${observation.id}','confirmed')">这很像我</button>
            <button onclick="ShaYuChallenge.confirm('${observation.id}','situational')">只在这个情境</button>
            <button onclick="ShaYuChallenge.confirm('${observation.id}','rejected')">不符合我的想法</button>
          </div>
          <div class="rewrite-row"><input id="choice-meaning-${index}" maxlength="500" placeholder="或者写下你自己的解释"><button onclick="ShaYuChallenge.confirm('${observation.id}','rewritten',${index})">按我的话记录</button></div>`}
        </article>`;
      }).join('')}</div>
      ${complete ? `<div class="challenge-complete-actions">
        <button class="btn btn-warm" onclick="ShaYuCommunity.openPublish()">📤 发布这座挑战沙盘</button>
        <button class="btn btn-primary" onclick="ShaYuCommunity.openMatcher()">🧩 寻找共鸣伙伴</button>
      </div><div id="choice-profile-panel"></div>` : '<p class="challenge-confirm-hint">请回应每一条观察，完成后即可发布、匹配并查看选择图谱。</p>'}
    </div>`;
  }

  function render() {
    const root = $('#challenge-area');
    if (!root || !model.challenge) return;
    if (model.stage === 'reflection' || model.stage === 'complete') root.innerHTML = renderReflection();
    else if (model.stage === 'round') root.innerHTML = `<div class="card challenge-stage">${renderRoundSummary()}<button class="btn btn-primary" onclick="ShaYuChallenge.enterTray()">进入沙盘回应 →</button></div>`;
    else root.innerHTML = renderIntro();
    if (model.stage === 'complete') global.ShaYuChoiceProfile.renderInto($('#choice-profile-panel'));
  }

  function prepareInitial() {
    model.stage = 'initial';
    model.runId = null;
    model.roundIndex = 0;
    model.actions = [];
    model.confirmations = {};
    persist();
    renderTrayBanner();
    bridge.switchView('tray');
  }

  function enterTray() {
    model.before = bridge.snapshotTray();
    model.actions = [];
    persist();
    renderTrayBanner();
    bridge.switchView('tray');
  }

  function renderTrayBanner() {
    const banner = $('#challenge-tray-banner');
    if (!banner) return;
    if (model.stage === 'initial') {
      banner.hidden = false;
      banner.innerHTML = `<div><span>每日热题 · 初始世界</span><b>先摆出此刻的沙盘</b><small>完成后将保存不可覆盖的初始快照。</small></div><button class="btn btn-primary btn-sm" onclick="ShaYuChallenge.submitInitial()">保存初始沙盘</button>`;
      return;
    }
    if (model.stage === 'round' && currentRound()) {
      banner.hidden = false;
      banner.innerHTML = `<div><span>第 ${model.roundIndex + 1} 轮</span><b>${bridge.escapeHtml(currentRound().prompt)}</b><small>${bridge.escapeHtml(constraintText(currentRound()))}</small></div><button class="btn btn-primary btn-sm" onclick="ShaYuChallenge.completeRound()">完成这一轮</button>`;
      return;
    }
    banner.hidden = true;
    banner.innerHTML = '';
  }

  async function submitInitial() {
    const snapshot = bridge.snapshotTray();
    if (!snapshot.length) return bridge.toast('先在沙盘中放入至少一件沙具');
    try {
      const run = await bridge.api.createChallengeRun({
        challengeId: model.challenge.id,
        initialSnapshot: snapshot,
        selfNarrative: bridge.getState().trayStory || '',
      });
      model.runId = run.id;
      model.stage = 'round';
      model.before = snapshot;
      model.actions = [];
      persist();
      renderTrayBanner();
      bridge.toast('初始世界已保存，开始第一轮镜像试炼');
    } catch (error) { bridge.toast(error.message || '初始沙盘保存失败'); }
  }

  function recordAction(action) {
    if (model.stage !== 'round') return;
    const normalized = action === 'place' ? 'add' : action === 'adjust' ? 'move' : action;
    if (!['add', 'remove', 'move', 'scale', 'rotate', 'layer', 'clear'].includes(normalized)) return;
    model.actions.push({ type: normalized, at: Date.now() });
    persist();
  }

  async function completeRound() {
    const round = currentRound();
    if (!round || !model.runId) return;
    const after = bridge.snapshotTray();
    if (!after.length) return bridge.toast('沙盘不能为空，请至少保留一件沙具');
    try {
      const diff = global.ShaYuTrayDiff.diffSnapshots(model.before, after, model.actions);
      await bridge.api.saveChallengeRound(model.runId, round.id, {
        dimension: round.dimension,
        before: model.before,
        after,
        actions: model.actions,
        diff,
      });
      model.roundIndex += 1;
      model.before = after;
      model.actions = [];
      if (model.roundIndex < model.challenge.rounds.length) {
        persist();
        renderTrayBanner();
        bridge.toast(`已记录选择，进入第 ${model.roundIndex + 1} 轮`);
        return;
      }
      model.reflection = await bridge.api.createChallengeReflection(model.runId);
      model.stage = 'reflection';
      bridge.getState().challengeResult = {
        challenge: { id: model.challenge.id, title: model.challenge.title },
        mirrorCard: { title: model.challenge.title, confirmedText: '' },
      };
      const facts = model.reflection.observations.map(item => item.fact).join('\n');
      bridge.getState().report = {
        title: model.challenge.title,
        aiText: facts,
        themeText: facts,
        atmos: '选择镜像记录',
        analysisFocus: [...new Set(model.reflection.observations.map(item => item.dimension))],
        source: 'choice-mirror',
        time: Date.now(),
      };
      persist();
      renderTrayBanner();
      bridge.switchView('challenge');
    } catch (error) { bridge.toast(error.message || '这一轮暂时无法保存'); }
  }

  async function confirm(observationId, result, inputIndex) {
    const input = Number.isInteger(inputIndex) ? $(`#choice-meaning-${inputIndex}`) : null;
    const userMeaning = input?.value?.trim() || '';
    if (result === 'rewritten' && !userMeaning) return bridge.toast('先写下你自己的解释');
    try {
      const response = await bridge.api.confirmChoiceObservation(model.runId, { observationId, result, userMeaning });
      model.confirmations[observationId] = result === 'rewritten' ? userMeaning : ({ confirmed: '这很像我', situational: '只在这个情境', rejected: '不符合我的想法' }[result]);
      if (response.profile) bridge.getState().choiceProfileCache = response.profile;
      if (Object.keys(model.confirmations).length >= model.reflection.observations.length) {
        model.stage = 'complete';
        const confirmedText = Object.values(model.confirmations).join('；');
        bridge.getState().challengeResult.mirrorCard.confirmedText = confirmedText;
      }
      persist();
      render();
    } catch (error) { bridge.toast(error.message || '回应保存失败'); }
  }

  function activeResult() {
    return model.stage === 'complete' ? bridge.getState().challengeResult : null;
  }

  global.ShaYuChallenge = Object.freeze({
    init, open, prepareInitial, enterTray, submitInitial, completeRound, confirm, recordAction, activeResult,
  });
})(window);
