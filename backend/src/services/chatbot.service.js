const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { getRedisClient } = require('../config/redis');
const geminiService = require('./gemini.service');
const pdfParser = require('./pdfParser.service');
const { mapChatMessage } = require('../utils/mappers');
const logger = require('../utils/logger');

const CACHE_TTL_SEC = 3600;
const MAX_HISTORY_LENGTH = 20;
const memoryCache = new Map();

const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') return '';

    const injectionPatterns = [
        /ignore (all |previous |above )?instructions/gi,
        /you are now/gi,
        /system ?override/gi,
        /forget (all |previous |your )?instructions/gi,
        /new ?instructions/gi,
        /act as (if )?/gi,
        /pretend (you are|to be)/gi,
        /\[system\]/gi,
        /\[admin\]/gi,
    ];

    let sanitized = input;
    for (const pattern of injectionPatterns) {
        sanitized = sanitized.replace(pattern, '[filtered]');
    }

    sanitized = sanitized.substring(0, 5000);
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized.trim();
};

const getSessionId = (userId, sessionId) => {
    return sessionId || `session_${userId}_${crypto.randomBytes(8).toString('hex')}`;
};

const getCachedConversation = async (sessionId) => {
    try {
        const redis = getRedisClient();
        if (redis) {
            const cached = await redis.get(`chat:${sessionId}`);
            if (cached) return JSON.parse(cached);
        }
    } catch (error) {
        logger.warn('Redis cache read failed:', error.message);
    }

    const mem = memoryCache.get(sessionId);
    if (mem && mem.expiresAt > Date.now()) {
        return mem.data;
    }
    memoryCache.delete(sessionId);
    return null;
};

const cacheConversation = async (sessionId, history) => {
    const trimmed = history.slice(-MAX_HISTORY_LENGTH);

    try {
        const redis = getRedisClient();
        if (redis) {
            await redis.setex(`chat:${sessionId}`, CACHE_TTL_SEC, JSON.stringify(trimmed));
        }
    } catch (error) {
        logger.warn('Redis cache write failed:', error.message);
    }

    if (memoryCache.size >= 500) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
    }
    memoryCache.set(sessionId, {
        data: trimmed,
        expiresAt: Date.now() + CACHE_TTL_SEC * 1000,
    });
};

const processMessage = async ({ userId, policyId, message, sessionId }) => {
    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) {
        throw new Error('Invalid message content');
    }

    const currentSessionId = getSessionId(userId, sessionId);

    let policySummary = {};
    if (policyId) {
        const { data: policy } = await supabaseAdmin
            .from('policies')
            .select('ai_summary, policy_number, provider_name, policy_type, coverage_amount')
            .eq('id', policyId)
            .eq('user_id', userId)
            .maybeSingle();

        if (policy) {
            policySummary = {
                ...(policy.ai_summary || {}),
                policyNumber: policy.policy_number,
                providerName: policy.provider_name,
                policyType: policy.policy_type,
                coverageAmount: Number(policy.coverage_amount || 0),
            };
        }
    }

    let conversationHistory = await getCachedConversation(currentSessionId);
    if (!conversationHistory) {
        const { data: dbHistory } = await supabaseAdmin
            .from('chat_history')
            .select('message, ai_response, timestamp')
            .eq('user_id', userId)
            .eq('session_id', currentSessionId)
            .order('timestamp', { ascending: false })
            .limit(MAX_HISTORY_LENGTH);

        conversationHistory = (dbHistory || []).reverse().map((row) => ({
            message: row.message,
            aiResponse: row.ai_response,
        }));
    }

    let matchedClauses = [];
    if (policyId) {
        matchedClauses = await pdfParser.searchPolicyClauses({
            policyId,
            userId,
            query: sanitizedMessage,
            limit: 5,
        });
    }

    let aiResult;
    try {
        aiResult = await geminiService.chatAboutPolicy(sanitizedMessage, policySummary, conversationHistory, matchedClauses);
    } catch (error) {
        logger.error('AI chat service error:', error.message);
        throw new Error('AI chat service is currently unavailable. Please check your AI API configuration.');
    }

    const { data: chatEntry, error: insertError } = await supabaseAdmin
        .from('chat_history')
        .insert({
            user_id: userId,
            policy_id: policyId || null,
            session_id: currentSessionId,
            message: sanitizedMessage,
            ai_response: aiResult.response,
            metadata: {
                model: aiResult.model,
                provider: aiResult.provider,
                tokensUsed: aiResult.tokensUsed || 0,
                responseTimeMs: aiResult.responseTimeMs || 0,
            },
        })
        .select()
        .single();

    if (insertError) {
        throw new Error(`Failed to persist chat message: ${insertError.message}`);
    }

    await cacheConversation(currentSessionId, [
        ...conversationHistory,
        { message: sanitizedMessage, aiResponse: aiResult.response },
    ]);

    return {
        id: chatEntry.id,
        sessionId: currentSessionId,
        message: sanitizedMessage,
        aiResponse: aiResult.response,
        model: aiResult.model,
        provider: aiResult.provider,
        responseTimeMs: aiResult.responseTimeMs,
        timestamp: chatEntry.timestamp,
    };
};

const getHistory = async (userId, sessionId, page = 1, limit = 50) => {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    let query = supabaseAdmin
        .from('chat_history')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

    if (sessionId) {
        query = query.eq('session_id', sessionId);
    }

    const { data, count, error } = await query
        .order('timestamp', { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(`Failed to fetch chat history: ${error.message}`);
    }

    const total = count || 0;
    return {
        messages: (data || []).reverse().map(mapChatMessage),
        total,
        page: safePage,
        pages: Math.ceil(total / safeLimit),
    };
};

const getUserSessions = async (userId) => {
    const { data, error } = await supabaseAdmin
        .from('chat_history')
        .select('session_id, message, timestamp')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(500);

    if (error) {
        throw new Error(`Failed to fetch chat sessions: ${error.message}`);
    }

    const sessionMap = new Map();
    for (const row of data || []) {
        if (!sessionMap.has(row.session_id)) {
            sessionMap.set(row.session_id, {
                sessionId: row.session_id,
                lastMessage: String(row.message || '').substring(0, 100),
                lastTimestamp: row.timestamp,
                messageCount: 1,
            });
        } else {
            sessionMap.get(row.session_id).messageCount += 1;
        }
    }

    return Array.from(sessionMap.values()).slice(0, 20);
};

module.exports = {
    processMessage,
    getHistory,
    getUserSessions,
    sanitizeInput,
};
