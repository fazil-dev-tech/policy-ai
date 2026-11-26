import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

const clearStoredAuth = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
};

const persistSession = (session, userObj) => {
    if (session?.access_token) localStorage.setItem('accessToken', session.access_token);
    if (session?.refresh_token) localStorage.setItem('refreshToken', session.refresh_token);
    if (userObj) localStorage.setItem('user', JSON.stringify(userObj));
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchBackendProfile = async (accessToken) => {
        const { data } = await api.get('/auth/me', {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        return data.user;
    };

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                if (supabase) {
                    const { data } = await supabase.auth.getSession();
                    if (data?.session?.access_token) {
                        persistSession(data.session, null);
                        try {
                            const profile = await fetchBackendProfile(data.session.access_token);
                            if (mounted) {
                                persistSession(data.session, profile);
                                setUser(profile);
                            }
                            return;
                        } catch {
                            clearStoredAuth();
                        }
                    }
                }

                const stored = localStorage.getItem('user');
                const token = localStorage.getItem('accessToken');
                if (stored && token) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (mounted) setUser(parsed);
                    } catch {
                        clearStoredAuth();
                    }
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        const authSub = supabase?.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                clearStoredAuth();
                if (mounted) setUser(null);
            } else if (session?.access_token) {
                persistSession(session, null);
            }
        });

        return () => {
            mounted = false;
            authSub?.data?.subscription?.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        if (supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });
            if (error) {
                const msg = error.message.toLowerCase().includes('email not confirmed')
                    ? 'Please verify your email address before signing in.'
                    : error.message;
                const err = new Error(msg);
                err.response = { data: { error: msg } };
                throw err;
            }
            persistSession(data.session, null);
            const profile = await fetchBackendProfile(data.session.access_token);
            persistSession(data.session, profile);
            setUser(profile);
            return { user: profile, accessToken: data.session.access_token };
        }

        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return data;
    };

    const register = async (name, email, password) => {
        if (supabase) {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: { data: { name: name.trim() } },
            });
            if (error) {
                const err = new Error(error.message);
                err.response = { data: { error: error.message } };
                throw err;
            }
            if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
                const err = new Error('Email already registered');
                err.response = { data: { error: 'Email already registered' } };
                throw err;
            }
            if (data.session) {
                persistSession(data.session, null);
                const profile = await fetchBackendProfile(data.session.access_token);
                persistSession(data.session, profile);
                setUser(profile);
                return { requiresVerification: false, user: profile };
            }
            return { requiresVerification: true, user: data.user };
        }

        const { data } = await api.post('/auth/register', { name, email, password });
        if (data.accessToken) {
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
        }
        return data;
    };

    const logout = async () => {
        if (supabase) {
            await supabase.auth.signOut().catch(() => {});
        }
        clearStoredAuth();
        setUser(null);
    };

    const sendOtp = async (email) => {
        if (supabase) {
            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim().toLowerCase(),
                options: { shouldCreateUser: true },
            });
            if (error) {
                const err = new Error(error.message);
                err.response = { data: { error: error.message } };
                throw err;
            }
            return { message: 'Verification code sent to your email' };
        }

        const { data } = await api.post('/auth/send-otp', { email });
        return data;
    };

    const verifyOtp = async (email, otp, type = 'email') => {
        if (supabase) {
            const { data, error } = await supabase.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: otp.trim(),
                type,
            });
            if (error || !data?.session) {
                const msg = error?.message || 'Invalid or expired OTP';
                const err = new Error(msg);
                err.response = { data: { error: msg } };
                throw err;
            }
            persistSession(data.session, null);
            const profile = await fetchBackendProfile(data.session.access_token);
            persistSession(data.session, profile);
            setUser(profile);
            return { user: profile, accessToken: data.session.access_token };
        }

        const { data } = await api.post('/auth/verify-otp', { email, otp, type });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return data;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, sendOtp, verifyOtp }}>
            {children}
        </AuthContext.Provider>
    );
};
