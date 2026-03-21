cret（仅用于 OAuth callback 页）
 * - REDIRECT_URI: OAuth 回调地址，需与飞书开放平台配置一致
 * - API_BASE: 飞书 Open API 基础地址
 * - APP_BASE: 应用部署路径，用于动态设置 base href 和路由
 *   （本地开发: /customer-app-h5/，生产环境请修改为实际路径或通过 URL 参数 ?base= 设置）
 */
const CONFIG = (function () {
  // 默认配置
  const defaults = {
    APP_ID: 'cli_a9365221543a5ccc',
    // 【重要】REDIRECT_URI 必须与飞书开放平台应用配置中的「重定向URL」完全一致
    REDIRECT_URI: 'https://ferrerocher92-coder.github.io/feishu-h5-app/pages/callback.html',
    APP_SECRET: 'o08J7194FRXuGPffPICd6cHb6gyKWjBY', // 仅在 callback.html 中使用
    API_BASE: 'https://open.feishu.cn/open-apis',
    // 【重要】APP_BASE 必须与 Web 服务器配置一致
    // 用于动态设置 <base href> 和页面间相对路径
    // GitHub Pages: /feishu-h5-app/
    H5_APP_PROXY_URL: 'https://1344246142-c7615ig2lb.ap-guangzhou.tencentscf.com',

    APP_BASE: '/feishu-h5-app/',
  };

  return defaults;
})();

// 辅助函数：动态设置 <base href>（由 index.html 调用）
function applyBaseHref() {
  const base = document.createElement('base');
  base.href = CONFIG.APP_BASE;
  // 让链接默认在当前窗口打开（不受 base 影响）
  base.target = '_self';
  document.head.prepend(base);
}

// 辅助函数：获取完整路径（带 APP_BASE 前缀）
function resolveUrl(relativePath) {
  // 确认为相对路径才拼接
  if (relativePath.startsWith('http') || relativePath.startsWith('/')) {
    return relativePath;
  }
  return CONFIG.APP_BASE.replace(/\/$/, '') + '/' + relativePath;
}

// 辅助函数：跳转页面（自动加 APP_BASE 前缀）
function navigateTo(path) {
  window.location.href = resolveUrl(path);
}

// 挂载到全局
window.CONFIG = CONFIG;
window.applyBaseHref = applyBaseHref;
window.resolveUrl = resolveUrl;
window.navigateTo = navigateTo;
// 【Bug3修复 - 2026-03-21】将 H5_APP_PROXY_URL 暴露到 window，供 customer_form.js 使用
window.H5_APP_PROXY_URL = CONFIG.H5_APP_PROXY_URL;
