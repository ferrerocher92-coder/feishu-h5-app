/**
 * 客户录入表单 H5 页面
 * 功能：表单录入 → 重复检查 → 照片上传 → 提交到飞书多维表格
 *
 * API 调用说明：
 * 由于飞书 API 不支持浏览器 CORS，请通过环境变量部署后端代理：
 *   H5_APP_PROXY_URL=https://your-proxy.workers.dev
 * 后端代理需转发以下 API：
 *   POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
 *   POST https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal
 *   POST https://open.feishu.cn/open-apis/bitable/v1/apps
 *   POST https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
 *   POST https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search
 *   POST https://open.feishu.cn/open-apis/drive/v1/files/upload_all
 *   POST https://open.feishu.cn/open-apis/drive/v1/files/create_folder
 *
 * 【修改说明 - 2026-03-21】
 * - APP_ID / APP_SECRET / API_BASE 改为从 CONFIG 读取（js/config.js）
 */

'use strict';

// =====================
// 配置（从 js/config.js 读取，不再硬编码）
// =====================
// 注意：customer_form.html 在加载本脚本之前会先加载 config.js
const APP_ID     = (window.CONFIG && window.CONFIG.APP_ID)     || 'cli_a9365221543a5ccc';

const API_BASE   = (window.CONFIG && window.CONFIG.API_BASE)    || 'https://open.feishu.cn/open-apis';

// =====================
// 国家代码映射
// =====================
const COUNTRY_CODE_MAP = {
  '+86':  '中国',
  '+1':   '美国/加拿大',
  '+44':  '英国',
  '+81':  '日本',
  '+49':  '德国',
  '+33':  '法国',
  '+65':  '新加坡',
  '+61':  '澳大利亚',
  '+82':  '韩国',
  '+852': '香港',
  '+853': '澳门',
  '+886': '台湾',
  '+39':  '意大利',
  '+34':  '西班牙',
  '+7':   '俄罗斯',
  '+91':  '印度',
  '+62':  '印尼',
  '+63':  '菲律宾',
  '+66':  '泰国',
  '+84':  '越南',
  '+60':  '马来西亚',
};

// Storage keys (localStorage)
const STORAGE_KEY_APP_TOKEN         = 'customer_bitable_app_token';
const STORAGE_KEY_TABLE_ID          = 'customer_bitable_table_id';
const STORAGE_KEY_PHOTO_FOLDER_TOKEN = 'customer_photo_folder_token';

// =====================
// Storage helpers
// =====================
function getStorage(key) {
  return localStorage.getItem(key) || '';
}

function setStorage(key, value) {
  localStorage.setItem(key, value);
}

// =====================
// API 请求核心（支持代理）
// =====================
async function apiRequest(endpoint, method, body, token) {
  // 优先使用配置的代理 URL，避免 CORS 问题
  const proxyUrl = window.H5_APP_PROXY_URL || '';
  const useProxy = !!proxyUrl;

  const url = useProxy
    ? `${proxyUrl}${endpoint}`
    : `${API_BASE}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log(`[API] ${method} ${url}`, JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: `Non-JSON response: ${res.status}` };
  }

  console.log(`[API] Response:`, JSON.stringify(data, null, 2));
  return data;
}

// =====================
// Token 获取
// =====================
// 【Bug4修复 - 2026-03-21】统一使用 user_access_token（与 api.js / app.js 保持一致）
// 注意：user_access_token 需要通过飞书 OAuth 流程获取，存储在 localStorage
function getUserToken() {
  const token = localStorage.getItem('user_access_token');
  if (!token) {
    window.location.href = window.resolveUrl ? window.resolveUrl('pages/login.html') : 'pages/login.html';
    throw new Error('Not authenticated, redirecting to login...');
  }
  return token;
}

async function getTenantAccessToken() {
  const data = await apiRequest('/auth/v3/tenant_access_token/internal', 'POST', {
    app_id: APP_ID // app_secret 由 SCF 环境变量注入
  });
  if (data.code === 0) return data.tenant_access_token;
  throw new Error(`获取 Tenant Token 失败: ${data.msg}`);
}

// =====================
// Bitable 操作
// =====================
async function getOrCreateBitable() {
  const savedAppToken = getStorage(STORAGE_KEY_APP_TOKEN);
  const savedTableId  = getStorage(STORAGE_KEY_TABLE_ID);

  if (savedAppToken && savedAppToken.length > 5 && savedTableId && savedTableId.length > 5) {
    console.log(`[Bitable] 复用已有表格: app_token=${savedAppToken}, table_id=${savedTableId}`);
    return { app_token: savedAppToken, table_id: savedTableId };
  }

  console.log('[Bitable] 未找到表格，创建新表格...');

  // 【Bug4修复 - 2026-03-21】使用 user_access_token（统一 Token 类型）
  const token = await getUserToken();

  // 创建多维表格
  const docRes = await apiRequest('/bitable/v1/apps', 'POST', { name: '客户录入表' }, token);
  if (docRes.code !== 0) {
    throw new Error(`创建多维表格失败: ${docRes.msg} (code: ${docRes.code})`);
  }

  const app_token = docRes.data.app.app_token;
  const table_id  = docRes.data.app.default_table_id;

  // 创建字段
  const fields = [
    { field_name: '公司名称', type: 1 },
    { field_name: '联系人',   type: 1 },
    { field_name: '电话',     type: 1 },
    { field_name: '邮箱',     type: 1 },
    { field_name: '地址',     type: 1 },
    { field_name: '国家',     type: 1 },
    { field_name: '录入时间', type: 1 },
    { field_name: '照片链接', type: 1 },
  ];

  for (const field of fields) {
    const r = await apiRequest(
      `/bitable/v1/apps/${app_token}/tables/${table_id}/fields`,
      'POST', field, token
    );
    if (r.code !== 0) {
      console.warn(`[Bitable] 创建字段[${field.field_name}]失败: ${r.msg}`);
    }
  }

  setStorage(STORAGE_KEY_APP_TOKEN, app_token);
  setStorage(STORAGE_KEY_TABLE_ID, table_id);

  console.log(`[Bitable] 表格创建完成: app_token=${app_token}, table_id=${table_id}`);
  return { app_token, table_id };
}

// =====================
// 搜索记录
// =====================
async function searchRecords(app_token, table_id, fieldName, value) {
  const token = await getUserToken(); // 【Bug4修复 - 2026-03-21】统一 Token
  const data = await apiRequest(
    `/bitable/v1/apps/${app_token}/tables/${table_id}/records/search`,
    'POST',
    {
      filter: {
        conjunction: 'and',
        conditions: [{ field_name: fieldName, operator: 'is', value: [value] }],
      },
    },
    token
  );
  if (data.code !== 0) throw new Error(`搜索失败: ${data.msg}`);
  return data.data?.items || [];
}

// =====================
// 添加记录
// =====================
async function addRecord(app_token, table_id, fields) {
  // 【Bug4修复 - 2026-03-21】使用 user_access_token（统一 Token 类型）
  const token = await getUserToken();
  const data = await apiRequest(
    `/bitable/v1/apps/${app_token}/tables/${table_id}/records`,
    'POST',
    { fields },
    token
  );
  if (data.code !== 0) throw new Error(`添加记录失败: ${data.msg} (code: ${data.code})`);
  return data;
}

// =====================
// 照片文件夹
// =====================
async function getOrCreatePhotoFolder() {
  const saved = getStorage(STORAGE_KEY_PHOTO_FOLDER_TOKEN);
  if (saved && saved.length > 5) return saved;

  const token = await getTenantAccessToken();
  const data = await apiRequest(
    '/drive/v1/files/create_folder?app_access_token=' + token,
    'POST',
    { name: '客户名片照片', folder_token: '' },
    token
  );

  if (data.code === 0 && data.data?.token) {
    setStorage(STORAGE_KEY_PHOTO_FOLDER_TOKEN, data.data.token);
    return data.data.token;
  }
  if (data.data?.token) {
    setStorage(STORAGE_KEY_PHOTO_FOLDER_TOKEN, data.data.token);
    return data.data.token;
  }
  console.warn('[Folder] 创建文件夹失败:', data.msg);
  return '';
}

// =====================
// 照片上传（H5 使用 FormData + fetch）
// =====================
async function uploadPhotoH5(file) {
  if (!file) return { file_token: '', url: '' };

  const token = await getTenantAccessToken();
  const folderToken = await getOrCreatePhotoFolder();
  const timestamp = Date.now();
  const fileName = `card_${timestamp}.jpg`;

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('parent_type', 'explorer');
  formData.append('parent_node', folderToken || 'me');
  formData.append('size', String(file.size));

  const proxyUrl = window.H5_APP_PROXY_URL || '';
  const uploadUrl = proxyUrl
    ? `${proxyUrl}/drive/v1/files/upload_all`
    : `${API_BASE}/drive/v1/files/upload_all`;

  console.log('[Upload] 开始上传:', fileName, 'size:', file.size);

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  console.log('[Upload] 响应:', JSON.stringify(data));

  if (data.code === 0) {
    const fileToken = data.data?.file_token || '';
    const url = data.data?.url || `https://open.feishu.cn/file/${fileToken}`;
    return { file_token: fileToken, url };
  }
  throw new Error(`上传失败: ${data.msg || '未知错误'}`);
}

// =====================
// 表单验证
// =====================
function validateForm(formData) {
  const errors = {};

  // 公司名称（建议填写，但允许空）
  if (!formData.company.trim() && !formData.contact.trim() && !formData.phone.trim()) {
    errors.company = '请至少填写公司名称、联系人或电话之一';
  }

  // 电话格式
  if (formData.phone) {
    const clean = (formData.countryCode || '') + formData.phone;
    if (!/^\+\d{1,4}?\d{5,14}$/.test(clean.replace(/\s/g, ''))) {
      if (clean.replace(/\D/g, '').length < 7 || clean.replace(/\D/g, '').length > 15) {
        errors.phone = '号码长度应在7-15位之间';
      }
    }
  }

  // 邮箱格式
  if (formData.email && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
    errors.email = '邮箱格式不正确';
  }

  return errors;
}

// =====================
// 表单控制器
// =====================
class CustomerForm {
  constructor() {
    this.photoFile = null;
    this.photoObjectUrl = '';
    this.submitting = false;
    this.pendingForceSubmit = false;   // 重复确认后强制提交
    this.pendingFormData = null;         // 暂存表单数据
    this.$ = this._bindElements();
    this._bindEvents();
  }

  _bindElements() {
    return {
      form:             document.getElementById('customerForm'),
      company:          document.getElementById('company'),
      contact:          document.getElementById('contact'),
      countryCode:      document.getElementById('countryCode'),
      phone:            document.getElementById('phone'),
      email:            document.getElementById('email'),
      address:          document.getElementById('address'),
      country:          document.getElementById('country'),
      detectedCountry:  document.getElementById('detectedCountry'),
      phoneWarn:        document.getElementById('phoneWarn'),
      emailWarn:        document.getElementById('emailWarn'),
      photoInput:       document.getElementById('photoInput'),
      photoUploadArea:  document.getElementById('photoUploadArea'),
      photoError:       document.getElementById('photoError'),
      photoPreview:     document.getElementById('photoPreview'),
      previewImg:       document.getElementById('previewImg'),
      submitBtn:        document.getElementById('submitBtn'),
      resultMsg:        document.getElementById('resultMsg'),
      duplicateModal:   document.getElementById('duplicateModal'),
      duplicateContent: document.getElementById('duplicateContent'),
      countrySuggestions: document.getElementById('countrySuggestions'),
    };
  }

  _bindEvents() {
    const $ = this.$;

    // 国家代码输入 → 自动填充国家名
    $.countryCode.addEventListener('input', (e) => {
      let val = e.target.value;
      if (val && !val.startsWith('+')) val = '+' + val;
      const detected = COUNTRY_CODE_MAP[val] || '';
      $.detectedCountry.textContent = detected;
      $.detectedCountry.style.display = detected ? 'block' : 'none';
      if (detected) $.country.value = detected;
    });

    // 国家字段 → 自动补全建议
    $.country.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        $.countrySuggestions.classList.remove('active');
        return;
      }
      const suggestions = Object.entries(COUNTRY_CODE_MAP)
        .filter(([code, name]) => name.includes(val) || code.includes(val))
        .slice(0, 6);

      if (suggestions.length === 0) {
        $.countrySuggestions.classList.remove('active');
        return;
      }

      $.countrySuggestions.innerHTML = suggestions.map(([code, name]) => `
        <div class="country-suggestion-item" data-code="${code}" data-name="${name}">
          <span>${name}</span>
          <span class="country-code">${code}</span>
        </div>
      `).join('');
      $.countrySuggestions.classList.add('active');
    });

    // 点击建议项
    $.countrySuggestions.addEventListener('click', (e) => {
      const item = e.target.closest('.country-suggestion-item');
      if (!item) return;
      const { code, name } = item.dataset;
      $.country.value = name;
      $.countryCode.value = code;
      $.detectedCountry.textContent = name;
      $.detectedCountry.style.display = 'block';
      $.countrySuggestions.classList.remove('active');
    });

    // 点击外部关闭建议
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.country-wrap')) {
        $.countrySuggestions.classList.remove('active');
      }
    });

    // 电话输入 → 实时验证
    $.phone.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && !/^\d+$/.test(val)) {
        this._showPhoneWarn('请只输入数字');
      } else if (val && (val.length < 5 || val.length > 15)) {
        this._showPhoneWarn('号码长度应在5-15位之间');
      } else {
        this._hidePhoneWarn();
      }
    });

    // 邮箱输入 → 实时验证
    $.email.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val)) {
        this._showEmailWarn('邮箱格式不正确');
      } else {
        this._hideEmailWarn();
      }
    });

    // 照片选择
    $.photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        this._showPhotoError('请选择图片文件');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        this._showPhotoError('图片大小不能超过 10MB');
        return;
      }
      this._hidePhotoError();
      this.photoFile = file;
      if (this.photoObjectUrl) URL.revokeObjectURL(this.photoObjectUrl);
      this.photoObjectUrl = URL.createObjectURL(file);
      $.previewImg.src = this.photoObjectUrl;
      $.photoPreview.style.display = 'inline-block';
      $.photoUploadArea.style.display = 'none';
    });

    // 拖拽上传
    $.photoUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      $.photoUploadArea.classList.add('drag-over');
    });
    $.photoUploadArea.addEventListener('dragleave', () => {
      $.photoUploadArea.classList.remove('drag-over');
    });
    $.photoUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      $.photoUploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const input = $.photoInput;
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
    });

    // 表单提交
    $.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });
  }

  _getFormData() {
    const $ = this.$;
    return {
      company:    $.company.value.trim(),
      contact:    $.contact.value.trim(),
      countryCode: $.countryCode.value.trim(),
      phone:      $.phone.value.trim(),
      email:      $.email.value.trim(),
      address:    $.address.value.trim(),
      country:    $.country.value.trim(),
    };
  }

  _showPhoneWarn(msg) {
    const $ = this.$;
    $.phoneWarn.textContent = msg;
    $.phoneWarn.style.display = 'block';
  }

  _hidePhoneWarn() {
    const $ = this.$;
    $.phoneWarn.style.display = 'none';
    $.phoneWarn.textContent = '';
  }

  _showEmailWarn(msg) {
    const $ = this.$;
    $.emailWarn.textContent = msg;
    $.emailWarn.style.display = 'block';
  }

  _hideEmailWarn() {
    const $ = this.$;
    $.emailWarn.style.display = 'none';
    $.emailWarn.textContent = '';
  }

  _showPhotoError(msg) {
    const $ = this.$;
    $.photoError.textContent = msg;
    $.photoError.style.display = 'block';
  }

  _hidePhotoError() {
    const $ = this.$;
    $.photoError.style.display = 'none';
    $.photoError.textContent = '';
  }

  _showResult(msg, type) {
    const $ = this.$;
    $.resultMsg.textContent = msg;
    $.resultMsg.className = `result-msg ${type}`;
    $.resultMsg.style.display = 'block';
  }

  _hideResult() {
    const $ = this.$;
    $.resultMsg.style.display = 'none';
  }

  _setLoading(loading) {
    const $ = this.$;
    this.submitting = loading;
    $.submitBtn.disabled = loading;
    $.submitBtn.classList.toggle('loading', loading);
    $.submitBtn.textContent = loading ? '提交中...' : '提交客户信息';
  }

  // 清除照片
  clearPhoto() {
    this.photoFile = null;
    if (this.photoObjectUrl) {
      URL.revokeObjectURL(this.photoObjectUrl);
      this.photoObjectUrl = '';
    }
    const $ = this.$;
    $.photoInput.value = '';
    $.photoPreview.style.display = 'none';
    $.photoUploadArea.style.display = 'block';
    this._hidePhotoError();
  }

  // 返回客户列表
  goBack() {
    const listUrl = this._getListPageUrl();
    if (window.parent !== window) {
      // 嵌入在 iframe 中
      window.parent.location.href = listUrl;
    } else {
      window.location.href = listUrl;
    }
  }

  _getListPageUrl() {
    // 【修改 - 2026-03-21】使用 resolveUrl() 动态生成路径，支持多环境部署
    if (window.resolveUrl) {
      return window.resolveUrl('../pages/customer_list.html');
    }
    return '../pages/customer_list.html';
  }

  // =====================
  // 重复确认弹窗
  // =====================
  _showDuplicateModal(content) {
    const $ = this.$;
    $.duplicateContent.textContent = content;
    $.duplicateModal.classList.remove('hidden');
  }

  _hideDuplicateModal() {
    this.$.duplicateModal.classList.add('hidden');
  }

  cancelDuplicate() {
    this._hideDuplicateModal();
    this._hideResult();
    this._showResult('已取消添加。', 'warning');
    this.pendingForceSubmit = false;
    this.pendingFormData = null;
  }

  async confirmDuplicate() {
    this._hideDuplicateModal();
    this.pendingForceSubmit = true;
    await this._doSubmit(this.pendingFormData, true);
    this.pendingForceSubmit = false;
    this.pendingFormData = null;
  }

  // =====================
  // 提交主流程
  // =====================
  async _handleSubmit() {
    if (this.submitting) return;

    const formData = this._getFormData();
    this._hideResult();
    this._hidePhoneWarn();
    this._hideEmailWarn();

    // 前端验证
    const errors = validateForm(formData);
    if (errors.company) {
      this._showResult(errors.company, 'error');
      return;
    }
    if (errors.phone) {
      this._showPhoneWarn(errors.phone);
      return;
    }
    if (errors.email) {
      this._showEmailWarn(errors.email);
      return;
    }

    this._setLoading(true);
    this._showResult('正在检查重复...', 'warning');

    try {
      // Step 1: 重复检查
      if (formData.company && !this.pendingForceSubmit) {
        const duplicates = await this._checkDuplicate(formData.company);
        if (duplicates && duplicates.length > 0) {
          this._setLoading(false);
          this.pendingFormData = formData;
          this._showDuplicateModalFromRecords(duplicates);
          return;
        }
      }

      // Step 2: 正式提交
      await this._doSubmit(formData, false);

    } catch (err) {
      console.error('submit error:', err);
      this._setLoading(false);
      this._showResult(`❌ 提交失败：${err.message || '未知错误'}`, 'error');
    }
  }

  async _checkDuplicate(companyName) {
    if (!companyName.trim()) return [];
    try {
      const { app_token, table_id } = await getOrCreateBitable();
      return await searchRecords(app_token, table_id, '公司名称', companyName.trim());
    } catch (err) {
      console.warn('[DuplicateCheck] 搜索失败:', err.message);
      return [];
    }
  }

  _showDuplicateModalFromRecords(records) {
    const lines = records.map((r, i) => {
      const f = r.fields || {};
      const getVal = (key) => {
        const v = f[key];
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') return v.text || v.name || JSON.stringify(v);
        return String(v);
      };
      return `【已有记录 ${i + 1}】\n` +
        (f['公司名称'] ? `公司：${getVal('公司名称')}\n` : '') +
        (f['联系人']   ? `联系人：${getVal('联系人')}\n` : '') +
        (f['电话']     ? `电话：${getVal('电话')}\n` : '') +
        (f['邮箱']     ? `邮箱：${getVal('邮箱')}\n` : '') +
        (f['地址']     ? `地址：${getVal('地址')}\n` : '') +
        (f['国家']     ? `国家：${getVal('国家')}\n` : '') +
        (f['录入时间'] ? `录入时间：${getVal('录入时间')}` : '');
    }).join('\n\n');

    const truncated = lines.length > 600 ? lines.substring(0, 600) + '...' : lines;
    this._showDuplicateModal(`⚠️ 发现该公司已存在！\n\n${truncated}\n\n是否仍要添加为新记录？`);
  }

  async _doSubmit(formData, forceSubmit) {
    const isWarningMode = forceSubmit || this.pendingForceSubmit;

    this._setLoading(true);
    this._showResult(isWarningMode ? '正在提交到云文档（追加模式）...' : '正在提交到云文档...', 'warning');

    const combinedPhone = (formData.countryCode || '') + (formData.phone || '');

    try {
      // Step A: 上传照片（如果有）
      let photoUrl = '';
      if (this.photoFile) {
        this._showResult('正在上传名片照片...', 'warning');
        try {
          const result = await uploadPhotoH5(this.photoFile);
          if (result.url) {
            photoUrl = result.url;
            console.log('[Submit] 照片上传成功:', photoUrl);
          }
        } catch (uploadErr) {
          console.warn('[Submit] 照片上传失败，继续提交:', uploadErr.message);
        }
      }

      // Step B: 写入多维表格
      const { app_token, table_id } = await getOrCreateBitable();

      const fields = {
        '公司名称': formData.company  || '',
        '联系人':   formData.contact  || '',
        '电话':     combinedPhone     || '',
        '邮箱':     formData.email    || '',
        '地址':     formData.address  || '',
        '国家':     formData.country  || '',
        '录入时间': new Date().toLocaleString('zh-CN'),
      };
      if (photoUrl) fields['照片链接'] = photoUrl;

      await addRecord(app_token, table_id, fields);

      this._setLoading(false);
      const suffix = isWarningMode ? '\n\n⚠️ 注意：该公司已存在，本次为追加记录' : '';
      const photoNote = photoUrl ? '\n📷 照片：已保存' : '';
      this._showResult(
        `✅ 提交成功！\n公司：${formData.company}\n联系人：${formData.contact}\n电话：${combinedPhone}\n邮箱：${formData.email}\n地址：${formData.address}\n国家：${formData.country}${photoNote}${suffix}`,
        'success'
      );

      // 3秒后自动跳转
      setTimeout(() => {
        this.goBack();
      }, 3000);

    } catch (err) {
      console.error('submit error:', err);
      this._setLoading(false);
      this._showResult(`❌ 提交失败：${err.message || '未知错误'}`, 'error');
    }
  }
}

// =====================
// 初始化
// =====================
window.customerForm = new CustomerForm();
