const { supabaseAdmin } = require('../config/supabase');
const { mapProfile } = require('../utils/mappers');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !authData?.user) {
            const msg = authError?.message || '';
            if (msg.toLowerCase().includes('expired')) {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const authUser = authData.user;

        let { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

        if (profileError) {
            logger.error('Profile lookup failed:', profileError.message);
            return res.status(500).json({ error: 'Failed to load user profile' });
        }

        if (!profile) {
            const fallbackName =
                authUser.user_metadata?.name ||
                (authUser.email ? authUser.email.split('@')[0] : 'User');

            const { data: createdProfile, error: upsertError } = await supabaseAdmin
                .from('profiles')
                .upsert(
                    {
                        id: authUser.id,
                        name: fallbackName,
                        email: (authUser.email || '').toLowerCase(),
                        role: 'user',
                    },
                    { onConflict: 'id' }
                )
                .select()
                .single();

            if (upsertError) {
                logger.error('Profile auto-create failed:', upsertError.message);
                return res.status(500).json({ error: 'Failed to initialize user profile' });
            }
            profile = createdProfile;
        }

        req.user = mapProfile(profile);
        req.accessToken = token;
        next();
    } catch (error) {
        logger.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
