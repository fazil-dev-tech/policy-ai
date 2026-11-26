const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { getRedisClient } = require('../config/redis');
const geminiService = require('./gemini.service');
const pdfParser = require('./pdfParser.service');
const searchService = require('./search.service');
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

const cacheKey = (userId, sessionId) => `${userId}:${sessionId}`;

const getCachedConversation = async (userId, sessionId) => {
    const key = cacheKey(userId, sessionId);
    try {
        const redis = getRedisClient();
        if (redis) {
            const cached = await redis.get(`chat:${key}`);
            if (cached) return JSON.parse(cached);
        }
    } catch (error) {
        logger.warn('Redis cache read failed:', error.message);
    }

    const mem = memoryCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
        return mem.data;
    }
    memoryCache.delete(key);
    return null;
};

const cacheConversation = async (userId, sessionId, history) => {
    const key = cacheKey(userId, sessionId);
    const trimmed = history.slice(-MAX_HISTORY_LENGTH);

    try {
        const redis = getRedisClient();
        if (redis) {
            await redis.setex(`chat:${key}`, CACHE_TTL_SEC, JSON.stringify(trimmed));
        }
    } catch (error) {
        logger.warn('Redis cache write failed:', error.message);
    }

    if (memoryCache.size >= 500) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
    }
    memoryCache.set(key, {
        data: trimmed,
        expiresAt: Date.now() + CACHE_TTL_SEC * 1000,
    });
};

const buildOfflinePolicyChatFallback = async ({ userMessage, policySummary = {}, matchedClauses = [] }) => {
    const startTime = Date.now();
    const isPolicyQuestion =
        Boolean(policySummary && Object.keys(policySummary).length > 0) &&
        /\b(my\s+policy|this\s+policy|policy\s*#?|sum\s*insured|cover(?:age)?|insured|member|nominee|ped|pre-?existing|exclusion|waiting|room\s*rent|deductible|co-?pay|helpline|claim|premium|moratorium|page|clause)\b/i.test(
            userMessage
        );

    const parts = [];
    if (isPolicyQuestion && matchedClauses.length > 0) {
        parts.push('Live LLM quota is currently saturated, so here are exact grounded sections directly from your uploaded policy:');
        for (const c of matchedClauses.slice(0, 4)) {
            parts.push(`• **[Page ${c.page_number} · ${c.section_title || 'Clause'}]**\n${String(c.clause_text || '').slice(0, 360)}`);
        }
    }
    if (isPolicyQuestion && policySummary && Object.keys(policySummary).length > 0) {
        const members = Array.isArray(policySummary.structuredTerms?.insuredMembers)
            ? policySummary.structuredTerms.insuredMembers
            : [];
        const declaredPeds = Array.isArray(policySummary.structuredTerms?.declaredPeds)
            ? policySummary.structuredTerms.declaredPeds
            : [];
        parts.push(
            `**Schedule Snapshot — ${policySummary.providerName || 'Policy'} (#${policySummary.policyNumber || 'N/A'})**\n` +
                `• Sum Insured: ₹${Number(policySummary.coverageAmount || 0).toLocaleString('en-IN')}` +
                (policySummary.startDate ? ` · Period: ${String(policySummary.startDate).slice(0, 10)} to ${String(policySummary.endDate || '').slice(0, 10)}` : '') +
                (members.length ? `\n• Insured Members: ${members.map((m) => `${m.name} (${m.relationship || 'Insured'}, Age ${m.age || '?'})`).join(', ')}` : '') +
                (declaredPeds.length ? `\n• Declared PEDs: ${declaredPeds.join(' | ')}` : '')
        );
        if (policySummary.exclusions && matchedClauses.length === 0) {
            parts.push(`**Key Exclusions / Waiting Periods**: ${policySummary.exclusions}`);
        }
    }

    if (parts.length > 0) {
        return {
            response: parts.join('\n\n'),
            tokensUsed: 0,
            responseTimeMs: Date.now() - startTime,
            model: 'offline:policy-clauses',
            provider: 'offline',
        };
    }

    // General-purpose query when LLM key hits upstream quota -> run live Tavily/Serper search fallback
    try {
        const searchRes = await searchService.liveSearch(userMessage, { prefix: 'chat_general', maxResults: 4 });
        const sources = (searchRes.results || []).slice(0, 4);
        if (searchRes.answer || sources.length > 0) {
            const bullets = sources
                .map((r, i) => `- **[${i + 1}] ${r.title}** (${r.url}): ${String(r.snippet || '').slice(0, 220)}`)
                .join('\n');
            const msg = `${searchRes.answer ? `${searchRes.answer}\n\n` : ''}${bullets}`;
            return {
                response: msg,
                tokensUsed: 0,
                responseTimeMs: Date.now() - startTime,
                model: `search:${searchRes.engine || 'web'}`,
                provider: searchRes.engine || 'search',
            };
        }
    } catch {
        // Ignore search errors cleanly
    }

    return {
        response: `Live AI text models have reached the temporary upstream quota for "${userMessage.slice(0, 100)}". Upload or select a policy to query exact [Page X] clauses instantly, or add another NVIDIA_API_KEY / GROQ_API_KEY / GEMINI_API_KEY.`,
        tokensUsed: 0,
        responseTimeMs: Date.now() - startTime,
        model: 'offline:quota-notice',
        provider: 'offline',
    };
};

const processMessage = async ({ userId, policyId, message, sessionId, aiModel }) => {
    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) {
        throw new Error('Invalid message content');
    }

    const currentSessionId = getSessionId(userId, sessionId);

    let policySummary = {};
    if (policyId) {
        const { data: policy } = await supabaseAdmin
            .from('policies')
            .select('ai_summary, cis_summary, structured_terms, start_date, end_date, inception_date, policy_number, provider_name, policy_type, coverage_amount')
            .eq('id', policyId)
            .eq('user_id', userId)
            .maybeSingle();

        if (policy) {
            policySummary = {
                ...(policy.ai_summary || {}),
                cisSummary: policy.cis_summary || {},
                structuredTerms: policy.structured_terms || {},
                startDate: policy.start_date || null,
                endDate: policy.end_date || null,
                inceptionDate: policy.inception_date || null,
                policyNumber: policy.policy_number,
                providerName: policy.provider_name,
                policyType: policy.policy_type,
                coverageAmount: Number(policy.coverage_amount || 0),
            };
        }
    }

    let conversationHistory = await getCachedConversation(userId, currentSessionId);
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
        aiResult = await geminiService.chatAboutPolicy(sanitizedMessage, policySummary, conversationHistory, matchedClauses, { aiModel });
    } catch (error) {
        logger.warn('AI chat unavailable, returning Postgres/Search fallback:', error.message);
        aiResult = await buildOfflinePolicyChatFallback({
            userMessage: sanitizedMessage,
            policySummary,
            matchedClauses,
        });
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
                agent: 'standard',
                model: aiResult.model,
                provider: aiResult.provider,
                tokensUsed: aiResult.tokensUsed || 0,
                responseTimeMs: aiResult.responseTimeMs || 0,
            },
        })
        .select()
        .single();

    if (insertError) {
        throw insertError;
    }

    await cacheConversation(userId, currentSessionId, [
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

const getUserSessions = async (userId, { agent = 'all' } = {}) => {
    let query = supabaseAdmin
        .from('chat_history')
        .select('session_id, policy_id, message, timestamp, metadata')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(500);

    if (agent === 'parinidhi') {
        query = query.like('session_id', 'parinidhi_%');
    } else if (agent === 'standard') {
        query = query.not('session_id', 'like', 'parinidhi_%');
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    const sessionMap = new Map();
    for (const row of data || []) {
        if (!sessionMap.has(row.session_id)) {
            sessionMap.set(row.session_id, {
                sessionId: row.session_id,
                policyId: row.policy_id || null,
                agent: row.metadata?.agent || (String(row.session_id).startsWith('parinidhi_') ? 'parinidhi' : 'standard'),
                lastMessage: String(row.message || '').substring(0, 100),
                lastTimestamp: row.timestamp,
                messageCount: 1,
            });
        } else {
            sessionMap.get(row.session_id).messageCount += 1;
        }
    }

    return Array.from(sessionMap.values()).slice(0, 30);
};

module.exports = {
    processMessage,
    getHistory,
    getUserSessions,
    sanitizeInput,
};
