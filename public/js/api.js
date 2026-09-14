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
    toggleCommunityLike: id => request(`/api/community/${encodeURIComponent(id)}/like`, { method: 'POST' }),
    toggleCommunityCollect: id => request(`/api/community/${encodeURIComponent(id)}/collect`, { method: 'POST' }),
    addCommunityComment: (id, text) => request(`/api/community/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  });
})(window);
