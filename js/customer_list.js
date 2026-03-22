/**
 * 客户列表页 - H5 版本
 * 功能：列表、搜索、详情、编辑、删除
 *
 * 【修改说明 - 2026-03-21】
 * - API_BASE / APP_ID / APP_SECRET 改为从 CONFIG 读取（js/config.js）
 * - goBackList() 跳转路径改为使用 resolveUrl() 动态生成
 */

// =====================
// Config（从 js/config.js 读取，不再硬编码）
// =====================
// 注意：customer_list.html 在加载本脚本之前会先加载 config.js
const API_BASE = window.H5_APP_PROXY_URL || 'https://1344246142-c7615ig2lb.ap-guangzhou.tencentscf.com';
const APP_ID    = window.CONFIG ? window.CONFIG.APP_ID    : 'cli_a9365221543a5ccc';

// Storage keys (same as api.js for compatibility)
const STORAGE_KEY_APP_TOKEN = 'customer_bitable_app_token';
const STORAGE_KEY_TABLE_ID  = 'customer_bitable_table_id';

// Country Code Mapping
const COUNTRY_CODE_MAP = {
  '+86': '中国', '+1': '美国/加拿大', '+44': '英国', '+81': '日本',
  '+49': '德国', '+33': '法国', '+65': '新加坡', '+61': '澳大利亚',
  '+82': '韩国', '+852': '香港', '+853': '澳门', '+886': '台湾',
  '+39': '意大利', '+34': '西班牙', '+7': '俄罗斯', '+91': '印度',
  '+62': '印尼', '+63': '菲律宾', '+66': '泰国', '+84': '越南',
  '+60': '马来西亚',
};

// =====================
// State
// =====================
let records = [];
let displayRecords = [];
let currentRecord = null;
let viewMode = 'list'; // 'list' | 'detail' | 'edit'
let searchKey = '';
let loading = false;

// =====================
// Token & API
// =====================
// 【Bug4修复 - 2026-03-21】统一使用 user_access_token（与 api.js/app.js 保持一致）
// 注意：user_access_token 需要通过飞书 OAuth 流程获取，存于 localStorage
// 如果 localStorage 中没有 token，说明用户未登录，跳转到登录页
function getUserToken() {
  const token = localStorage.getItem(STORAGE_KEY_USER_TOKEN);
  if (!token) {
    // 未登录，跳转到登录页面
    window.location.href = window.resolveUrl ? window.resolveUrl('pages/login.html') : 'pages/login.html';
    throw new Error('Not authenticated, redirecting to login...');
  }
  return token;
}

async function apiRequest(endpoint, method = 'GET', body = null, token) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: `Bearer ${token}`,
  };
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, config);
  return await res.json();
}

async function getBitableConfig() {
  const appToken = localStorage.getItem(STORAGE_KEY_APP_TOKEN);
  const tableId  = localStorage.getItem(STORAGE_KEY_TABLE_ID);
  if (appToken && appToken.length > 5 && tableId && tableId.length > 5) {
    return { app_token: appToken, table_id: tableId };
  }
  // Try to create if not found
  await ensureBitable();
  return {
    app_token: localStorage.getItem(STORAGE_KEY_APP_TOKEN),
    table_id:  localStorage.getItem(STORAGE_KEY_TABLE_ID),
  };
}

async function ensureBitable() {
  const appToken = localStorage.getItem(STORAGE_KEY_APP_TOKEN);
  const tableId  = localStorage.getItem(STORAGE_KEY_TABLE_ID);
  if (appToken && tableId) return;

  const token = await getUserToken(); // 【Bug4修复 - 2026-03-21】统一 Token

  // Create bitable
  const createRes = await apiRequest('/bitable/v1/apps', 'POST', { name: '客户录入表' }, token);
  if (createRes.code !== 0) throw new Error('创建多维表格失败: ' + createRes.msg);

  const app_token = createRes.data.app.app_token;
  const table_id  = createRes.data.app.default_table_id;

  // Create fields
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
  for (const f of fields) {
    await apiRequest(`/bitable/v1/apps/${app_token}/tables/${table_id}/fields`, 'POST', f, token).catch(() => {});
  }

  localStorage.setItem(STORAGE_KEY_APP_TOKEN, app_token);
  localStorage.setItem(STORAGE_KEY_TABLE_ID, table_id);
}

// =====================
// Toast
// =====================
let _toastTimer = null;
function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  if (_toastTimer) clearTimeout(_toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// =====================
// View Navigation
// =====================
function switchView(view) {
  viewMode = view;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  if (view === 'list') {
    document.getElementById('listView').classList.add('active');
  } else if (view === 'detail') {
    document.getElementById('detailView').classList.add('active');
  } else if (view === 'edit') {
    document.getElementById('editView').classList.add('active');
  }
  window.scrollTo(0, 0);
}

// 【修改 - 2026-03-21】跳转路径使用 resolveUrl() 动态生成，支持多环境部署
function goBackList() {
  // Navigate back to home index
  const href = window.resolveUrl ? window.resolveUrl('../index.html') : '../index.html';
  window.location.href = href;
}

function goBackDetail() {
  switchView('list');
}

function goBackEdit() {
  switchView('detail');
}

// =====================
// Data Loading
// =====================
async function loadRecords() {
  if (loading) return;
  loading = true;
  showLoading(true, false);

  try {
    const { app_token, table_id } = await getBitableConfig();
    // 【Bug4修复 - 2026-03-21】使用 user_access_token（统一 Token 类型）
    const token = await getUserToken();
    const data = await apiRequest(
      `/bitable/v1/apps/${app_token}/tables/${table_id}/records?page_size=500`,
      'GET', null, token
    );

    if (data.code !== 0) throw new Error(data.msg || '获取客户列表失败');

    const items = data.data?.items || [];
    records = items;
    displayRecords = items;

    loading = false;
    showLoading(false, items.length === 0);
    renderList();
    updateRecordCount();
  } catch (err) {
    console.error('[CustomerList] loadRecords error:', err);
    loading = false;
    showLoading(false, true, '加载失败：' + (err.message || '未知错误'));
    showToast('加载失败：' + (err.message || '未知错误'));
  }
}

async function refreshRecords() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.style.transform = 'rotate(360deg)';
  // Trigger CSS spin via class
  if (icon) { icon.style.transition = 'transform 0.6s'; icon.style.transform = 'rotate(360deg)'; }
  await loadRecords();
  showToast('刷新成功');
}

function showLoading(show, empty, emptyMsg) {
  const loadingArea = document.getElementById('loadingArea');
  const emptyArea   = document.getElementById('emptyArea');
  const emptyText   = document.getElementById('emptyText');

  if (show) {
    loadingArea.style.display = 'flex';
    emptyArea.style.display = 'none';
  } else if (empty) {
    loadingArea.style.display = 'none';
    emptyArea.style.display = 'flex';
    if (emptyMsg) emptyText.textContent = emptyMsg;
  } else {
    loadingArea.style.display = 'none';
    emptyArea.style.display = 'none';
  }
}

function updateRecordCount() {
  const el = document.getElementById('recordCount');
  if (!el) return;
  const count = displayRecords.length;
  const total = records.length;
  if (searchKey) {
    el.textContent = `共 ${total} 条，搜索到 ${count} 条`;
  } else {
    el.textContent = `共 ${count} 条客户`;
  }
}

// =====================
// List Rendering
// =====================
function renderList() {
  const container = document.getElementById('customerList');
  if (!container) return;

  if (displayRecords.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = displayRecords.map(record => {
    const f = record.fields || {};
    return `
      <div class="customer-card" onclick="viewDetail('${record.record_id}')">
        <div class="card-main">
          <div class="card-company">${escapeHtml(f['公司名称'] || '—')}</div>
          <div class="card-row">
            <span class="card-label">联系人</span>
            <span class="card-value">${escapeHtml(f['联系人'] || '—')}</span>
          </div>
          <div class="card-row">
            <span class="card-label">电话</span>
            <span class="card-value">${escapeHtml(f['电话'] || '—')}</span>
          </div>
          <div class="card-row">
            <span class="card-label">国家</span>
            <span class="card-value">${escapeHtml(f['国家'] || '—')}</span>
          </div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    `;
  }).join('');
}

// =====================
// Search
// =====================
function onSearchInput(e) {
  const value = e.target.value || '';
  searchKey = value;
  applySearch(value);
  document.getElementById('searchClear').style.display = value ? 'flex' : 'none';
}

function onSearchKeydown(e) {
  if (e.key === 'Enter') {
    const value = e.target.value || '';
    searchKey = value;
    applySearch(value);
  }
}

function clearSearch() {
  searchKey = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  displayRecords = records;
  renderList();
  updateRecordCount();
}

function applySearch(keyword) {
  if (!keyword || !keyword.trim()) {
    displayRecords = records;
    renderList();
    updateRecordCount();
    return;
  }
  const lower = keyword.toLowerCase().trim();
  displayRecords = records.filter(r => {
    const company = ((r.fields && r.fields['公司名称']) || '').toLowerCase();
    const contact = ((r.fields && r.fields['联系人'])   || '').toLowerCase();
    return company.includes(lower) || contact.includes(lower);
  });
  renderList();
  updateRecordCount();
}

// =====================
// Detail View
// =====================
function viewDetail(recordId) {
  const record = records.find(r => r.record_id === recordId);
  if (!record) { showToast('记录不存在'); return; }
  currentRecord = record;
  renderDetail();
  switchView('detail');
}

function renderDetail() {
  if (!currentRecord) return;
  const f = currentRecord.fields || {};

  const fields = [
    { label: '公司名称', key: '公司名称' },
    { label: '联系人',   key: '联系人' },
    { label: '电话',      key: '电话' },
    { label: '邮箱',      key: '邮箱' },
    { label: '地址',      key: '地址' },
    { label: '国家',      key: '国家' },
    { label: '录入时间',  key: '录入时间' },
  ];

  const rowsHtml = fields.map(item => `
    <div class="detail-row">
      <span class="detail-label">${item.label}</span>
      <span class="detail-value">${escapeHtml(f[item.key] || '—')}</span>
    </div>
  `).join('');

  document.getElementById('detailRows').innerHTML = rowsHtml;

  // Photo button
  const photoUrl = normalizePhotoUrl(f['照片链接']);
  const btn = document.getElementById('btnViewCard');
  if (photoUrl) {
    btn.disabled = false;
    btn.classList.remove('btn-view-card-disabled');
  } else {
    btn.disabled = true;
    btn.classList.add('btn-view-card-disabled');
  }
}

function normalizePhotoUrl(val) {
  if (!val) return '';
  if (typeof val === 'object') return val.text || val.url || '';
  if (typeof val === 'string') return (val.trim() && val !== 'undefined') ? val.trim() : '';
  return '';
}

function viewCardPhoto() {
  const photoUrl = normalizePhotoUrl(currentRecord?.fields?.['照片链接']);
  if (!photoUrl) return;
  openLightbox(photoUrl);
}

function openLightbox(url) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lightbox || !img) {
    // Fallback: open in new tab
    window.open(url, '_blank');
    return;
  }
  img.src = url;
  lightbox.classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('active');
}

// =====================
// Edit
// =====================
function startEdit() {
  if (!currentRecord) return;
  const f = currentRecord.fields || {};
  const fullPhone = f['电话'] || '';
  let countryCode = '';
  let localPhone = fullPhone;

  for (const code of Object.keys(COUNTRY_CODE_MAP).sort((a, b) => b.length - a.length)) {
    if (fullPhone.startsWith(code)) {
      countryCode = code;
      localPhone = fullPhone.slice(code.length);
      break;
    }
  }
  if (!countryCode && fullPhone.startsWith('+')) {
    const match = fullPhone.match(/^(\+\d{1,3})/);
    if (match) { countryCode = match[1]; localPhone = fullPhone.slice(countryCode.length); }
  }

  const detectedCountry = countryCode ? (COUNTRY_CODE_MAP[countryCode] || '') : '';

  // Fill form
  document.getElementById('edit_company').value  = f['公司名称'] || '';
  document.getElementById('edit_contact').value  = f['联系人']   || '';
  document.getElementById('edit_countryCode').value = countryCode;
  document.getElementById('edit_phone').value     = localPhone;
  document.getElementById('edit_email').value     = f['邮箱']     || '';
  document.getElementById('edit_address').value    = f['地址']     || '';
  document.getElementById('edit_country').value   = f['国家']     || detectedCountry;

  // Country hint
  const hintEl = document.getElementById('editCountryHint');
  const hintText = document.getElementById('editCountryHintText');
  if (detectedCountry) {
    hintText.textContent = detectedCountry;
    hintEl.classList.add('country-hint-visible');
  } else {
    hintEl.classList.remove('country-hint-visible');
  }

  switchView('edit');
}

function onEditCountryCodeInput(e) {
  let value = e.target.value || '';
  if (value && !value.startsWith('+')) value = '+' + value;
  const detected = COUNTRY_CODE_MAP[value] || '';
  const hintEl = document.getElementById('editCountryHint');
  const hintText = document.getElementById('editCountryHintText');
  if (detected) {
    hintText.textContent = detected;
    hintEl.classList.add('country-hint-visible');
    document.getElementById('edit_country').value = detected;
  } else {
    hintEl.classList.remove('country-hint-visible');
  }
}

function onEditPhoneInput(e) {
  // Just tracking, no special logic needed
}

function onEditInput(field, e) {
  // Could track dirty state here if needed
}

function cancelEdit() {
  switchView('detail');
}

async function saveEdit() {
  const company  = document.getElementById('edit_company').value.trim();
  const contact  = document.getElementById('edit_contact').value.trim();
  const phone    = document.getElementById('edit_phone').value.trim();
  const countryCode = document.getElementById('edit_countryCode').value.trim();
  const email    = document.getElementById('edit_email').value.trim();
  const address  = document.getElementById('edit_address').value.trim();
  const country  = document.getElementById('edit_country').value.trim();

  if (!company && !contact && !phone) {
    showToast('请至少填写公司名称、联系人或电话之一');
    return;
  }

  const saveBtn = document.getElementById('editSaveBtn');
  const btnSaveEdit = document.getElementById('btnSaveEdit');
  saveBtn.textContent = '保存中...';
  saveBtn.classList.remove('save-btn');
  saveBtn.classList.add('saving-btn');
  btnSaveEdit.disabled = true;
  btnSaveEdit.textContent = '保存中...';
  showToast('保存中...');

  try {
    const { app_token, table_id } = await getBitableConfig();
    // 【Bug4修复 - 2026-03-21】使用 user_access_token（统一 Token 类型）
    const token = await getUserToken();
    const combinedPhone = countryCode + phone;
    const fields = {
      '公司名称': company,
      '联系人':   contact,
      '电话':     combinedPhone,
      '邮箱':     email,
      '地址':     address,
      '国家':     country,
    };

    const data = await apiRequest(
      `/bitable/v1/apps/${app_token}/tables/${table_id}/records/${currentRecord.record_id}`,
      'PUT', { fields }, token
    );

    if (data.code !== 0) throw new Error(data.msg || '保存失败');

    // Update local state
    const updatedRecord = { ...currentRecord, fields };
    records = records.map(r => r.record_id === currentRecord.record_id ? updatedRecord : r);
    displayRecords = displayRecords.map(r => r.record_id === currentRecord.record_id ? updatedRecord : r);
    currentRecord = updatedRecord;

    saveBtn.textContent = '保存';
    saveBtn.classList.add('save-btn');
    saveBtn.classList.remove('saving-btn');
    btnSaveEdit.disabled = false;
    btnSaveEdit.textContent = '保存';

    renderList();
    renderDetail();
    switchView('detail');
    showToast('✅ 保存成功');
  } catch (err) {
    console.error('[CustomerList] saveEdit error:', err);
    saveBtn.textContent = '保存';
    saveBtn.classList.add('save-btn');
    saveBtn.classList.remove('saving-btn');
    btnSaveEdit.disabled = false;
    btnSaveEdit.textContent = '保存';
    showToast('保存失败：' + (err.message || '未知错误'));
  }
}

// =====================
// Delete
// =====================
function confirmDelete() {
  showModal('确认删除', '确定要删除该客户记录吗？此操作不可恢复。', doDelete, '删除', true);
}

function showModal(title, body, onConfirm, confirmText, isDanger) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  const confirmBtn = document.getElementById('modalConfirm');
  confirmBtn.textContent = confirmText || '确认';
  confirmBtn.className = 'modal-btn confirm' + (isDanger ? '' : ' blue');
  window._modalConfirmCallback = onConfirm;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  window._modalConfirmCallback = null;
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function onModalConfirm() {
  const cb = window._modalConfirmCallback;
  closeModal();
  if (typeof cb === 'function') cb();
}

async function doDelete() {
  if (!currentRecord) return;

  try {
    const { app_token, table_id } = await getBitableConfig();
    const token = await getUserToken(); // 【Bug4修复 - 2026-03-21】统一 Token
    const data = await apiRequest(
      `/bitable/v1/apps/${app_token}/tables/${table_id}/records/${currentRecord.record_id}`,
      'DELETE', null, token
    );

    if (data.code !== 0) throw new Error(data.msg || '删除失败');

    records = records.filter(r => r.record_id !== currentRecord.record_id);
    displayRecords = displayRecords.filter(r => r.record_id !== currentRecord.record_id);
    currentRecord = null;

    renderList();
    updateRecordCount();
    switchView('list');
    showToast('✅ 删除成功');
  } catch (err) {
    console.error('[CustomerList] doDelete error:', err);
    showToast('删除失败：' + (err.message || '未知错误'));
  }
}

// =====================
// Utils
// =====================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =====================
// Init
// =====================
document.addEventListener('DOMContentLoaded', () => {
  // 【修改 - 2026-03-21】动态设置「添加客户」链接的 href
  const addLink = document.getElementById('addCustomerLink');
  if (addLink && window.resolveUrl) {
    addLink.href = window.resolveUrl('customer_form.html');
  }
  loadRecords();
});
