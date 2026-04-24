
import { init, getPageType } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    const page = getPageType();

    if (!token && page !== 'login') {
        window.location.replace('login.html');
        return;
    }
    if (token && page === 'login') {
        window.location.replace('index.html');
        return;
    }

    init();
});
