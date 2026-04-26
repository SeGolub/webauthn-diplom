/**
 * camera.js — Модуль управления камерой с анимированным сканером
 *
 * Предоставляет:
 *   - initCamera(videoElement)   — запуск камеры
 *   - captureFrame(videoElement) — захват кадра + запуск scan-анимации
 *   - stopCamera()              — остановка камеры
 *   - isCameraActive()          — проверка статуса
 *   - createScannerOverlay(container) — создание UI-оверлея сканера
 *   - activateScanAnimation()   — включить сканирующую линию
 *   - deactivateScanAnimation() — выключить сканирующую линию
 */

let currentStream = null;
let scannerOverlay = null;

export async function initCamera(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',     // Фронтальная камера
                width: { ideal: 640 },
                height: { ideal: 480 },
            },
            audio: false, // Микрофон не нужен
        });

        currentStream = stream;
        videoElement.srcObject = stream;

        await videoElement.play();

        // Создаём overlay-сканер поверх контейнера видео, если ещё не создан
        const container = videoElement.closest('.camera-container');
        if (container) {
            createScannerOverlay(container);
        }

        return stream;
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            throw new Error(
                'Доступ к камере запрещён. Разрешите доступ в настройках браузера.'
            );
        }
        if (error.name === 'NotFoundError') {
            throw new Error(
                'Камера не обнаружена. Подключите веб-камеру и попробуйте снова.'
            );
        }
        throw new Error(`Ошибка инициализации камеры: ${error.message}`);
    }
}

export function captureFrame(videoElement) {
    if (!videoElement.srcObject) {
        throw new Error('Камера не инициализирована. Сначала вызовите initCamera().');
    }

    // Запускаем анимацию сканирования при захвате кадра
    activateScanAnimation();

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;

    const ctx = canvas.getContext('2d');

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.9);
}

export function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    // Убираем overlay при остановке камеры
    deactivateScanAnimation();
}

export function isCameraActive() {
    return currentStream !== null && currentStream.active;
}

// ---------------------------------------------------------------------------
// Scanner Overlay — анимированная рамка и сканирующая линия поверх видео
// ---------------------------------------------------------------------------

/**
 * Создаёт DOM-элемент сканера поверх контейнера камеры.
 * Включает: 4 угловых маркера + горизонтальную сканирующую линию.
 */
export function createScannerOverlay(container) {
    // Не создавать повторно
    if (container.querySelector('.scanner-overlay')) {
        scannerOverlay = container.querySelector('.scanner-overlay');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = `
        <div class="scanner-corners">
            <span class="scanner-corner scanner-corner--tl"></span>
            <span class="scanner-corner scanner-corner--tr"></span>
            <span class="scanner-corner scanner-corner--bl"></span>
            <span class="scanner-corner scanner-corner--br"></span>
        </div>
        <div class="scanner-line"></div>
    `;

    container.appendChild(overlay);
    scannerOverlay = overlay;
}

/**
 * Запускает анимацию сканирующей линии.
 * Вызывается автоматически при captureFrame().
 */
export function activateScanAnimation() {
    if (scannerOverlay) {
        scannerOverlay.classList.add('scanner-overlay--active');
    }
}

/**
 * Останавливает анимацию сканирующей линии.
 */
export function deactivateScanAnimation() {
    if (scannerOverlay) {
        scannerOverlay.classList.remove('scanner-overlay--active');
    }
}
