/**
 * =========================================================
 * BioAuth — Система многофакторной биометрической аутентификации
 * =========================================================
 *
 * Модули:
 *   1. UIController       — Управление интерфейсом, вкладками, уведомлениями
 *   2. OTPHandler         — Логика ввода OTP-кода
 *   3. CameraManager      — Управление веб-камерой
 *   4. FaceMeshEngine     — MediaPipe Face Mesh + вычисление поворота головы
 *   5. LivenessChecker    — Стейт-машина Liveness-проверки (Challenge-Response)
 *   6. APIClient          — Заглушка для взаимодействия с бэкендом FastAPI
 *   7. DashboardManager   — Логи безопасности и статистика
 *   8. App                — Точка входа, связывает все модули
 */

'use strict';

// ============================================================
// 1. UIController — Управление интерфейсом
// ============================================================
const UIController = (() => {
    // DOM-элементы (кешируются при инициализации)
    const els = {};

    /**
     * Инициализация: собираем все нужные DOM-элементы
     */
    function init() {
        els.authSection      = document.getElementById('auth-section');
        els.successSection   = document.getElementById('success-section');
        els.dashboardSection = document.getElementById('dashboard-section');
        els.authForm         = document.getElementById('auth-form');
        els.formTitle        = document.getElementById('form-title');
        els.formSubtitle     = document.getElementById('form-subtitle');
        els.tabLogin         = document.getElementById('tab-login');
        els.tabRegister      = document.getElementById('tab-register');
        els.tabIndicator     = document.getElementById('tab-indicator');
        els.btnNextStep      = document.getElementById('btn-next-step');
        els.btnLogout        = document.getElementById('btn-logout');
        els.btnDashboard     = document.getElementById('btn-toggle-dashboard');
        els.btnCloseDash     = document.getElementById('btn-close-dashboard');
        els.btnRefreshLogs   = document.getElementById('btn-refresh-logs');
        els.togglePassword   = document.getElementById('toggle-password');
        els.inputLogin       = document.getElementById('input-login');
        els.inputPassword    = document.getElementById('input-password');
        els.videoContainer   = document.getElementById('video-container');
        els.videoOverlay     = document.getElementById('video-overlay');
        els.videoPlaceholder = document.getElementById('video-placeholder');
        els.webcamVideo      = document.getElementById('webcam-video');
        els.faceCanvas       = document.getElementById('face-canvas');
        els.snapshotCanvas   = document.getElementById('snapshot-canvas');
        els.scanFrame        = document.querySelector('.scan-frame');
        els.instructionBlock = document.getElementById('instruction-block');
        els.instructionText  = document.getElementById('instruction-text');
        els.instructionIcon  = document.getElementById('instruction-icon');
        els.progressFill     = document.getElementById('progress-fill');
        els.progressLabel    = document.getElementById('progress-label');
        els.welcomeUsername  = document.getElementById('welcome-username');
        els.loginTime        = document.getElementById('login-time');
        els.notifications    = document.getElementById('notifications-container');

        // Steps
        els.stepCredentials = document.getElementById('step-credentials');
        els.stepLiveness    = document.getElementById('step-liveness');
        els.stepResult      = document.getElementById('step-result');

        _bindEvents();
    }

    /** Привязка событий */
    function _bindEvents() {
        // Табы вход/регистрация
        els.tabLogin.addEventListener('click', () => setTab('login'));
        els.tabRegister.addEventListener('click', () => setTab('register'));

        // Показать/скрыть пароль
        els.togglePassword.addEventListener('click', () => {
            const inp = els.inputPassword;
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });

        // Кнопка Dashboard
        els.btnDashboard.addEventListener('click', toggleDashboard);
        els.btnCloseDash.addEventListener('click', toggleDashboard);
        els.btnRefreshLogs.addEventListener('click', () => DashboardManager.refresh());

        // Logout
        els.btnLogout.addEventListener('click', () => App.logout());
    }

    /** Переключение табов */
    function setTab(tab) {
        const isLogin = tab === 'login';
        els.tabLogin.classList.toggle('tab-switcher__btn--active', isLogin);
        els.tabRegister.classList.toggle('tab-switcher__btn--active', !isLogin);
        els.tabIndicator.classList.toggle('tab-switcher__indicator--right', !isLogin);

        els.formTitle.textContent   = isLogin ? 'Добро пожаловать' : 'Создать аккаунт';
        els.formSubtitle.textContent = isLogin
            ? 'Войдите в систему для продолжения'
            : 'Зарегистрируйтесь для начала работы';
        els.btnNextStep.querySelector('span').textContent = isLogin ? 'Продолжить' : 'Зарегистрироваться';
    }

    /** Текущий таб */
    function getCurrentTab() {
        return els.tabLogin.classList.contains('tab-switcher__btn--active') ? 'login' : 'register';
    }

    /** Обновить прогресс-бар */
    function setProgress(pct) {
        els.progressFill.style.width = pct + '%';
        els.progressLabel.textContent = Math.round(pct) + '%';
    }

    /** Обновить инструкцию */
    function setInstruction(text, variant = '') {
        els.instructionText.textContent = text;
        els.instructionBlock.className = 'instruction-block';
        if (variant) els.instructionBlock.classList.add('instruction-block--' + variant);
    }

    /** Обновить шаги верификации */
    function setStep(stepName) {
        const steps = ['credentials', 'liveness', 'result'];
        const idx = steps.indexOf(stepName);
        [els.stepCredentials, els.stepLiveness, els.stepResult].forEach((el, i) => {
            el.classList.remove('v-step--active', 'v-step--done');
            if (i < idx) el.classList.add('v-step--done');
            if (i === idx) el.classList.add('v-step--active');
        });
    }

    /** Показать экран успеха */
    function showSuccess(username) {
        els.authSection.classList.add('hidden');
        els.dashboardSection.classList.add('hidden');
        els.successSection.classList.remove('hidden');
        els.welcomeUsername.textContent = username;
        els.loginTime.textContent = new Date().toLocaleString('ru-RU');
    }

    /** Показать экран аутентификации */
    function showAuth() {
        els.successSection.classList.add('hidden');
        els.dashboardSection.classList.add('hidden');
        els.authSection.classList.remove('hidden');
    }

    /** Toggle dashboard */
    function toggleDashboard() {
        const visible = !els.dashboardSection.classList.contains('hidden');
        if (visible) {
            els.dashboardSection.classList.add('hidden');
            els.authSection.classList.remove('hidden');
            els.successSection.classList.add('hidden');
        } else {
            els.dashboardSection.classList.remove('hidden');
            els.authSection.classList.add('hidden');
            els.successSection.classList.add('hidden');
            DashboardManager.refresh();
        }
    }

    /** Активировать камеру в UI */
    function activateCamera() {
        els.videoOverlay.classList.add('hidden');
        els.webcamVideo.classList.add('active');
        els.scanFrame.classList.add('active');
    }

    /** Деактивировать камеру в UI */
    function deactivateCamera() {
        els.videoOverlay.classList.remove('hidden');
        els.webcamVideo.classList.remove('active');
        els.scanFrame.classList.remove('active');
        els.videoContainer.classList.remove('video-container--face-detected');
    }

    /** Показать уведомление */
    function notify(title, message, type = 'info') {
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        const el = document.createElement('div');
        el.className = `notification notification--${type}`;
        el.innerHTML = `
            <div class="notification__icon">${icons[type] || icons.info}</div>
            <div class="notification__body">
                <div class="notification__title">${title}</div>
                <div class="notification__message">${message}</div>
            </div>`;
        els.notifications.appendChild(el);

        // Автоудаление через 5 секунд
        setTimeout(() => {
            el.classList.add('notification--exiting');
            setTimeout(() => el.remove(), 300);
        }, 5000);
    }

    /** Установить состояние кнопки (загрузка) */
    function setBtnLoading(loading) {
        if (loading) {
            els.btnNextStep.disabled = true;
            els.btnNextStep.innerHTML = '<div class="spinner"></div><span>Проверка...</span>';
        } else {
            els.btnNextStep.disabled = false;
            els.btnNextStep.innerHTML = '<span>Продолжить</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
    }

    return { init, els, setTab, getCurrentTab, setProgress, setInstruction, setStep, showSuccess, showAuth, activateCamera, deactivateCamera, notify, setBtnLoading, toggleDashboard };
})();


// ============================================================
// 2. OTPHandler — Логика ввода 6-значного OTP
// ============================================================
const OTPHandler = (() => {
    const inputs = [];

    function init() {
        for (let i = 1; i <= 6; i++) {
            inputs.push(document.getElementById('otp-' + i));
        }

        inputs.forEach((inp, idx) => {
            // При вводе цифры — автопереход на следующее поле
            inp.addEventListener('input', (e) => {
                const val = e.target.value.replace(/\D/g, '');
                e.target.value = val.slice(-1);
                if (val && idx < 5) inputs[idx + 1].focus();
            });

            // Backspace — переход назад
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                    inputs[idx - 1].focus();
                }
            });

            // Вставка целого кода из буфера обмена
            inp.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                pasted.split('').forEach((ch, i) => {
                    if (inputs[i]) inputs[i].value = ch;
                });
                if (pasted.length > 0) inputs[Math.min(pasted.length, 5)].focus();
            });
        });
    }

    /** Получить собранный OTP-код (6 цифр) */
    function getCode() {
        return inputs.map(i => i.value).join('');
    }

    /** Очистить все поля */
    function clear() {
        inputs.forEach(i => (i.value = ''));
        inputs[0].focus();
    }

    return { init, getCode, clear };
})();


// ============================================================
// 3. CameraManager — Управление веб-камерой
// ============================================================
const CameraManager = (() => {
    let stream = null;

    /**
     * Запросить доступ к камере и запустить видеопоток
     */
    async function start() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width:  { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            const video = UIController.els.webcamVideo;
            video.srcObject = stream;
            await video.play();
            UIController.activateCamera();
            return true;
        } catch (err) {
            console.error('Ошибка доступа к камере:', err);
            UIController.notify('Ошибка камеры', 'Не удалось получить доступ к веб-камере. Проверьте разрешения.', 'error');
            return false;
        }
    }

    /**
     * Остановить видеопоток
     */
    function stop() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        UIController.els.webcamVideo.srcObject = null;
        UIController.deactivateCamera();
    }

    /**
     * Сделать стоп-кадр и вернуть Base64-строку (JPEG)
     */
    function captureSnapshot() {
        const video    = UIController.els.webcamVideo;
        const canvas   = UIController.els.snapshotCanvas;
        canvas.width   = video.videoWidth;
        canvas.height  = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        // Возвращаем Base64 (data:image/jpeg;base64,...)
        return canvas.toDataURL('image/jpeg', 0.9);
    }

    return { start, stop, captureSnapshot };
})();


// ============================================================
// 4. FaceMeshEngine — MediaPipe Face Mesh
// ============================================================
/**
 * Этот модуль инициализирует MediaPipe Face Mesh и на каждом кадре
 * вычисляет ориентацию головы (Yaw — поворот влево/вправо).
 *
 * ## Как вычисляется поворот головы (Yaw)
 *
 * Face Mesh возвращает 468 ключевых точек лица (landmarks).
 * Для определения горизонтального поворота (Yaw) используются три ключевые точки:
 *
 *   - Landmark #1   — кончик носа
 *   - Landmark #234 — крайняя левая точка лица (левое ухо в координатах Face Mesh)
 *   - Landmark #454 — крайняя правая точка лица (правое ухо в координатах Face Mesh)
 *
 * ### Алгоритм:
 *
 * 1. Берём X-координаты (нормализованные, от 0 до 1) для трёх точек:
 *      noseX  = landmarks[1].x    // Нос
 *      leftX  = landmarks[234].x  // Левый край лица
 *      rightX = landmarks[454].x  // Правый край лица
 *
 * 2. Вычисляем ширину лица:
 *      faceWidth = rightX - leftX
 *
 * 3. Вычисляем, где нос расположен относительно краёв лица:
 *      noseRelative = (noseX - leftX) / faceWidth
 *
 *    Если человек смотрит прямо, noseRelative ≈ 0.5 (нос посередине).
 *    Если поворачивает голову вправо (от себя), нос смещается к левому краю → noseRelative < 0.5.
 *    Если поворачивает голову влево (от себя), нос смещается к правому краю → noseRelative > 0.5.
 *
 * 4. Переводим в условный угол (Yaw):
 *      yaw = (noseRelative - 0.5) * 2
 *
 *    yaw ≈ 0   → смотрит прямо
 *    yaw < -0.3 → голова повёрнута вправо (от пользователя)
 *    yaw > 0.3  → голова повёрнута влево (от пользователя)
 *
 * ВАЖНО: Так как видео зеркально отражено (scaleX(-1)),
 *        отрицательный yaw визуально соответствует повороту «направо» для пользователя,
 *        а положительный — «налево».
 *
 * ### Дополнительно: Pitch (наклон вверх/вниз)
 *
 * Для Pitch (вертикальный наклон) используются:
 *   - Landmark #10  — верхняя часть лба
 *   - Landmark #152 — подбородок
 *   - Landmark #1   — кончик носа
 *
 * Аналогично:
 *   faceHeight  = landmarks[152].y - landmarks[10].y
 *   noseVertical = (landmarks[1].y - landmarks[10].y) / faceHeight
 *
 *   pitch = (noseVertical - 0.5) * 2
 *   pitch < 0 → голова наклонена вверх
 *   pitch > 0 → голова наклонена вниз
 */
const FaceMeshEngine = (() => {
    let faceMesh   = null;
    let camera     = null;
    let onResults  = null;  // Callback для получения результатов
    let isRunning  = false;

    /**
     * Инициализация MediaPipe Face Mesh
     * @param {Function} resultsCallback - вызывается на каждом кадре с данными о лицах
     */
    async function init(resultsCallback) {
        onResults = resultsCallback;

        // Создаём экземпляр FaceMesh
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        // Настройки модели
        faceMesh.setOptions({
            maxNumFaces: 1,              // Отслеживаем только одно лицо
            refineLandmarks: true,       // Уточнённые точки (iris)
            minDetectionConfidence: 0.5, // Минимальная уверенность детекции
            minTrackingConfidence: 0.5   // Минимальная уверенность трекинга
        });

        // Callback для обработки результатов
        faceMesh.onResults(_processResults);
    }

    /**
     * Запуск обработки видеопотока
     */
    function start() {
        if (isRunning) return;
        isRunning = true;

        const video = UIController.els.webcamVideo;

        // Используем MediaPipe Camera Utils для синхронной отправки кадров
        camera = new Camera(video, {
            onFrame: async () => {
                if (faceMesh && isRunning) {
                    await faceMesh.send({ image: video });
                }
            },
            width: 640,
            height: 480
        });
        camera.start();
    }

    /**
     * Остановка обработки
     */
    function stop() {
        isRunning = false;
        if (camera) {
            camera.stop();
            camera = null;
        }
    }

    /**
     * Внутренняя обработка результатов Face Mesh.
     * Вычисляет Yaw и Pitch, рисует сетку на canvas.
     */
    function _processResults(results) {
        const canvas = UIController.els.faceCanvas;
        const ctx    = canvas.getContext('2d');
        const video  = UIController.els.webcamVideo;

        // Устанавливаем размеры canvas равными видеопотоку
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;

        // Очищаем canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            // Лицо не обнаружено
            UIController.els.videoContainer.classList.remove('video-container--face-detected');
            if (onResults) onResults({ detected: false, yaw: 0, pitch: 0 });
            return;
        }

        // Лицо обнаружено — подсветим рамку
        UIController.els.videoContainer.classList.add('video-container--face-detected');

        const landmarks = results.multiFaceLandmarks[0];

        // ---- Отрисовка сетки лица на canvas ----
        // Рисуем тесселяцию (треугольную сетку)
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
            color: 'rgba(0, 212, 170, 0.08)',
            lineWidth: 0.5
        });
        // Рисуем контуры лица
        drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, {
            color: 'rgba(0, 212, 170, 0.35)',
            lineWidth: 1.5
        });
        // Рисуем контуры губ
        drawConnectors(ctx, landmarks, FACEMESH_LIPS, {
            color: 'rgba(0, 212, 170, 0.3)',
            lineWidth: 1
        });
        // Рисуем контуры глаз
        drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, {
            color: 'rgba(0, 180, 255, 0.35)',
            lineWidth: 1
        });
        drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, {
            color: 'rgba(0, 180, 255, 0.35)',
            lineWidth: 1
        });

        // ---- Вычисление Yaw (горизонтальный поворот) ----

        // Ключевые точки: нос (#1), левый край (#234), правый край (#454)
        const noseX  = landmarks[1].x;
        const leftX  = landmarks[234].x;
        const rightX = landmarks[454].x;

        // Ширина лица по X
        const faceWidth = rightX - leftX;

        // Относительная позиция носа (0..1), если ~0.5 — смотрит прямо
        const noseRelativeX = (noseX - leftX) / faceWidth;

        // Yaw: от -1 (голова повёрнута вправо) до +1 (голова повёрнута влево)
        // Учитывая зеркалирование видео, для пользователя всё наоборот:
        //   yaw < 0 → пользователь повернулся НАПРАВО (экранно — налево)
        //   yaw > 0 → пользователь повернулся НАЛЕВО  (экранно — направо)
        const yaw = (noseRelativeX - 0.5) * 2;

        // ---- Вычисление Pitch (вертикальный наклон) ----

        // Ключевые точки: лоб (#10), подбородок (#152), нос (#1)
        const topY    = landmarks[10].y;
        const bottomY = landmarks[152].y;
        const noseY   = landmarks[1].y;

        const faceHeight    = bottomY - topY;
        const noseRelativeY = (noseY - topY) / faceHeight;

        // Pitch: < 0 — голова наклонена вверх, > 0 — вниз
        const pitch = (noseRelativeY - 0.45) * 2;

        // Передаём результаты в callback
        if (onResults) {
            onResults({
                detected: true,
                yaw:   yaw,
                pitch: pitch,
                landmarks: landmarks
            });
        }
    }

    return { init, start, stop };
})();


// ============================================================
// 5. LivenessChecker — Стейт-машина Liveness-проверки
// ============================================================
/**
 * Реализует challenge-response протокол:
 *
 * Состояния:
 *   IDLE            — ожидание начала
 *   LOOK_STRAIGHT   — пользователь должен смотреть прямо
 *   TURN_RIGHT      — пользователь должен повернуть голову направо
 *   TURN_LEFT       — пользователь должен повернуть голову налево
 *   COMPLETED       — все проверки пройдены
 *   FAILED          — таймаут или ошибка
 *
 * Каждая проверка требует удержания позы в течение HOLD_FRAMES кадров подряд,
 * чтобы исключить случайное срабатывание.
 */
const LivenessChecker = (() => {
    // Состояния стейт-машины
    const STATE = {
        IDLE:           'IDLE',
        LOOK_STRAIGHT:  'LOOK_STRAIGHT',
        TURN_RIGHT:     'TURN_RIGHT',
        TURN_LEFT:      'TURN_LEFT',
        COMPLETED:      'COMPLETED',
        FAILED:         'FAILED'
    };

    // --- Пороговые значения ---
    const YAW_STRAIGHT_THRESHOLD = 0.12;  // |yaw| < 0.12 → смотрит прямо
    const YAW_TURN_THRESHOLD     = 0.28;  // |yaw| > 0.28 → голова повёрнута
    const HOLD_FRAMES            = 15;    // Нужно удержать позу N кадров подряд
    const TIMEOUT_MS             = 30000; // Таймаут на всю проверку (30 секунд)

    let currentState   = STATE.IDLE;
    let holdCounter    = 0;     // Счётчик удержания текущей позы
    let timeoutId      = null;
    let onComplete     = null;  // Callback при завершении (success/fail)

    /**
     * Начать Liveness-проверку
     * @param {Function} callback - вызывается при завершении: callback(success: boolean)
     */
    function start(callback) {
        onComplete   = callback;
        holdCounter  = 0;
        _transition(STATE.LOOK_STRAIGHT);

        // Установить таймаут
        timeoutId = setTimeout(() => {
            if (currentState !== STATE.COMPLETED) {
                _transition(STATE.FAILED);
            }
        }, TIMEOUT_MS);
    }

    /**
     * Остановить проверку
     */
    function stop() {
        currentState = STATE.IDLE;
        holdCounter  = 0;
        if (timeoutId) clearTimeout(timeoutId);
    }

    /**
     * Обработать данные от FaceMesh для текущего кадра.
     * Вызывается на каждый кадр из FaceMeshEngine.
     */
    function processFaceData(data) {
        if (currentState === STATE.IDLE || currentState === STATE.COMPLETED || currentState === STATE.FAILED) {
            return;
        }

        // Если лицо не обнаружено — сбросить счётчик
        if (!data.detected) {
            holdCounter = 0;
            UIController.setInstruction('⚠ Лицо не обнаружено. Расположите лицо в рамке.', 'warning');
            return;
        }

        const { yaw } = data;

        switch (currentState) {

            case STATE.LOOK_STRAIGHT:
                // Проверяем, что |yaw| достаточно мал (смотрит прямо)
                if (Math.abs(yaw) < YAW_STRAIGHT_THRESHOLD) {
                    holdCounter++;
                    _updateProgress();
                    if (holdCounter >= HOLD_FRAMES) {
                        holdCounter = 0;
                        _transition(STATE.TURN_RIGHT);
                    }
                } else {
                    holdCounter = 0;
                }
                break;

            case STATE.TURN_RIGHT:
                // Видео зеркалировано: поворот направо (для пользователя) → yaw < 0
                if (yaw < -YAW_TURN_THRESHOLD) {
                    holdCounter++;
                    _updateProgress();
                    if (holdCounter >= HOLD_FRAMES) {
                        holdCounter = 0;
                        _transition(STATE.TURN_LEFT);
                    }
                } else {
                    holdCounter = 0;
                }
                break;

            case STATE.TURN_LEFT:
                // Видео зеркалировано: поворот налево (для пользователя) → yaw > 0
                if (yaw > YAW_TURN_THRESHOLD) {
                    holdCounter++;
                    _updateProgress();
                    if (holdCounter >= HOLD_FRAMES) {
                        holdCounter = 0;
                        _transition(STATE.COMPLETED);
                    }
                } else {
                    holdCounter = 0;
                }
                break;
        }
    }

    /**
     * Переход между состояниями стейт-машины
     */
    function _transition(newState) {
        currentState = newState;
        holdCounter  = 0;

        switch (newState) {
            case STATE.LOOK_STRAIGHT:
                UIController.setInstruction('👤 Смотрите прямо в камеру и не двигайтесь');
                UIController.setProgress(0);
                break;

            case STATE.TURN_RIGHT:
                UIController.setInstruction('➡️ Поверните голову направо (вправо)', 'warning');
                UIController.setProgress(33);
                UIController.notify('Шаг 1 пройден', 'Отлично! Теперь поверните голову направо.', 'success');
                break;

            case STATE.TURN_LEFT:
                UIController.setInstruction('⬅️ Поверните голову налево (влево)', 'warning');
                UIController.setProgress(66);
                UIController.notify('Шаг 2 пройден', 'Хорошо! Теперь поверните голову налево.', 'success');
                break;

            case STATE.COMPLETED:
                UIController.setInstruction('✅ Liveness-проверка пройдена успешно!', 'success');
                UIController.setProgress(100);
                if (timeoutId) clearTimeout(timeoutId);
                UIController.notify('Верификация лица', 'Liveness-проверка успешно пройдена. Отправка данных...', 'success');
                if (onComplete) onComplete(true);
                break;

            case STATE.FAILED:
                UIController.setInstruction('❌ Время истекло. Попробуйте снова.', 'warning');
                UIController.setProgress(0);
                if (timeoutId) clearTimeout(timeoutId);
                UIController.notify('Таймаут', 'Вы не прошли проверку вовремя. Попробуйте ещё раз.', 'error');
                if (onComplete) onComplete(false);
                break;
        }
    }

    /**
     * Обновить прогресс-бар с учётом текущего шага и holdCounter
     */
    function _updateProgress() {
        let base = 0;
        if (currentState === STATE.LOOK_STRAIGHT) base = 0;
        if (currentState === STATE.TURN_RIGHT)    base = 33;
        if (currentState === STATE.TURN_LEFT)     base = 66;

        const stepProgress = (holdCounter / HOLD_FRAMES) * 33;
        UIController.setProgress(Math.min(base + stepProgress, 100));
    }

    /** Текущее состояние */
    function getState() {
        return currentState;
    }

    return { start, stop, processFaceData, getState, STATE };
})();


// ============================================================
// 6. APIClient — Заглушка взаимодействия с бэкендом (FastAPI)
// ============================================================
/**
 * Этот модуль содержит функции для отправки данных на бэкенд.
 * Сейчас реализованы как заглушки с имитацией задержки.
 * Для подключения к реальному серверу — замените BASE_URL и уберите setTimeout.
 */
const APIClient = (() => {
    // Базовый URL вашего FastAPI-сервера
    const BASE_URL = 'http://localhost:8000';

    /**
     * Отправка данных для верификации (Вход)
     *
     * @param {Object} payload
     * @param {string}   payload.login      — логин пользователя
     * @param {string}   payload.password   — пароль
     * @param {string}   payload.otp        — 6-значный OTP-код
     * @param {string}   payload.face_image — Base64-строка изображения лица
     * @returns {Promise<Object>} — ответ сервера
     */
    async function verify(payload) {
        console.log('[APIClient] Отправка данных на /api/verify:', {
            login: payload.login,
            otp:   payload.otp,
            face_image_length: payload.face_image?.length || 0
        });

        // ====================================================
        // ЗАГЛУШКА: имитация серверного ответа
        // Замените этот блок на реальный fetch() ниже
        // ====================================================
        return new Promise((resolve) => {
            setTimeout(() => {
                // Имитация успешного ответа
                resolve({
                    status:  200,
                    data: {
                        success:    true,
                        message:    'Верификация пройдена успешно',
                        user:       payload.login,
                        confidence: 0.97,
                        timestamp:  new Date().toISOString()
                    }
                });
            }, 1500);
        });

        // ====================================================
        // РЕАЛЬНЫЙ ЗАПРОС (раскомментируйте при подключении FastAPI):
        // ====================================================
        /*
        try {
            const response = await fetch(`${BASE_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login:      payload.login,
                    password:   payload.password,
                    otp:        payload.otp,
                    face_image: payload.face_image
                })
            });

            const data = await response.json();
            return { status: response.status, data };
        } catch (err) {
            console.error('[APIClient] Ошибка сети:', err);
            return { status: 0, data: { success: false, message: 'Ошибка сети' } };
        }
        */
    }

    /**
     * Отправка данных для регистрации
     *
     * @param {Object} payload — аналогичная структура
     * @returns {Promise<Object>}
     */
    async function register(payload) {
        console.log('[APIClient] Отправка данных на /api/register:', {
            login: payload.login,
            otp:   payload.otp,
            face_image_length: payload.face_image?.length || 0
        });

        // ЗАГЛУШКА
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: 200,
                    data: {
                        success:   true,
                        message:   'Регистрация прошла успешно',
                        user:      payload.login,
                        timestamp: new Date().toISOString()
                    }
                });
            }, 1500);
        });

        // РЕАЛЬНЫЙ ЗАПРОС:
        /*
        try {
            const response = await fetch(`${BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login:      payload.login,
                    password:   payload.password,
                    otp:        payload.otp,
                    face_image: payload.face_image
                })
            });

            const data = await response.json();
            return { status: response.status, data };
        } catch (err) {
            console.error('[APIClient] Ошибка сети:', err);
            return { status: 0, data: { success: false, message: 'Ошибка сети' } };
        }
        */
    }

    return { verify, register };
})();


// ============================================================
// 7. DashboardManager — Логи безопасности и статистика
// ============================================================
const DashboardManager = (() => {
    const logs = [];
    const stats = { total: 0, success: 0, failed: 0, spoofing: 0 };

    const userAgents = [
        'Chrome 120 / Windows 11',
        'Firefox 121 / Ubuntu 22',
        'Safari 17 / macOS Sonoma',
        'Edge 120 / Windows 10',
        'Chrome 119 / Android 14',
    ];

    const events = [
        'Аутентификация',
        'Регистрация',
        'Liveness-проверка',
        'OTP-верификация',
        'Повторная попытка',
    ];

    const ips = [
        '192.168.1.100',
        '10.0.0.42',
        '172.16.0.15',
        '192.168.0.200',
        '10.10.10.5',
    ];

    /**
     * Добавить запись в лог
     * @param {string} event
     * @param {string} result — 'success' | 'fail' | 'warning'
     * @param {string} [user]
     */
    function addLog(event, result, user = 'admin') {
        const entry = {
            time:      new Date().toLocaleString('ru-RU'),
            user:      user,
            event:     event,
            ip:        ips[Math.floor(Math.random() * ips.length)],
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            result:    result
        };
        logs.unshift(entry);
        stats.total++;
        if (result === 'success') stats.success++;
        if (result === 'fail')    stats.failed++;
        if (result === 'warning') stats.spoofing++;
    }

    /**
     * Сгенерировать демо-логи для показа на защите
     */
    function generateDemoLogs() {
        if (logs.length > 0) return; // не дублировать

        const demoData = [
            { event: 'Аутентификация',      result: 'success', user: 'ivanov_a' },
            { event: 'Liveness-проверка',    result: 'success', user: 'ivanov_a' },
            { event: 'Аутентификация',       result: 'fail',    user: 'petrov_b' },
            { event: 'Spoofing-атака (фото)',result: 'warning', user: 'unknown' },
            { event: 'OTP-верификация',      result: 'success', user: 'sidorov_c' },
            { event: 'Регистрация',          result: 'success', user: 'kuznetsov_d' },
            { event: 'Повторная попытка',    result: 'fail',    user: 'petrov_b' },
            { event: 'Аутентификация',       result: 'success', user: 'sidorov_c' },
            { event: 'Spoofing-атака (видео)',result:'warning', user: 'unknown' },
            { event: 'Liveness-проверка',    result: 'success', user: 'kuznetsov_d' },
        ];

        demoData.forEach((d) => {
            addLog(d.event, d.result, d.user);
        });
    }

    /**
     * Обновить таблицу и статистику в DOM
     */
    function refresh() {
        // Статистика
        document.getElementById('stat-total').textContent   = stats.total;
        document.getElementById('stat-success').textContent  = stats.success;
        document.getElementById('stat-failed').textContent   = stats.failed;
        document.getElementById('stat-spoofing').textContent = stats.spoofing;

        // Таблица
        const tbody = document.getElementById('logs-tbody');
        tbody.innerHTML = '';

        logs.forEach((log) => {
            const resultBadge = _badgeHTML(log.result);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.time}</td>
                <td>${log.user}</td>
                <td><span class="log-event">${log.event}</span></td>
                <td>${log.ip}</td>
                <td>${log.userAgent}</td>
                <td>${resultBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function _badgeHTML(result) {
        const map = {
            success: { cls: 'log-badge--success', text: '✓ Успех' },
            fail:    { cls: 'log-badge--fail',    text: '✗ Отклонено' },
            warning: { cls: 'log-badge--warning', text: '⚠ Угроза' },
        };
        const b = map[result] || map.fail;
        return `<span class="log-badge ${b.cls}">${b.text}</span>`;
    }

    return { addLog, generateDemoLogs, refresh };
})();


// ============================================================
// 8. App — Точка входа, связывает все модули
// ============================================================
const App = (() => {
    let capturedFaceImage = null;

    /**
     * Инициализация приложения
     */
    async function init() {
        UIController.init();
        OTPHandler.init();

        // Генерируем демо-логи для Dashboard
        DashboardManager.generateDemoLogs();

        // Обработка формы
        UIController.els.authForm.addEventListener('submit', _onFormSubmit);

        console.log('[BioAuth] Приложение инициализировано');
        UIController.notify('Система готова', 'BioAuth v2.0 загружена успешно.', 'info');
    }

    /**
     * Обработка нажатия «Продолжить»
     */
    async function _onFormSubmit(e) {
        e.preventDefault();

        const login    = UIController.els.inputLogin.value.trim();
        const password = UIController.els.inputPassword.value;
        const otp      = OTPHandler.getCode();

        // Валидация
        if (!login) {
            UIController.notify('Ошибка', 'Введите логин.', 'error');
            return;
        }
        if (!password) {
            UIController.notify('Ошибка', 'Введите пароль.', 'error');
            return;
        }
        if (otp.length !== 6) {
            UIController.notify('Ошибка', 'Введите полный 6-значный OTP-код.', 'error');
            return;
        }

        // Переходим к биометрической верификации
        UIController.setStep('liveness');
        UIController.setBtnLoading(true);

        // Запускаем камеру
        const cameraOk = await CameraManager.start();
        if (!cameraOk) {
            UIController.setBtnLoading(false);
            return;
        }

        // Инициализируем и запускаем FaceMesh
        await FaceMeshEngine.init((faceData) => {
            LivenessChecker.processFaceData(faceData);
        });
        FaceMeshEngine.start();

        // Запускаем Liveness-проверку
        LivenessChecker.start(async (success) => {
            if (success) {
                // Делаем стоп-кадр
                capturedFaceImage = CameraManager.captureSnapshot();

                // Останавливаем FaceMesh и камеру
                FaceMeshEngine.stop();
                CameraManager.stop();

                UIController.setStep('result');

                // Отправляем данные на сервер
                const tab     = UIController.getCurrentTab();
                const apiFunc = tab === 'login' ? APIClient.verify : APIClient.register;

                const response = await apiFunc({
                    login:      login,
                    password:   password,
                    otp:        otp,
                    face_image: capturedFaceImage
                });

                UIController.setBtnLoading(false);

                // Обработка ответа
                if (response.status === 200 && response.data.success) {
                    // Успех
                    UIController.notify('Успех!', response.data.message, 'success');
                    DashboardManager.addLog(tab === 'login' ? 'Аутентификация' : 'Регистрация', 'success', login);
                    DashboardManager.addLog('Liveness-проверка', 'success', login);

                    setTimeout(() => {
                        UIController.showSuccess(login);
                    }, 800);
                } else {
                    // Ошибка
                    const errMsg = response.data?.message || 'Неизвестная ошибка';
                    UIController.notify('Ошибка верификации', errMsg, 'error');
                    DashboardManager.addLog(tab === 'login' ? 'Аутентификация' : 'Регистрация', 'fail', login);
                    _resetToForm();
                }
            } else {
                // Liveness не пройден
                FaceMeshEngine.stop();
                CameraManager.stop();
                UIController.setBtnLoading(false);
                DashboardManager.addLog('Liveness-проверка', 'fail', login);
                _resetToForm();
            }
        });
    }

    /**
     * Сбросить интерфейс к исходному состоянию формы
     */
    function _resetToForm() {
        UIController.setStep('credentials');
        UIController.setProgress(0);
        UIController.setInstruction('Заполните форму слева и нажмите «Продолжить»');
        UIController.deactivateCamera();
    }

    /**
     * Выход из системы
     */
    function logout() {
        capturedFaceImage = null;
        OTPHandler.clear();
        _resetToForm();
        UIController.showAuth();
        UIController.setBtnLoading(false);
        UIController.notify('Выход', 'Вы вышли из системы.', 'info');
    }

    return { init, logout };
})();


// ============================================================
// Запуск приложения после загрузки DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
