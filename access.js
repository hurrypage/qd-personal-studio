(() => {
  'use strict';
  const key = 'qd-personal-unlocked';
  const form = document.getElementById('accessForm');
  const input = document.getElementById('accessPassword');
  const message = document.getElementById('accessMessage');
  let loading = false;
  window.lockWorkspace = () => {
    try { sessionStorage.removeItem(key); } catch (_) {}
    location.reload();
  };
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  async function unlock() {
    if (loading) return;
    loading = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message.textContent = '正在打开观察台…';
    const dashboard = document.createElement('div');
    dashboard.id = 'personalDashboard';
    dashboard.hidden = false;
    dashboard.appendChild(document.getElementById('dashboardTemplate').content.cloneNode(true));
    document.body.appendChild(dashboard);
    document.getElementById('accessScreen').style.display = 'none';
    try {
      await loadScript('./app.js');
      await loadScript('./ui.js');
      try { sessionStorage.setItem(key, 'yes'); } catch (_) {}
      document.getElementById('accessScreen').remove();
      dashboard.hidden = false;
    } catch (_) {
      dashboard.hidden = true;
      document.getElementById('accessScreen').style.display = '';
      // Reload before retrying so partially loaded scripts cannot initialize twice.
      message.textContent = '页面加载失败，请刷新后重试。';
      submit.textContent = '刷新重试';
      submit.disabled = false;
      submit.onclick = () => location.reload();
    }
  }
  document.getElementById('togglePassword').addEventListener('click', event => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? '隐藏' : '显示';
    event.currentTarget.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
  });
  input.addEventListener('input', () => {
    message.textContent = '';
    input.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (input.value !== '1234') {
      message.textContent = '密码不正确，请重新输入。';
      input.setAttribute('aria-invalid', 'true');
      input.select();
      return;
    }
    unlock();
  });
  try { if (sessionStorage.getItem(key) === 'yes') unlock(); } catch (_) {}
})();
