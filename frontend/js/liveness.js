const EAR_THRESHOLD = 0.25;
const BLINK_CONSEC_FRAMES = 2;
const DETECTION_INTERVAL_MS = 100;

let modelsLoaded = false;
let animFrameId = null;
let intervalId = null;
let isRunning = false;

let blinkState = {
    closedFrames: 0,
    wasEyeClosed: false,
};


export async function loadModels() {
    if (modelsLoaded) return;

    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model';

    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        console.log('[LIVENESS] Модели face-api.js загружены');
    } catch (err) {
        console.error('[LIVENESS] Ошибка загрузки моделей:', err);
        throw new Error('Не удалось загрузить модели проверки живости');
    }
}

export function isModelsLoaded() {
    return modelsLoaded;
}

/**
 * Вычисляет Евклидово расстояние между двумя точками.
 */
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 *
 * @param {Array} eye 
 * @returns {number}
 */
function computeEAR(eye) {
    const vertical1 = distance(eye[1], eye[5]);
    const vertical2 = distance(eye[2], eye[4]);

    const horizontal = distance(eye[0], eye[3]);

    if (horizontal === 0) return 0;
    return (vertical1 + vertical2) / (2.0 * horizontal);
}


function getEyePoints(landmarks) {
    const positions = landmarks.positions;

    const leftEye = positions.slice(36, 42);
    const rightEye = positions.slice(42, 48);

    return { leftEye, rightEye };
}



/**
 *
 * @param {HTMLVideoElement} videoElement 
 * @param {Function} onBlinkDetected 
 * @param {Function} onStatusUpdate 
 */
export function startLivenessCheck(videoElement, onBlinkDetected, onStatusUpdate) {
    if (!modelsLoaded) {
        console.error('[LIVENESS] Модели не загружены. Вызовите loadModels() первым.');
        return;
    }

    blinkState = { closedFrames: 0, wasEyeClosed: false };
    isRunning = true;

    if (onStatusUpdate) {
        onStatusUpdate('waiting', 'Для подтверждения личности, пожалуйста, моргните 👁️');
    }

    intervalId = setInterval(async () => {
        if (!isRunning) return;

        try {
            const detection = await faceapi
                .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 224,
                    scoreThreshold: 0.5,
                }))
                .withFaceLandmarks(true); // true = useTiny

            if (!detection) {
                if (onStatusUpdate) {
                    onStatusUpdate('no-face', 'Расположите лицо в кадре 😕');
                }
                blinkState.closedFrames = 0;
                return;
            }

            const { leftEye, rightEye } = getEyePoints(detection.landmarks);

            const leftEAR = computeEAR(leftEye);
            const rightEAR = computeEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2.0;

            if (avgEAR < EAR_THRESHOLD) {
                blinkState.closedFrames++;

                if (blinkState.closedFrames >= BLINK_CONSEC_FRAMES) {
                    blinkState.wasEyeClosed = true;
                }
            } else {
                if (blinkState.wasEyeClosed) {
                    console.log(`[LIVENESS] ✅ Blink detected! EAR: ${avgEAR.toFixed(3)}`);
                    isRunning = false;

                    if (onStatusUpdate) {
                        onStatusUpdate('success', 'Живость подтверждена ✅');
                    }

                    if (onBlinkDetected) {
                        onBlinkDetected();
                    }

                    stopLivenessCheck();
                    return;
                }

                blinkState.closedFrames = 0;
            }

            if (onStatusUpdate && isRunning) {
                onStatusUpdate('tracking', 'Лицо найдено. Пожалуйста, моргните 👁️');
            }

        } catch (err) {
            console.error('[LIVENESS] Ошибка детекции:', err);
        }
    }, DETECTION_INTERVAL_MS);
}

/**
 *
 * @param {HTMLVideoElement} videoElement 
 * @param {Function} onFaceDetected 
 * @param {Function} onStatusUpdate 
 */
export function startFaceDetection(videoElement, onFaceDetected, onStatusUpdate) {
    if (!modelsLoaded) {
        console.error('[LIVENESS] Модели не загружены. Вызовите loadModels() первым.');
        return;
    }

    isRunning = true;
    let focusTimerId = null;

    if (onStatusUpdate) {
        onStatusUpdate('waiting', 'Расположите лицо в кадре для входа 📷');
    }

    intervalId = setInterval(async () => {
        if (!isRunning) return;

        try {
            const detection = await faceapi
                .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 224,
                    scoreThreshold: 0.5,
                }));

            if (!detection) {
                if (focusTimerId) {
                    clearTimeout(focusTimerId);
                    focusTimerId = null;
                    console.log('[LIVENESS/LOGIN] Face lost during focus delay, resetting...');
                }
                if (onStatusUpdate) {
                    onStatusUpdate('no-face', 'Расположите лицо в кадре 😕');
                }
                return;
            }

            if (!focusTimerId) {
                console.log('[LIVENESS/LOGIN] 👁️ Face detected, starting 1500ms focus delay...');
                if (onStatusUpdate) {
                    onStatusUpdate('tracking', 'Фокусировка... Не двигайтесь 📸');
                }

                focusTimerId = setTimeout(() => {
                    if (!isRunning) return;

                    console.log('[LIVENESS/LOGIN] ✅ Focus delay complete, capturing...');
                    isRunning = false;

                    if (onStatusUpdate) {
                        onStatusUpdate('success', 'Лицо обнаружено. Анализ...');
                    }

                    if (onFaceDetected) {
                        onFaceDetected();
                    }

                    stopLivenessCheck();
                }, 1500);
            }
        } catch (err) {
            console.error('[LIVENESS/LOGIN] Ошибка детекции:', err);
        }
    }, DETECTION_INTERVAL_MS);
}

export function stopLivenessCheck() {
    isRunning = false;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}
