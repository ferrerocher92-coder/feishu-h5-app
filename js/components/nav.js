/**
 * nav.js - Navigation Component
 */

/**
 * Create navigation bar HTML
 */
function createNavBar(title, showBack = false, showLogout = true) {
    const backButton = showBack ? `
        <button class="nav-btn" onclick="history.back()">返回</button>
    ` : '';

    const logoutButton = showLogout ? `
        <button class="nav-btn" onclick="handleLogout()">退出</button>
    ` : '';

    return `
        <nav class="navbar">
            ${backButton}
            <div class="nav-title">${title}</div>
            ${logoutButton}
        </nav>
    `;
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        Auth.clearAuth();
        window.location.href = 'pages/login.html';
    }
}

/**
 * Navigate back
 */
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        Router.navigate('/');
    }
}

// Export for use in app
window.Nav = {
    createNavBar,
    handleLogout,
    goBack
};
