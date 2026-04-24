let currentStream = null;

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
}

export function isCameraActive() {
    return currentStream !== null && currentStream.active;
}
