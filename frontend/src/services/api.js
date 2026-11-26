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

/**
 * Uploads large files via Supabase Signed URL when running on Vercel (>4 MB)
 * so the 4.5 MB Serverless payload cap never blocks multi-file PDF/photo uploads.
 */
export const uploadDirectToSignedStorage = async (file, folder = 'incidents') => {
    const { data } = await api.post('/storage/signed-upload', {
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        folder,
    });
    const putResp = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
    });
    if (!putResp.ok) {
        throw new Error(`Direct storage upload failed (${putResp.status})`);
    }
    return {
        storagePath: data.storagePath,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
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

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest?._retry) {
            originalRequest._retry = true;

            try {
                let newAccessToken = null;

                if (supabase) {
                    const { data, error: refreshErr } = await supabase.auth.refreshSession();
                    if (!refreshErr && data?.session?.access_token) {
                        newAccessToken = data.session.access_token;
                        localStorage.setItem('accessToken', newAccessToken);
                        if (data.session.refresh_token) {
                            localStorage.setItem('refreshToken', data.session.refresh_token);
                        }
                    }
                }

                if (!newAccessToken) {
                    const refreshToken = localStorage.getItem('refreshToken');
                    if (!refreshToken) throw new Error('No refresh token');
                    const baseURL = import.meta.env.VITE_API_URL || '/api';
                    const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
                    newAccessToken = data.accessToken;
                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);
                }

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
