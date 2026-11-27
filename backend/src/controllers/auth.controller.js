const env = require('../config/env');
const { supabaseAdmin, createAuthClient } = require('../config/supabase');
const emailService = require('../services/email.service');
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
        const trimmedName = name.trim();
        const smtpReady = Boolean(env.SMTP_USER && env.SMTP_PASS);

        if (smtpReady && typeof supabaseAdmin.auth?.admin?.generateLink === 'function') {
            const { data, error } = await supabaseAdmin.auth.admin.generateLink({
                type: 'signup',
                email: normalizedEmail,
                password,
                options: {
                    data: { name: trimmedName },
                },
            });

            if (error) {
                const status = error.message.toLowerCase().includes('already') ? 409 : 400;
                return res.status(status).json({ error: error.message });
            }

            if (!data?.user) {
                return res.status(400).json({ error: 'Unable to create account' });
            }

            if (data.user.email_confirmed_at) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            const otp = data.properties?.email_otp;
            if (otp) {
                try {
                    await emailService.sendOtpEmail(normalizedEmail, otp, {
                        mode: 'signup',
                        userName: trimmedName,
                    });
                } catch (smtpErr) {
                    logger.warn(`Branded SMTP signup email failed for ${normalizedEmail}, falling back to Supabase resend: ${smtpErr.message}`);
                    await createAuthClient().auth.resend({ type: 'signup', email: normalizedEmail }).catch(() => {});
                }
                const profile = await ensureProfile(data.user, trimmedName);
                logger.info(`User registered (OTP verification sent): ${normalizedEmail}`);
                return res.status(201).json({
                    message: 'Account created! Enter the 6-digit verification code sent to your email.',
                    requiresVerification: true,
                    otpType: 'signup',
                    user: mapProfile(profile),
                    accessToken: null,
                    refreshToken: null,
                });
            }
        }

        const authClient = createAuthClient();
        const { data, error } = await authClient.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
                data: { name: trimmedName },
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

        const profile = await ensureProfile(data.user, trimmedName);

        logger.info(`User registered: ${normalizedEmail}`);

        res.status(201).json({
            message: data.session
                ? 'Registration successful'
                : 'Account created! Enter the 6-digit verification code sent to your email.',
            requiresVerification: !data.session,
            otpType: 'signup',
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
        const { email, type = 'email', createIfMissing = false } = req.body || {};
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const normalizedEmail = email.trim().toLowerCase();
        const smtpReady = Boolean(env.SMTP_USER && env.SMTP_PASS);

        if (smtpReady && typeof supabaseAdmin.auth?.admin?.generateLink === 'function') {
            const { data: existingProf } = await supabaseAdmin
                .from('profiles')
                .select('id, name')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (!existingProf && !createIfMissing && type !== 'signup') {
                return res.status(404).json({ error: 'No account found for this email. Please create an account first.' });
            }

            const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: normalizedEmail,
            });
            if (linkErr) {
                return res.status(400).json({ error: linkErr.message });
            }

            const otp = linkData?.properties?.email_otp;
            if (otp) {
                try {
                    await emailService.sendOtpEmail(normalizedEmail, otp, {
                        mode: type === 'signup' ? 'signup' : 'login',
                        userName: existingProf?.name || linkData.user?.user_metadata?.name || '',
                    });
                    logger.info(`Branded OTP email sent via SMTP for ${normalizedEmail}`);
                    return res.json({ message: 'Verification code sent to your email', otpType: 'email' });
                } catch (smtpErr) {
                    logger.warn(`Branded SMTP OTP failed for ${normalizedEmail}, falling back to Supabase Auth: ${smtpErr.message}`);
                }
            }
        }

        const authClient = createAuthClient();
        const { error } = await authClient.auth.signInWithOtp({
            email: normalizedEmail,
            options: { shouldCreateUser: Boolean(createIfMissing) },
        });

        if (error) {
            const raw = error.message || '';
            if (raw.toLowerCase().includes('signups not allowed')) {
                return res.status(404).json({ error: 'No account found for this email. Please create an account first.' });
            }
            return res.status(400).json({ error: raw });
        }

        logger.info(`OTP email requested via Supabase Auth for ${normalizedEmail}`);
        res.json({ message: 'Verification code sent to your email', otpType: 'email' });
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
        const preferredType = type === 'signup' ? 'signup' : type === 'magiclink' ? 'magiclink' : 'email';
        const candidateTypes = Array.from(new Set([preferredType, 'email', 'signup', 'magiclink']));
        const authClient = createAuthClient();

        let data = null;
        let lastError = null;
        for (const t of candidateTypes) {
            const resOtp = await authClient.auth.verifyOtp({
                email: normalizedEmail,
                token: otp.trim(),
                type: t,
            });
            if (!resOtp.error && resOtp.data?.session && resOtp.data?.user) {
                data = resOtp.data;
                break;
            }
            lastError = resOtp.error;
        }

        if (!data?.session || !data?.user) {
            return res.status(401).json({ error: lastError?.message || 'Invalid or expired OTP' });
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
