const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const env = require('../config/env');
const logger = require('../utils/logger');

let puterClient = null;

const OPENROUTER_TEXT_FALLBACKS = [
    'particle-ai/particle-1:free',
    'google/gemma-4-26b-a4b-it:free',
    'openrouter/free',
];

const OPENROUTER_VISION_FALLBACKS = [
    'particle-ai/particle-1:free',
    'openrouter/free',
    'nvidia/nemotron-3.5-super-vl:free',
];

const uniqueModels = (list) =>
    list.filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

const resolveProviderConfig = () => {
    const requested = env.AI_PROVIDER || 'auto';

    const providerMap = {
        gemini: () =>
            env.GEMINI_API_KEY
                ? { provider: 'gemini', apiKey: env.GEMINI_API_KEY, model: env.AI_MODEL || 'gemini-2.0-flash' }
                : null,
        openai: () =>
            env.OPENAI_API_KEY
                ? {
                      provider: 'openai',
                      apiKey: env.OPENAI_API_KEY,
                      baseURL: env.AI_BASE_URL || undefined,
                      model: env.AI_MODEL || 'gpt-4o-mini',
                  }
                : null,
        openrouter: () =>
            env.OPENROUTER_API_KEY
                ? {
                      provider: 'openrouter',
                      apiKey: env.OPENROUTER_API_KEY,
                      baseURL: env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
                      model: env.AI_MODEL || OPENROUTER_TEXT_FALLBACKS[0],
                  }
                : null,
        groq: () =>
            env.GROQ_API_KEY
                ? {
                      provider: 'groq',
                      apiKey: env.GROQ_API_KEY,
                      baseURL: env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
                      model: env.AI_MODEL || 'llama-3.3-70b-versatile',
                  }
                : null,
        grok: () =>
            env.GROK_API_KEY
                ? {
                      provider: 'grok',
                      apiKey: env.GROK_API_KEY,
                      baseURL: env.GROK_API_BASE_URL || 'https://api.x.ai/v1',
                      model: env.AI_MODEL || 'grok-2-latest',
                  }
                : null,
        puter: () => ({
            provider: 'puter',
            token: env.PUTER_AUTH_TOKEN || '',
            model: env.AI_MODEL || 'puter-ai',
        }),
    };

    if (requested !== 'auto') {
        const chosen = providerMap[requested]?.();
        if (chosen) return chosen;
        throw new Error(`AI_PROVIDER is set to '${requested}', but its API key is not configured.`);
    }

    for (const candidate of ['openrouter', 'gemini', 'openai', 'groq', 'grok']) {
        const cfg = providerMap[candidate]();
        if (cfg) return cfg;
    }

    return providerMap.puter();
};

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
    if (typeof response === 'string') return response;
    if (response?.message?.content) return response.message.content;
    if (response?.text) return response.text;
    return JSON.stringify(response);
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

    const candidateModels = isOpenRouter
        ? uniqueModels(vision ? [...OPENROUTER_VISION_FALLBACKS, cfg.model] : [cfg.model, ...OPENROUTER_TEXT_FALLBACKS])
        : [cfg.model];

    // Enforce >= 4096 tokens so reasoning :free models never exhaust output budget before emitting content
    const safeMaxTokens = Math.max(4096, Number(maxTokens) || 4096);
    const totalDeadlineMs = startTime + 35000;

    let lastError = null;
    for (const modelName of candidateModels) {
        if (Date.now() > totalDeadlineMs) {
            logger.warn('OpenRouter fallback deadline reached (35s); triggering local deterministic fallback.');
            break;
        }
        try {
            const completion = await client.chat.completions.create(
                {
                    model: modelName,
                    messages,
                    temperature,
                    max_tokens: safeMaxTokens,
                },
                { signal: AbortSignal.timeout(15000) }
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
        }
    }

    throw lastError || new Error('All configured AI models failed');
};

const generateText = async (prompt, { systemPrompt = '', temperature = 0.3, maxTokens = 2048 } = {}) => {
    const cfg = resolveProviderConfig();
    const startTime = Date.now();

    if (cfg.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(cfg.apiKey);
        const model = genAI.getGenerativeModel({
            model: cfg.model,
            ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: Math.max(2048, maxTokens) },
        });
        const text = result.response.text();
        return { text, model: cfg.model, provider: cfg.provider, responseTimeMs: Date.now() - startTime };
    }

    if (['openai', 'openrouter', 'groq', 'grok'].includes(cfg.provider)) {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        return callOpenAiCompatibleWithFallback({ cfg, messages, temperature, maxTokens, vision: false });
    }

    const puter = await getPuterClient(cfg.token);
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const response = await puter.ai.chat(fullPrompt);
    return {
        text: extractTextFromPuter(response),
        tokensUsed: 0,
        model: cfg.model,
        provider: 'puter',
        responseTimeMs: Date.now() - startTime,
    };
};

/**
 * Send one or more images + prompt in a single multimodal call.
 * Accepts array items: { mimeType, base64 } or { url }.
 */
const generateVisionText = async ({ prompt, images = [], systemPrompt = '', temperature = 0.2, maxTokens = 2400 }) => {
    const cfg = resolveProviderConfig();
    const startTime = Date.now();

    const safeImages = (images || []).slice(0, 4);
    if (safeImages.length === 0) {
        return generateText(prompt, { systemPrompt, temperature, maxTokens });
    }

    if (cfg.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(cfg.apiKey);
        const model = genAI.getGenerativeModel({
            model: cfg.model,
            ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        });
        const parts = [{ text: prompt }];
        for (const img of safeImages) {
            if (img.base64) {
                parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } });
            }
        }
        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature, maxOutputTokens: Math.max(2048, maxTokens) },
        });
        return { text: result.response.text(), model: cfg.model, provider: 'gemini', responseTimeMs: Date.now() - startTime };
    }

    if (['openai', 'openrouter', 'groq', 'grok'].includes(cfg.provider)) {
        const contentParts = [{ type: 'text', text: prompt }];
        for (const img of safeImages) {
            const url = img.url || `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`;
            contentParts.push({ type: 'image_url', image_url: { url } });
        }
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: contentParts });

        return callOpenAiCompatibleWithFallback({ cfg, messages, temperature, maxTokens, vision: true });
    }

    throw new Error('Multimodal vision is not supported on the configured fallback provider');
};

const parseJsonResponse = (rawText) => {
    const stripped = String(rawText || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim();

    const tryParse = (candidate) => {
        try {
            return JSON.parse(candidate);
        } catch {
            // Remove trailing commas before closing } or ] often emitted by free models
            const sanitized = candidate
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
            return JSON.parse(sanitized);
        }
    };

    try {
        return tryParse(stripped);
    } catch {
        const firstBrace = stripped.indexOf('{');
        const lastBrace = stripped.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            return tryParse(stripped.slice(firstBrace, lastBrace + 1));
        }
        const firstBracket = stripped.indexOf('[');
        const lastBracket = stripped.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
            return tryParse(stripped.slice(firstBracket, lastBracket + 1));
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
