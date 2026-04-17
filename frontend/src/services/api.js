import axios from 'axios';

// In development: VITE_API_URL=http://localhost:5000/api (via .env)
// In production:  VITE_API_URL=https://your-backend-render-url.onrender.com/api
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 60000,  // 60s timeout for AI analysis uploads
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - attach JWT
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) throw new Error('No refresh token');

                const baseURL = import.meta.env.VITE_API_URL || '/api';
                const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);

                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
