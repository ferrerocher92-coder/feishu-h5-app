const FEISHU_API_BASE = 'https://open.feishu.cn';

const ALLOWED_PATHS = [
  '/open-apis/auth/v3/app_access_token/internal',
  '/open-apis/auth/v3/tenant_access_token/internal',
  '/open-apis/authen/v1/user_info',
  '/open-apis/authen/v1/oidc/access_token',
  '/open-apis/authen/v1/refresh_access_token',
  '/open-apis/bitable/v1/apps',
  '/open-apis/drive/v1/files/upload_all',
  '/open-apis/drive/v1/files/create_folder',
];

function isPathAllowed(path) {
  if (ALLOWED_PATHS.includes(path)) return true;
  if (path.startsWith('/open-apis/bitable/v1/apps/')) return true;
  return false;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).send('');
    return;
  }

  if (!isPathAllowed(path)) {
    res.status(403).json({ code: 403, msg: 'Forbidden' });
    return;
  }

  const target = `${FEISHU_API_BASE}${path}${url.search}`;

  try {
    const authHeader = req.headers.authorization || '';

    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (authHeader) fetchOptions.headers['Authorization'] = authHeader;

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = req.body;
    }

    const resp = await fetch(target, fetchOptions);
    const text = await resp.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(resp.status).send(text);
  } catch (err) {
    res.status(502).json({ code: 502, msg: err.message });
  }
};
