# 客户录入助手 - H5 应用

基于飞书 OAuth 2.0 认证的 H5 应用框架，包含完整的用户认证流程、路由系统和 API 请求封装。

## 项目结构

```
h5-app/
├── index.html          # 主入口页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 路由和主逻辑
│   ├── auth.js         # OAuth 认证流程
│   ├── api.js          # API 请求封装
│   └── components/     # UI 组件
│       ├── nav.js
│       ├── customerList.js
│       └── customerForm.js
└── pages/
    ├── login.html      # 登录页面
    └── callback.html   # OAuth 回调页面
```

## 功能特性

- ✅ **飞书 OAuth 2.0 登录** - 支持用户身份认证
- ✅ **Token 管理** - 自动存储和刷新 access_token
- ✅ **Hash 路由** - `#/` 首页, `#/list` 列表, `#/add` 新增
- ✅ **API 封装** - 自动携带 Token，处理 401 错误
- ✅ **响应式设计** - 适配移动端 H5 页面
- ✅ **组件化** - 可复用 UI 组件

## 快速开始

### 1. 配置应用信息

在 `js/auth.js` 中配置您的飞书应用信息：

```javascript
APP_ID: 'cli_a9365221543a5ccc',
REDIRECT_URI: 'https://your-domain.com/h5-app/callback.html',
```

### 2. 配置 App Secret

在 `pages/callback.html` 中配置 App Secret：

```javascript
window.feishuAppSecret = 'your-app-secret';
```

**注意**: 正式环境中，App Secret 不应暴露在前端。建议通过后端服务进行 code 换 token 的操作。

### 3. 部署

#### 方式一：静态部署

将整个 `h5-app` 目录部署到任意静态服务器或 CDN：

```bash
# 使用 nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/h5-app;
    index index.html;
    
    # SPA fallback
    try_files $uri $uri/ /index.html;
}

# 使用 serve
npx serve h5-app -p 3000
```

#### 方式二：部署到子路径

如果部署到子路径（如 `/app/`），需要更新相关配置：

1. `index.html` 中的 CSS/JS 引用路径
2. `js/auth.js` 中的 `REDIRECT_URI`
3. `pages/callback.html` 中的重定向路径

#### 方式三：使用 Netlify/Vercel

```bash
# Netlify
netlify deploy --dir=h5-app --prod

# Vercel
vercel deploy h5-app
```

## 飞书应用配置

### 1. 创建飞书应用

1. 前往 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret

### 2. 配置应用能力

在飞书开放平台控制台：

1. **添加应用能力** → 选择 H5 应用
2. **配置重定向 URL** → 设置您的回调地址
3. **开通权限** → 根据需要开通用户信息等权限

### 3. 配置权限

建议开通以下权限：

```
authen.v1.user.readonly    # 获取用户基本信息
contact.v3.users.read      # 读取通讯录
```

### 4. 发布应用

完成开发测试后，需要发布应用版本才能供其他用户使用。

## OAuth 流程说明

### 登录流程

```
1. 用户访问 index.html
2. 检查 localStorage 中是否有 user_access_token
3. 无 Token → 跳转 login.html
4. 用户点击"飞书登录" → 跳转飞书授权页面
5. 用户授权 → 回调到 callback.html
6. callback.html 用 code 换取 access_token
7. 存储 Token → 跳转 index.html
```

### Token 刷新

当前实现为静默登录模式：
- Token 过期后自动跳转登录页面
- 用户重新授权后获取新 Token

### 安全建议

1. **后端换 Token**: 生产环境建议由后端服务处理 code 换 token 的操作
2. **HTTPS**: 确保部署使用 HTTPS
3. **State 验证**: 已实现 State 参数验证防止 CSRF

## API 使用

### 发起 API 请求

```javascript
// GET 请求
const customers = await API.getCustomers();

// POST 请求
const newCustomer = await API.createCustomer({
    name: '张三公司',
    phone: '13800138000'
});

// 带错误处理
try {
    const data = await API.get('/some/endpoint');
} catch (error) {
    console.error('请求失败:', error.message);
}
```

### 自定义 API

在 `js/api.js` 中添加新的 API 方法：

```javascript
async getOrders(customerId) {
    return this.get(`/order/v1/orders`, { customer_id: customerId });
}
```

## 路由说明

| 路由 | 页面 | 说明 |
|------|------|------|
| `#/` | 首页 | 欢迎页面，快速入口 |
| `#/list` | 客户列表 | 显示客户列表 |
| `#/add` | 新增客户 | 创建新客户表单 |
| `#/edit/:id` | 编辑客户 | 编辑客户信息 |
| `#/detail/:id` | 客户详情 | 查看客户详情 |

### 页面跳转

```javascript
// 跳转到客户列表
Router.navigate('/list');

// 跳转到客户详情
Router.navigate('/detail/123');
```

## 自定义修改

### 修改主题色

编辑 `css/style.css` 中的 CSS 变量：

```css
:root {
    --primary-color: #3370ff;      /* 主色调 */
    --primary-hover: #2860e6;      /* 悬停色 */
    --bg-color: #f5f5f5;           /* 背景色 */
    /* ... */
}
```

### 添加新页面

1. 在 `js/app.js` 中注册路由：

```javascript
this.register('/new-page', this.renderNewPage.bind(this));
```

2. 实现页面渲染方法：

```javascript
renderNewPage() {
    const container = document.getElementById('mainContent');
    container.innerHTML = '<div>新页面内容</div>';
}
```

## 常见问题

### Q: 回调页面提示 State 验证失败？

A: 确保从授权页面的回调 URL 中的 state 参数与存储的一致。可能是页面刷新导致的。

### Q: Token 过期如何处理？

A: 401 错误时会自动清除本地存储并跳转登录页面。

### Q: 本地开发如何测试？

A: 需要使用内网穿透工具（如 ngrok）将本地服务暴露到公网：

```bash
ngrok http 3000
# 获取公网 URL 后配置为 REDIRECT_URI
```

## License

MIT
