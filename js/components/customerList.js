/**
 * customerList.js - Customer List Component
 */

/**
 * Render customer list view
 * @param {Array} customers - Array of customer objects
 * @param {Object} options - Rendering options
 */
function renderCustomerList(customers, options = {}) {
    const container = document.createElement('div');
    container.className = 'customer-list';
    
    if (!customers || customers.length === 0) {
        container.innerHTML = renderEmptyState(options.emptyText || '暂无客户数据');
        return container;
    }

    const listItems = customers.map(customer => {
        const primaryInfo = customer.name || customer.company_name || '未知客户';
        const secondaryInfo = customer.phone || customer.mobile || '';
        const dateInfo = customer.created_at ? formatDate(customer.created_at) : '';

        return `
            <div class="card list-item" data-customer-id="${customer.customer_id || customer.id}" onclick="viewCustomer('${customer.customer_id || customer.id}')">
                <div class="list-item-title">${primaryInfo}</div>
                <div class="list-item-desc">
                    ${secondaryInfo}${secondaryInfo && dateInfo ? ' · ' : ''}${dateInfo}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = listItems;
    return container;
}

/**
 * Render empty state
 */
function renderEmptyState(message) {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Format date string
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * View customer detail
 */
function viewCustomer(customerId) {
    Router.navigate(`/detail/${customerId}`);
}

/**
 * Create pagination controls
 */
function createPagination(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';

    const prevDisabled = currentPage <= 1 ? 'disabled' : '';
    const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

    return `
        <div class="pagination" style="display: flex; justify-content: center; gap: 8px; margin-top: 16px;">
            <button class="btn" ${prevDisabled} onclick="${onPageChange}(${currentPage - 1})">上一页</button>
            <span style="padding: 10px 16px;">${currentPage} / ${totalPages}</span>
            <button class="btn" ${nextDisabled} onclick="${onPageChange}(${currentPage + 1})">下一页</button>
        </div>
    `;
}

// Export for use in app
window.CustomerList = {
    render: renderCustomerList,
    view: viewCustomer,
    formatDate,
    createPagination
};
