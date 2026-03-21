# 飞书 H5 应用 - 部署上线指南

> 本文档指导运营/运维人员将飞书 H5 应用部署至生产环境。

---

## 一、项目结构速览

```
feishu-h5-app/
├── index.html              # 应用入口
├── 404.html                # Vercel/Netlify 需要
├── pages/
│   ├── login.html          # 登录页
│   ├── callback.html       # OAuth 回调页
│   ├── customer_list.html  # 客户列表页
│   └── customer_form.html  # 客户表单页
├── js/
│   ├── config.js           # 全局配置（核心）
│   ├── auth.js             # 鉴权逻辑
│   ├── api.js              # API 请求封装
│   ├── app.js              # 主应用逻辑
│   ├── customer_list.js    # 客户列表
│   └── customer_form.js    # 客户表单
└── css/                    # 样式文件
```

---

## 二、部署方式推荐：Vercel

### 步骤 1：打包静态文件

本项目为纯静态 H5 应用，无需构建步骤。

```bash
# 进入项目目录
cd feishu-h5-app/

# 直接将整个目录部署即可
```

### 步骤 2：Vercel 部署流程

**方式 A：Vercel CLI（推荐）**

```bash
# 1. 全局安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 进入项目目录，初始化（首次）
cd feishu-h5-app/
vercel

# 4. 回答交互问题：
#    - Set up and deploy?  → Yes
#    - Which scope?        → 选择你的个人/团队 scope
#    - Link to existing project? → No（首次）
#    - Project name?       → 如 feishu-h5-app
#    - Directory?          → ./
#    - Override settings?  → No

# 5. 部署 preview 环境（测试用）
vercel

# 6. 确认无误后，正式生产部署
vercel --prod
```

**方式 B：GitHub 关联部署（推荐团队协作）**

1. 将 `feishu-h5-app/` 目录推送到 GitHub 仓库
2. 登录 [vercel.com](https://vercel.com)
3. New Project → Import Git Repository → 选择仓库
4. Framework Preset 选择 `Other`
5. Root Directory 保持默认 `./`
6. Build Command 留空（静态项目无需构建）
7. 点击 Deploy

**方式 C：Netlify**

1. 登录 [app.netlify.com](https://app.netlify.com)
2. Add new site → Deploy manually → 拖入 `feishu-h5-app/` 目录
3. Netlify 会自动识别为静态站点
4. Site settings → Branch: `main` → 开启生产部署

### 步骤 3：域名绑定和 HTTPS

**Vercel 自动提供 HTTPS**（由 Vercel/Cloudflare 签发），无需手动配置。

如需绑定自定义域名：

```
Vercel Dashboard → Project → Settings → Domains
→ 添加你的域名（如 app.yourcompany.com）
→ 按提示在 DNS 服务商处添加 CNAME 记录
→ 等待 HTTPS 证书自动签发（约 1-5 分钟）
```

**注意事项：**
- 自定义域名添加后，生产域名会自动切换
- 建议同步在飞书开放平台更新 `REDIRECT_URI` 为新的 HTTPS 域名

**关于 vercel.json（可选）：**

如果项目需要精细控制 Vercel 行为，可在项目根目录创建 `vercel.json` 文件（简单部署可省略）：

```json
{
  "routes": [
    { "src": "/(.*)", "dest": "/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

> 💡 `vercel.json` 还可用于导入环境变量（`env` 字段）、配置重定向（`rewrites`）、设置 Edge Functions 等高级功能。具体参考 [Vercel Configuration](https://vercel.com/docs/projects/project-configuration)。

---

## 三、飞书开放平台配置清单

> 完成以下配置后，才能通过飞书内嵌方式正常访问应用。

### 3.1 App ID 和 App Secret 获取位置

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 点击右上角「开发者后台」
3. 选择你的应用 → 「凭证与基础信息」
4. 复制 `App ID` 和 `App Secret`

> ⚠️ `App Secret` 请妥善保管，**不要提交到 GitHub 等公开仓库**。

### 3.2 H5 应用能力配置

1. 在应用详情页左侧菜单，点击「添加应用能力」
2. 选择「网页」类型
3. 配置「运行页面」：
   - 开发阶段：`http://localhost:端口号/customer-app-h5/index.html`
   - 生产环境：`https://你的域名/customer-app-h5/index.html`
4. 配置「可信域名」：填入你的部署域名（如 `your-app.vercel.app`），**不带协议头**
5. 开启「支持在飞书内打开」

### 3.3 重定向 URL（Redirect URI）填写要求

> ⚠️ **此配置最为关键，必须与 `js/config.js` 中 `REDIRECT_URI` 完全一致（包括协议、域名、路径、大小写），否则 OAuth 授权流程会失败。**

在飞书开放平台「安全设置」中填写：

```
生产环境格式：
https://你的域名/customer-app-h5/pages/callback.html

本地开发格式（可选，如果需要在本地测试完整 OAuth 流程）：
http://localhost:端口号/customer-app-h5/pages/callback.html
```

### 3.4 需要开通的权限清单

在飞书开放平台「权限管理」中，开通以下权限：

| 权限名称 | 权限标识 | 用途 |
|---------|---------|------|
| ~~获取 tenant_access_token~~ | ~~`tenant_access_token`~~ | ⚠️ **不是权限**。通过 `auth/v3/tenant_access_token/internal` 接口自动获取，无需申请 |
| 查看、评论和导出文档 | `docx:document:readonly` | 文档相关（如有） |
| 获取文件元信息 | `drive:file:readonly` | 文件操作 |
| 上传、下载文件或压缩包 | `drive:file` | 文件上传 |
| 获取用户基本信息 | `contact:user.base:readonly` | 用户信息获取 |
| 查看多维表格 | `bitable:app:readonly` | Bitable 读取 |
| 编辑多维表格 | `bitable:app` | Bitable 写入 |

> ⚠️ `tenant_access_token` 是调用接口后获得的响应数据，不是权限标识，无需在开放平台申请。<br>
> 上表中除第一行外，其余权限均需在飞书开放平台「权限管理」中开通，开通后需**发布应用版本**才会生效。

#### 3.5 应用版本发布流程

权限开通后，必须发布新版本才能生效：

1. 在应用详情页左侧菜单，点击「**应用功能**」→「**版本管理与发布**」
2. 点击「**创建版本**」，填写版本号（如 `1.0.0`）和更新说明
3. 如应用为**企业内部自用**，可选择「**直接发布**」（无需审核）
4. 如应用面向**第三方用户**，需提交审核，由企业管理员审批后生效
5. 版本发布后，权限变更才会对终端用户生效

> 💡 测试阶段建议先在「版本管理与发布」中创建**测试版本**，确认功能正常后再发布正式版本。

---

## 四、CORS 代理部署指南

### 4.1 H5_APP_PROXY_URL 的作用

由于浏览器同源策略限制，H5 页面直接调用飞书 Open API（`https://open.feishu.cn`）会被 CORS 拦截。`H5_APP_PROXY_URL` 用于指定一个代理服务地址，由代理将请求转发到飞书 API。

**请求流程：**
```
H5 页面 → H5_APP_PROXY_URL（你的代理）→ https://open.feishu.cn/open-apis
```

> ⚠️ 生产环境必须配置此代理，否则所有飞书 API 请求均会失败。

### 4.2 推荐方案：Cloudflare Workers（免费、低延迟）

#### 4.2.1 创建 Workers 服务

1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号（免费）
2. 进入 Workers & Pages → 创建 Worker
3. 随意命名（如 `feishu-proxy`）
4. 粘贴以下代理脚本代码

#### 4.2.2 Workers 代理脚本

```javascript
/**
 * Cloudflare Worker - 飞书 Open API CORS 代理
 * 
 * 使用方式：
 * 1. 部署此 Worker，获得一个 .workers.dev 域名
 *    例如：https://feishu-proxy.你的名称.workers.dev
 * 2. 在 js/config.js 中设置：
 *    H5_APP_PROXY_URL: 'https://feishu-proxy.你的名称.workers.dev'
 * 3. 前端所有飞书 API 请求将通过此代理转发
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis'

// 需要转发的 API 路径前缀
const ALLOWED_PATHS = [
  '/open-apis/auth/v3/app_access_token/internal',
  '/open-apis/auth/v3/tenant_access_token/internal',
  '/open-apis/bitable/v1/apps',
  '/open-apis/drive/v1/files/upload_all',
  '/open-apis/drive/v1/files/create_folder',
]

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // 将请求路径拼接到飞书 API 基础地址
  const targetUrl = FEISHU_API_BASE + url.pathname + url.search
  
  // 构造新的请求，透传 method、headers、body
  const headers = new Headers(request.headers)
  // 不允许手动覆盖 host
  headers.set('host', 'open.feishu.cn')
  // 移除 CF 相关的 headers
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')
  headers.delete('cf-request-id')
  headers.delete('cf-worker')
  
  const feishuResponse = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  })
  
  // 构造响应，透传状态码和 headers
  const responseHeaders = new Headers(feishuResponse.headers)
  // 允许跨域访问（⚠️ 当前为全开放代理，生产环境如需携带 credentials（cookie），需将 '*' 替换为具体域名）
  responseHeaders.set('Access-Control-Allow-Origin', '*')
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  return new Response(feishuResponse.body, {
    status: feishuResponse.status,
    statusText: feishuResponse.statusText,
    headers: responseHeaders,
  })
}
```

#### 4.2.3 部署 Worker

1. 在 Cloudflare Dashboard 编辑 Worker 代码，粘贴上述脚本
2. 点击「部署」
3. 获取 Worker 域名（如 `feishu-proxy.你的账号.workers.dev`）
4. 将此 URL 填入 `js/config.js` 的 `H5_APP_PROXY_URL` 字段

### 4.3 备选方案：Nginx 配置

如果已有 Nginx 服务器，可在 server 块中添加反向代理：

```nginx
server {
    listen 443 ssl;
    server_name your-proxy.example.com;

    # SSL 证书配置（略）

    location /feishu-proxy/ {
        # 去掉 /feishu-proxy/ 前缀，转发到飞书 API
        rewrite ^/feishu-proxy/(.*) /$1 break;
        proxy_pass https://open.feishu.cn;
        
        # 透传必要 headers
        proxy_set_header Host open.feishu.cn;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 处理 CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
        
        # 处理 OPTIONS 预检请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
}
```

> 注意：使用 Nginx 方案时，`H5_APP_PROXY_URL` 应设置为 `https://your-proxy.example.com/feishu-proxy/`（注意尾部斜杠）。

---

## 五、环境配置

### 5.1 js/config.js 关键配置项

| 配置项 | 说明 | 生产环境是否需要修改 |
|-------|------|-------------------|
| `APP_ID` | 飞书应用 App ID | ✅ 必须改为生产 App ID |
| `APP_SECRET` | 飞书应用 App Secret | ✅ 必须改为生产 App Secret |
| `REDIRECT_URI` | OAuth 回调地址 | ✅ 必须与飞书平台配置一致 |
| `API_BASE` | 飞书 API 基础地址 | ❌ 通常不需要修改 |
| `H5_APP_PROXY_URL` | CORS 代理地址 | ✅ 生产环境必须填写 |
| `APP_BASE` | 应用部署路径 | ✅ 需与部署路径一致 |

#### 5.2 APP_BASE 路径对照表

`APP_BASE` 应与实际部署路径完全一致，以下是常见场景对照：

| 部署场景 | APP_BASE | 示例说明 |
|---------|---------|---------|
| Vercel 部署到根域名（如 myapp.vercel.app） | `/` | 域名直接指向应用，无需子路径 |
| Vercel 部署到子路径（如 myapp.vercel.app/customer-app） | `/customer-app` | Vercel 项目配置了 Subpath Routing |
| Nginx 部署到子路径 `/customer-app-h5/` | `/customer-app-h5` | location 配置了 `/customer-app-h5/` |
| 本地开发（http://localhost:8080） | `/` | 无子路径时填 `/` |

> 💡 如果部署后页面空白或资源 404，首先检查此项是否与实际路径一致。

#### 5.3 APP_SECRET 生产管理

> ⚠️ **`APP_SECRET` 不得硬编码在代码中，更不得提交到 GitHub 等公开仓库。**

**推荐方案：使用 Vercel Secrets（或 Netlify 环境变量）存储**

**Vercel 设置步骤：**

1. 进入 Vercel 项目 Dashboard → **Settings** → **Environment Variables**
2. 点击 **Add New** → 添加以下变量：
   - Name: `FEISHU_APP_SECRET`
   - Value: 你的生产环境 App Secret 值
   - Environments: 勾选 ✅ **Production**、✅ Preview、✅ Development（按需）
3. 点击 **Save**
4. 重新部署生产环境（`vercel --prod`），Vercel 会自动注入该环境变量

**在 `js/config.js` 中读取：**

```javascript
// Vercel/Netlify 会自动将环境变量注入到 process.env
const APP_SECRET = process.env.FEISHU_APP_SECRET || 'fallback_dev_secret';
```

> 💡 同理，`APP_ID` 也推荐使用环境变量管理（变量名如 `FEISHU_APP_ID`），避免生产/开发配置混在代码里。

### 5.4 本地开发 vs 生产环境配置切换

`config.js` 支持三级配置优先级（从高到低）：

```
URL 参数 (?redirect=xxx & base=xxx)
    ↓ 最高优先级，用于本地开发多环境切换
localStorage 覆盖（用户在应用内手动设置）
    ↓ 次优先级，用于部署后持久化
代码默认值（CONFIG.defaults 对象）
    ↓ 最低优先级
```

**本地开发：**
- 直接修改 `config.js` 中的默认值
- 或通过 URL 参数快速切换：`http://localhost:端口/index.html?redirect=http://localhost:端口/callback&base=/customer-app-h5`
- 或通过浏览器 console 设置 localStorage：
  ```javascript
  localStorage.setItem('feishu_config_redirect_uri', 'http://localhost:端口/customer-app-h5/pages/callback.html')
  localStorage.setItem('feishu_config_app_base', '/customer-app-h5')
  ```

**生产环境：**
- 修改 `config.js` 中的默认值为生产环境值
- 特别提醒：`H5_APP_PROXY_URL` 必须填写，否则 API 调用会被 CORS 拦截

**多环境切换（推荐方式）：**
为避免生产环境误用开发配置，建议在 `config.js` 顶部加一个环境标记：

```javascript
// === 环境配置 ===
const ENV = 'production';  // 可选值: 'development' | 'production'

const ENV_CONFIGS = {
  development: {
    APP_ID: 'cli_xxx_dev',
    APP_SECRET: 'xxx_dev',
    REDIRECT_URI: 'http://localhost:端口/customer-app-h5/pages/callback.html',
    H5_APP_PROXY_URL: '',  // 本地开发如果遇到 CORS 可留空，或填本地代理
    APP_BASE: '/customer-app-h5',
  },
  production: {
    APP_ID: 'cli_xxx_prod',
    APP_SECRET: 'xxx_prod',
    REDIRECT_URI: 'https://你的域名/customer-app-h5/pages/callback.html',
    H5_APP_PROXY_URL: 'https://feishu-proxy.你的账号.workers.dev',  // ⚠️ 必填
    APP_BASE: '/customer-app-h5',  // Vercel 通常不需要前缀，如果域名直接指向此目录则留空
  },
};
```

---

## 六、部署前自检清单

> 上线前请逐项核对，全部通过后方可发布。

### 6.1 飞书开放平台配置

- [ ] `App ID` 已填写（生产环境 App ID，非测试版）
- [ ] `App Secret` 已填写（非测试版 Secret）
- [ ] 重定向 URL 已填写，与 `config.js` 中 `REDIRECT_URI` 完全一致（包括协议 https、域名、路径每个字符）
- [ ] 所需权限已全部开通并发布应用版本
- [ ] 「运行页面」已配置为生产环境 URL
- [ ] 「可信域名」已填写部署域名（不带 https://）

### 6.2 CORS 代理

- [ ] Cloudflare Worker 已部署并可访问（访问 `https://你的-worker.workers.dev/open-apis/auth/v3/app_access_token/internal` 应返回 JSON）
- [ ] `config.js` 中 `H5_APP_PROXY_URL` 已填写完整 URL（带 `https://`，尾部不带斜杠）
- [ ] 代理已放行所有飞书 Open API 路径（包括 auth、bitable、drive 等）<br>　　💡 当前为全开放代理，生产环境如需携带 credentials（cookie），需将 `Access-Control-Allow-Origin: *` 替换为具体域名

### 6.3 环境配置

- [ ] `APP_ID` 已更改为生产 App ID
- [ ] `APP_SECRET` 已更改为生产 App Secret
- [ ] `REDIRECT_URI` 已更改为生产回调地址
- [ ] `APP_BASE` 已与实际部署路径一致
- [ ] `H5_APP_PROXY_URL` 已填写（生产环境必填）
- [ ] `API_BASE` 保持 `https://open.feishu.cn/open-apis`（通常不需要改）

### 6.4 部署验证

- [ ] 应用可通过 HTTPS 正常访问
- [ ] 飞书内嵌打开应用可正常加载
- [ ] 点击登录后，OAuth 授权流程可完成回调
- [ ] 回调页面（callback.html）可成功获取 token
- [ ] 客户列表页可正常调用 Bitable 数据
- [ ] 客户表单提交功能正常
- [ ] 文件上传功能正常（如有）

### 6.5 安全检查

- [ ] `APP_SECRET` 未提交到 GitHub 等公开仓库
- [ ] 生产环境使用 HTTPS
- [ ] `H5_APP_PROXY_URL` 代理服务未对公众开放不必要的 API

---

## 七、常见问题

**Q：CORS 代理部署后仍然报跨域错误？**

A：检查以下两点：
1. `H5_APP_PROXY_URL` 是否以 `https://` 开头
2. Cloudflare Worker 是否正确返回了 `Access-Control-Allow-Origin: *` header（用浏览器 Network 面板查看响应头）

**Q：OAuth 回调失败，提示 redirect_uri 不匹配？**

A：飞书平台配置的 redirect_uri 必须与 `config.js` 中 `REDIRECT_URI` **逐字符完全一致**。常见错误：多了/少了尾部斜杠、大小写不一致、协议写成 http 而非 https。

**Q：Vercel 部署后页面空白？**

A：检查 `APP_BASE` 是否与实际部署路径匹配。如果部署在根路径，改为 `/` 或留空。

---

*文档版本：v1.0 | 更新日期：2026-03-21*
