# feishu-h5-app 项目状态文档

> 本文件由 PM (AI) 自动维护，每次重要更新后修改。
> 如果遇到 session reset，读取此文件恢复上下文。

---

## 项目概述

- **项目名称**：飞书 H5 客户录入助手
- **项目类型**：飞书网页应用（独立 H5 + OAuth 登录）
- **启动时间**：2026-03-21
- **目标**：销售人员通过手机浏览器录入客户信息，数据存储在飞书多维表格（Bitable）

---

## 当前状态

### 部署架构

```
用户手机浏览器
    │
    ├── 访问 GitHub Pages → H5 应用静态文件
    │
    └── API 请求 → 腾讯云 SCF（CORS 代理）→ 飞书 Open API → 飞书 Bitable
```

### 已完成
- [x] H5 前端开发
- [x] 飞书 OAuth 登录流程
- [x] 客户 CRUD 功能（新增/编辑/删除）
- [x] 照片上传功能
- [x] 腾讯云 COS 静态托管（备用）
- [x] 腾讯云 SCF CORS 代理
- [x] GitHub 仓库创建
- [x] GitHub Pages 部署
- [x] config.js 更新（APP_BASE=/feishu-h5-app/、REDIRECT_URI）
- [x] 飞书开放平台可信域名配置
- [x] 重定向 URL 配置
- [x] 代码审查（发现 3 个严重问题）
- [x] api.js 硬编码路径修复（/customer-app-h5 → /feishu-h5-app）

### 待处理
- [ ] 解决 auth.js 404 问题（GitHub Pages 缓存/部署延迟）
- [ ] 完整 E2E 测试（飞书登录 + 客户 CRUD）
- [ ] 【需用户配合】更新 SCF 云函数：添加 `/exchange-token` 接口处理 token 交换

### 当前阻塞
- **auth.js 404** — GitHub Pages 部署延迟，auth.js 在某些网络下 404
- **需要用户手动测试** — 我的沙箱环境无法访问 GitHub Pages

---

## 部署地址

| 服务 | 地址 | 状态 |
|------|------|------|
| **GitHub Pages H5** | https://ferrerocher92-coder.github.io/feishu-h5-app/ | ✅ 已部署 |
| **腾讯云 COS（备用）** | https://feishu-h5-app-1344246142.cos-website.ap-guangzhou.myqcloud.com/ | ✅ 已部署 |
| **CORS 代理 SCF** | https://1344246142-c7615ig2lb.ap-guangzhou.tencentscf.com | ✅ 运行中 |

---

## 代码仓库

- **GitHub**：https://github.com/ferrerocher92-coder/feishu-h5-app
- **本地路径**：~/Desktop/feishu-h5-app/
- **GitHub Token**：（已配置 git credentials）

---

## 飞书应用配置

- **APP_ID**：`cli_a9365221543a5ccc`
- **APP_SECRET**：`o08J7194FRXuGPffPICd6cHb6gyKWjBY`
- **REDIRECT_URI**：`https://ferrerocher92-coder.github.io/feishu-h5-app/pages/callback.html`

### 飞书开放平台配置
- ✅ 可信域名：`https://ferrerocher92-coder.github.io`
- ✅ 重定向 URL：`https://ferrerocher92-coder.github.io/feishu-h5-app/pages/callback.html`

---

## 腾讯云资源

- **COS Bucket**：`feishu-h5-app-1344246142`（广州）
- **SCF 函数**：`feishu-cors-proxy`（广州）
- **SecretId**：（已配置 SCF 环境变量）
- **SecretKey**：已移除（安全原因）

---

## 代码审查发现的问题（待修复）

### 🔴 高优先级
1. **【已修复 2026-03-21】APP_SECRET 暴露**：config.js 和 auth.js 已移除 APP_SECRET，token 交换改由 SCF 代理处理
2. **【需用户配合】SCF 云函数需更新**：需在 SCF 上添加 `/exchange-token` 接口，从环境变量读取 APP_SECRET

### 🟡 中优先级
4. **refresh_token 有存储无刷新机制**：token 过期后需重新 OAuth 登录
5. **localStorage token 无加密**：XSS 风险

---

## 下一步计划

1. [ ] 用户测试 GitHub Pages 访问（auth.js 404 问题）
2. [ ] 完成飞书登录 + 客户 CRUD E2E 测试
3. [ ] 将 APP_SECRET 相关逻辑移至 SCF 代理层（安全修复）
4. [ ] 正式上线

---

## SCF 云函数更新（需用户配合）

**腾讯云 SCF 需要手动更新**，添加 `/exchange-token` 接口：

```
接口路径：/exchange-token
方法：POST
功能：接收前端传来的 code 和 app_id，从环境变量读取 APP_SECRET，
     向飞书 API 发起 token 交换请求，返回 access_token

环境变量：
  APP_ID=cli_a9365221543a5ccc
  APP_SECRET=o08J7194FRXuGPffPICd6cHb6gyKWjBY
```

---

## 最近更新

### 2026-03-21 20:15
- 【安全修复】auth.js：TOKEN_URL 改为 SCF 代理地址
- 【安全修复】auth.js：移除 app_secret 请求参数
- 【安全修复】config.js：移除 APP_SECRET 配置项（由 SCF 环境变量管理）
- 代码已提交 GitHub，待 SCF 更新后生效

### 2026-03-21 18:55
- 代码审查完成，发现 3 个严重问题
- api.js 硬编码路径修复并推送
- GitHub Token 已配置，可直接 git push

### 2026-03-21 18:50
- 完成 GitHub Pages 部署
- 飞书开放平台可信域名配置完成

### 2026-03-21 18:30
- 切换到 GitHub Pages（腾讯云 COS 无法作为飞书可信域名）
- 飞书开放平台配置可信域名 + 重定向 URL

### 2026-03-21 17:15
- CORS 代理 SCF 部署成功
- H5 应用在腾讯云 COS 上线

### 2026-03-21 10:00
- 确定使用腾讯云（替代 Vercel）
- 部署 COS 静态网站托管 + SCF CORS 代理

---

## 重要指令

- **任何我有权限做的事，不要问用户，直接执行**

---

## 联系方式

- **PM**：AI 项目经理（当前 session）
- **工作区**：/Users/ferrerocher/.openclaw/agents/foreign-trade-pm
