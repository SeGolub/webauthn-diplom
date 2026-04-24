
import * as API from './api.js';
import * as Camera from './camera.js';

let currentAccessToken = null;
let currentUserEmail = null;

const PAGE = (window.location.pathname.endsWith('login.html') || window.location.href.includes('login'))
    ? 'login'
    : 'dashboard';

export function notify(title, message, type = 'info') {
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    };

    const container = document.getElementById('notifications-container');
    if (!container) return;

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
    container.appendChild(el);

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

function initTheme() {
    const btnToggle = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    const savedTheme = localStorage.getItem('theme');
    let theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);

    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
            applyTheme(theme);
        });
    }

    function applyTheme(t) {
        if (t === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeIcon) themeIcon.textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (themeIcon) themeIcon.textContent = '🌙';
        }
    }
}

function initLoginPage() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const tabIndicator = document.getElementById('tab-indicator');
    const formTitle = document.getElementById('form-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const authForm = document.getElementById('auth-form');
    const inputLogin = document.getElementById('input-login');
    const inputPassword = document.getElementById('input-password');
    const togglePassword = document.getElementById('toggle-password');
    const btnNextStep = document.getElementById('btn-next-step');
    const btnNextStepText = document.getElementById('btn-next-step-text');

    const cameraVideo = document.getElementById('camera-video');
    const btnCaptureLogin = document.getElementById('btn-capture-login');
    const cameraSection = document.getElementById('camera-section');
    const cameraPlaceholder = document.getElementById('camera-placeholder');

    const otpSection = document.getElementById('otp-section');
    const otpInputs = document.querySelectorAll('.otp-input');
    const btnVerifyOtp = document.getElementById('btn-verify-otp');

    const btnShowBackupLogin = document.getElementById('btn-show-backup-login');
    const loginBackupBlock = document.getElementById('login-backup-block');
    const btnBackupLoginSubmit = document.getElementById('btn-backup-login-submit');
    const btnBackToNormalLogin = document.getElementById('btn-back-to-normal-login');
    const inputBackupCode = document.getElementById('input-backup-code');
    const loginBiometricBlock = document.getElementById('login-biometric-block');
    const inputGroupPassword = document.getElementById('input-group-password');
    const inputGroupLogin = document.getElementById('input-group-login');

    const authSection = document.getElementById('auth-section');
    const successSection = document.getElementById('success-section');
    const promoModal = document.getElementById('biometric-promo-modal');
    const welcomeUsername = document.getElementById('welcome-username');
    const loginTime = document.getElementById('login-time');
    const btnLogout = document.getElementById('btn-logout');

    const btnEnrollFace = document.getElementById('btn-enroll-face');

    const securityInfoBlock = document.getElementById('security-info-block');
    const instructionBlock = document.getElementById('instruction-block');
    const instructionText = document.getElementById('instruction-text');

    let currentTab = 'login';

    function setTab(tab) {
        currentTab = tab;
        if (tabLogin) tabLogin.classList.toggle('tab-switcher__btn--active', tab === 'login');
        if (tabRegister) tabRegister.classList.toggle('tab-switcher__btn--active', tab === 'register');
        if (tabIndicator) tabIndicator.style.transform = tab === 'login' ? 'translateX(0%)' : 'translateX(100%)';
        if (formTitle) formTitle.textContent = tab === 'login' ? 'Добро пожаловать' : 'Создать аккаунт';
        if (formSubtitle) formSubtitle.textContent = tab === 'login'
            ? 'Войдите в систему для продолжения'
            : 'Зарегистрируйтесь для начала работы';
        if (btnNextStepText) btnNextStepText.textContent = tab === 'login' ? 'Войти по паролю' : 'Зарегистрироваться';
        hideCameraAndOTP();
    }

    function setBtnLoading(isLoading) {
        if (!btnNextStep) return;
        btnNextStep.disabled = isLoading;
        if (isLoading) {
            btnNextStep.innerHTML = '<div class="spinner"></div><span>Загрузка...</span>';
        } else {
            const label = currentTab === 'login' ? 'Войти по паролю' : 'Зарегистрироваться';
            btnNextStep.innerHTML = `<span id="btn-next-step-text">${label}</span>`;
        }
    }

    function showSuccess(email) {
        if (authSection) authSection.classList.add('hidden');
        if (successSection) successSection.classList.remove('hidden');
        if (welcomeUsername) welcomeUsername.textContent = email;
        if (loginTime) loginTime.textContent = new Date().toLocaleTimeString('ru-RU');
        Camera.stopCamera();
    }

    function hideCameraAndOTP() {
        if (cameraSection) cameraSection.style.display = 'none';
        if (otpSection) otpSection.style.display = 'none';
        Camera.stopCamera();

        if (securityInfoBlock) securityInfoBlock.style.display = 'block';
    }

    function showEnrollPromo() {
        if (authSection) authSection.classList.add('hidden');
        if (successSection) successSection.classList.add('hidden');
        if (promoModal) promoModal.classList.remove('hidden');
    }

    if (tabLogin) tabLogin.addEventListener('click', () => setTab('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => setTab('register'));

    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            inputPassword.type = inputPassword.type === 'password' ? 'text' : 'password';
        });
    }

    otpInputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value && idx < otpInputs.length - 1) {
                otpInputs[idx + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                otpInputs[idx - 1].focus();
            }
        });
    });

    if (authForm) authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = inputLogin.value.trim();
        const password = inputPassword.value;

        if (!email || !password) {
            notify('Ошибка', 'Введите email и пароль.', 'error');
            return;
        }

        setBtnLoading(true);

        try {
            if (currentTab === 'login') {
                const resp = await API.loginStep1(email, password);

                if (resp.requires_face) {
                    currentUserEmail = email;
                    notify('Пароль принят', 'Подтвердите личность через камеру.', 'info');
                    showFaceVerification(email);
                } else {
                    currentAccessToken = resp.access_token;
                    currentUserEmail = email;
                    localStorage.setItem('access_token', currentAccessToken);
                    localStorage.setItem('user_email', currentUserEmail);
                    notify('Успех', 'Вход выполнен', 'success');
                    setTimeout(() => showSuccess(email), 800);
                }

            } else {
                const resp = await API.register(email, password);
                currentAccessToken = resp.access_token;
                currentUserEmail = email;
                localStorage.setItem('access_token', currentAccessToken);
                localStorage.setItem('user_email', currentUserEmail);

                notify('Регистрация', 'Аккаунт создан!', 'success');
                showEnrollPromo();
            }
        } catch (error) {
            notify('Ошибка', error.message, 'error');
        } finally {
            setBtnLoading(false);
        }
    });

    async function showFaceVerification(email) {
        if (securityInfoBlock) securityInfoBlock.style.display = 'none';
        if (cameraSection) cameraSection.style.display = 'block';
        if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';

        if (instructionBlock) {
            instructionBlock.style.display = 'flex';
        }
        if (instructionText) {
            instructionText.textContent = 'Посмотрите в камеру и нажмите «Сделать снимок»';
        }

        try {
            await Camera.initCamera(cameraVideo);
            if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
        } catch (err) {
            notify('Камера', err.message, 'error');
            return;
        }

        if (btnCaptureLogin) {
            const newBtn = btnCaptureLogin.cloneNode(true);
            btnCaptureLogin.parentNode.replaceChild(newBtn, btnCaptureLogin);

            newBtn.addEventListener('click', async () => {
                newBtn.disabled = true;
                newBtn.innerHTML = '<div class="spinner"></div><span>Проверка...</span>';

                try {
                    const snapshot = Camera.captureFrame(cameraVideo);
                    const result = await API.verifyFace(email, snapshot);

                    if (result.otp_sent) {
                        notify('Лицо распознано', 'OTP-код отправлен. Проверьте консоль сервера.', 'success');
                        showOTPInput(email);
                    }
                } catch (error) {
                    notify('Ошибка', error.message, 'error');
                    newBtn.disabled = false;
                    newBtn.innerHTML = '📸 Сделать снимок';
                }
            });
        }
    }

    function showOTPInput(email) {
        if (cameraSection) cameraSection.style.display = 'none';
        if (otpSection) otpSection.style.display = 'block';
        Camera.stopCamera();

        if (instructionText) {
            instructionText.textContent = 'Введите 6-значный OTP-код из консоли сервера';
        }

        if (otpInputs.length > 0) otpInputs[0].focus();
    }

    if (btnVerifyOtp) {
        btnVerifyOtp.addEventListener('click', async () => {
            const code = Array.from(otpInputs).map(i => i.value).join('');
            if (code.length !== 6) {
                notify('Ошибка', 'Введите все 6 цифр OTP-кода.', 'error');
                return;
            }

            btnVerifyOtp.disabled = true;
            btnVerifyOtp.innerHTML = '<div class="spinner"></div><span>Проверка...</span>';

            try {
                const resp = await API.verifyOTP(currentUserEmail, code);
                currentAccessToken = resp.access_token;
                localStorage.setItem('access_token', currentAccessToken);
                localStorage.setItem('user_email', currentUserEmail);

                notify('Успех', 'Двухфакторная аутентификация пройдена!', 'success');
                otpInputs.forEach(i => { i.value = ''; });
                setTimeout(() => showSuccess(currentUserEmail), 800);
            } catch (error) {
                notify('Ошибка OTP', error.message, 'error');
            } finally {
                btnVerifyOtp.disabled = false;
                btnVerifyOtp.innerHTML = 'Подтвердить код';
            }
        });
    }

    if (btnEnrollFace) {
        btnEnrollFace.addEventListener('click', async () => {
            if (promoModal) promoModal.classList.add('hidden');
            if (authSection) authSection.classList.remove('hidden');
            if (securityInfoBlock) securityInfoBlock.style.display = 'none';
            if (cameraSection) cameraSection.style.display = 'block';

            if (instructionBlock) instructionBlock.style.display = 'flex';
            if (instructionText) {
                instructionText.textContent = 'Посмотрите в камеру для регистрации лица';
            }

            try {
                await Camera.initCamera(cameraVideo);
                if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
            } catch (err) {
                notify('Камера', err.message, 'error');
                return;
            }

            const captureBtn = document.getElementById('btn-capture-login');
            if (captureBtn) {
                const newBtn = captureBtn.cloneNode(true);
                captureBtn.parentNode.replaceChild(newBtn, captureBtn);

                newBtn.addEventListener('click', async () => {
                    newBtn.disabled = true;
                    newBtn.innerHTML = '<div class="spinner"></div><span>Сохранение...</span>';

                    try {
                        const snapshot = Camera.captureFrame(cameraVideo);
                        await API.enrollFace(currentAccessToken, snapshot);
                        notify('Успех', 'Лицо зарегистрировано!', 'success');
                        Camera.stopCamera();
                        showSuccess(currentUserEmail);
                    } catch (error) {
                        notify('Ошибка', error.message, 'error');
                        newBtn.disabled = false;
                        newBtn.innerHTML = '📸 Сделать снимок';
                    }
                });
            }
        });
    }

    const btnPromoSkip = document.getElementById('btn-promo-skip');
    if (btnPromoSkip) {
        btnPromoSkip.addEventListener('click', () => {
            if (promoModal) promoModal.classList.add('hidden');
            showSuccess(currentUserEmail);
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.location.replace('index.html');
        });
    }

    if (btnShowBackupLogin) {
        btnShowBackupLogin.addEventListener('click', () => {
            if (inputGroupLogin) inputGroupLogin.style.display = 'none';
            if (loginBiometricBlock) loginBiometricBlock.style.display = 'none';
            if (inputGroupPassword) inputGroupPassword.style.display = 'none';
            if (btnNextStep) btnNextStep.style.display = 'none';
            if (loginBackupBlock) loginBackupBlock.style.display = 'block';
        });
    }

    if (btnBackToNormalLogin) {
        btnBackToNormalLogin.addEventListener('click', () => {
            if (inputGroupLogin) inputGroupLogin.style.display = 'block';
            if (loginBiometricBlock) loginBiometricBlock.style.display = 'block';
            if (inputGroupPassword) inputGroupPassword.style.display = 'block';
            if (btnNextStep) btnNextStep.style.display = 'block';
            if (loginBackupBlock) loginBackupBlock.style.display = 'none';
        });
    }

    if (btnBackupLoginSubmit) {
        btnBackupLoginSubmit.addEventListener('click', async () => {
            const email = inputLogin.value.trim();
            const code = inputBackupCode.value.trim();

            if (!email || !code) {
                notify('Ошибка', 'Введите email и резервный код.', 'error');
                return;
            }

            btnBackupLoginSubmit.disabled = true;
            btnBackupLoginSubmit.innerHTML = '<div class="spinner"></div><span>Ожидание...</span>';

            try {
                const resp = await API.loginWithBackupCode(email, code);
                currentAccessToken = resp.access_token;
                currentUserEmail = email;
                localStorage.setItem('access_token', currentAccessToken);
                localStorage.setItem('user_email', currentUserEmail);

                if (inputGroupLogin) inputGroupLogin.style.display = 'block';
                if (loginBiometricBlock) loginBiometricBlock.style.display = 'block';
                if (inputGroupPassword) inputGroupPassword.style.display = 'block';
                if (btnNextStep) btnNextStep.style.display = 'block';
                if (loginBackupBlock) loginBackupBlock.style.display = 'none';
                if (inputBackupCode) inputBackupCode.value = '';

                notify('Успех', 'Вход по резервному коду', 'success');
                setTimeout(() => showSuccess(email), 800);
            } catch (error) {
                notify('Ошибка', error.message, 'error');
            } finally {
                btnBackupLoginSubmit.disabled = false;
                btnBackupLoginSubmit.innerHTML = 'Подтвердить резервный код';
            }
        });
    }

}

async function initDashboardPage() {
    const savedToken = localStorage.getItem('access_token');
    const savedEmail = localStorage.getItem('user_email');

    if (!savedToken || !savedEmail) {
        window.location.replace('login.html');
        return;
    }

    currentAccessToken = savedToken;
    currentUserEmail = savedEmail;

    const burgerToggle = document.getElementById('burger-toggle');
    const dashboardSidebar = document.getElementById('dashboard-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        if (dashboardSidebar) dashboardSidebar.classList.add('sidebar--open');
        if (sidebarOverlay) {
            sidebarOverlay.style.display = 'block';
            requestAnimationFrame(() => sidebarOverlay.classList.add('active'));
        }
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        if (dashboardSidebar) dashboardSidebar.classList.remove('sidebar--open');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
            setTimeout(() => { sidebarOverlay.style.display = 'none'; }, 300);
        }
        document.body.style.overflow = '';
    }

    if (burgerToggle) {
        burgerToggle.addEventListener('click', () => {
            const isOpen = dashboardSidebar && dashboardSidebar.classList.contains('sidebar--open');
            isOpen ? closeSidebar() : openSidebar();
        });
    }
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    const navMyProfile = document.getElementById('nav-my-profile');
    const navMyDevices = document.getElementById('nav-my-devices');
    const navAdminPanel = document.getElementById('nav-admin-panel');
    const profileSection = document.getElementById('profile-section');
    const adminPanelSection = document.getElementById('admin-panel-section');

    function showProfile(e) {
        if (e) e.preventDefault();
        if (profileSection) profileSection.classList.remove('hidden');
        if (adminPanelSection) adminPanelSection.classList.add('hidden');
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('sidebar-link--active'));
        if (e && e.currentTarget) e.currentTarget.classList.add('sidebar-link--active');
        closeSidebar();
    }
    if (navMyProfile) navMyProfile.addEventListener('click', showProfile);
    if (navMyDevices) navMyDevices.addEventListener('click', showProfile);

    if (navAdminPanel) {
        navAdminPanel.addEventListener('click', (e) => {
            e.preventDefault();
            showAdminPanel();
            closeSidebar();
        });
    }

    const tabAdminUsers = document.getElementById('tab-admin-users');
    const tabAdminAudit = document.getElementById('tab-admin-audit');
    const adminUsersView = document.getElementById('admin-users-view');
    const adminAuditView = document.getElementById('admin-audit-view');

    if (tabAdminUsers) {
        tabAdminUsers.addEventListener('click', () => {
            tabAdminUsers.classList.add('tab-switcher__btn--active');
            if (tabAdminAudit) tabAdminAudit.classList.remove('tab-switcher__btn--active');
            if (adminUsersView) adminUsersView.classList.remove('hidden');
            if (adminAuditView) adminAuditView.classList.add('hidden');
        });
    }
    if (tabAdminAudit) {
        tabAdminAudit.addEventListener('click', () => {
            tabAdminAudit.classList.add('tab-switcher__btn--active');
            if (tabAdminUsers) tabAdminUsers.classList.remove('tab-switcher__btn--active');
            if (adminAuditView) adminAuditView.classList.remove('hidden');
            if (adminUsersView) adminUsersView.classList.add('hidden');
        });
    }

    const btnHeaderLogout = document.getElementById('btn-header-logout');
    if (btnHeaderLogout) {
        btnHeaderLogout.addEventListener('click', () => {
            currentAccessToken = null;
            currentUserEmail = null;
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_email');
            window.location.replace('login.html');
        });
    }

    const btnRefreshLogs = document.getElementById('btn-refresh-logs');
    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', () => loadDashboardData());
    }

    const btnDashEnrollFace = document.getElementById('btn-dash-enroll-face');
    const dashCameraSection = document.getElementById('dash-camera-section');
    const dashCameraVideo = document.getElementById('dash-camera-video');
    const btnDashCapture = document.getElementById('btn-dash-capture');

    if (btnDashEnrollFace) {
        btnDashEnrollFace.addEventListener('click', async () => {
            if (dashCameraSection) dashCameraSection.style.display = 'block';
            try {
                await Camera.initCamera(dashCameraVideo);
            } catch (err) {
                notify('Камера', err.message, 'error');
            }
        });
    }

    if (btnDashCapture) {
        btnDashCapture.addEventListener('click', async () => {
            btnDashCapture.disabled = true;
            btnDashCapture.innerHTML = '<div class="spinner"></div><span>Сохранение...</span>';
            try {
                const snapshot = Camera.captureFrame(dashCameraVideo);
                await API.enrollFace(currentAccessToken, snapshot);
                notify('Успех', 'Лицо зарегистрировано!', 'success');
                Camera.stopCamera();
                if (dashCameraSection) dashCameraSection.style.display = 'none';
                loadFaceStatus();
            } catch (error) {
                notify('Ошибка', error.message, 'error');
            } finally {
                btnDashCapture.disabled = false;
                btnDashCapture.innerHTML = '📸 Сделать снимок';
            }
        });
    }


    const btnGenerateBackupCodes = document.getElementById('btn-generate-backup-codes');
    const backupCodesModal = document.getElementById('backup-codes-modal');
    const backupCodesGrid = document.getElementById('backup-codes-grid');
    const btnCopyBackupCodes = document.getElementById('btn-copy-backup-codes');
    const btnCloseBackupModal = document.getElementById('btn-close-backup-modal');

    if (btnGenerateBackupCodes) {
        btnGenerateBackupCodes.addEventListener('click', async () => {
            try {
                notify('Инфо', 'Генерация кодов...', 'info');
                const data = await API.generateBackupCodes(currentAccessToken);
                const codes = data.codes || data;

                if (Array.isArray(codes) && backupCodesGrid) {
                    backupCodesGrid.innerHTML = '';
                    codes.forEach(code => {
                        const div = document.createElement('div');
                        div.textContent = code;
                        backupCodesGrid.appendChild(div);
                    });

                    if (btnCopyBackupCodes) {
                        btnCopyBackupCodes.onclick = async () => {
                            try {
                                await navigator.clipboard.writeText(codes.join('\n'));
                                notify('Скопировано', 'Резервные коды в буфере обмена', 'success');
                            } catch (e) {
                                notify('Ошибка', 'Не удалось скопировать', 'error');
                            }
                        };
                    }

                    if (backupCodesModal) backupCodesModal.classList.remove('hidden');
                }
            } catch (error) {
                notify('Ошибка', error.message, 'error');
            }
        });
    }

    if (btnCloseBackupModal) {
        btnCloseBackupModal.addEventListener('click', () => {
            if (backupCodesModal) backupCodesModal.classList.add('hidden');
        });
    }

    try {
        const profile = await API.getProfile(currentAccessToken);
        renderProfile(profile);
        setupRole(profile.role);
        await loadDashboardData();
        loadFaceStatus();
        notify('Добро пожаловать', `Сессия: ${profile.email}`, 'success');
    } catch (err) {
        console.error('Ошибка сессии:', err);
        currentAccessToken = null;
        currentUserEmail = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_email');
        window.location.replace('login.html');
    }

    function renderProfile(profile) {
        const avatarEl = document.getElementById('profile-avatar');
        const emailEl = document.getElementById('profile-email');
        const roleBadgeEl = document.getElementById('profile-role-badge');
        const loginTimeEl = document.getElementById('profile-login-time');
        if (avatarEl) avatarEl.textContent = (profile.email || 'U')[0].toUpperCase();
        if (emailEl) emailEl.textContent = profile.email || '';
        if (roleBadgeEl) roleBadgeEl.textContent = profile.role || 'user';
        if (loginTimeEl) loginTimeEl.textContent = 'Вход: ' + new Date().toLocaleString('ru-RU');
    }

    function showAdminPanel() {
        if (profileSection) profileSection.classList.add('hidden');
        if (adminPanelSection) adminPanelSection.classList.remove('hidden');
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('sidebar-link--active'));
        if (navAdminPanel) navAdminPanel.classList.add('sidebar-link--active');
        loadAdminPanel();
    }

    async function loadDashboardData() {
        try {
            const resp = await API.getAdminAuditLogs(currentAccessToken);
            const logs = resp.items || resp;
            const tbody = document.getElementById('logs-tbody');
            const emptyState = document.getElementById('logs-empty-state');
            let successCount = 0, failedCount = 0;

            if (tbody) {
                tbody.innerHTML = '';
                if (!logs || logs.length === 0) {
                    if (emptyState) emptyState.classList.remove('hidden');
                } else {
                    if (emptyState) emptyState.classList.add('hidden');
                    logs.forEach(log => {
                        const tr = document.createElement('tr');
                        const statusClass = log.status === 'SUCCESS' ? 'log-badge--success' : 'log-badge--fail';
                        if (log.status === 'SUCCESS') successCount++; else failedCount++;
                        tr.innerHTML = `
                            <td>${new Date(log.created_at).toLocaleString('ru-RU')}</td>
                            <td>${log.user_id ?? '—'}</td>
                            <td>${log.action}</td>
                            <td>${log.ip_address || '—'}</td>
                            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${log.user_agent || '—'}</td>
                            <td><span class="log-badge ${statusClass}">${log.status}</span></td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            const statTotal = document.getElementById('stat-total');
            const statSuccess = document.getElementById('stat-success');
            const statFailed = document.getElementById('stat-failed');
            if (statTotal) statTotal.textContent = (logs || []).length;
            if (statSuccess) statSuccess.textContent = successCount;
            if (statFailed) statFailed.textContent = failedCount;
        } catch (e) {
            console.error('Ошибка loadDashboardData:', e);
        }
    }

    function renderAuditLogs(auditLogs) {
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
            const statusClass = log.status === 'SUCCESS' ? 'log-badge--success' : 'log-badge--fail';
            tr.innerHTML = `
                <td>${new Date(log.created_at).toLocaleString('ru-RU')}</td>
                <td>${log.user_id ?? '—'}</td>
                <td>${log.action}</td>
                <td><span class="log-badge ${statusClass}">${log.status}</span></td>
                <td>${log.ip_address || '—'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function setupRole(role) {
        if (role === 'user') {
            if (adminPanelSection) { adminPanelSection.remove(); }
            if (navAdminPanel) { navAdminPanel.remove(); }
            const statsGrid = document.getElementById('stats-grid');
            if (statsGrid) statsGrid.remove();
            const logsWrapper = document.getElementById('logs-table');
            if (logsWrapper) logsWrapper.closest('.logs-table-wrapper')?.remove();
            const logsEmpty = document.getElementById('logs-empty-state');
            if (logsEmpty) logsEmpty.remove();
            if (profileSection) profileSection.classList.remove('hidden');
        } else if (role === 'admin' || role === 'auditor') {
            if (navAdminPanel) navAdminPanel.classList.remove('hidden');
            if (profileSection) profileSection.classList.remove('hidden');
            if (adminPanelSection) adminPanelSection.classList.add('hidden');

            if (role === 'auditor') {
                if (tabAdminUsers) tabAdminUsers.style.display = 'none';
                if (tabAdminAudit) tabAdminAudit.click();
            }
        }
    }

    async function loadFaceStatus() {
        try {
            const status = await API.getFaceStatus(currentAccessToken);
            const faceStatusEl = document.getElementById('face-status-text');
            const btnEnroll = document.getElementById('btn-dash-enroll-face');
            if (faceStatusEl) {
                faceStatusEl.textContent = status.has_face ? '✅ Лицо зарегистрировано' : '❌ Лицо не зарегистрировано';
            }
            if (btnEnroll) {
                btnEnroll.textContent = status.has_face ? '🔄 Перезаписать лицо' : '📸 Зарегистрировать лицо';
            }
        } catch (e) {
            console.error('Ошибка загрузки статуса лица:', e);
        }
    }

    async function loadAdminPanel() {
        try {
            const resp = await API.getAdminUsers(currentAccessToken);
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
                            <button class="btn btn--danger-ghost btn--sm btn-reset-face" data-user-id="${u.id}" style="font-size: 0.75rem; padding: 4px 10px;">🗑️ Сбросить лицо</button>
                        </td>
                    `;
                        tbody.appendChild(tr);
                    });

                    tbody.querySelectorAll('.btn-lock-user').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const userId = e.target.getAttribute('data-user-id');
                            const currentlyLocked = e.target.getAttribute('data-locked') === 'true';
                            try {
                                await API.lockUser(currentAccessToken, userId, !currentlyLocked);
                                notify('Успех', !currentlyLocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован', 'success');
                                loadAdminPanel();
                            } catch (err) {
                                notify('Ошибка', err.message, 'error');
                            }
                        });
                    });

                    tbody.querySelectorAll('.btn-reset-face').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const userId = e.target.getAttribute('data-user-id');
                            if (!confirm('Сбросить биометрию лица пользователя?')) return;
                            try {
                                const result = await API.resetUserFace(currentAccessToken, userId);
                                notify('Успех', result.message || 'Биометрия сброшена', 'success');
                            } catch (err) {
                                notify('Ошибка', err.message, 'error');
                            }
                        });
                    });
                }
            }
        } catch (e) {
            console.error('Ошибка загрузки пользователей:', e);
        }

        try {
            const resp = await API.getAdminAuditLogs(currentAccessToken);
            const auditLogs = resp.items || resp;
            renderAuditLogs(auditLogs);
            renderAuditChart(auditLogs);
        } catch (e) {
            console.error('Ошибка загрузки логов:', e);
        }
    }

    let auditChartInstance = null;
    function renderAuditChart(auditLogs) {
        const ctx = document.getElementById('auditChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (auditChartInstance) auditChartInstance.destroy();

        let successCount = 0;
        let failedCount = 0;
        auditLogs.forEach(l => {
            if (l.status === 'SUCCESS') successCount++;
            else failedCount++;
        });

        const style = getComputedStyle(document.documentElement);
        const textColor = style.getPropertyValue('--chart-text-color').trim() || '#94a3b8';
        const gridColor = style.getPropertyValue('--chart-grid-color').trim() || 'rgba(148,163,184,0.1)';

        auditChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Успешные', 'Отклонённые'],
                datasets: [{
                    label: 'События',
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
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { family: "'Inter', sans-serif" } },
                        border: { color: gridColor }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: "'Inter', sans-serif" } },
                        border: { color: gridColor }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        cornerRadius: 8,
                        padding: 12,
                    }
                }
            }
        });
    }
}

export function init() {
    initTheme();

    if (PAGE === 'login') {
        initLoginPage();
    } else {
        initDashboardPage();
    }
}


export function getPageType() {
    return PAGE;
}
