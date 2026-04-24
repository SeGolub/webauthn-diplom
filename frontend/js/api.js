
const BASE_URL = 'http://localhost:8000';

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

async function _authFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        _handleUnauthorized();
        throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
    }
    return response;
}

export async function register(email, password) {
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
        throw new Error(_extractErrorMessage(errBody, 'Ошибка при регистрации.'));
    }

    return await response.json();
}

export async function loginStep1(email, password) {
    const response = await fetch(`${BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(_extractErrorMessage(errBody, 'Неверный логин или пароль.'));
    }
    return await response.json();
}

export async function enrollFace(accessToken, imageBase64) {
    const response = await _authFetch(`${BASE_URL}/auth/face/enroll`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ image_base64: imageBase64 })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(_extractErrorMessage(errBody, 'Ошибка регистрации лица.'));
    }
    return await response.json();
}

export async function verifyFace(email, imageBase64) {
    const response = await fetch(`${BASE_URL}/auth/face/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, image_base64: imageBase64 })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(_extractErrorMessage(errBody, 'Лицо не распознано.'));
    }
    return await response.json();
}

export async function verifyOTP(email, otpCode) {
    const response = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(_extractErrorMessage(errBody, 'Неверный или просроченный OTP-код.'));
    }
    return await response.json();
}

export async function getProfile(accessToken) {
    const response = await _authFetch(`${BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Ошибка получения профиля');
    return await response.json();
}

export async function getFaceStatus(accessToken) {
    const response = await _authFetch(`${BASE_URL}/users/me/face-status`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Ошибка получения статуса лица');
    return await response.json();
}

export async function generateBackupCodes(accessToken) {
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

export async function loginWithBackupCode(email, code) {
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

export async function getAdminUsers(accessToken) {
    const response = await _authFetch(`${BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Ошибка получения пользователей');
    return await response.json();
}

export async function getAdminAuditLogs(accessToken) {
    const response = await _authFetch(`${BASE_URL}/admin/audit-logs`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Ошибка получения логов аудита');
    return await response.json();
}

export async function lockUser(accessToken, userId, isLocked) {
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
        throw new Error(_extractErrorMessage(errBody, 'Ошибка изменения статуса'));
    }
    return await response.json();
}

export async function resetUserFace(accessToken, userId) {
    const response = await _authFetch(`${BASE_URL}/admin/users/${userId}/reset-face`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(_extractErrorMessage(errBody, 'Ошибка сброса биометрии'));
    }
    return await response.json();
}
