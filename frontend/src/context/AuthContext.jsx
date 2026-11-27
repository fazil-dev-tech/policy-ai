import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
    const explicitAuthRef = useRef(false);

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
                            await supabase.auth.signOut().catch(() => {});
                            clearStoredAuth();
                        }
                    }
                }

                const stored = localStorage.getItem('user');
                const token = localStorage.getItem('accessToken');
                if (stored && token) {
                    try {
                        const profile = await fetchBackendProfile(token);
                        if (mounted) {
                            localStorage.setItem('user', JSON.stringify(profile));
                            setUser(profile);
                        }
                    } catch {
                        clearStoredAuth();
                    }
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        const inFlightProfileRef = { active: false };
        const authSub = supabase?.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                clearStoredAuth();
                if (mounted) setUser(null);
            } else if (session?.access_token) {
                persistSession(session, null);
                if (
                    event === 'SIGNED_IN' &&
                    !explicitAuthRef.current &&
                    !localStorage.getItem('user') &&
                    !inFlightProfileRef.active
                ) {
                    inFlightProfileRef.active = true;
                    try {
                        const profile = await fetchBackendProfile(session.access_token);
                        if (mounted) {
                            persistSession(session, profile);
                            setUser(profile);
                        }
                    } catch {
                        // Explicit login/verifyOtp handles surfaced errors directly
                    } finally {
                        inFlightProfileRef.active = false;
                    }
                }
            }
        });

        return () => {
            mounted = false;
            authSub?.data?.subscription?.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        if (supabase) {
            explicitAuthRef.current = true;
            try {
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
            } finally {
                explicitAuthRef.current = false;
            }
        }

        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return data;
    };

    const register = async (name, email, password) => {
        explicitAuthRef.current = true;
        try {
            const { data } = await api.post('/auth/register', {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
            });
            if (data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('user', JSON.stringify(data.user));
                if (supabase && data.refreshToken) {
                    await supabase.auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken }).catch(() => {});
                }
                setUser(data.user);
            }
            return data;
        } finally {
            explicitAuthRef.current = false;
        }
    };

    const logout = async () => {
        if (supabase) {
            await supabase.auth.signOut().catch(() => {});
        }
        clearStoredAuth();
        setUser(null);
    };

    const sendOtp = async (email) => {
        const { data } = await api.post('/auth/send-otp', {
            email: email.trim().toLowerCase(),
            type: 'email',
        });
        return data;
    };

    const resendSignupOtp = async (email) => {
        const { data } = await api.post('/auth/send-otp', {
            email: email.trim().toLowerCase(),
            type: 'signup',
        });
        return data;
    };

    const verifyOtp = async (email, otp, type = 'email') => {
        explicitAuthRef.current = true;
        try {
            const { data } = await api.post('/auth/verify-otp', {
                email: email.trim().toLowerCase(),
                otp: otp.trim(),
                type,
            });
            if (data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('user', JSON.stringify(data.user));
                if (supabase && data.refreshToken) {
                    await supabase.auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken }).catch(() => {});
                }
                setUser(data.user);
            }
            return data;
        } finally {
            explicitAuthRef.current = false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, sendOtp, resendSignupOtp, verifyOtp }}>
            {children}
        </AuthContext.Provider>
    );
};
