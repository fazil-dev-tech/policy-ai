const { supabaseAdmin, createAuthClient } = require('../config/supabase');
const { mapProfile } = require('../utils/mappers');
const logger = require('../utils/logger');

const ensureProfile = async (authUser, fallbackName) => {
    const email = (authUser.email || '').toLowerCase();
    const name =
        authUser.user_metadata?.name ||
        fallbackName ||
        (email ? email.split('@')[0] : 'User');

    const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: authUser.id, name, email, role: 'user' }, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        const e = new Error(`Failed to initialize user profile: ${error.message}`);
        if (error.code === '23505') e.statusCode = 409;
        throw e;
    }
    return created;
};

const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = email.trim().toLowerCase();
        const authClient = createAuthClient();

        const { data, error } = await authClient.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
                data: { name: name.trim() },
            },
        });

        if (error) {
            const status = error.message.toLowerCase().includes('already') ? 409 : 400;
            return res.status(status).json({ error: error.message });
        }

        if (!data.user) {
            return res.status(400).json({ error: 'Unable to create account' });
        }

        // Supabase returns empty identities when email already exists in confirmed state
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const profile = await ensureProfile(data.user, name.trim());

        logger.info(`User registered: ${normalizedEmail}`);

        res.status(201).json({
            message: data.session
                ? 'Registration successful'
                : 'Account created! Enter the 6-digit verification code sent to your email.',
            requiresVerification: !data.session,
            user: mapProfile(profile),
            accessToken: data.session?.access_token || null,
            refreshToken: data.session?.refresh_token || null,
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.trim().toLowerCase();
        const authClient = createAuthClient();

        const { data, error } = await authClient.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        });

        if (error) {
            if (error.message.toLowerCase().includes('email not confirmed')) {
                return res.status(403).json({
                    error: 'Please verify your email address before signing in.',
                    code: 'EMAIL_NOT_CONFIRMED',
                });
            }
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const profile = await ensureProfile(data.user);
        await supabaseAdmin
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id);

        logger.info(`User logged in: ${normalizedEmail}`);

        res.json({
            message: 'Login successful',
            user: mapProfile(profile),
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
        });
    } catch (error) {
        next(error);
    }
};

const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const authClient = createAuthClient();
        const { data, error } = await authClient.auth.refreshSession({
            refresh_token: refreshToken,
        });

        if (error || !data?.session) {
            return res.status(401).json({ error: 'Refresh token expired. Please login again.' });
        }

        res.json({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
        });
    } catch (error) {
        next(error);
    }
};

const sendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const normalizedEmail = email.trim().toLowerCase();
        const authClient = createAuthClient();

        const { error } = await authClient.auth.signInWithOtp({
            email: normalizedEmail,
            options: { shouldCreateUser: Boolean(req.body.createIfMissing) },
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        logger.info(`OTP email requested via Supabase Auth for ${normalizedEmail}`);
        res.json({ message: 'Verification code sent to your email' });
    } catch (error) {
        next(error);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp, type } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpType = type === 'signup' ? 'signup' : 'email';
        const authClient = createAuthClient();

        const { data, error } = await authClient.auth.verifyOtp({
            email: normalizedEmail,
            token: otp.trim(),
            type: otpType,
        });

        if (error || !data?.session || !data?.user) {
            return res.status(401).json({ error: error?.message || 'Invalid or expired OTP' });
        }

        const profile = await ensureProfile(data.user);
        await supabaseAdmin
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id);

        logger.info(`User verified OTP (${otpType}): ${normalizedEmail}`);

        res.json({
            message: 'Login successful',
            user: mapProfile(profile),
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
        });
    } catch (error) {
        next(error);
    }
};

const getMe = async (req, res) => {
    res.json({ user: req.user });
};

module.exports = { register, login, refresh, getMe, sendOtp, verifyOtp };
