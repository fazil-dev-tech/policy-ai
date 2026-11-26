const crypto = require('crypto');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const DEFAULT_CACHE_HOURS = 12;

const buildCacheKey = (prefix, query) => {
    const hash = crypto.createHash('sha256').update(`${prefix}:${String(query || '').trim().toLowerCase()}`).digest('hex').slice(0, 32);
    return `${prefix}_${hash}`;
};

const getCachedResearch = async (cacheKey) => {
    try {
        const { data } = await supabaseAdmin
            .from('research_cache')
            .select('result_json, source, expires_at')
            .eq('cache_key', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        return data || null;
    } catch {
        return null;
    }
};

const setCachedResearch = async (cacheKey, source, query, resultJson, hours = DEFAULT_CACHE_HOURS) => {
    try {
        const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        await supabaseAdmin.from('research_cache').upsert(
            {
                cache_key: cacheKey,
                source,
                query: String(query || '').slice(0, 500),
                result_json: resultJson,
                expires_at: expiresAt,
            },
            { onConflict: 'cache_key' }
        );
    } catch (err) {
        logger.warn('Research cache write skipped:', err.message);
    }
};

const searchWithTavily = async (query, { searchDepth = 'basic', maxResults = 5 } = {}) => {
    if (!env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY not configured');
    const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: env.TAVILY_API_KEY,
            query,
            search_depth: searchDepth,
            include_answer: true,
            include_raw_content: false,
            max_results: maxResults,
        }),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Tavily HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const json = await resp.json();
    return {
        engine: 'tavily',
        answer: json.answer || '',
        results: (json.results || []).map((r) => ({
            title: r.title || '',
            url: r.url || '',
            snippet: r.content || '',
            score: r.score || 0,
        })),
        knowledgeGraph: null,
    };
};

const searchWithSerper = async (query, { gl = 'in', hl = 'en', num = 6 } = {}) => {
    if (!env.SERPER_API_KEY) throw new Error('SERPER_API_KEY not configured');
    const resp = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': env.SERPER_API_KEY,
        },
        body: JSON.stringify({ q: query, gl, hl, num }),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Serper HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const json = await resp.json();
    const kg = json.knowledgeGraph || null;
    const answerBox = json.answerBox?.snippet || json.answerBox?.answer || kg?.description || '';
    return {
        engine: 'serper',
        answer: answerBox,
        knowledgeGraph: kg
            ? {
                  title: kg.title || '',
                  website: kg.website || '',
                  type: kg.type || '',
                  attributes: kg.attributes || {},
              }
            : null,
        results: (json.organic || []).map((r) => ({
            title: r.title || '',
            url: r.link || '',
            snippet: r.snippet || '',
            sitelinks: r.sitelinks || [],
        })),
    };
};

/**
 * Dual-engine search: Supabase cache -> Tavily primary -> Serper India backup.
 */
const liveSearch = async (query, { prefix = 'web', searchDepth = 'basic', maxResults = 5, cacheHours = 12, prefer = 'tavily' } = {}) => {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return { engine: 'none', cached: false, answer: '', results: [], knowledgeGraph: null };

    const cacheKey = buildCacheKey(prefix, cleanQuery);
    const cached = await getCachedResearch(cacheKey);
    if (cached) {
        return { ...cached.result_json, cached: true, engine: cached.source };
    }

    const order = prefer === 'serper' ? [searchWithSerper, searchWithTavily] : [searchWithTavily, searchWithSerper];

    for (const fn of order) {
        try {
            const result = await fn(cleanQuery, { searchDepth, maxResults });
            await setCachedResearch(cacheKey, result.engine, cleanQuery, result, cacheHours);
            return { ...result, cached: false };
        } catch (err) {
            logger.warn(`Live search provider failed (${fn.name}): ${err.message}`);
        }
    }

    return {
        engine: 'offline_fallback',
        cached: false,
        answer: '',
        results: [],
        knowledgeGraph: null,
    };
};

const verifyInsurerWebPresence = async (providerName) => {
    const q = `${providerName} official insurance India IRDAI customer care website`;
    return liveSearch(q, { prefix: 'insurer', prefer: 'serper', cacheHours: 48, maxResults: 5 });
};

const lookupOemRepairCosts = async (vehicleInfo, partLabels = []) => {
    const makeModel = [vehicleInfo?.make, vehicleInfo?.model, vehicleInfo?.year].filter(Boolean).join(' ') || 'car';
    const partStr = partLabels.slice(0, 4).join(', ') || 'bumper headlight dent';
    const q = `${makeModel} replacement repair cost India INR ${partStr}`;
    return liveSearch(q, { prefix: 'oem_repair', prefer: 'tavily', cacheHours: 72, maxResults: 4 });
};

module.exports = {
    liveSearch,
    searchWithTavily,
    searchWithSerper,
    verifyInsurerWebPresence,
    lookupOemRepairCosts,
};
