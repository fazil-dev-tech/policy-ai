const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const env = require('../config/env');
const logger = require('../utils/logger');

let puterClient = null;

// Verified live NVIDIA NIM endpoints (https://integrate.api.nvidia.com/v1)
const NVIDIA_NIM_TEXT_FALLBACKS = [
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    'nvidia/nemotron-3.5-bolt-e4b',
    'mistralai/mistral-large-4-1t-a52b',
];

const NVIDIA_NIM_VISION_FALLBACKS = [
    'nvidia/nemotron-3.5-super-vl-120b-a12b',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
];

const getNvidiaKeys = () => {
    const raw = [env.NVIDIA_API_KEY, env.NVIDIA_API_KEYS].filter(Boolean).join(',');
    return raw
        .split(',')
        .map((k) => k.trim())
        .filter((v, i, arr) => v && arr.indexOf(v) === i);
};

const FREE_FIRST_ORDER = ['nvidia', 'openrouter', 'groq', 'puter', 'gemini'];
const PAID_PROVIDERS = ['openai', 'grok'];
const keyQuotaCooldowns = new Map();

const uniqueModels = (list) =>
    list.filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

const buildProviderMap = () => ({
    nvidia: () => {
        const keys = getNvidiaKeys();
        if (keys.length === 0) return null;
        const requested = env.AI_MODEL && !env.AI_MODEL.endsWith(':free') ? env.AI_MODEL : NVIDIA_NIM_TEXT_FALLBACKS[0];
        return {
            provider: 'nvidia',
            apiKey: keys[0],
            apiKeys: keys,
            baseURL: env.AI_PROVIDER === 'nvidia' && env.AI_BASE_URL ? env.AI_BASE_URL : 'https://integrate.api.nvidia.com/v1',
            model: requested,
            supportsVision: true,
        };
    },
    openrouter: () =>
        env.OPENROUTER_API_KEY
            ? {
                  provider: 'openrouter',
                  apiKey: env.OPENROUTER_API_KEY,
                  baseURL: env.AI_PROVIDER === 'openrouter' && env.AI_BASE_URL ? env.AI_BASE_URL : 'https://openrouter.ai/api/v1',
                  model: env.AI_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free',
                  supportsVision: true,
              }
            : null,
    gemini: () =>
        env.GEMINI_API_KEY
            ? { provider: 'gemini', apiKey: env.GEMINI_API_KEY, model: env.AI_MODEL || 'gemini-2.5-flash', supportsVision: true }
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
            : 'No AI API key configured. Set NVIDIA_API_KEY (recommended), GROQ_API_KEY, GEMINI_API_KEY, or PUTER_AUTH_TOKEN.'
    );
};

const resolveProviderConfig = () => resolveCandidateConfigs()[0];

const getActiveAiMetadata = () => {
    try {
        const cfg = resolveProviderConfig();
        return {
            provider: cfg.provider,
            model: cfg.model,
            configuredKeys: Array.isArray(cfg.apiKeys) ? cfg.apiKeys.length : 1,
            fallbackChain: cfg.provider === 'nvidia' ? uniqueModels([cfg.model, ...NVIDIA_NIM_TEXT_FALLBACKS]) : [cfg.model],
        };
    } catch {
        return { provider: env.AI_PROVIDER || 'unconfigured', model: env.AI_MODEL || 'none', configuredKeys: 0, fallbackChain: [] };
    }
};

const getPuterClient = async (token) => {
    if (puterClient) return puterClient;
    if (!token) {
        throw new Error(
            'No AI API key configured. Set NVIDIA_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, PUTER_AUTH_TOKEN, OPENAI_API_KEY, or GROK_API_KEY in backend/.env.'
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

const mapModelForProvider = (requestedModel = '', provider = 'nvidia') => {
    const raw = String(requestedModel || '').trim();
    if (!raw) return '';
    if (provider === 'nvidia') {
        const legacyMap = {
            'nvidia/nemotron-3.5-lightning:free': 'nvidia/nemotron-3.5-lightning-30b-a3b',
            'nvidia/nemotron-3-ultra-550b-a55b:free': 'nvidia/nemotron-3-ultra-550b-a55b',
            'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
            'nvidia/nemotron-3.5-super-vl:free': 'nvidia/nemotron-3.5-super-vl-120b-a12b',
        };
        if (legacyMap[raw]) return legacyMap[raw];
        return raw.endsWith(':free') ? '' : raw;
    }
    if (provider === 'gemini') {
        if (raw.includes('gemma')) return 'gemma-3-27b-it';
        if (raw.startsWith('gemini')) return raw.replace(/:free$/i, '');
        return '';
    }
    if (provider === 'groq') {
        return /llama|qwen|mixtral|deepseek/i.test(raw) && !raw.includes('/') ? raw : '';
    }
    if (provider === 'openrouter') {
        return raw;
    }
    return raw.endsWith(':free') ? '' : raw;
};

const callOpenAiCompatibleWithFallback = async ({ cfg, messages, temperature = 0.3, maxTokens = 2048, vision = false, model: optionsModel = '' }) => {
    const startTime = Date.now();
    const isNvidia = cfg.provider === 'nvidia';
    const candidateKeys = Array.isArray(cfg.apiKeys) && cfg.apiKeys.length > 0 ? cfg.apiKeys : [cfg.apiKey];
    const mappedOption = mapModelForProvider(optionsModel, cfg.provider);

    const curatedModels = isNvidia
        ? uniqueModels(
              vision
                  ? NVIDIA_NIM_VISION_FALLBACKS
                  : [mappedOption, cfg.model, ...NVIDIA_NIM_TEXT_FALLBACKS]
          )
        : cfg.provider === 'openrouter'
          ? uniqueModels([mappedOption, cfg.model, 'nvidia/nemotron-3-nano-30b-a3b:free', 'meta-llama/llama-3.3-70b-instruct:free'])
          : cfg.provider === 'groq'
            ? uniqueModels([mappedOption, cfg.model, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])
            : [mappedOption || cfg.model];

    const safeMaxTokens = Math.max(4096, Number(maxTokens) || 4096);
    const totalDeadlineMs = startTime + 45000;

    let lastError = null;
    for (const apiKey of candidateKeys) {
        const cooldownUntil = keyQuotaCooldowns.get(apiKey) || 0;
        if (cooldownUntil > Date.now()) {
            lastError = lastError || new Error(`${cfg.provider} key temporarily in cooldown; rotating to backup.`);
            continue;
        }
        const client = new OpenAI({
            apiKey,
            timeout: 22000,
            maxRetries: 0,
            ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
        });

        for (const modelName of curatedModels) {
            const remainingMs = totalDeadlineMs - Date.now();
            if (remainingMs < 3500) {
                logger.warn(`${cfg.provider} fallback budget exhausted (45s); aborting remaining model retries.`);
                break;
            }
            const perAttemptMs = Math.min(22000, remainingMs);
            const isNemotronInteractive = isNvidia && modelName.startsWith('nvidia/nemotron-3');
            try {
                const completion = await client.chat.completions.create(
                    {
                        model: modelName,
                        messages,
                        temperature,
                        max_tokens: safeMaxTokens,
                        ...(isNemotronInteractive ? { chat_template_kwargs: { enable_thinking: false } } : {}),
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
                if (err.status === 401 || err.status === 402 || err.status === 429) {
                    // Rotate immediately to next configured NVIDIA key on auth or per-minute limit
                    keyQuotaCooldowns.set(apiKey, Date.now() + 60 * 1000);
                    break;
                }
            }
        }
    }

    throw lastError || new Error('All configured AI models failed');
};

const runProviderText = async (cfg, prompt, { systemPrompt = '', temperature = 0.3, maxTokens = 2048, model: requestedModel = '' } = {}) => {
    const startTime = Date.now();
    const effectiveModel = mapModelForProvider(requestedModel, cfg.provider) || cfg.model;

    if (cfg.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(cfg.apiKey);
        const geminiChain = uniqueModels([effectiveModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemma-3-27b-it']);
        let gemErr = null;
        for (const gemModelName of geminiChain) {
            try {
                const isGemma = gemModelName.startsWith('gemma');
                const model = genAI.getGenerativeModel({
                    model: gemModelName,
                    ...(!isGemma && systemPrompt ? { systemInstruction: systemPrompt } : {}),
                });
                const finalPrompt = isGemma && systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
                const result = await withTimeoutPromise(
                    model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
                        generationConfig: { temperature, maxOutputTokens: Math.max(2048, maxTokens) },
                    }),
                    20000,
                    `Gemini (${gemModelName})`
                );
                const text = String(result.response.text() || '').trim();
                if (!text) throw new Error(`${gemModelName} returned empty response`);
                return { text, tokensUsed: 0, model: gemModelName, provider: cfg.provider, responseTimeMs: Date.now() - startTime };
            } catch (err) {
                gemErr = err;
                logger.warn(`Gemini model '${gemModelName}' failed: ${err.message}`);
            }
        }
        throw gemErr || new Error('Gemini provider failed');
    }

    if (['nvidia', 'openrouter', 'openai', 'groq', 'grok'].includes(cfg.provider)) {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        return callOpenAiCompatibleWithFallback({ cfg, messages, temperature, maxTokens, vision: false, model: requestedModel });
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

            if (['nvidia', 'openrouter', 'openai'].includes(cfg.provider)) {
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
    mapModelForProvider,
};
