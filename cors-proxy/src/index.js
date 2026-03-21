/**
 * Cloudflare Worker - 飞书 Open API CORS 代理
 * 
 * 用途：解决 H5 应用在浏览器直接调用飞书 Open API 的 CORS 跨域问题
 * 
 * 部署方式：
 * 1. npm install -g wrangler
 * 2. wrangler login
 * 3. wrangler init feishu-proxy
 * 4. 将本文件内容替换到 feishu-proxy/src/index.js
 * 5. wrangler deploy
 * 
 * 或使用 npx wrangler dev 本地测试
 */

const CORRECT_ORIGIN = '*'; // 生产环境可改为具体域名限制

// 飞书 Open API 基础地址
const FEISHU_API_BASE = 'https://open.feishu.cn';

// 允许代理的 API 路径白名单
const ALLOWED_PATHS = [
  // Auth APIs
  '/open-apis/auth/v3/app_access_token/internal',
  '/open-apis/auth/v3/tenant_access_token/internal',
  '/open-apis/authen/v1/user_info',
  '/open-apis/authen/v1/oidc/access_token',
  '/open-apis/authen/v1/refresh_access_token',
  
  // Bitable APIs
  '/open-apis/bitable/v1/apps',
  '/open-apis/bitable/v1/apps/',  // 动态路径（带 app_token）
  
  // Drive APIs
  '/open-apis/drive/v1/files/upload_all',
  '/open-apis/drive/v1/files/create_folder',
];

function isPathAllowed(path) {
  // 精确匹配
  if (ALLOWED_PATHS.includes(path)) return true;
  
  // 动态路径匹配（/open-apis/bitable/v1/apps/{app_token}/...）
  if (path.startsWith('/open-apis/bitable/v1/apps/')) return true;
  
  return false;
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': CORRECT_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Lark-Request-TTL',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Expose-Headers': 'X-Lark-Request-Id',
    },
  });
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  // 检查路径是否允许
  if (!isPathAllowed(path)) {
    return new Response(JSON.stringify({
      code: 403,
      msg: 'Forbidden: path not allowed by proxy'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 转发请求到飞书 API
  const targetUrl = `${FEISHU_API_BASE}${path}${url.search}`;

  // 提取原始请求头（过滤不合法的）
  const requestHeaders = {};
  const excludeHeaders = ['host', 'cf-connecting-ip', 'cf-ray', 'cf-request-id', 'x-forwarded-proto'];
  for (const [key, value] of Object.entries(request.headers)) {
    if (!excludeHeaders.includes(key.toLowerCase())) {
      requestHeaders[key] = value;
    }
  }

  // 构造新的请求选项
  const fetchOptions = {
    method: request.method,
    headers: requestHeaders,
  };

  // 如果有请求体，且是 POST/PUT，则转发body
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    // 尝试读取原始body
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        fetchOptions.body = await request.text();
      } else if (contentType.includes('multipart/form-data')) {
        // 文件上传，FormData 直接转发
        fetchOptions.body = await request.arrayBuffer();
        fetchOptions.headers['Content-Type'] = contentType;
      } else {
        fetchOptions.body = await request.text();
      }
    } catch (e) {
      console.error('Failed to read request body:', e);
    }
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    // 复制响应头
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      // 排除一些代理不需要的响应头
      if (!['content-encoding', 'transfer-encoding', 'connection', 'vary'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    }

    // 添加 CORS 头
    responseHeaders['Access-Control-Allow-Origin'] = CORRECT_ORIGIN;
    responseHeaders['Access-Control-Expose-Headers'] = 'X-Lark-Request-Id';

    const responseBody = await response.arrayBuffer();

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy fetch error:', error);
    return new Response(JSON.stringify({
      code: 502,
      msg: `Proxy error: ${error.message}`
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': CORRECT_ORIGIN,
      },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
