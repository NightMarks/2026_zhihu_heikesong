(function exposeZhihuApi(global) {
  async function request(url, options) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() };
    if (!response.ok) {
      if (response.status === 401) global.dispatchEvent(new CustomEvent('shayu:unauthorized'));
      throw new Error(body.error || `请求失败（HTTP ${response.status}）`);
    }
    return body;
  }

  const query = params => new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  );

  global.ShaYuApi = Object.freeze({
    capabilities: () => request('/api/capabilities'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    contents: ({ limit = 12, offset = 0, type = 'all' } = {}) =>
      request(`/api/me/contents?${query({ n: limit, offset, type })}`),
    followees: ({ limit = 12, offset = 0 } = {}) =>
      request(`/api/me/followees?${query({ n: limit, offset })}`),
    communityWorks: ({ filter = 'all', cursor = '', limit = 10 } = {}) =>
      request(`/api/community?${query({ filter, cursor, limit })}`),
    communityWork: id => request(`/api/community/${encodeURIComponent(id)}`),
    createCommunityWork: payload => request('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    deleteCommunityWork: id => request(`/api/community/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    toggleCommunityLike: id => request(`/api/community/${encodeURIComponent(id)}/like`, { method: 'POST' }),
    toggleCommunityCollect: id => request(`/api/community/${encodeURIComponent(id)}/collect`, { method: 'POST' }),
    addCommunityComment: (id, text) => request(`/api/community/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
    matchCommunityWorks: payload => request('/api/community/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    friendRequests: () => request('/api/community/friend-requests'),
    sendFriendRequest: (workId, message) => request(`/api/community/${encodeURIComponent(workId)}/friend-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }),
    respondFriendRequest: (requestId, status) => request(`/api/community/friend-requests/${encodeURIComponent(requestId)}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
    dailyChallenge: () => request('/api/challenges/daily'),
    createChallengeRun: payload => request('/api/challenge-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    saveChallengeRound: (runId, roundId, payload) => request(
      `/api/challenge-runs/${encodeURIComponent(runId)}/rounds/${encodeURIComponent(roundId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),
    createChallengeReflection: runId => request(`/api/challenge-runs/${encodeURIComponent(runId)}/reflection`, {
      method: 'POST',
    }),
    confirmChoiceObservation: (runId, payload) => request(
      `/api/challenge-runs/${encodeURIComponent(runId)}/confirmations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),
    choiceProfile: () => request('/api/challenge-runs/profile'),
    updateArchetypeSettings: (id, payload) => request(
      `/api/challenge-runs/profile/archetypes/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),
    deleteChoiceRecord: id => request(`/api/challenge-runs/profile/records/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  });
})(window);
