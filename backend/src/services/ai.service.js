const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const env = require('../config/env');
const logger = require('../utils/logger');

let puterClient = null;

// Permanently $0 OpenRouter free-tier models (excludes paid-per-use / audio-gen / preview models)
const OPENROUTER_TEXT_FALLBACKS = [
    'nvidia/nemotron-3.5-lightning:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'particle-ai/particle-1:free',
    'inclusionai/ling-3.2-flash:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'openrouter/free',
];

const OPENROUTER_VISION_FALLBACKS = [
    'nvidia/nemotron-3.5-super-vl:free',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'inclusionai/ling-3.2-flash:free',
    'particle-ai/particle-1:free',
    'openrouter/free',
];

const FREE_FIRST_ORDER = ['openrouter', 'groq', 'puter', 'gemini'];
const PAID_PROVIDERS = ['openai', 'grok'];

let liveFreeCatalogCache = {
    fetchedAt: 0,
    textModels: [],
    visionModels: [],
};
const LIVE_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

const discoverOpenRouterFreeModels = async ({ vision = false } = {}) => {
    const now = Date.now();
    if (liveFreeCatalogCache.fetchedAt && now - liveFreeCatalogCache.fetchedAt < LIVE_CATALOG_TTL_MS) {
        return vision ? liveFreeCatalogCache.visionModels : liveFreeCatalogCache.textModels;
    }

    try {
        const resp = await fetch('https://openrouter.ai/api/v1/models', {
            signal: AbortSignal.timeout(4500),
            headers: { Accept: 'application/json' },
        });
        if (!resp.ok) return [];
        const json = await resp.json();
        const models = (json.data || []).filter((m) => {
            const id = String(m.id || '');
            const isZeroCost = String(m.pricing?.prompt) === '0' && String(m.pricing?.completion) === '0';
            const isFreeSlug = id.endsWith(':free') || id === 'openrouter/free';
            const outMods = m.architecture?.output_modalities || ['text'];
            const notAudioOrPreview = !/lyria|preview/i.test(id) && outMods.includes('text');
            const notExpired = !m.expiration_date || new Date(m.expiration_date).getTime() > now;
            return isZeroCost && isFreeSlug && notAudioOrPreview && notExpired;
        });

        const scoreModel = (m) => {
            const id = String(m.id || '').toLowerCase();
            let rank = 0;
            if (id.startsWith('nvidia/nemotron')) rank += 400;
            else if (id.startsWith('google/gemma')) rank += 320;
            else if (id.startsWith('qwen/') || id.startsWith('deepseek/') || id.startsWith('meta-llama/')) rank += 280;
            else if (id.startsWith('particle-ai/') || id.startsWith('inclusionai/')) rank += 220;
            else if (id === 'openrouter/free') rank -= 100; // keep auto-router as final fallback
            rank += Math.min(80, Math.round((Number(m.context_length) || 0) / 32768));
            return rank;
        };

        const sorted = [...models].sort((a, b) => scoreModel(b) - scoreModel(a));
        const textModels = sorted.map((m) => m.id);
        const visionModels = sorted
            .filter((m) => Array.isArray(m.architecture?.input_modalities) && m.architecture.input_modalities.includes('image'))
            .map((m) => m.id);

        liveFreeCatalogCache = { fetchedAt: now, textModels, visionModels };
        return vision ? visionModels : textModels;
    } catch {
        return [];
    }
};

const uniqueModels = (list) =>
    list.filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

const isFreeOpenRouterModel = (modelName = '') => {
    const m = String(modelName || '').trim();
    return m.endsWith(':free') || m === 'openrouter/free';
};

const buildProviderMap = () => ({
    gemini: () =>
        env.GEMINI_API_KEY
            ? { provider: 'gemini', apiKey: env.GEMINI_API_KEY, model: env.AI_MODEL || 'gemini-2.0-flash', supportsVision: true }
            : null,
    openai: () =>
        env.OPENAI_API_KEY
            ? {
                  provider: 'openai',
                  apiKey: env.OPENAI_API_KEY,
                  baseURL: env.AI_PROVIDER === 'openai' && env.AI_BASE_URL ? env.AI_BASE_URL : undefined,
                  model: env.AI_PROVIDER === 'openai' && env.AI_MODEL ? env.AI_MODEL : 'gpt-4o-mini',
                  supportsVision: true,
              }
            : null,
    openrouter: () => {
        if (!env.OPENROUTER_API_KEY) return null;
        const preferred = env.AI_MODEL && (!env.AI_ALLOW_PAID ? isFreeOpenRouterModel(env.AI_MODEL) : true)
            ? env.AI_MODEL
            : OPENROUTER_TEXT_FALLBACKS[0];
        return {
            provider: 'openrouter',
            apiKey: env.OPENROUTER_API_KEY,
            baseURL: env.AI_PROVIDER === 'openrouter' && env.AI_BASE_URL ? env.AI_BASE_URL : 'https://openrouter.ai/api/v1',
            model: preferred,
            supportsVision: true,
        };
    },
    groq: () =>
        env.GROQ_API_KEY
            ? {
                  provider: 'groq',
                  apiKey: env.GROQ_API_KEY,
                  baseURL: env.AI_PROVIDER === 'groq' && env.AI_BASE_URL ? env.AI_BASE_URL : 'https://api.groq.com/openai/v1',
                  model: env.AI_PROVIDER === 'groq' && env.AI_MODEL ? env.AI_MODEL : 'llama-3.3-70b-versatile',
                  supportsVision: false,
              }
            : null,
    grok: () =>
        env.GROK_API_KEY
            ? {
                  provider: 'grok',
                  apiKey: env.GROK_API_KEY,
                  baseURL: env.GROK_API_BASE_URL || 'https://api.x.ai/v1',
                  model: env.AI_PROVIDER === 'grok' && env.AI_MODEL ? env.AI_MODEL : 'grok-2-latest',
                  supportsVision: false,
              }
            : null,
    puter: () =>
        env.PUTER_AUTH_TOKEN
            ? {
                  provider: 'puter',
                  token: env.PUTER_AUTH_TOKEN,
                  model: env.AI_MODEL || 'puter-ai',
                  supportsVision: false,
              }
            : null,
});

const resolveCandidateConfigs = ({ vision = false } = {}) => {
    const requested = env.AI_PROVIDER || 'auto';
    const providerMap = buildProviderMap();
    const allowedOrder = env.AI_ALLOW_PAID
        ? [...FREE_FIRST_ORDER, ...PAID_PROVIDERS]
        : FREE_FIRST_ORDER;

    if (requested !== 'auto') {
        const primary = providerMap[requested]?.();
        if (!primary) {
            throw new Error(`AI_PROVIDER is set to '${requested}', but its API key is not configured.`);
        }
        // Only fall back to free providers unless paid failover is explicitly permitted
        const fallbackOrder = env.AI_ALLOW_PAID ? [...FREE_FIRST_ORDER, ...PAID_PROVIDERS] : FREE_FIRST_ORDER;
        const rest = fallbackOrder.filter((k) => k !== requested).map((k) => providerMap[k]?.()).filter(Boolean);
        const combined = [primary, ...rest];
        return vision ? combined.filter((c) => c.supportsVision) : combined;
    }

    const available = allowedOrder.map((k) => providerMap[k]?.()).filter(Boolean);
    const filtered = vision ? available.filter((c) => c.supportsVision) : available;
    if (filtered.length > 0) return filtered;

    throw new Error(
        vision
            ? 'No multimodal vision AI provider is configured.'
            : 'No AI API key configured. Set OPENROUTER_API_KEY (free models), GROQ_API_KEY, GEMINI_API_KEY, or PUTER_AUTH_TOKEN.'
    );
};

const resolveProviderConfig = () => resolveCandidateConfigs()[0];

const getActiveAiMetadata = () => {
    try {
        const cfg = resolveProviderConfig();
        return {
            provider: cfg.provider,
            model: cfg.model,
            fallbackChain: cfg.provider === 'openrouter' ? uniqueModels([cfg.model, ...OPENROUTER_TEXT_FALLBACKS]) : [cfg.model],
        };
    } catch {
        return { provider: env.AI_PROVIDER || 'unconfigured', model: env.AI_MODEL || 'none', fallbackChain: [] };
    }
};

const getPuterClient = async (token) => {
    if (puterClient) return puterClient;
    if (!token) {
        throw new Error(
            'No AI API key configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, GROK_API_KEY, or PUTER_AUTH_TOKEN in backend/.env.'
        );
    }
    const { init } = require('@heyputer/puter.js/src/init.cjs');
    puterClient = init(token);
    return puterClient;
};

const extractTextFromPuter = (response) => {
    if (typeof response === 'string') return response.trim();
    if (response?.error) {
        throw new Error(typeof response.error === 'string' ? response.error : JSON.stringify(response.error));
    }
    if (response?.message?.content) return String(response.message.content).trim();
    if (response?.text) return String(response.text).trim();
    throw new Error('Puter AI returned unrecognized payload shape');
};

const withTimeoutPromise = (promise, ms = 15000, label = 'AI call') => {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const extractMessageText = (completion) => {
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content
            .map((part) => (typeof part === 'string' ? part : part?.text || ''))
            .join('\n')
            .trim();
    }
    return '';
};

const callOpenAiCompatibleWithFallback = async ({ cfg, messages, temperature = 0.3, maxTokens = 2048, vision = false }) => {
    const startTime = Date.now();
    const isOpenRouter = cfg.provider === 'openrouter';
    const defaultHeaders = isOpenRouter
        ? {
              'HTTP-Referer': env.FRONTEND_URL || 'http://localhost:5173',
              'X-Title': 'PolicyGuard Insurance Intelligence',
          }
        : undefined;

    const client = new OpenAI({
        apiKey: cfg.apiKey,
        timeout: 15000,
        maxRetries: 0,
        ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
        ...(defaultHeaders ? { defaultHeaders } : {}),
    });

    const curatedModels = isOpenRouter
        ? uniqueModels(
              vision
                  ? [
                        ...(env.AI_MODEL && !OPENROUTER_TEXT_FALLBACKS.includes(env.AI_MODEL) && isFreeOpenRouterModel(env.AI_MODEL)
                            ? [env.AI_MODEL]
                            : []),
                        ...OPENROUTER_VISION_FALLBACKS,
                    ]
                  : [cfg.model, ...OPENROUTER_TEXT_FALLBACKS]
          )
        : [cfg.model];

    // Enforce >= 4096 tokens so reasoning :free models never exhaust output budget before emitting content
    const safeMaxTokens = Math.max(4096, Number(maxTokens) || 4096);
    const totalDeadlineMs = startTime + 35000;

    let lastError = null;
    let quotaExhausted = false;
    const runModelLoop = async (models) => {
        for (const modelName of models) {
            const remainingMs = totalDeadlineMs - Date.now();
            if (remainingMs < 3500) {
                logger.warn(`${cfg.provider} fallback budget exhausted (35s); aborting remaining model retries.`);
                break;
            }
            const perAttemptMs = Math.min(15000, remainingMs);
            try {
                const completion = await client.chat.completions.create(
                    {
                        model: modelName,
                        messages,
                        temperature,
                        max_tokens: safeMaxTokens,
                    },
                    { signal: AbortSignal.timeout(perAttemptMs) }
                );
                const text = extractMessageText(completion);
                if (!text) {
                    throw new Error(`Model ${modelName} returned empty content`);
                }
                return {
                    text,
                    tokensUsed: completion.usage?.total_tokens || 0,
                    model: completion.model || modelName,
                    provider: cfg.provider,
                    responseTimeMs: Date.now() - startTime,
                };
            } catch (err) {
                lastError = err;
                logger.warn(`AI model '${modelName}' (${cfg.provider}) failed: ${err.message}. Trying next fallback...`);
                if (isOpenRouter && /free-models-per-day/i.test(String(err.message || ''))) {
                    quotaExhausted = true;
                    break;
                }
            }
        }
        return null;
    };

    const primaryRes = await runModelLoop(curatedModels);
    if (primaryRes) return primaryRes;

    // If curated models failed due to retired slugs/upstream downtime (not account daily quota),
    // dynamically discover live $0 :free models from OpenRouter catalog
    if (isOpenRouter && !quotaExhausted && totalDeadlineMs - Date.now() > 4500) {
        const discovered = await discoverOpenRouterFreeModels({ vision });
        const unseen = discovered.filter((m) => !curatedModels.includes(m));
        if (unseen.length > 0) {
            const dynamicRes = await runModelLoop(unseen.slice(0, 4));
            if (dynamicRes) return dynamicRes;
        }
    }

    throw lastError || new Error('All configured AI models failed');
};

const runProviderText = async (cfg, prompt, { systemPrompt = '', temperature = 0.3, maxTokens = 2048 } = {}) => {
    const startTime = Date.now();

    if (cfg.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(cfg.apiKey);
        const model = genAI.getGenerativeModel({
            model: cfg.model,
            ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        });
        const result = await withTimeoutPromise(
            model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature, maxOutputTokens: Math.max(2048, maxTokens) },
            }),
            15000,
            'Gemini generateContent'
        );
        const text = String(result.response.text() || '').trim();
        if (!text) throw new Error('Gemini returned empty response');
        return { text, tokensUsed: 0, model: cfg.model, provider: cfg.provider, responseTimeMs: Date.now() - startTime };
    }

    if (['openai', 'openrouter', 'groq', 'grok'].includes(cfg.provider)) {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        return callOpenAiCompatibleWithFallback({ cfg, messages, temperature, maxTokens, vision: false });
    }

    const puter = await getPuterClient(cfg.token);
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const response = await withTimeoutPromise(puter.ai.chat(fullPrompt), 15000, 'Puter chat');
    return {
        text: extractTextFromPuter(response),
        tokensUsed: 0,
        model: cfg.model,
        provider: 'puter',
        responseTimeMs: Date.now() - startTime,
    };
};

const generateText = async (prompt, options = {}) => {
    const configs = resolveCandidateConfigs({ vision: false });
    let lastError = null;
    for (const cfg of configs) {
        try {
            return await runProviderText(cfg, prompt, options);
        } catch (err) {
            lastError = err;
            logger.warn(`AI provider '${cfg.provider}' failed (${err.message}).`);
        }
    }
    throw lastError || new Error('All AI providers failed');
};

/**
 * Send one or more images + prompt in a single multimodal call.
 * Accepts array items: { mimeType, base64 } or { url }.
 */
const generateVisionText = async ({ prompt, images = [], systemPrompt = '', temperature = 0.2, maxTokens = 2400 }) => {
    const safeImages = (images || []).slice(0, 4);
    if (safeImages.length === 0) {
        return generateText(prompt, { systemPrompt, temperature, maxTokens });
    }

    const configs = resolveCandidateConfigs({ vision: true });
    let lastError = null;

    for (const cfg of configs) {
        const startTime = Date.now();
        try {
            if (cfg.provider === 'gemini') {
                const genAI = new GoogleGenerativeAI(cfg.apiKey);
                const model = genAI.getGenerativeModel({
                    model: cfg.model,
                    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
                });
                const parts = [{ text: prompt }];
                for (const img of safeImages) {
                    if (img.base64) {
                        const normalizedMime = img.mimeType === 'image/jpg' ? 'image/jpeg' : img.mimeType || 'image/jpeg';
                        parts.push({ inlineData: { data: img.base64, mimeType: normalizedMime } });
                    } else if (img.url) {
                        parts.push({ text: `[Image URL reference: ${img.url}]` });
                    }
                }
                const result = await withTimeoutPromise(
                    model.generateContent({
                        contents: [{ role: 'user', parts }],
                        generationConfig: { temperature, maxOutputTokens: Math.max(2048, maxTokens) },
                    }),
                    18000,
                    'Gemini Vision'
                );
                const text = String(result.response.text() || '').trim();
                if (!text) throw new Error('Gemini vision returned empty response');
                return { text, tokensUsed: 0, model: cfg.model, provider: 'gemini', responseTimeMs: Date.now() - startTime };
            }

            if (['openai', 'openrouter'].includes(cfg.provider)) {
                const contentParts = [{ type: 'text', text: prompt }];
                for (const img of safeImages) {
                    const normalizedMime = img.mimeType === 'image/jpg' ? 'image/jpeg' : img.mimeType || 'image/jpeg';
                    const url = img.url || `data:${normalizedMime};base64,${img.base64}`;
                    contentParts.push({ type: 'image_url', image_url: { url } });
                }
                const messages = [];
                if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
                messages.push({ role: 'user', content: contentParts });

                return await callOpenAiCompatibleWithFallback({ cfg, messages, temperature, maxTokens, vision: true });
            }
        } catch (err) {
            lastError = err;
            logger.warn(`Vision provider '${cfg.provider}' failed (${err.message}).`);
        }
    }

    throw lastError || new Error('All configured multimodal vision providers failed');
};

const parseJsonResponse = (rawText) => {
    const stripped = String(rawText || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    const tryParse = (candidate) => {
        try {
            return JSON.parse(candidate);
        } catch {
            // Only normalize smart quotes / trailing commas as a fallback so valid strings containing quotes aren't broken
            const sanitized = candidate
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
            return JSON.parse(sanitized);
        }
    };

    try {
        return tryParse(stripped);
    } catch {
        const firstBrace = stripped.indexOf('{');
        const firstBracket = stripped.indexOf('[');
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            const lastBrace = stripped.lastIndexOf('}');
            if (lastBrace > firstBrace) {
                return tryParse(stripped.slice(firstBrace, lastBrace + 1));
            }
        }
        if (firstBracket !== -1) {
            const lastBracket = stripped.lastIndexOf(']');
            if (lastBracket > firstBracket) {
                return tryParse(stripped.slice(firstBracket, lastBracket + 1));
            }
        }
        throw new Error('AI response did not contain valid JSON');
    }
};

const generateJson = async (prompt, options = {}) => {
    const res = await generateText(prompt, { ...options, temperature: options.temperature ?? 0.2 });
    return {
        data: parseJsonResponse(res.text),
        provider: res.provider,
        model: res.model,
        responseTimeMs: res.responseTimeMs,
    };
};

const generateVisionJson = async (options = {}) => {
    const res = await generateVisionText(options);
    return {
        data: parseJsonResponse(res.text),
        provider: res.provider,
        model: res.model,
        responseTimeMs: res.responseTimeMs,
    };
};

module.exports = {
    generateText,
    generateJson,
    generateVisionText,
    generateVisionJson,
    parseJsonResponse,
    getActiveAiMetadata,
};
