/**
 * customerForm.js - Customer Form Component
 */

/**
 * Create customer form HTML
 * @param {Object} customer - Customer data for editing (null for new customer)
 * @param {Function} onSubmit - Submit handler function
 */
function createCustomerForm(customer = null, onSubmit) {
    const isEdit = !!customer;
    const formId = `customerForm_${isEdit ? customer.customer_id : 'new'}`;

    const formHTML = `
        <form id="${formId}" class="customer-form">
            <div class="form-group">
                <label class="form-label">客户名称 *</label>
                <input type="text" class="form-input" name="name" 
                    placeholder="请输入客户名称" 
                    value="${customer?.name || ''}" 
                    required>
            </div>
            
            <div class="form-group">
                <label class="form-label">联系电话</label>
                <input type="tel" class="form-input" name="phone" 
                    placeholder="请输入联系电话" 
                    value="${customer?.phone || ''}">
            </div>
            
            <div class="form-group">
                <label class="form-label">电子邮箱</label>
                <input type="email" class="form-input" name="email" 
                    placeholder="请输入电子邮箱" 
                    value="${customer?.email || ''}">
            </div>
            
            <div class="form-group">
                <label class="form-label">公司地址</label>
                <input type="text" class="form-input" name="address" 
                    placeholder="请输入公司地址" 
                    value="${customer?.address || ''}">
            </div>
            
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-input" name="remark" rows="3" 
                    placeholder="请输入备注信息">${customer?.remark || ''}</textarea>
            </div>
            
            <button type="submit" class="btn btn-primary btn-block">
                ${isEdit ? '保存修改' : '创建客户'}
            </button>
        </form>
    `;

    // Attach event listener after rendering
    setTimeout(() => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const customerData = Object.fromEntries(formData.entries());
                
                if (onSubmit) {
                    onSubmit(customerData, customer?.customer_id);
                }
            });
        }
    }, 0);

    return formHTML;
}

/**
 * Validate customer form data
 */
function validateCustomerForm(data) {
    const errors = [];

    if (!data.name || data.name.trim() === '') {
        errors.push('客户名称不能为空');
    }

    if (data.phone && !/^[\d\-\+\(\)\s]+$/.test(data.phone)) {
        errors.push('请输入有效的电话号码');
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('请输入有效的电子邮箱');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Show form validation errors
 */
function showFormErrors(errors) {
    return errors.join('\n');
}

// Export for use in app
window.CustomerForm = {
    create: createCustomerForm,
    validate: validateCustomerForm,
    showErrors: showFormErrors
};
