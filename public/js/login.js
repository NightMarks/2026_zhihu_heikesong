(async function setupLoginPage() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('returnTo');
  const returnTo = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  const oauthMethod = document.querySelector('#oauth-method');
  const judgeMethod = document.querySelector('#judge-method');
  const divider = document.querySelector('#login-divider');
  const unavailable = document.querySelector('#login-unavailable');
  const oauthLink = document.querySelector('#oauth-login');
  const form = document.querySelector('#judge-login-form');
  const status = document.querySelector('#login-form-status');

  try {
    const response = await fetch('/api/capabilities');
    const capabilities = await response.json();
    if (capabilities.loggedIn) {
      location.replace(returnTo);
      return;
    }
    oauthMethod.hidden = !capabilities.oauthReady;
    judgeMethod.hidden = !capabilities.judgeLoginReady;
    divider.hidden = !(capabilities.oauthReady && capabilities.judgeLoginReady);
    unavailable.hidden = capabilities.oauthReady || capabilities.judgeLoginReady;
    oauthLink.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  } catch {
    unavailable.hidden = false;
    unavailable.textContent = '暂时无法连接服务器，请刷新页面重试。';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    status.className = 'login-form-status';
    status.textContent = '正在确认体验身份…';
    try {
      const response = await fetch('/auth/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password'),
          returnTo,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '登录失败');
      status.className = 'login-form-status success';
      status.textContent = '身份确认成功，正在进入沙盘…';
      const separator = result.returnTo.includes('?') ? '&' : '?';
      location.assign(`${result.returnTo}${separator}login=ok`);
    } catch (error) {
      status.className = 'login-form-status error';
      status.textContent = error.message || '登录失败，请稍后重试。';
      form.elements.password.value = '';
      form.elements.password.focus();
      button.disabled = false;
    }
  });
})();
