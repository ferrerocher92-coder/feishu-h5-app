# PROJECT_STATUS.md - feishu-h5-app 项目状态

## 基本信息

- **项目名称**：飞书网页应用 - 客户录入助手
- **接手时间**：2026-03-21 00:36
- **当前状态**：🧪 E2E 测试阶段
- **源码位置**：`~/Desktop/feishu-h5-app/`
- **GitHub**：https://github.com/ferrerocher92-coder/feishu-h5-app
- **技术栈**：原生 HTML/CSS/JS，Hash 路由，飞书 OAuth 2.0

## 部署状态

| 服务 | 地址 | 状态 |
|------|------|------|
| GitHub Pages H5 | https://ferrerocher92-coder.github.io/feishu-h5-app/ | ✅ 已部署 |
| 腾讯云 COS（备用） | https://feishu-h5-app-1344246142.cos-website.ap-guangzhou.myqcloud.com/ | ✅ 已部署 |
| CORS 代理 SCF | https://1344246142-c7615ig2lb.ap-guangzhou.tencentscf.com | ✅ 运行中 |

## 飞书配置

- **APP_ID**：`cli_a9365221543a5ccc`
- **REDIRECT_URI**：`https://ferrerocher92-coder.github.io/feishu-h5-app/pages/callback.html`
- 可信域名：`https://ferrerocher92-coder.github.io`（已配置）

## 最新里程碑

### ✅ GitHub Pages 路径修复（2026-03-22）

**问题**：登录回调后 404，原因多个路径错误累积

**修复内容**：
1. `index.html` 重定向路径 `feishu-h5-app/pages/login.html` → `pages/login.html`
2. `pages/customer_list.html` 补齐缺失的 `api.js` 和 `auth.js` 引用
3. `pages/customer_list.html` 添加 `?v=2` 版本参数强制刷新 JS 缓存
4. `pages/callback.html` 跳转路径 `../index.html` → `index.html`

**Git commits**：
- `98517dc` - 修正 index.html 重定向路径
- `96cdde0` - 补齐 customer_list.html 缺失的 api.js 和 auth.js 引用
- `1a7bcca` - 添加版本参数强制刷新JS缓存
- `c7d1388` - callback.html 跳转路径修正

**验证结果**：
- ✅ GitHub Pages 主页可访问
- ✅ 飞书登录授权页正常显示
- ✅ 用户 Jimmy 授权成功
- 🧪 callback.html 跳转仍在调试中（当前 404）

### ✅ 安全修复（2026-03-21）
**问题**：APP_SECRET 硬编码在前端代码中，严重安全风险

**修复方案**：
1. 前端 `auth.js`：TOKEN_URL 改为 SCF 代理地址，前端不再发送 app_secret
2. SCF 云函数：新增 `/exchange-token` 接口，环境变量存储 APP_SECRET
3. `config.js`：移除 APP_SECRET 配置项

## 已知问题

### 🔧 callback.html 跳转 404（调试中）
- **现象**：飞书授权后回调到 `callback.html`，然后跳转到根目录 `/index.html` 而非 `/feishu-h5-app/index.html`
- **已尝试**：修改 `callback.html` 第 108 行 `resolveUrl('../index.html')` → `resolveUrl('index.html')`
- **状态**：commit `c7d1388` 已 push，待验证

## 腾讯云资源

- **COS Bucket**：`feishu-h5-app-1344246142`（广州）
- **SCF 函数**：`feishu-cors-proxy`（广州）
- **SecretId**：已配置 SCF 环境变量
- **SecretKey**：已移除（安全原因）

## 团队架构

| 角色 | 类型 | 状态 |
|------|------|------|
| PM (我) | 项目统筹 | ✅ 在职 |
| QA | subagent，常驻 | 🧪 E2E 测试中 |
| 后端工程师 | subagent，动态 | ✅ 已完成 |
| 前端工程师 | subagent，动态 | ✅ 已完成 |

## 下一步

1. [ ] 修复 callback.html 跳转 404 问题
2. [ ] 完成 E2E 测试（登录 → 客户列表 → 新增客户）
3. [ ] 飞书内嵌应用调试（可选）
4. [ ] 正式上线

## 历史决策

- **2026-03-22**：修复 GitHub Pages 多处路径错误（index.html、customer_list.html、callback.html）
- **2026-03-21**：从 Vercel 切换到腾讯云（大陆访问问题）
- **2026-03-21**：从腾讯云 COS 切换到 GitHub Pages（飞书可信域名要求）
- **2026-03-21**：从独立 H5 改为飞书内嵌应用方向
- **2026-03-21**：移除前端 APP_SECRET，改走 SCF 代理（安全修复）
