# 飞书 CORS 代理 - 部署指南

> Phase 1 交付物：Cloudflare Workers CORS 代理，解决 H5 应用浏览器端调用飞书 Open API 的跨域问题。

---

## 目录

1. [快速部署](#快速部署)
2. [部署后配置](#部署后配置)
3. [本地测试](#本地测试)
4. [代理的 API 列表](#代理的-api-列表)
5. [已知问题](#已知问题)

---

## 快速部署

### 前置条件

- [Cloudflare 账号](https://dash.cloudflare.com/)（免费即可）
- Node.js 16+ 环境

### 步骤

```bash
# 1. 进入代理目录
cd ~/Desktop/feishu-h5-app/cors-proxy

# 2. 全局安装 Wrangler CLI
npm install -g wrangler

# 3. 登录 Cloudflare
wrangler login
# 会打开浏览器，按提示授权

# 4. 本地开发测试
wrangler dev
# 输出类似：http://127.0.0.1:8787

# 5. 部署到生产
wrangler deploy
# 部署成功后输出：https://feishu-cors-proxy.<your-subdomain>.workers.dev
```

> ⚠️ **首次部署时**，Cloudflare 会让你选择 `zone`（你的域名）。如果没有域名，直接选 `workers.dev`（免费子域名）。

---

## 部署后配置

### 步骤 1：获取代理地址

部署成功后，你会得到一个类似下面的 URL：

```
https://feishu-cors-proxy.你的账号.workers.dev
```

### 步骤 2：更新 config.js

```bash
# 编辑配置文件
open ~/Desktop/feishu-h5-app/js/config.js
```

将 `H5_APP_PROXY_URL` 的值改为你的代理地址：

```javascript
// 原来（空，需要填写）
H5_APP_PROXY_URL: '',

// 改为（示例，请替换为你的实际地址）
H5_APP_PROXY_URL: 'https://feishu-cors-proxy.abc123.workers.dev',
```

### 步骤 3：重新部署 H5 应用

```bash
# 进入 H5 应用目录
cd ~/Desktop/feishu-h5-app/

# 使用 Vercel 部署（推荐）
vercel --prod

# 或直接用 Vercel CLI
vercel deploy --prod
```

---

## 本地测试

### 测试 OAuth Token 获取（绕过 CORS）

```bash
# 启动本地代理
cd ~/Desktop/feishu-h5-app/cors-proxy
wrangler dev

# 在另一个终端，用代理地址测试
curl -X POST "http://127.0.0.1:8787/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"cli_a9365221543a5ccc","app_secret":"o08J7194FRXuGPffPICd6cHb6gyKWjBY"}'
```

### 预期输出

```json
{
  "code": 0,
  "expire": 7200,
  "msg": "ok",
  "tenant_access_token": "t-xxxxxx..."
}
```

---

## 代理的 API 列表

以下飞书 Open API 路径已配置白名单代理：

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/open-apis/auth/v3/app_access_token/internal` | 获取 App Token |
| POST | `/open-apis/auth/v3/tenant_access_token/internal` | 获取 Tenant Token |
| POST | `/open-apis/authen/v1/oidc/access_token` | OAuth code 换 token |
| GET | `/open-apis/authen/v1/user_info` | 获取用户信息 |
| POST | `/open-apis/authen/v1/refresh_access_token` | 刷新 Token |
| POST | `/open-apis/bitable/v1/apps` | 创建多维表格 |
| POST | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records` | 新增记录 |
| POST | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search` | 搜索记录 |
| PUT | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}` | 更新记录 |
| DELETE | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}` | 删除记录 |
| POST | `/open-apis/drive/v1/files/upload_all` | 上传文件 |
| POST | `/open-apis/drive/v1/files/create_folder` | 创建文件夹 |

---

## 已知问题

### Q: 为什么使用 Cloudflare Workers 而不是自己的服务器？

A: Cloudflare Workers 有以下优势：
- **免费额度**：每天 10 万次请求足够小规模使用
- **边缘部署**：全球低延迟
- **无需服务器管理**
- **自带 HTTPS**

### Q: token 过期怎么办？

A: 飞书 `user_access_token` 有效期 2 小时，`refresh_token` 有效期 30 天。H5 应用在 `api.js` 中已处理 401 自动跳转登录。

### Q: 生产环境可以限制 CORS 来源吗？

A: 可以。将 `worker.js` 中的 `CORRECT_ORIGIN = '*'` 改为具体域名：

```javascript
const CORRECT_ORIGIN = 'https://your-domain.com'; // 例如你的 Vercel 域名
```

### Q: 飞书要求 HTTPS，代理支持吗？

A: Cloudflare Workers 默认提供 HTTPS，无需额外配置。

---

## Phase 1 验证结果摘要

```
✅ Tenant Token 获取     → 成功 (code=0)
✅ Bitable 创建          → 成功 (app_token=OX2wbEsc3aEEl4suQ4Ncu6e2nXd)
✅ 字段创建 (8个)         → 全部成功 (code=0)
✅ 新增记录               → 成功 (record_id=recvesoL7OBIHx)
✅ 搜索记录               → 成功 (找到1条)
✅ 更新记录               → 成功 (code=0)
✅ 删除记录               → 成功 (deleted=true)
```

---

## 文件清单

```
cors-proxy/
├── worker.js      # Cloudflare Worker 源码（主逻辑）
├── wrangler.toml  # Wrangler 部署配置
└── README.md      # 本文件
```
