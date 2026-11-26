const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const logger = require('../utils/logger');

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const createAuthClient = () =>
    createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

const checkSupabaseHealth = async () => {
    const start = Date.now();
    try {
        const { error } = await supabaseAdmin
            .from('market_data')
            .select('id', { count: 'exact', head: true });

        if (error) {
            logger.warn('Supabase health check query error:', error.message);
            return { status: 'disconnected', latencyMs: Date.now() - start, error: error.message };
        }

        return { status: 'connected', latencyMs: Date.now() - start };
    } catch (error) {
        logger.error('Supabase health check exception:', error.message);
        return { status: 'disconnected', latencyMs: Date.now() - start, error: error.message };
    }
};

module.exports = {
    supabaseAdmin,
    createAuthClient,
    checkSupabaseHealth,
};
