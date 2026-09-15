(function exposeChoiceProfile(global) {
  let bridge;
  let profile = null;

  function init(options) {
    bridge = options;
  }

  async function refresh() {
    profile = await bridge.api.choiceProfile();
    const state = bridge.getState();
    state.choiceProfileCache = profile;
    bridge.saveState();
    return profile;
  }

  function archetypeCard(archetype) {
    const publicChecked = archetype.isPublic ? 'checked' : '';
    const matchChecked = archetype.matchEligible ? 'checked' : '';
    return `<article class="archetype-card">
      <div><span class="archetype-kicker">近期选择原型</span><h3>${bridge.escapeHtml(archetype.name)}</h3></div>
      <p>${bridge.escapeHtml(archetype.description)}</p>
      <small>${archetype.evidenceCount} 条本人确认的观察 · ${archetype.dimensions.length} 类情境</small>
      <label><input type="checkbox" ${publicChecked} onchange="ShaYuChoiceProfile.update('${archetype.id}','isPublic',this.checked)"> 向其他玩家公开</label>
      <label><input type="checkbox" ${matchChecked} ${archetype.isPublic ? '' : 'disabled'} onchange="ShaYuChoiceProfile.update('${archetype.id}','matchEligible',this.checked)"> 允许用于好友匹配</label>
    </article>`;
  }

  async function renderInto(root) {
    if (!root) return;
    root.innerHTML = '<div class="choice-profile-loading">正在读取你的选择图谱…</div>';
    try {
      const data = await refresh();
      root.innerHTML = data.archetypes?.length
        ? `<div class="choice-profile-head"><h2>我的选择图谱</h2><p>这些只是近期、经过你确认的选择方式，会随新记录变化，不是心理诊断。</p></div>
           <div class="archetype-grid">${data.archetypes.map(archetypeCard).join('')}</div>`
        : `<div class="choice-profile-empty"><h3>选择图谱正在形成</h3><p>同一模式至少被你确认 3 次，并跨越 2 类情境后，才会出现选择原型。</p></div>`;
    } catch (error) {
      root.innerHTML = `<div class="choice-profile-empty">${bridge.escapeHtml(error.message || '选择图谱暂时不可用')}</div>`;
    }
  }

  async function update(id, field, value) {
    const archetype = profile?.archetypes?.find(item => item.id === id);
    if (!archetype) return;
    const payload = {
      isPublic: field === 'isPublic' ? value : archetype.isPublic,
      matchEligible: field === 'matchEligible' ? value : archetype.matchEligible,
    };
    if (!payload.isPublic) payload.matchEligible = false;
    try {
      profile = await bridge.api.updateArchetypeSettings(id, payload);
      const root = document.querySelector('#choice-profile-panel');
      if (root) await renderInto(root);
      bridge.toast(payload.isPublic ? '选择原型公开设置已更新' : '这个选择原型已设为私密');
    } catch (error) {
      bridge.toast(error.message || '设置更新失败');
    }
  }

  function publicForSharing() {
    return (profile?.archetypes || []).filter(item => item.isPublic);
  }

  global.ShaYuChoiceProfile = Object.freeze({ init, refresh, renderInto, update, publicForSharing });
})(window);
