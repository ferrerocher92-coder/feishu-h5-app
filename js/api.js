/**
 * 飞书多维表格（Bitable）H5 前端 API
 * 适配浏览器环境：fetch + localStorage
 *
 * 关键差异（vs 小程序版）：
 * - 使用 fetch 替代 tt.request
 * - 使用 localStorage 替代 tt.getStorageSync / tt.setStorageSync
 * - 所有 API 调用使用 localStorage 中的 user_access_token
 * - 文件上传使用 FormData + fetch 替代 tt.uploadFile
 */

// 使用 H5_APP_PROXY_URL（Vercel Edge Function），解决 CORS 问题
const API_BASE = (window.H5_APP_PROXY_URL || 'https://open.feishu.cn/open-apis');

// 多维表格字段定义
const TABLE_FIELDS = [
  { field_name: '公司名称', type: 1 },   // type=1 表示文本
  { field_name: '联系人',   type: 1 },
  { field_name: '电话',     type: 1 },
  { field_name: '邮箱',     type: 1 },
  { field_name: '地址',     type: 1 },
  { field_name: '国家',     type: 1 },
  { field_name: '录入时间', type: 1 },
  { field_name: '照片链接', type: 1 },   // type=1 文本字段，存图片 URL
];

// localStorage keys
const STORAGE_KEY_APP_TOKEN         = 'customer_bitable_app_token';
const STORAGE_KEY_TABLE_ID          = 'customer_bitable_table_id';
const STORAGE_KEY_PHOTO_FOLDER_TOKEN = 'customer_photo_folder_token';
const STORAGE_KEY_USER_TOKEN        = 'user_access_token';

// ========================
// Token & Auth
// ========================

/**
 * 获取用户 access token（从 localStorage）
 * 如果未登录，跳转到登录页
 */
function getUserToken() {
  const token = localStorage.getItem(STORAGE_KEY_USER_TOKEN);
  if (!token) {
    // 未登录，跳转到登录页面
    window.location.href = '/customer-app-h5/pages/login.html';
    throw new Error('Not authenticated, redirecting to login...');
  }
  return token;
}

// ========================
// Core API Request Helper
// ========================

/**
 * 通用 API 请求（JSON）
 * @param {string} endpoint - 例如 /bitable/v1/apps
 * @param {string} method - GET / POST / PUT / DELETE
 * @param {object|null} body - 请求体（可选）
 * @returns {Promise<object>} API 响应数据
 */
async function apiRequest(endpoint, method, body) {
  const token = getUserToken();

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (data.code !== 0) {
    // token 无效或过期
    if (data.code === 99991663 || data.code === 230001) {
      localStorage.removeItem(STORAGE_KEY_USER_TOKEN);
      window.location.href = '/customer-app-h5/pages/login.html';
    }
    throw new Error(data.msg || `API Error: code=${data.code}`);
  }

  return data;
}

// ========================
// Bitable: 创建基础设施
// ========================

/**
 * 创建多维表格
 * POST /open-apis/bitable/v1/apps
 * @param {string} token
 * @returns {object} { app_token, table_id, url }
 */
async function createBitable(token) {
  const data = await apiRequest('/bitable/v1/apps', 'POST', { name: '客户录入表' });
  console.log('[Bitable] 创建多维表格响应:', JSON.stringify(data));

  const app_token = data.data.app.app_token;
  const table_id  = data.data.app.default_table_id;
  const url       = data.data.app.url;

  console.log(`[Bitable] 创建成功 - app_token: ${app_token}, table_id: ${table_id}`);
  return { app_token, table_id, url };
}

/**
 * 为表格创建字段（列）
 * POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/fields
 */
async function createFields(app_token, table_id) {
  for (const field of TABLE_FIELDS) {
    const data = await apiRequest(
      `/bitable/v1/apps/${app_token}/tables/${table_id}/fields`,
      'POST',
      field
    );
    console.log(`[Bitable] 创建字段[${field.field_name}]: code=${data.code}`);
    if (data.code !== 0) {
      // 忽略已存在字段的错误，继续
      console.warn(`[Bitable] 字段[${field.field_name}]创建失败: ${data.msg}`);
    }
  }
}

// ========================
// Bitable: 记录 CRUD
// ========================

/**
 * 新增一条记录
 * POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
 * @param {string} app_token
 * @param {string} table_id
 * @param {object} fields - 字段名-值对
 */
async function addRecord(app_token, table_id, fields) {
  const data = await apiRequest(
    `/bitable/v1/apps/${app_token}/tables/${table_id}/records`,
    'POST',
    { fields }
  );
  console.log('[Bitable] 新增记录响应:', JSON.stringify(data));
  if (data.code !== 0) {
    throw new Error(`添加记录失败: ${data.msg} (code: ${data.code})`);
  }
  return data;
}

/**
 * 更新一条记录
 * PUT /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}
 * @param {string} app_token
 * @param {string} table_id
 * @param {string} record_id
 * @param {object} fields - 字段名-值对
 */
async function updateRecordOnServer(app_token, table_id, record_id, fields) {
  const data = await apiRequest(
    `/bitable/v1/apps/${app_token}/tables/${table_id}/records/${record_id}`,
    'PUT',
    { fields }
  );
  console.log('[Bitable] 更新记录响应:', JSON.stringify(data));
  if (data.code !== 0) {
    throw new Error(`更新记录失败: ${data.msg} (code: ${data.code})`);
  }
  return data;
}

/**
 * 删除一条记录
 * DELETE /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}
 */
async function deleteRecordOnServer(app_token, table_id, record_id) {
  const data = await apiRequest(
    `/bitable/v1/apps/${app_token}/tables/${table_id}/records/${record_id}`,
    'DELETE'
  );
  console.log('[Bitable] 删除记录响应:', JSON.stringify(data));
  if (data.code !== 0) {
    throw new Error(`删除记录失败: ${data.msg} (code: ${data.code})`);
  }
  return data;
}

/**
 * 搜索记录（精确匹配）
 * POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search
 */
async function searchRecordsOnServer(app_token, table_id, fieldName, value) {
  const data = await apiRequest(
    `/bitable/v1/apps/${app_token}/tables/${table_id}/records/search`,
    'POST',
    {
      filter: {
        conjunction: 'and',
        conditions: [
          {
            field_name: fieldName,
            operator: 'is',
            value: [value],
          },
        ],
      },
    }
  );
  console.log('[Bitable] 搜索记录响应:', JSON.stringify(data));
  if (data.code !== 0) {
    throw new Error(`搜索记录失败: ${data.msg} (code: ${data.code})`);
  }
  return data.data?.items || [];
}

// ========================
// Public API - Bitable
// ========================

/**
 * 获取或创建多维表格
 * @returns {Promise<object>} { app_token, table_id }
 */
async function getOrCreateBitable() {
  const savedAppToken = localStorage.getItem(STORAGE_KEY_APP_TOKEN);
  const savedTableId  = localStorage.getItem(STORAGE_KEY_TABLE_ID);

  console.log(`[Bitable] Storage check: app_token="${savedAppToken}" (length=${savedAppToken ? savedAppToken.length : 0}), table_id="${savedTableId}" (length=${savedTableId ? savedTableId.length : 0})`);

  if (savedAppToken && savedAppToken.length > 5 && savedTableId && savedTableId.length > 5) {
    console.log(`[Bitable] 找到已有多维表格: app_token=${savedAppToken}, table_id=${savedTableId}`);
    return { app_token: savedAppToken, table_id: savedTableId };
  }

  console.log('[Bitable] 未找到多维表格，创建新表格...');
  const { app_token, table_id } = await createBitable();
  await createFields(app_token, table_id);

  localStorage.setItem(STORAGE_KEY_APP_TOKEN, app_token);
  localStorage.setItem(STORAGE_KEY_TABLE_ID, table_id);

  console.log(`[Bitable] 多维表格创建完成: app_token=${app_token}, table_id=${table_id}`);
  return { app_token, table_id };
}

/**
 * 创建多维表格（含表头字段）
 * @returns {Promise<object>} { app_token, table_id }
 */
async function createCustomerBitable() {
  const { app_token, table_id } = await createBitable();
  await createFields(app_token, table_id);
  localStorage.setItem(STORAGE_KEY_APP_TOKEN, app_token);
  localStorage.setItem(STORAGE_KEY_TABLE_ID, table_id);
  return { app_token, table_id };
}

/**
 * 搜索客户（按公司名称模糊/精确搜索）
 * @param {string|object} query - 搜索关键词或 { fieldName, value } 对象
 * @returns {Promise<array>} 匹配的记录列表
 */
async function searchRecords(query) {
  const { app_token, table_id } = await getOrCreateBitable();

  // 支持两种调用方式: searchRecords("公司名") 或 searchRecords({ fieldName: "公司名称", value: "公司名" })
  let fieldName = '公司名称';
  let value = query;

  if (typeof query === 'object' && query !== null) {
    fieldName = query.fieldName || fieldName;
    value     = query.value;
  }

  if (!value || !String(value).trim()) return [];

  const records = await searchRecordsOnServer(app_token, table_id, fieldName, String(value).trim());
  return records;
}

/**
 * 添加客户记录
 * @param {object} fields - 字段名-值对，如 { 公司名称: 'xxx', 联系人: 'yyy' }
 * @returns {Promise<object>} 新增的记录
 */
async function createRecord(fields) {
  const { app_token, table_id } = await getOrCreateBitable();
  const result = await addRecord(app_token, table_id, fields);
  return result.data;
}

/**
 * 更新客户记录
 * @param {string} recordId - 记录 ID
 * @param {object} fields - 字段名-值对
 * @returns {Promise<object>} 更新后的记录
 */
async function updateRecord(recordId, fields) {
  const { app_token, table_id } = await getOrCreateBitable();
  const result = await updateRecordOnServer(app_token, table_id, recordId, fields);
  return result.data;
}

/**
 * 删除客户记录
 * @param {string} recordId - 记录 ID
 */
async function deleteRecord(recordId) {
  const { app_token, table_id } = await getOrCreateBitable();
  await deleteRecordOnServer(app_token, table_id, recordId);
}

// ========================
// Public API - Convenience Wrappers
// ========================

/**
 * 添加客户记录（方便格式，字段名映射）
 * @param {object} customerData - { company, contact, phone, email, address, country, photoUrl }
 */
async function addCustomerRow(customerData) {
  const { app_token, table_id } = await getOrCreateBitable();

  const fields = {
    '公司名称': customerData.company  || '',
    '联系人':   customerData.contact  || '',
    '电话':     customerData.phone    || '',
    '邮箱':     customerData.email    || '',
    '地址':     customerData.address  || '',
    '国家':     customerData.country  || '',
    '录入时间': new Date().toLocaleString('zh-CN'),
  };

  if (customerData.photoUrl) {
    fields['照片链接'] = customerData.photoUrl;
  }

  return await addRecord(app_token, table_id, fields);
}

/**
 * 根据公司名称搜索已存在的客户记录
 * @param {string} companyName
 */
async function searchCustomerByCompany(companyName) {
  if (!companyName || !companyName.trim()) return [];
  return await searchRecords({ fieldName: '公司名称', value: companyName.trim() });
}

// ========================
// 云盘文件夹管理
// ========================

/**
 * 创建"客户名片照片"文件夹
 * @returns {Promise<string>} folder_token
 */
async function createPhotoFolder() {
  const savedFolderToken = localStorage.getItem(STORAGE_KEY_PHOTO_FOLDER_TOKEN);
  if (savedFolderToken && savedFolderToken.length > 5) {
    console.log(`[Folder] 已存在 folder_token=${savedFolderToken}，跳过创建`);
    return savedFolderToken;
  }

  // 文件夹创建需要 app_access_token，这里直接用 user token 试试
  // 如果是 folder_token='' 表示在根目录创建
  const data = await apiRequest(
    '/drive/v1/files/create_folder',
    'POST',
    { name: '客户名片照片', folder_token: '' }
  );

  console.log('[Folder] 创建文件夹响应:', JSON.stringify(data));

  if (data.code !== 0) {
    // 文件夹可能已存在，尝试从响应中提取 token
    if (data.data && data.data.token) {
      const folderToken = data.data.token;
      localStorage.setItem(STORAGE_KEY_PHOTO_FOLDER_TOKEN, folderToken);
      console.log(`[Folder] 同名文件夹已存在，保存 token=${folderToken}`);
      return folderToken;
    }
    throw new Error(`创建文件夹失败: ${data.msg} (code: ${data.code})`);
  }

  const folderToken = data.data?.token;
  if (folderToken) {
    localStorage.setItem(STORAGE_KEY_PHOTO_FOLDER_TOKEN, folderToken);
    console.log(`[Folder] 文件夹创建成功，folder_token=${folderToken}`);
  }
  return folderToken || '';
}

/**
 * 获取或创建"客户名片照片"文件夹
 * @returns {Promise<string>} folder_token
 */
async function getOrCreatePhotoFolder() {
  const saved = localStorage.getItem(STORAGE_KEY_PHOTO_FOLDER_TOKEN);
  if (saved && saved.length > 5) return saved;
  return await createPhotoFolder();
}

// ========================
// 图片上传（使用 FormData + fetch）
// ========================

/**
 * 将本地图片文件上传到飞书云盘
 * 使用 FormData 替代 tt.uploadFile，适配浏览器环境
 *
 * @param {File|Blob} file - 浏览器 File 对象（或 Blob）
 * @param {string} [folderToken] - 可选，指定文件夹 token；不传则自动创建/获取
 * @returns {Promise<{ file_token: string, url: string }>}
 */
async function uploadImage(file, folderToken) {
  if (!file) {
    return { file_token: '', url: '' };
  }

  const token = getUserToken();
  const folder = folderToken || await getOrCreatePhotoFolder();

  const timestamp = Date.now();
  const fileName = file.name || `card_${timestamp}.jpg`;

  console.log(`[Upload] 开始上传文件: ${fileName}, size: ${file.size}, type: ${file.type}`);

  // 使用 FormData 上传（浏览器原生，无需第三方库）
  const formData = new FormData();
  formData.append('file_name', fileName);
  formData.append('parent_type', 'explorer');
  formData.append('parent_node', folder);
  formData.append('size', String(Math.floor(file.size)));
  formData.append('file', file);  // key 名必须是 'file'

  const uploadUrl = `${API_BASE}/drive/v1/files/upload_all`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // 注意：不设置 Content-Type，让 fetch 自动生成 multipart boundary
    },
    body: formData,
  });

  const uploadRes = await response.json();
  console.log('[Upload] 上传响应:', JSON.stringify(uploadRes));

  if (uploadRes && uploadRes.code === 0) {
    const fileToken = uploadRes.data?.file_token || '';
    const url = uploadRes.data?.url || `https://open.feishu.cn/file/${fileToken}`;
    console.log(`[Upload] 成功: file_token=${fileToken}, url=${url}`);
    return { file_token: fileToken, url };
  } else {
    throw new Error(`上传失败: ${uploadRes?.msg || '未知错误'}`);
  }
}

// ========================
// 导出（附加到 window，供非 module 模式调用）
// 【修改 - 2026-03-21】因为 index.html 的 script 标签没有 type="module"，
// 所以 export {} 语法不会生效，将 API 函数直接挂到 window 上
// ========================
window.API = {
  getOrCreateBitable,
  createCustomerBitable,
  searchRecords,
  searchCustomerByCompany,
  createRecord,
  updateRecord,
  deleteRecord,
  addCustomerRow,
  uploadImage,
  createPhotoFolder,
  getOrCreatePhotoFolder,
  STORAGE_KEY_APP_TOKEN,
  STORAGE_KEY_TABLE_ID,
  STORAGE_KEY_PHOTO_FOLDER_TOKEN,
  STORAGE_KEY_USER_TOKEN,
};

// 【保留】ES module export（如果后续改用 type="module" 则通过 import 调用）
export {
  // Bitable 核心
  getOrCreateBitable,
  createCustomerBitable,
  searchRecords,
  searchCustomerByCompany,
  createRecord,
  updateRecord,
  deleteRecord,
  addCustomerRow,
  // 云盘 & 上传
  uploadImage,
  createPhotoFolder,
  getOrCreatePhotoFolder,
  // Storage keys（供外部使用）
  STORAGE_KEY_APP_TOKEN,
  STORAGE_KEY_TABLE_ID,
  STORAGE_KEY_PHOTO_FOLDER_TOKEN,
  STORAGE_KEY_USER_TOKEN,
};
