/**
 * =========================================================
 * BioAuth — Система многофакторной биометрической аутентификации
 * =========================================================
 * SECURITY FIX: Полный рефакторинг с Auth Guard, строгим RBAC,
 * защитой от XSS (убран window.showAdminPanel), перехватом 401.
 */

'use strict';

// ============================================================
// 0. Page Detection — login.html vs index.html
// ============================================================
const PAGE = (() => {
    const path = window.location.pathname;
    if (path.includes('login.html') || path.endsWith('/login')) return 'login';
    return 'dashboard'; // index.html and everything else
})();

// ============================================================
// 1. UIController — Управление интерфейсом
// ============================================================
const UIController = (() => {
    const els = {};

    function init() {
        // Common elements (both pages)
        els.btnThemeToggle = document.getElementById('btn-theme-toggle');
        els.themeIcon = document.getElementById('theme-icon');
        els.notifications = document.getElementById('notifications-container');

        if (PAGE === 'login') {
            _initLoginElements();
        } else {
            _initDashboardElements();
        }

        _initTheme();
        _bindEvents();
    }

    function _initLoginElements() {
        els.authSection = document.getElementById('auth-section');
        els.successSection = document.getElementById('success-section');
        els.authForm = document.getElementById('auth-form');
        els.formTitle = document.getElementById('form-title');
        els.formSubtitle = document.getElementById('form-subtitle');
        els.tabLogin = document.getElementById('tab-login');
        els.tabRegister = document.getElementById('tab-register');
        els.tabIndicator = document.getElementById('tab-indicator');
        els.btnNextStep = document.getElementById('btn-next-step');
        els.btnNextStepText = document.getElementById('btn-next-step-text');
        els.loginBiometricBlock = document.getElementById('login-biometric-block');

        els.promoModal = document.getElementById('biometric-promo-modal');
        els.btnPromoPlatform = document.getElementById('btn-promo-platform');
        els.btnPromoCrossplatform = document.getElementById('btn-promo-crossplatform');
        els.btnPromoSkip = document.getElementById('btn-promo-skip');

        els.btnLogout = document.getElementById('btn-logout');
        els.btnSetupBiometrics = document.getElementById('btn-setup-biometrics');
        els.togglePassword = document.getElementById('toggle-password');
        els.inputLogin = document.getElementById('input-login');
        els.inputPassword = document.getElementById('input-password');
        els.inputGroupLogin = document.getElementById('input-group-login');
        els.inputGroupPassword = document.getElementById('input-group-password');

        // Backup
        els.btnShowBackupLogin = document.getElementById('btn-show-backup-login');
        els.loginBackupBlock = document.getElementById('login-backup-block');
        els.btnBackupLoginSubmit = document.getElementById('btn-backup-login-submit');
        els.btnBackToNormalLogin = document.getElementById('btn-back-to-normal-login');
        els.inputBackupCode = document.getElementById('input-backup-code');

        els.securityInfoBlock = document.getElementById('security-info-block');

        els.videoContainer = document.getElementById('video-container');
        els.instructionBlock = document.getElementById('instruction-block');
        els.instructionText = document.getElementById('instruction-text');
        els.instructionIcon = document.getElementById('instruction-icon');
        els.progressFill = document.getElementById('progress-fill');
        els.progressLabel = document.getElementById('progress-label');
        els.welcomeUsername = document.getElementById('welcome-username');
        els.loginTime = document.getElementById('login-time');

        els.stepCredentials = document.getElementById('step-credentials');
        els.stepLiveness = document.getElementById('step-liveness');
        els.stepResult = document.getElementById('step-result');
    }

    function _initDashboardElements() {
        els.dashboardSection = document.getElementById('dashboard-section');
        els.navAdminPanel = document.getElementById('nav-admin-panel');
        els.navMyProfile = document.getElementById('nav-my-profile');
        els.navMyDevices = document.getElementById('nav-my-devices');
        els.adminPanelSection = document.getElementById('admin-panel-section');
        els.profileSection = document.getElementById('profile-section');

        els.tabAdminUsers = document.getElementById('tab-admin-users');
        els.tabAdminAudit = document.getElementById('tab-admin-audit');
        els.adminUsersView = document.getElementById('admin-users-view');
        els.adminAuditView = document.getElementById('admin-audit-view');

        // Sidebar & Burger
        els.burgerToggle = document.getElementById('burger-toggle');
        els.dashboardSidebar = document.getElementById('dashboard-sidebar');
        els.sidebarOverlay = document.getElementById('sidebar-overlay');

        els.btnRefreshLogs = document.getElementById('btn-refresh-logs');
        els.btnDashPlatform = document.getElementById('btn-dash-setup-platform');
        els.btnDashCrossplatform = document.getElementById('btn-dash-setup-crossplatform');
        els.btnHeaderLogout = document.getElementById('btn-header-logout');

        // Backup
        els.btnGenerateBackupCodes = document.getElementById('btn-generate-backup-codes');
        els.backupCodesModal = document.getElementById('backup-codes-modal');
        els.backupCodesGrid = document.getElementById('backup-codes-grid');
        els.btnCopyBackupCodes = document.getElementById('btn-copy-backup-codes');
        els.btnCloseBackupModal = document.getElementById('btn-close-backup-modal');

        // Profile info
        els.profileAvatar = document.getElementById('profile-avatar');
        els.profileEmail = document.getElementById('profile-email');
        els.profileRoleBadge = document.getElementById('profile-role-badge');
        els.profileLoginTime = document.getElementById('profile-login-time');
    }

    // ------ Theme System ------
    function _initTheme() {
        const savedTheme = localStorage.getItem('theme');
        let theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        _applyTheme(theme);

        if (els.btnThemeToggle) {
            els.btnThemeToggle.addEventListener('click', () => {
                theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                localStorage.setItem('theme', theme);
                _applyTheme(theme);
                if (typeof DashboardManager !== 'undefined') {
                    DashboardManager.updateChartTheme();
                }
            });
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                _applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    function _applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (els.themeIcon) els.themeIcon.textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (els.themeIcon) els.themeIcon.textContent = '🌙';
        }
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    // ------ Sidebar / Burger ------
    function _openSidebar() {
        if (els.dashboardSidebar) els.dashboardSidebar.classList.add('sidebar--open');
        if (els.sidebarOverlay) {
            els.sidebarOverlay.style.display = 'block';
            requestAnimationFrame(() => els.sidebarOverlay.classList.add('active'));
        }
        document.body.style.overflow = 'hidden';
    }

    function _closeSidebar() {
        if (els.dashboardSidebar) els.dashboardSidebar.classList.remove('sidebar--open');
        if (els.sidebarOverlay) {
            els.sidebarOverlay.classList.remove('active');
            setTimeout(() => { els.sidebarOverlay.style.display = 'none'; }, 300);
        }
        document.body.style.overflow = '';
    }

    // ------ Event Bindings ------
    function _bindEvents() {
        if (PAGE === 'login') {
            _bindLoginEvents();
        } else {
            _bindDashboardEvents();
        }
    }

    function _bindLoginEvents() {
        els.tabLogin.addEventListener('click', () => setTab('login'));
        els.tabRegister.addEventListener('click', () => setTab('register'));

        els.togglePassword.addEventListener('click', () => {
            const inp = els.inputPassword;
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });

        if (els.btnPromoPlatform) els.btnPromoPlatform.addEventListener('click', () => App.setupBiometrics('platform'));
        if (els.btnPromoCrossplatform) els.btnPromoCrossplatform.addEventListener('click', () => App.setupBiometrics('cross-platform'));
        if (els.btnPromoSkip) els.btnPromoSkip.addEventListener('click', () => {
            els.promoModal.classList.add('hidden');
            showSuccess(App.getCurrentUserEmail());
        });

        if (els.btnLogout) {
            els.btnLogout.addEventListener('click', () => {
                // SECURITY FIX: На login.html кнопка "Перейти в Панель управления" → redirect
                window.location.replace('index.html');
            });
        }

        els.btnSetupPlatform = document.getElementById('btn-setup-platform');
        if (els.btnSetupPlatform) {
            els.btnSetupPlatform.addEventListener('click', () => App.setupBiometrics('platform'));
        }

        els.btnSetupCrossplatform = document.getElementById('btn-setup-crossplatform');
        if (els.btnSetupCrossplatform) {
            els.btnSetupCrossplatform.addEventListener('click', () => App.setupBiometrics('cross-platform'));
        }

        els.btnBiometricLogin = document.getElementById('btn-biometric-login');
        if (els.btnBiometricLogin) {
            els.btnBiometricLogin.addEventListener('click', (e) => App.loginWithBiometrics(e));
        }

        // Backup login events
        if (els.btnShowBackupLogin) {
            els.btnShowBackupLogin.addEventListener('click', () => {
                els.inputGroupLogin.style.display = 'none';
                els.loginBiometricBlock.style.display = 'none';
                els.inputGroupPassword.style.display = 'none';
                els.btnNextStep.style.display = 'none';
                els.loginBackupBlock.style.display = 'block';
            });
        }

        if (els.btnBackToNormalLogin) {
            els.btnBackToNormalLogin.addEventListener('click', () => {
                els.inputGroupLogin.style.display = 'block';
                els.loginBiometricBlock.style.display = 'block';
                els.inputGroupPassword.style.display = 'block';
                els.btnNextStep.style.display = 'block';
                els.loginBackupBlock.style.display = 'none';
            });
        }

        if (els.btnBackupLoginSubmit) {
            els.btnBackupLoginSubmit.addEventListener('click', () => App.loginWithBackupCode());
        }
    }

    function _bindDashboardEvents() {
        // Burger menu
        if (els.burgerToggle) {
            els.burgerToggle.addEventListener('click', () => {
                const isOpen = els.dashboardSidebar && els.dashboardSidebar.classList.contains('sidebar--open');
                if (isOpen) _closeSidebar();
                else _openSidebar();
            });
        }

        if (els.sidebarOverlay) {
            els.sidebarOverlay.addEventListener('click', _closeSidebar);
        }

        // Admin panel navigation
        if (els.navAdminPanel) {
            els.navAdminPanel.addEventListener('click', (e) => {
                e.preventDefault();
                showAdminPanel();
            });
        }

        const showMainDashboard = (e) => {
            e.preventDefault();
            if (els.profileSection) els.profileSection.classList.remove('hidden');
            if (els.adminPanelSection) els.adminPanelSection.classList.add('hidden');
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('sidebar-link--active'));
            e.currentTarget.classList.add('sidebar-link--active');
            _closeSidebar();
        };
        if (els.navMyProfile) els.navMyProfile.addEventListener('click', showMainDashboard);
        if (els.navMyDevices) els.navMyDevices.addEventListener('click', showMainDashboard);

        if (els.tabAdminUsers) {
            els.tabAdminUsers.addEventListener('click', () => {
                els.tabAdminUsers.classList.add('tab-switcher__btn--active');
                els.tabAdminAudit.classList.remove('tab-switcher__btn--active');
                els.adminUsersView.classList.remove('hidden');
                els.adminAuditView.classList.add('hidden');
            });
        }
        if (els.tabAdminAudit) {
            els.tabAdminAudit.addEventListener('click', () => {
                els.tabAdminAudit.classList.add('tab-switcher__btn--active');
                els.tabAdminUsers.classList.remove('tab-switcher__btn--active');
                els.adminAuditView.classList.remove('hidden');
                els.adminUsersView.classList.add('hidden');
            });
        }

        if (els.btnDashPlatform) els.btnDashPlatform.addEventListener('click', () => App.setupBiometrics('platform'));
        if (els.btnDashCrossplatform) els.btnDashCrossplatform.addEventListener('click', () => App.setupBiometrics('cross-platform'));
        if (els.btnRefreshLogs) els.btnRefreshLogs.addEventListener('click', () => DashboardManager.refresh());
        if (els.btnHeaderLogout) els.btnHeaderLogout.addEventListener('click', () => App.logout());

        // Backup codes (dashboard)
        if (els.btnGenerateBackupCodes) {
            els.btnGenerateBackupCodes.addEventListener('click', () => App.generateBackupCodes());
        }
        if (els.btnCloseBackupModal) {
            els.btnCloseBackupModal.addEventListener('click', () => {
                els.backupCodesModal.classList.add('hidden');
            });
        }
    }

    function setTab(tab) {
        const isLogin = tab === 'login';
        els.tabLogin.classList.toggle('tab-switcher__btn--active', isLogin);
        els.tabRegister.classList.toggle('tab-switcher__btn--active', !isLogin);
        els.tabIndicator.classList.toggle('tab-switcher__indicator--right', !isLogin);

        els.formTitle.textContent = isLogin ? 'Добро пожаловать' : 'Создать аккаунт';
        els.formSubtitle.textContent = isLogin
            ? 'Войдите в систему для продолжения'
            : 'Зарегистрируйтесь для начала работы';

        if (els.btnNextStepText) {
            els.btnNextStepText.textContent = isLogin ? 'Войти по паролю' : 'Зарегистрироваться';
        }

        if (els.loginBiometricBlock) {
            els.loginBiometricBlock.style.display = isLogin ? 'block' : 'none';
        }
    }

    function getCurrentTab() {
        return els.tabLogin.classList.contains('tab-switcher__btn--active') ? 'login' : 'register';
    }

    function setProgress(pct) {
        if (els.progressFill) els.progressFill.style.width = pct + '%';
        if (els.progressLabel) els.progressLabel.textContent = Math.round(pct) + '%';
    }

    function setInstruction(text, variant = '') {
        if (!els.instructionText) return;
        els.instructionText.textContent = text;
        els.instructionBlock.className = 'instruction-block';
        if (variant) els.instructionBlock.classList.add('instruction-block--' + variant);
    }

    function activateScannerUI() {
        if (els.securityInfoBlock) els.securityInfoBlock.style.display = 'none';
        if (els.videoContainer) els.videoContainer.style.display = 'flex';
        if (els.instructionBlock) els.instructionBlock.style.display = 'flex';
        if (els.progressContainer = document.getElementById('progress-container')) {
            els.progressContainer.style.display = 'flex';
        }
    }

    function setStep(stepName) {
        const steps = ['credentials', 'liveness', 'result'];
        const idx = steps.indexOf(stepName);
        [els.stepCredentials, els.stepLiveness, els.stepResult].forEach((el, i) => {
            if (!el) return;
            el.classList.remove('v-step--active', 'v-step--done');
            if (i < idx) el.classList.add('v-step--done');
            if (i === idx) el.classList.add('v-step--active');
        });
    }

    function showPromo() {
        if (els.authSection) els.authSection.classList.add('hidden');
        if (els.successSection) els.successSection.classList.add('hidden');
        if (els.promoModal) els.promoModal.classList.remove('hidden');
    }

    function showSuccess(username) {
        if (els.authSection) els.authSection.classList.add('hidden');
        if (els.promoModal) els.promoModal.classList.add('hidden');
        if (els.successSection) els.successSection.classList.remove('hidden');
        if (els.welcomeUsername) els.welcomeUsername.textContent = username;
        if (els.loginTime) els.loginTime.textContent = new Date().toLocaleString('ru-RU');
    }

    function showAuth() {
        if (els.successSection) els.successSection.classList.add('hidden');
        if (els.promoModal) els.promoModal.classList.add('hidden');
        if (els.authSection) els.authSection.classList.remove('hidden');
    }

    function notify(title, message, type = 'info') {
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        const el = document.createElement('div');
        el.className = `notification notification--${type}`;
        el.innerHTML = `
            <div class="notification__icon">${icons[type] || icons.info}</div>
            <div class="notification__body">
                <div class="notification__title">${title}</div>
                <div class="notification__message">${message}</div>
            </div>
            <button class="notification__close" aria-label="Закрыть">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>`;
        if (els.notifications) els.notifications.appendChild(el);

        el.querySelector('.notification__close').addEventListener('click', () => {
            el.classList.add('notification--exiting');
            setTimeout(() => el.remove(), 300);
        });

        setTimeout(() => {
            if (el.parentNode) {
                el.classList.add('notification--exiting');
                setTimeout(() => el.remove(), 300);
            }
        }, 5000);
    }

    function setBtnLoading(loading) {
        if (!els.btnNextStep) return;
        if (loading) {
            els.btnNextStep.disabled = true;
            els.btnNextStep.innerHTML = '<div class="spinner"></div><span>Ожидание...</span>';
        } else {
            const isLogin = getCurrentTab() === 'login';
            els.btnNextStep.disabled = false;
            els.btnNextStep.innerHTML = `<span>${isLogin ? 'Войти по паролю' : 'Зарегистрироваться'}</span>`;
        }
    }

    // SECURITY FIX: Строгий RBAC — setupRole удаляет admin DOM для role=user
    let currentRole = 'user';
    function setupRole(role) {
        currentRole = role;

        if (PAGE !== 'dashboard') return;

        if (role === 'user') {
            // SECURITY FIX: Полное удаление admin-секции из DOM (не display:none)
            if (els.adminPanelSection) {
                els.adminPanelSection.remove();
                els.adminPanelSection = null;
            }
            if (els.navAdminPanel) {
                els.navAdminPanel.remove();
                els.navAdminPanel = null;
            }
            // SECURITY FIX: Удаляем Audit/Login Logs из DOM для обычных пользователей
            const statsGrid = document.getElementById('stats-grid');
            if (statsGrid) statsGrid.remove();
            const logsWrapper = document.getElementById('logs-table');
            if (logsWrapper) logsWrapper.closest('.logs-table-wrapper')?.remove();
            const logsEmpty = document.getElementById('logs-empty-state');
            if (logsEmpty) logsEmpty.remove();
            // Показываем профиль
            if (els.profileSection) els.profileSection.classList.remove('hidden');
        } else if (role === 'admin' || role === 'auditor') {
            if (els.navAdminPanel) els.navAdminPanel.classList.remove('hidden');
            // Показываем профиль по умолчанию
            if (els.profileSection) els.profileSection.classList.remove('hidden');
            if (els.adminPanelSection) els.adminPanelSection.classList.add('hidden');

            if (role === 'auditor') {
                if (els.tabAdminUsers) els.tabAdminUsers.style.display = 'none';
                if (els.tabAdminAudit) els.tabAdminAudit.click();
            } else if (role === 'admin') {
                if (els.tabAdminUsers) els.tabAdminUsers.style.display = 'inline-block';
                if (els.tabAdminUsers) els.tabAdminUsers.click();
            }
        }
    }

    // SECURITY FIX: showAdminPanel — НЕ экспортируется в window (убираем XSS-вектор)
    function showAdminPanel() {
        if (currentRole !== 'admin' && currentRole !== 'auditor') {
            notify('Ошибка 403', 'Доступ запрещен', 'error');
            return;
        }
        if (!els.adminPanelSection) return;
        if (els.profileSection) els.profileSection.classList.add('hidden');
        els.adminPanelSection.classList.remove('hidden');
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('sidebar-link--active'));
        if (els.navAdminPanel) els.navAdminPanel.classList.add('sidebar-link--active');
        _closeSidebar();

        // Загружаем данные при переключении
        if (typeof App !== 'undefined') {
            DashboardManager.loadAdminPanel(App.getCurrentAccessToken(), currentRole);
        }
    }

    // Render profile card
    function renderProfile(profile) {
        if (PAGE !== 'dashboard') return;
        if (els.profileAvatar) els.profileAvatar.textContent = (profile.email || 'U')[0].toUpperCase();
        if (els.profileEmail) els.profileEmail.textContent = profile.email || '';
        if (els.profileRoleBadge) {
            const roleLabels = { admin: 'Администратор', auditor: 'Аудитор', user: 'Пользователь' };
            els.profileRoleBadge.textContent = roleLabels[profile.role] || profile.role;
            els.profileRoleBadge.className = 'log-badge';
            if (profile.role === 'admin') els.profileRoleBadge.classList.add('log-badge--warning');
            else if (profile.role === 'auditor') els.profileRoleBadge.classList.add('log-badge--info');
            else els.profileRoleBadge.classList.add('log-badge--success');
        }
        if (els.profileLoginTime) {
            els.profileLoginTime.textContent = 'Сессия: ' + new Date().toLocaleString('ru-RU');
        }
    }

    return { init, els, setTab, getCurrentTab, setProgress, setInstruction, activateScannerUI, setStep, showSuccess, showAuth, showPromo, notify, setBtnLoading, setupRole, getCurrentTheme, showAdminPanel, renderProfile };
})();

// ============================================================
// 2. APIClient — Запросы к FastAPI
// ============================================================
const APIClient = (() => {
    const BASE_URL = 'http://localhost:8000';

    // SECURITY FIX: Централизованный перехват 401 → force logout
    function _handleUnauthorized() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_email');
        window.location.replace('login.html');
    }

    function _extractErrorMessage(errBody, fallback) {
        if (errBody?.error?.message) return errBody.error.message;
        if (errBody?.error?.details) {
            if (Array.isArray(errBody.error.details)) {
                return errBody.error.details.map(d => d.message || d).join('; ');
            }
        }
        if (errBody?.detail) {
            if (Array.isArray(errBody.detail)) return errBody.detail[0]?.msg || fallback;
            return errBody.detail;
        }
        return fallback;
    }

    // SECURITY FIX: Обёртка для авторизованных запросов — перехватывает 401
    async function _authFetch(url, options = {}) {
        const response = await fetch(url, options);
        if (response.status === 401) {
            _handleUnauthorized();
            throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
        }
        return response;
    }

    async function loginStep1(email, password) {
        const response = await fetch(`${BASE_URL}/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка авторизации. Неверный логин или пароль.'));
        }
        return await response.json();
    }

    async function getWebAuthnOptions(mfaToken, email) {
        const response = await fetch(`${BASE_URL}/auth/webauthn/login/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mfaToken}`
            },
            body: JSON.stringify({ email: email })
        });

        if (!response.ok) throw new Error('Не удалось сгенерировать опции WebAuthn.');
        return await response.json();
    }

    async function verifyWebAuthn(mfaToken, email, credential) {
        const response = await fetch(`${BASE_URL}/auth/webauthn/login/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mfaToken}`
            },
            body: JSON.stringify({ email: email, credential: credential })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка верификации биометрии на сервере.'));
        }
        return await response.json();
    }

    async function register(email, password) {
        if (password.length < 8) {
            throw new Error("Пароль должен содержать минимум 8 символов");
        }

        const response = await fetch(`${BASE_URL}/auth/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: email.split('@')[0],
                email: email,
                password: password
            })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка при регистрации. Возможно, такой email уже занят.'));
        }

        return await response.json();
    }

    async function getWebAuthnRegistrationOptions(accessToken, type) {
        const response = await _authFetch(`${BASE_URL}/auth/webauthn/register/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ attachment_type: type })
        });

        if (!response.ok) throw new Error('Не удалось сгенерировать опции регистрации устройства.');
        return await response.json();
    }

    async function verifyWebAuthnRegistration(accessToken, email, attestationResponse) {
        const response = await _authFetch(`${BASE_URL}/auth/webauthn/register/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ email: email, credential: attestationResponse })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка верификации FIDO2 ключа на сервере.'));
        }
        return await response.json();
    }

    async function getWebAuthnLoginOptions(email) {
        const response = await fetch(`${BASE_URL}/auth/webauthn/login/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Не удалось получить опции для входа (Passwordless).'));
        }
        return await response.json();
    }

    async function verifyWebAuthnLogin(email, assertionResponse) {
        const response = await fetch(`${BASE_URL}/auth/webauthn/login/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, credential: assertionResponse })
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка верификации Passwordless входа.'));
        }
        return await response.json();
    }

    async function getWebAuthnDevices(accessToken) {
        const response = await _authFetch(`${BASE_URL}/auth/webauthn/devices`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Ошибка получения устройств');
        return await response.json();
    }

    async function getProfile(accessToken) {
        const response = await _authFetch(`${BASE_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Ошибка получения профиля');
        return await response.json();
    }

    async function getAdminUsers(accessToken) {
        const response = await _authFetch(`${BASE_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Ошибка получения пользователей');
        return await response.json();
    }

    async function getAdminAuditLogs(accessToken) {
        const response = await _authFetch(`${BASE_URL}/admin/audit-logs`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Ошибка получения логов аудита');
        return await response.json();
    }

    async function generateBackupCodes(accessToken) {
        const response = await _authFetch(`${BASE_URL}/auth/backup-codes/generate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка генерации резервных кодов'));
        }
        return await response.json();
    }

    async function loginWithBackupCode(email, code) {
        const response = await fetch(`${BASE_URL}/auth/login/backup-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Неверный резервный код'));
        }
        return await response.json();
    }

    // ── Admin Actions ──────────────────────────────────────
    async function lockUser(accessToken, userId, isLocked) {
        const response = await _authFetch(`${BASE_URL}/admin/users/${userId}/lock`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ is_locked: isLocked })
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка изменения статуса пользователя'));
        }
        return await response.json();
    }

    async function resetUserCredentials(accessToken, userId) {
        const response = await _authFetch(`${BASE_URL}/admin/users/${userId}/credentials`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(_extractErrorMessage(errBody, 'Ошибка сброса биометрии'));
        }
        return await response.json();
    }

    return {
        loginStep1, getWebAuthnOptions, verifyWebAuthn, register,
        getWebAuthnRegistrationOptions, verifyWebAuthnRegistration,
        getWebAuthnLoginOptions, verifyWebAuthnLogin, getWebAuthnDevices,
        getProfile, getAdminUsers, getAdminAuditLogs,
        generateBackupCodes, loginWithBackupCode,
        lockUser, resetUserCredentials
    };
})();

// ============================================================
// 3. DashboardManager — Логи безопасности и статистика
// ============================================================
const DashboardManager = (() => {
    const logs = [];
    const stats = { total: 0, success: 0, failed: 0, spoofing: 0 };

    const userAgents = [
        'Chrome 120 / Windows 11',
        'Safari 17 / macOS Sonoma'
    ];

    const ips = ['192.168.1.100', '10.0.0.42'];

    function addLog(event, result, user = 'admin') {
        const entry = {
            time: new Date().toLocaleString('ru-RU'),
            user: user,
            event: event,
            ip: ips[Math.floor(Math.random() * ips.length)],
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            result: result
        };
        logs.unshift(entry);
        stats.total++;
        if (result === 'success') stats.success++;
        if (result === 'fail') stats.failed++;
        if (result === 'warning') stats.spoofing++;
    }

    function generateDemoLogs() {
        if (logs.length > 0) return;
        addLog('Авторизация FIDO2', 'success', 'admin');
    }

    function refresh() {
        if (PAGE !== 'dashboard') return;

        const statTotal = document.getElementById('stat-total');
        const statSuccess = document.getElementById('stat-success');
        const statFailed = document.getElementById('stat-failed');
        const statSpoofing = document.getElementById('stat-spoofing');
        if (statTotal) statTotal.textContent = stats.total;
        if (statSuccess) statSuccess.textContent = stats.success;
        if (statFailed) statFailed.textContent = stats.failed;
        if (statSpoofing) statSpoofing.textContent = stats.spoofing;

        const tbody = document.getElementById('logs-tbody');
        const emptyState = document.getElementById('logs-empty-state');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (logs.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
        } else {
            if (emptyState) emptyState.classList.add('hidden');
            logs.forEach((log) => {
                let badgeHtml = '';
                if (log.result === 'success') {
                    badgeHtml = `<span class="log-badge log-badge--success">✓ Успех</span>`;
                } else if (log.result === 'fail') {
                    badgeHtml = `<span class="log-badge log-badge--fail">✗ Отклонено</span>`;
                } else {
                    badgeHtml = `<span class="log-badge log-badge--warning">⚠ Угроза</span>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td>${log.time}</td>
                <td>${log.user}</td>
                <td><span class="log-event">${log.event}</span></td>
                <td>${log.ip}</td>
                <td>${log.userAgent}</td>
                <td>${badgeHtml}</td>
            `;
                tbody.appendChild(tr);
            });
        }

        // Загружаем список устройств
        if (typeof App !== 'undefined') {
            loadDevices(App.getCurrentAccessToken());
        }
    }

    // Show skeleton loading in device list
    function _showDeviceSkeleton() {
        const container = document.getElementById('devices-list');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 2; i++) {
            const skel = document.createElement('div');
            skel.className = 'skeleton skeleton-card';
            container.appendChild(skel);
        }
    }

    async function loadDevices(accessToken) {
        if (!accessToken) return;
        const container = document.getElementById('devices-list');
        if (!container) return;

        _showDeviceSkeleton();

        try {
            const devices = await APIClient.getWebAuthnDevices(accessToken);
            container.innerHTML = '';

            if (!devices || devices.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 2rem 1rem;">
                        <div class="empty-state__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                <line x1="8" y1="21" x2="16" y2="21"/>
                                <line x1="12" y1="17" x2="12" y2="21"/>
                            </svg>
                        </div>
                        <div class="empty-state__title">Нет устройств</div>
                        <div class="empty-state__text">Привяжите первое устройство для безопасного входа.</div>
                    </div>`;
                return;
            }

            devices.forEach(dev => {
                const icon = dev.is_internal ? '💻' : '📱';
                const card = document.createElement('div');
                card.className = 'device-card';
                card.innerHTML = `
                    <div class="device-info">
                        <span style="font-size: 1.5rem;">${icon}</span>
                        <div class="device-meta">
                            <span class="device-name">${dev.name}</span>
                            <span class="device-date">Ключ: ${dev.credential_id_preview}</span>
                        </div>
                    </div>
                    <button class="btn btn--danger-ghost btn--sm btn-delete-device" data-id="${dev.id}">Удалить</button>
                `;
                container.appendChild(card);
            });

            container.querySelectorAll('.btn-delete-device').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    console.log('Запрос на удаление id:', id);
                    UIController.notify('Удаление', 'Функция отвязки устройства в разработке.', 'info');
                });
            });
        } catch (e) {
            UIController.notify('Ошибка', 'Не удалось загрузить список устройств', 'error');
            console.error(e);
            container.innerHTML = '';
        }
    }

    let auditChartInstance = null;

    async function loadAdminPanel(accessToken, role) {
        if (!accessToken) return;

        if (role === 'admin') {
            try {
                const resp = await APIClient.getAdminUsers(accessToken);
                const users = resp.items || resp;
                const tbody = document.getElementById('admin-users-tbody');
                const emptyState = document.getElementById('users-empty-state');
                if (tbody) {
                    tbody.innerHTML = '';
                    if (!users || users.length === 0) {
                        if (emptyState) emptyState.classList.remove('hidden');
                    } else {
                        if (emptyState) emptyState.classList.add('hidden');
                        users.forEach(u => {
                            const tr = document.createElement('tr');
                            const isLocked = u.is_locked || false;
                            const statusBadge = isLocked
                                ? `<span class="log-badge log-badge--fail">🔒 Заблокирован</span>`
                                : `<span class="log-badge log-badge--success">✓ Активен</span>`;
                            const lockBtnText = isLocked ? '🔓 Разблокировать' : '🔒 Заблокировать';
                            const lockBtnClass = isLocked ? 'btn--ghost' : 'btn--danger-ghost';

                            tr.innerHTML = `
                                <td>${u.id}</td>
                                <td>${u.email}</td>
                                <td><span class="log-badge">${u.role}</span></td>
                                <td>${statusBadge}</td>
                                <td style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    <button class="btn ${lockBtnClass} btn--sm btn-lock-user" data-user-id="${u.id}" data-locked="${isLocked}" style="font-size: 0.75rem; padding: 4px 10px;">${lockBtnText}</button>
                                    <button class="btn btn--danger-ghost btn--sm btn-reset-creds" data-user-id="${u.id}" style="font-size: 0.75rem; padding: 4px 10px;">🗑️ Сбросить биометрию</button>
                                </td>
                            `;
                            tbody.appendChild(tr);
                        });

                        // Bind lock/unlock actions
                        tbody.querySelectorAll('.btn-lock-user').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                const userId = e.target.getAttribute('data-user-id');
                                const currentlyLocked = e.target.getAttribute('data-locked') === 'true';
                                const newState = !currentlyLocked;
                                try {
                                    await APIClient.lockUser(accessToken, userId, newState);
                                    UIController.notify('Успех', newState ? 'Пользователь заблокирован' : 'Пользователь разблокирован', 'success');
                                    loadAdminPanel(accessToken, role); // Re-render
                                } catch (err) {
                                    UIController.notify('Ошибка', err.message, 'error');
                                }
                            });
                        });

                        // Bind reset biometrics actions
                        tbody.querySelectorAll('.btn-reset-creds').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                const userId = e.target.getAttribute('data-user-id');
                                if (!confirm('Удалить все WebAuthn ключи пользователя? Это действие необратимо.')) return;
                                try {
                                    const result = await APIClient.resetUserCredentials(accessToken, userId);
                                    UIController.notify('Успех', result.message || 'Биометрия сброшена', 'success');
                                } catch (err) {
                                    UIController.notify('Ошибка', err.message, 'error');
                                }
                            });
                        });
                    }
                }
            } catch (e) {
                console.error('Ошибка загрузки пользователей', e);
            }
        }

        try {
            const resp = await APIClient.getAdminAuditLogs(accessToken);
            const auditLogs = resp.items || resp;
            renderAdminAuditLogs(auditLogs);
            renderAuditChart(auditLogs);
        } catch (e) {
            console.error('Ошибка загрузки логов', e);
        }
    }

    function renderAdminAuditLogs(auditLogs) {
        const tbody = document.getElementById('admin-audit-tbody');
        const emptyState = document.getElementById('audit-empty-state');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!auditLogs || auditLogs.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');
        auditLogs.forEach(log => {
            const tr = document.createElement('tr');
            const date = new Date(log.timestamp).toLocaleString('ru-RU');
            tr.innerHTML = `
                <td>${date}</td>
                <td>${log.user_id || 'Система'}</td>
                <td><span class="log-event">${log.action}</span></td>
                <td><span class="log-badge ${log.status === 'SUCCESS' ? 'log-badge--success' : 'log-badge--fail'}">${log.status}</span></td>
                <td>${log.ip_address || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function _getChartColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            textColor: style.getPropertyValue('--chart-text-color').trim() || '#94a3b8',
            gridColor: style.getPropertyValue('--chart-grid-color').trim() || 'rgba(148,163,184,0.1)',
        };
    }

    function renderAuditChart(auditLogs) {
        const ctx = document.getElementById('auditChart');
        if (!ctx) return;

        if (auditChartInstance) {
            auditChartInstance.destroy();
        }

        let successCount = 0;
        let failedCount = 0;
        auditLogs.forEach(l => {
            if (l.status === 'SUCCESS') successCount++;
            else failedCount++;
        });

        const colors = _getChartColors();

        auditChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Успешные действия', 'Отклоненные действия'],
                datasets: [{
                    label: 'События аудита',
                    data: [successCount, failedCount],
                    backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                    borderColor: ['#10B981', '#EF4444'],
                    borderWidth: 1,
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: "'Inter', sans-serif" } },
                        border: { color: colors.gridColor }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: colors.textColor, font: { family: "'Inter', sans-serif" } },
                        border: { color: colors.gridColor }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: "'Inter', sans-serif" },
                        bodyFont: { family: "'Inter', sans-serif" },
                        cornerRadius: 8,
                        padding: 12,
                    }
                }
            }
        });
    }

    function updateChartTheme() {
        if (!auditChartInstance) return;
        const colors = _getChartColors();

        auditChartInstance.options.scales.y.grid.color = colors.gridColor;
        auditChartInstance.options.scales.y.ticks.color = colors.textColor;
        auditChartInstance.options.scales.y.border.color = colors.gridColor;
        auditChartInstance.options.scales.x.ticks.color = colors.textColor;
        auditChartInstance.options.scales.x.border.color = colors.gridColor;
        auditChartInstance.update();
    }

    return { addLog, generateDemoLogs, refresh, loadDevices, loadAdminPanel, updateChartTheme };
})();

// ============================================================
// 4. App — Точка входа, связывает все модули
// ============================================================
const App = (() => {
    let currentAccessToken = null;
    let currentUserEmail = null;

    async function init() {
        UIController.init();

        if (PAGE === 'login') {
            _initLoginPage();
        } else {
            await _initDashboardPage();
        }
    }

    function _initLoginPage() {
        DashboardManager.generateDemoLogs();
        UIController.els.authForm.addEventListener('submit', _onFormSubmit);
        console.log('[BioAuth] Страница входа инициализирована');
        UIController.notify('Система готова', 'BioAuth v2.0 WebAuthn загружена.', 'info');
    }

    async function _initDashboardPage() {
        const savedToken = localStorage.getItem('access_token');
        const savedEmail = localStorage.getItem('user_email');

        if (!savedToken || !savedEmail) {
            window.location.replace('login.html');
            return;
        }

        currentAccessToken = savedToken;
        currentUserEmail = savedEmail;

        DashboardManager.generateDemoLogs();

        try {
            const profile = await APIClient.getProfile(currentAccessToken);

            // SECURITY FIX: Render profile + strict RBAC
            UIController.renderProfile(profile);
            UIController.setupRole(profile.role);
            DashboardManager.refresh();
            DashboardManager.loadAdminPanel(currentAccessToken, profile.role);

            UIController.notify('Добро пожаловать', `Сессия восстановлена: ${profile.email}`, 'success');
        } catch (err) {
            // SECURITY FIX: Если токен невалиден — force logout
            console.error('Ошибка восстановления сессии:', err);
            logout();
        }
    }

    function getCurrentUserEmail() {
        return currentUserEmail;
    }

    async function _onFormSubmit(e) {
        e.preventDefault();

        const email = UIController.els.inputLogin.value.trim();
        const password = UIController.els.inputPassword.value;
        const tab = UIController.getCurrentTab();

        if (!email || !password) {
            UIController.notify('Ошибка', 'Введите логин и пароль.', 'error');
            return;
        }

        UIController.setBtnLoading(true);

        try {
            if (tab === 'login') {
                UIController.setInstruction('Проверка учётных данных...', 'info');
                const AuthResponse = await APIClient.loginStep1(email, password);

                if (AuthResponse.requires_mfa && AuthResponse.mfa_token) {
                    UIController.setStep('liveness');
                    UIController.activateScannerUI();
                    UIController.setInstruction('Подтвердите вход с помощью системной биометрии (FaceID/TouchID)', 'warning');
                    UIController.setProgress(50);

                    const options = await APIClient.getWebAuthnOptions(AuthResponse.mfa_token, email);

                    let attestationResponse;
                    try {
                        attestationResponse = await SimpleWebAuthnBrowser.startAuthentication(options.options);
                    } catch (webAuthnError) {
                        if (webAuthnError.name === 'NotAllowedError') {
                            throw new Error('Системная проверка отменена пользователем.');
                        }
                        throw webAuthnError;
                    }

                    UIController.setInstruction('Проверка криптографического ответа...', 'info');

                    const verifyResp = await APIClient.verifyWebAuthn(AuthResponse.mfa_token, email, attestationResponse);
                    currentAccessToken = verifyResp.access_token;
                    currentUserEmail = email;

                    _handleSuccess(email, 'Вход WebAuthn выполнен');
                } else {
                    currentAccessToken = AuthResponse.access_token;
                    currentUserEmail = email;
                    _handleSuccess(email, 'Успешный вход (Пароль)');
                }
            } else {
                UIController.setInstruction('Регистрация пользователя...', 'info');
                const regResp = await APIClient.register(email, password);

                currentAccessToken = regResp.access_token;
                currentUserEmail = email;
                localStorage.setItem('access_token', currentAccessToken);
                localStorage.setItem('user_email', currentUserEmail);

                DashboardManager.addLog('Новый аккаунт зарегистрирован', 'success', email);
                UIController.showPromo();
                _resetToForm();
                UIController.els.inputLogin.value = '';
                UIController.els.inputPassword.value = '';
            }

        } catch (error) {
            UIController.notify('Ошибка операции', error.message, 'error');
            DashboardManager.addLog('Авторизация', 'fail', email);
            _resetToForm();
        } finally {
            UIController.setBtnLoading(false);
        }
    }

    function _handleSuccess(username, logEvent) {
        UIController.setStep('result');
        UIController.setProgress(100);
        UIController.setInstruction('Верификация пройдена успешно!', 'success');
        UIController.notify('Успех', 'Авторизация выполнена', 'success');

        DashboardManager.addLog(logEvent, 'success', username);

        if (currentAccessToken) {
            localStorage.setItem('access_token', currentAccessToken);
            localStorage.setItem('user_email', currentUserEmail);
        }

        // SECURITY FIX: Redirect to dashboard instead of inline section switch
        setTimeout(() => {
            UIController.showSuccess(username);
            _resetToForm();
            UIController.els.inputLogin.value = '';
            UIController.els.inputPassword.value = '';
        }, 1500);
    }

    function _resetToForm() {
        UIController.setStep('credentials');
        UIController.setProgress(0);
        UIController.setInstruction('Заполните форму слева и нажмите «Продолжить»');
    }

    function logout() {
        currentAccessToken = null;
        currentUserEmail = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_email');
        // SECURITY FIX: replace() prevents back-button to authenticated state
        window.location.replace('login.html');
    }

    async function setupBiometrics(type) {
        if (!currentAccessToken || !currentUserEmail) {
            UIController.notify('Ошибка', 'Нет активной сессии для привязки устройства.', 'error');
            return;
        }

        try {
            const typeLabel = type === 'platform' ? 'встроенного считывателя (Ноутбук)' : 'внешнего ключа (Телефон/USB)';
            UIController.notify('Инфо', `Запрос параметров для регистрации ${typeLabel}...`, 'info');

            const optionsResp = await APIClient.getWebAuthnRegistrationOptions(currentAccessToken, type);
            const options = optionsResp.options;

            let attestationResponse;
            try {
                attestationResponse = await SimpleWebAuthnBrowser.startRegistration(options);
            } catch (webAuthnError) {
                if (webAuthnError.name === 'NotAllowedError') {
                    throw new Error('Регистрация устройства отменена пользователем.');
                }
                throw webAuthnError;
            }

            UIController.notify('Инфо', 'Ожидание сервера (сохранение ключа)...', 'info');
            await APIClient.verifyWebAuthnRegistration(currentAccessToken, currentUserEmail, attestationResponse);

            UIController.notify('Успех', 'Устройство успешно привязано!', 'success');
            DashboardManager.addLog(`Привязка устройства FIDO2 (${type})`, 'success', currentUserEmail);

            if (UIController.els.promoModal && !UIController.els.promoModal.classList.contains('hidden')) {
                UIController.showSuccess(currentUserEmail);
            }
        } catch (error) {
            UIController.notify('Ошибка', error.message, 'error');
            DashboardManager.addLog('Ошибка привязки FIDO2', 'fail', currentUserEmail);
        }
    }

    async function loginWithBiometrics(e) {
        e.preventDefault();

        const email = UIController.els.inputLogin.value.trim();
        if (!email) {
            UIController.notify('Внимание', 'Пожалуйста, введите Email для входа по биометрии.', 'warning');
            return;
        }

        UIController.setBtnLoading(true);
        try {
            UIController.activateScannerUI();
            UIController.setInstruction('Подготовка к биометрическому входу...', 'info');

            const optionsResp = await APIClient.getWebAuthnLoginOptions(email);
            const options = optionsResp.options;

            let assertionResponse;
            try {
                assertionResponse = await SimpleWebAuthnBrowser.startAuthentication(options);
            } catch (webAuthnError) {
                if (webAuthnError.name === 'NotAllowedError') {
                    throw new Error('Сканирование отменено пользователем.');
                }
                throw webAuthnError;
            }

            UIController.setInstruction('Проверка данных на сервере...', 'info');

            const verifyResp = await APIClient.verifyWebAuthnLogin(email, assertionResponse);

            currentAccessToken = verifyResp.access_token;
            currentUserEmail = email;

            _handleSuccess(email, 'Passwordless вход WebAuthn');

        } catch (error) {
            UIController.notify('Ошибка входа', error.message, 'error');
            DashboardManager.addLog('Авторизация Passwordless', 'fail', email);
            _resetToForm();
        } finally {
            UIController.setBtnLoading(false);
        }
    }

    function getCurrentAccessToken() {
        return currentAccessToken || localStorage.getItem('access_token');
    }

    async function generateBackupCodes() {
        const token = getCurrentAccessToken();
        if (!token) return;

        try {
            UIController.notify('Инфо', 'Генерация кодов...', 'info');
            const data = await APIClient.generateBackupCodes(token);
            const codes = data.codes || data;

            if (Array.isArray(codes)) {
                UIController.els.backupCodesGrid.innerHTML = '';
                codes.forEach(code => {
                    const div = document.createElement('div');
                    div.textContent = code;
                    UIController.els.backupCodesGrid.appendChild(div);
                });

                UIController.els.btnCopyBackupCodes.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(codes.join('\n'));
                        UIController.notify('Скопировано', 'Резервные коды сохранены в буфер обмена', 'success');
                    } catch (e) {
                        UIController.notify('Ошибка', 'Не удалось скопировать коды', 'error');
                    }
                };

                UIController.els.backupCodesModal.classList.remove('hidden');
                DashboardManager.addLog('Сгенерированы резервные коды', 'success', currentUserEmail);
            }
        } catch (error) {
            UIController.notify('Ошибка', error.message, 'error');
        }
    }

    async function loginWithBackupCode() {
        const email = UIController.els.inputLogin.value.trim();
        const code = UIController.els.inputBackupCode.value.trim();

        if (!email) {
            UIController.notify('Ошибка', 'Пожалуйста, введите Email на предыдущем шаге', 'error');
            return;
        }
        if (!code) {
            UIController.notify('Ошибка', 'Введите резервный код', 'error');
            return;
        }

        UIController.setBtnLoading(true);
        if (UIController.els.btnBackupLoginSubmit) {
            UIController.els.btnBackupLoginSubmit.disabled = true;
            UIController.els.btnBackupLoginSubmit.innerHTML = '<div class="spinner"></div><span>Ожидание...</span>';
        }

        try {
            const resp = await APIClient.loginWithBackupCode(email, code);
            currentAccessToken = resp.access_token;
            currentUserEmail = email;

            UIController.els.inputGroupLogin.style.display = 'block';
            UIController.els.loginBiometricBlock.style.display = 'block';
            UIController.els.inputGroupPassword.style.display = 'block';
            UIController.els.btnNextStep.style.display = 'block';
            UIController.els.loginBackupBlock.style.display = 'none';
            UIController.els.inputBackupCode.value = '';

            _handleSuccess(email, 'Вход по резервному коду');
        } catch (error) {
            UIController.notify('Ошибка входа', error.message, 'error');
            DashboardManager.addLog('Вход по резервному коду', 'fail', email);
        } finally {
            UIController.setBtnLoading(false);
            if (UIController.els.btnBackupLoginSubmit) {
                UIController.els.btnBackupLoginSubmit.disabled = false;
                UIController.els.btnBackupLoginSubmit.innerHTML = 'Подтвердить резервный код';
            }
        }
    }

    return { init, getCurrentUserEmail, getCurrentAccessToken, setupBiometrics, loginWithBiometrics, logout, generateBackupCodes, loginWithBackupCode };
})();

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    const isLoginPage = PAGE === 'login';

    // SECURITY FIX: Auth Guard — redirect BEFORE app init
    if (!token && !isLoginPage) {
        window.location.replace('login.html');
        return;
    }
    if (token && isLoginPage) {
        window.location.replace('index.html');
        return;
    }

    App.init();
});