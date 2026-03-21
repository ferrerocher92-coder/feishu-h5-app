/**
 * app.js - Main Application Router
 *
 * Hash-based routing for the H5 app
 * Routes: #/ (home), #/list (customer list), #/add (add customer)
 *
 * 【修改说明 - 2026-03-21】
 * - loadCustomerList(): 替换 demo 数据为调用 API.getOrCreateBitable() + listRecords
 * - loadCustomerDetail(): 替换为真实 API 调用
 * - loadCustomerForEdit(): 替换为真实 API 调用
 * - renderAddCustomer() 表单提交: 改为调用 API.addCustomerRow()
 * - renderEditCustomer() 表单提交: 改为调用 API.updateRecord()
 * - deleteCustomer(): 改为调用 API.deleteRecord()
 * - 所有 alert() 替换为页面内错误 UI
 * - 页面跳转路径改为使用 CONFIG.APP_BASE 动态生成
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    if (!Auth.isAuthenticated()) {
        window.location.href = resolveUrl('pages/login.html');
        return;
    }

    // Show logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.style.display = 'block';
        logoutBtn.addEventListener('click', () => {
            Auth.clearAuth();
            window.location.href = resolveUrl('pages/login.html');
        });
    }

    // Initialize router
    Router.init();

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
        Router.handleRoute();
    });
});

// ========================
// 错误提示 UI 工具函数
// 【新增 - 2026-03-21】统一错误提示，不再使用 alert()
// ========================
function showInlineError(container, message, onRetry) {
    container.innerHTML = `
        <div class="card" style="border-left: 4px solid #ff4d4f; background: #fff2f0;">
            <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
            <div style="color: #cf1322; font-size: 14px; margin-bottom: 12px;">${escapeHtml(message)}</div>
            ${onRetry ? `<button class="btn btn-primary" onclick="(${onRetry.toString()})()">重试</button>` : ''}
        </div>
    `;
}

function showInlineSuccess(container, message, onAction) {
    container.innerHTML = `
        <div class="card" style="border-left: 4px solid #52c41a; background: #f6ffed;">
            <div style="font-size: 20px; margin-bottom: 8px;">✅</div>
            <div style="color: #389e0d; font-size: 14px;">${escapeHtml(message)}</div>
        </div>
    `;
}

// ========================
// 自定义确认弹窗（替代 window.confirm）
// 【新增 - 2026-03-21 Phase 2】原生实现，无第三方依赖
// ========================
function showConfirmModal(message, onConfirm, onCancel) {
    // Remove any existing modal
    const existing = document.getElementById('confirmModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirmModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-icon">⚠️</div>
            <div class="modal-title">确认操作</div>
            <div class="modal-message">${escapeHtml(message)}</div>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-cancel" id="modalCancelBtn">取消</button>
                <button class="modal-btn modal-btn-confirm" id="modalConfirmBtn">确认删除</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Trap focus / close on cancel
    document.getElementById('modalCancelBtn').addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });

    document.getElementById('modalConfirmBtn').addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
            if (onCancel) onCancel();
        }
    });

    function closeModal() {
        overlay.classList.add('hiding');
        overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========================
// Token（本地函数，替代 Auth.getToken()）
// 【Bug2修复 - 2026-03-21】避免依赖 Auth 对象，改用本地 getUserToken()
// ========================
function getUserToken() {
    const token = localStorage.getItem('user_access_token');
    if (!token) {
        window.location.href = resolveUrl('pages/login.html');
        throw new Error('Not authenticated, redirecting to login...');
    }
    return token;
}

/**
 * Simple Hash Router
 */
const Router = {
    routes: {},

    /**
     * Register a route
     */
    register(path, handler) {
        this.routes[path] = handler;
    },

    /**
     * Initialize the router
     */
    init() {
        // Register default routes
        this.register('/', this.renderHome.bind(this));
        this.register('/list', this.renderCustomerList.bind(this));
        this.register('/add', this.renderAddCustomer.bind(this));
        this.register('/edit/:id', this.renderEditCustomer.bind(this));
        this.register('/detail/:id', this.renderCustomerDetail.bind(this));

        // Handle initial route
        this.handleRoute();
    },

    /**
     * Handle current route
     */
    handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        const container = document.getElementById('mainContent');

        // Find matching route
        let handler = null;
        let params = {};

        for (const [path, routeHandler] of Object.entries(this.routes)) {
            const match = this.matchRoute(path, hash);
            if (match) {
                handler = routeHandler;
                params = match.params;
                break;
            }
        }

        if (handler) {
            handler(params);
        } else {
            this.render404();
        }
    },

    /**
     * Match route pattern against actual path
     */
    matchRoute(pattern, path) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                // Parameter
                params[patternParts[i].slice(1)] = pathParts[i];
            } else if (patternParts[i] !== pathParts[i]) {
                return null;
            }
        }

        return { params };
    },

    /**
     * Navigate to a route
     */
    navigate(path) {
        window.location.hash = path;
    },

    // ==================== Page Renderers ====================

    /**
     * Render home page
     */
    renderHome() {
        const user = Auth.getUserInfo();
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="welcome-section" style="text-align: center; padding: 40px 20px;">
                <h2 style="margin-bottom: 8px;">欢迎使用客户录入助手</h2>
                ${user ? `<p style="color: var(--text-secondary); margin-bottom: 24px;">当前用户: ${escapeHtml(user.name || user.en_name || '未知')}</p>` : ''}
                
                <div style="display: flex; flex-direction: column; gap: 12px; max-width: 300px; margin: 0 auto;">
                    <button class="btn btn-primary btn-block" onclick="Router.navigate('/list')">
                        客户列表
                    </button>
                    <button class="btn btn-primary btn-block" onclick="Router.navigate('/add')">
                        新增客户
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render customer list page
     */
    renderCustomerList() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">客户列表</h1>
                <button class="btn btn-primary" onclick="Router.navigate('/add')">新增</button>
            </div>
            <div id="customerListContainer">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">加载中...</span>
                </div>
            </div>
        `;

        // Load customer list
        this.loadCustomerList();
    },

    // 【修改 - 2026-03-21】替换 demo 数据为真实 API 调用
    async loadCustomerList() {
        const container = document.getElementById('customerListContainer');
        
        try {
            // 调用 API 获取多维表格的记录列表
            const { app_token, table_id } = await API.getOrCreateBitable();
            const records = await this._listRecords(app_token, table_id);

            if (!records || records.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <div class="empty-state-title">暂无客户</div>
                        <div class="empty-state-desc">点击下方按钮，添加您的第一个客户</div>
                        <button class="btn btn-primary" onclick="Router.navigate('/add')">添加第一个客户</button>
                    </div>
                `;
                return;
            }

            // 渲染客户列表
            container.innerHTML = records.map(record => {
                const fields = record.fields || {};
                const name = fields['公司名称'] || '未命名客户';
                const phone = fields['电话'] || '';
                const date = fields['录入时间'] || '';
                return `
                    <div class="card list-item" onclick="Router.navigate('/detail/${record.record_id}')">
                        <div class="list-item-title">${escapeHtml(name)}</div>
                        <div class="list-item-desc">${escapeHtml(phone)}${phone && date ? ' · ' : ''}${escapeHtml(date)}</div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('[loadCustomerList] error:', error);
            // Token 无效/过期时，apiRequest 会自动跳转登录页，这里只处理其他错误
            if (!localStorage.getItem(API.STORAGE_KEY_USER_TOKEN)) return;
            showInlineError(container, `加载失败: ${error.message}`, this.loadCustomerList.bind(this));
        }
    },

    /**
     * 列出多维表格所有记录（分页）
     * 【新增 - 2026-03-21】
     */
    async _listRecords(app_token, table_id, pageToken) {
        const token = getUserToken(); // 【Bug2修复 - 2026-03-21】改用本地 getUserToken()
        const params = pageToken ? `?page_token=${pageToken}` : '';
        const response = await fetch(
            `${CONFIG.API_BASE}/bitable/v1/apps/${app_token}/tables/${table_id}/records${params}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const data = await response.json();
        if (data.code !== 0) {
            // token 无效或过期，重定向登录
            if (data.code === 99991663 || data.code === 230001) {
                Auth.clearAuth();
                window.location.href = resolveUrl('pages/login.html');
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(data.msg || `获取列表失败 (code: ${data.code})`);
        }
        // 递归获取所有页
        const items = data.data?.items || [];
        if (data.data?.page_token) {
            const next = await this._listRecords(app_token, table_id, data.data.page_token);
            return items.concat(next);
        }
        return items;
    },

    /**
     * Render add customer page
     */
    renderAddCustomer() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">新增客户</h1>
            </div>
            <div class="card">
                <form id="customerForm">
                    <div class="form-group">
                        <label class="form-label">公司名称 *</label>
                        <input type="text" class="form-input" name="company" placeholder="请输入公司名称" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">联系人</label>
                        <input type="text" class="form-input" name="contact" placeholder="请输入联系人姓名">
                    </div>
                    <div class="form-group">
                        <label class="form-label">联系电话</label>
                        <input type="tel" class="form-input" name="phone" placeholder="请输入联系电话">
                    </div>
                    <div class="form-group">
                        <label class="form-label">电子邮箱</label>
                        <input type="email" class="form-input" name="email" placeholder="请输入电子邮箱">
                    </div>
                    <div class="form-group">
                        <label class="form-label">公司地址</label>
                        <input type="text" class="form-input" name="address" placeholder="请输入公司地址">
                    </div>
                    <div class="form-group">
                        <label class="form-label">国家/地区</label>
                        <input type="text" class="form-input" name="country" placeholder="请输入国家或地区">
                    </div>
                    <div id="formMessage"></div>
                    <button type="submit" class="btn btn-primary btn-block">保存</button>
                </form>
            </div>
        `;

        document.getElementById('customerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            const msgContainer = document.getElementById('formMessage');
            msgContainer.innerHTML = '';

            const customerData = {
                company: form.company.value.trim(),
                contact: form.contact.value.trim(),
                phone: form.phone.value.trim(),
                email: form.email.value.trim(),
                address: form.address.value.trim(),
                country: form.country.value.trim(),
            };

            // 【Bug2修复 - 2026-03-21】补充手机号和邮箱格式验证（参考 customer_form.js validateForm()）
            if (!customerData.company && !customerData.contact && !customerData.phone) {
                msgContainer.innerHTML = `<div style="color: #ff4d4f; margin-bottom: 12px;">请至少填写公司名称、联系人或电话之一</div>`;
                return;
            }
            // 手机号格式验证
            if (customerData.phone) {
                const phoneDigits = customerData.phone.replace(/\D/g, '');
                if (phoneDigits.length < 7 || phoneDigits.length > 15) {
                    msgContainer.innerHTML = `<div style="color: #ff4d4f; margin-bottom: 12px;">手机号长度应在7-15位之间</div>`;
                    return;
                }
            }
            // 邮箱格式验证
            if (customerData.email && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(customerData.email)) {
                msgContainer.innerHTML = `<div style="color: #ff4d4f; margin-bottom: 12px;">邮箱格式不正确</div>`;
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '保存中...';

            try {
                // 【修改 - 2026-03-21】调用真实 API addCustomerRow
                await API.addCustomerRow(customerData);
                msgContainer.innerHTML = `<div style="color: #52c41a; margin-bottom: 12px;">✅ 客户创建成功！</div>`;
                setTimeout(() => Router.navigate('/list'), 800);
            } catch (error) {
                console.error('[createCustomer] error:', error);
                msgContainer.innerHTML = `<div style="color: #ff4d4f; margin-bottom: 12px;">创建失败: ${escapeHtml(error.message)}</div>`;
                submitBtn.disabled = false;
                submitBtn.textContent = '保存';
            }
        });
    },

    /**
     * Render edit customer page
     */
    renderEditCustomer(params) {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">编辑客户</h1>
            </div>
            <div id="customerEditContent">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">加载中...</span>
                </div>
            </div>
        `;

        // Load customer data for editing
        this.loadCustomerForEdit(params.id);
    },

    // 【修改 - 2026-03-21】替换 demo 数据为真实 API 调用
    async loadCustomerForEdit(customerId) {
        const container = document.getElementById('customerEditContent');

        try {
            // 从 Bitable 获取该记录详情
            const { app_token, table_id } = await API.getOrCreateBitable();
            const record = await this._getRecord(app_token, table_id, customerId);
            const fields = record.fields || {};

            container.innerHTML = `
                <div class="card">
                    <form id="customerForm">
                        <div class="form-group">
                            <label class="form-label">公司名称 *</label>
                            <input type="text" class="form-input" name="company" value="${escapeHtml(fields['公司名称'] || '')}" placeholder="请输入公司名称" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">联系人</label>
                            <input type="text" class="form-input" name="contact" value="${escapeHtml(fields['联系人'] || '')}" placeholder="请输入联系人姓名">
                        </div>
                        <div class="form-group">
                            <label class="form-label">联系电话</label>
                            <input type="tel" class="form-input" name="phone" value="${escapeHtml(fields['电话'] || '')}" placeholder="请输入联系电话">
                        </div>
                        <div class="form-group">
                            <label class="form-label">电子邮箱</label>
                            <input type="email" class="form-input" name="email" value="${escapeHtml(fields['邮箱'] || '')}" placeholder="请输入电子邮箱">
                        </div>
                        <div class="form-group">
                            <label class="form-label">公司地址</label>
                            <input type="text" class="form-input" name="address" value="${escapeHtml(fields['地址'] || '')}" placeholder="请输入公司地址">
                        </div>
                        <div class="form-group">
                            <label class="form-label">国家/地区</label>
                            <input type="text" class="form-input" name="country" value="${escapeHtml(fields['国家'] || '')}" placeholder="请输入国家或地区">
                        </div>
                        <div id="formMessage"></div>
                        <button type="submit" class="btn btn-primary btn-block">保存</button>
                    </form>
                </div>
            `;

            document.getElementById('customerForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const submitBtn = form.querySelector('button[type="submit"]');
                const msgContainer = document.getElementById('formMessage');

                const customerData = {
                    company: form.company.value.trim(),
                    contact: form.contact.value.trim(),
                    phone: form.phone.value.trim(),
                    email: form.email.value.trim(),
                    address: form.address.value.trim(),
                    country: form.country.value.trim(),
                };

                if (!customerData.company) {
                    msgContainer.innerHTML = `<div style="color: #ff4d4f; margin-bottom: 12px;">公司名称不能为空</div>`;
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = '保存中...';

                try {
                    // 【修改 - 2026-03-21】调用真实 API updateRecord
                    await API.updateRecord(customerId, {
                        '公司名称': customerData.company,
                        '联系人': customerData.contact,
                        '电话': customerData.phone,
                        '邮箱': customerData.email,
                        '地址': customerData.address,
                        '国家': customerData.country,
                    });
                    msgContainer.innerHTML = `<div style="color: #52c41a; margin-bottom: 12px;">✅ 客户更新成功！</div>`;
                    setTimeout(() => Router.navigate('/list'), 800);
                } catch (error) {
                    console.error('[updateCustomer] error:', error);
                    msgContainer.innerHTML = `<div style="color: #ff4d4f; margin-bottom: 12px;">更新失败: ${escapeHtml(error.message)}</div>`;
                    submitBtn.disabled = false;
                    submitBtn.textContent = '保存';
                }
            });

        } catch (error) {
            console.error('[loadCustomerForEdit] error:', error);
            showInlineError(container, `加载客户数据失败: ${error.message}`, this.loadCustomerForEdit.bind(this, customerId));
        }
    },

    /**
     * 获取单条记录
     * 【新增 - 2026-03-21】
     */
    async _getRecord(app_token, table_id, record_id) {
        const token = getUserToken(); // 【Bug2修复 - 2026-03-21】改用本地 getUserToken()
        const response = await fetch(
            `${CONFIG.API_BASE}/bitable/v1/apps/${app_token}/tables/${table_id}/records/${record_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const data = await response.json();
        if (data.code !== 0) {
            if (data.code === 99991663 || data.code === 230001) {
                Auth.clearAuth();
                window.location.href = resolveUrl('pages/login.html');
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(data.msg || `获取记录失败 (code: ${data.code})`);
        }
        return data.data;
    },

    /**
     * Render customer detail page
     */
    renderCustomerDetail(params) {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">客户详情</h1>
            </div>
            <div id="customerDetailContent">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">加载中...</span>
                </div>
            </div>
        `;

        this.loadCustomerDetail(params.id);
    },

    // 【修改 - 2026-03-21】替换 demo 数据为真实 API 调用
    async loadCustomerDetail(customerId) {
        const container = document.getElementById('customerDetailContent');
        
        try {
            const { app_token, table_id } = await API.getOrCreateBitable();
            const record = await this._getRecord(app_token, table_id, customerId);
            const fields = record.fields || {};

            container.innerHTML = `
                <div class="card">
                    ${this._renderField('公司名称', fields['公司名称'])}
                    ${this._renderField('联系人', fields['联系人'])}
                    ${this._renderField('联系电话', fields['电话'])}
                    ${this._renderField('电子邮箱', fields['邮箱'])}
                    ${this._renderField('公司地址', fields['地址'])}
                    ${this._renderField('国家/地区', fields['国家'])}
                    ${this._renderField('录入时间', fields['录入时间'])}
                    ${fields['照片链接'] ? this._renderField('照片链接', `<a href="${escapeHtml(fields['照片链接'])}" target="_blank">查看照片</a>`) : ''}
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="Router.navigate('/edit/${customerId}')">编辑</button>
                    <button class="btn" style="flex: 1; background: #ff4d4f; color: #fff;" id="deleteBtn">删除</button>
                </div>
            `;

            document.getElementById('deleteBtn').addEventListener('click', () => {
                this.deleteCustomer(customerId);
            });

        } catch (error) {
            console.error('[loadCustomerDetail] error:', error);
            showInlineError(container, `加载失败: ${error.message}`, this.loadCustomerDetail.bind(this, customerId));
        }
    },

    _renderField(label, value) {
        if (!value) return '';
        return `
            <div style="margin-bottom: 12px;">
                <label class="form-label">${escapeHtml(label)}</label>
                <div>${typeof value === 'string' ? escapeHtml(value) : value}</div>
            </div>
        `;
    },

    // 【修改 - 2026-03-21】替换为真实 API 调用
    // 【Phase 2 - 2026-03-21】window.confirm() 替换为自定义弹窗，alert() 替换为 inlineError
    async deleteCustomer(customerId) {
        const detailContainer = document.getElementById('customerDetailContent');
        showConfirmModal(
            '确定要删除该客户吗？此操作不可恢复。',
            async () => {
                // 用户确认删除
                try {
                    await API.deleteRecord(customerId);
                    Router.navigate('/list');
                    setTimeout(() => Router.loadCustomerList(), 100);
                } catch (error) {
                    console.error('[deleteCustomer] error:', error);
                    showInlineError(detailContainer, `删除失败: ${error.message}`, this.deleteCustomer.bind(this, customerId));
                }
            },
            () => {
                // 用户取消，不做任何操作
            }
        );
    },

    /**
     * Render 404 page
     */
    render404() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">页面未找到</div>
                <div class="empty-state-desc">您访问的页面不存在</div>
                <button class="btn btn-primary" onclick="Router.navigate('/')">返回首页</button>
            </div>
        `;
    },

    // 【新增 - 2026-03-21】暴露 loadCustomerList 供 Retry 使用
    loadCustomerList() {
        this.renderCustomerList();
    }
};

// Make Router available globally
window.Router = Router;
