/**
 * config.js - 全局配置文件
 */
const CONFIG = (function () {
  const defaults = {
    APP_ID: 'cli_a9365221543a5ccc',
    REDIRECT_URI: 'https://ferrerocher92-coder.github.io/feishu-h5-app/pages/callback.html',
    APP_SECRET: 'o08J7194FRXuGPffPICd6cHb6gyKWjBY',
    API_BASE: 'https://open.feishu.cn/open-apis',
    H5_APP_PROXY_URL: 'https://1344246142-c7615ig2lb.ap-guangzhou.tencentscf.com',
    APP_BASE: '/feishu-h5-app/',
  };
  return defaults;
})();

function applyBaseHref() {
  const base = document.createElement('base');
  base.href = CONFIG.APP_BASE;
  base.target = '_self';
  document.head.prepend(base);
}

function resolveUrl(relativePath) {
  if (relativePath.startsWith('http') || relativePath.startsWith('/')) {
    return relativePath;
  }
  return CONFIG.APP_BASE.replace(/\/$/, '') + '/' + relativePath;
}

function navigateTo(path) {
  window.location.href = resolveUrl(path);
}

window.CONFIG = CONFIG;
window.applyBaseHref = applyBaseHref;
window.resolveUrl = resolveUrl;
window.navigateTo = navigateTo;
window.H5_APP_PROXY_URL = CONFIG.H5_APP_PROXY_URL;
