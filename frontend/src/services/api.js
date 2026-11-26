import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const resolveAssetUrl = (url) => {
    if (!url) return '#';
    if (/^https?:\/\//i.test(url)) return url;
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
    return `${base}${url}`;
};

const inferMimeFromFile = (file) => {
    const raw = String(file?.type || '').trim().toLowerCase().split(';')[0];
    if (raw === 'image/jpg') return 'image/jpeg';
    if (['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(raw)) return raw;
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    return 'application/pdf';
};

/**
 * Uploads large files via Supabase Signed URL when running on Vercel (>4 MB)
 * so the 4.5 MB Serverless payload cap never blocks multi-file PDF/photo uploads.
 */
export const uploadDirectToSignedStorage = async (file, folder = 'incidents') => {
    const mimeType = inferMimeFromFile(file);
    const { data } = await api.post('/storage/signed-upload', {
        fileName: file.name,
        mimeType,
        folder,
    });
    const putResp = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
    });
    if (!putResp.ok) {
        throw new Error(`Direct storage upload failed (${putResp.status})`);
    }
    return {
        storagePath: data.storagePath,
        fileName: file.name,
        mimeType,
        fileSize: file.size,
    };
};

api.interceptors.request.use(
    async (config) => {
        let token = localStorage.getItem('accessToken');
        if (supabase) {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.access_token) {
                token = data.session.access_token;
                localStorage.setItem('accessToken', token);
                if (data.session.refresh_token) {
                    localStorage.setItem('refreshToken', data.session.refresh_token);
                }
            }
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Single-flight refresh lock prevents parallel Promise.all calls from racing single-use Supabase refresh tokens
let refreshPromise = null;

const refreshAccessTokenSingleFlight = async () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
        if (supabase) {
            const { data, error: refreshErr } = await supabase.auth.refreshSession();
            if (!refreshErr && data?.session?.access_token) {
                localStorage.setItem('accessToken', data.session.access_token);
                if (data.session.refresh_token) {
                    localStorage.setItem('refreshToken', data.session.refresh_token);
                }
                return data.session.access_token;
            }
        }
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const baseURL = import.meta.env.VITE_API_URL || '/api';
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return data.accessToken;
    })().finally(() => {
        refreshPromise = null;
    });
    return refreshPromise;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const reqUrl = String(originalRequest?.url || '');
        const isAuthEndpoint = /\/auth\/(login|register|send-otp|verify-otp|refresh)/i.test(reqUrl);

        if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest?._retry) {
            originalRequest._retry = true;
            try {
                const newAccessToken = await refreshAccessTokenSingleFlight();
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                if (supabase) await supabase.auth.signOut().catch(() => {});
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
