const aiService = require('../src/services/ai.service');

describe('ai.service NVIDIA NIM routing & JSON parsing', () => {
    test('getActiveAiMetadata exposes provider, model, and NIM fallbackChain cleanly', () => {
        const meta = aiService.getActiveAiMetadata();
        expect(meta).toHaveProperty('provider');
        expect(meta).toHaveProperty('model');
        expect(Array.isArray(meta.fallbackChain)).toBe(true);
        if (meta.provider === 'nvidia' && meta.fallbackChain.length > 0) {
            expect(meta.fallbackChain).toContain('nvidia/nemotron-3.5-lightning-30b-a3b');
        }
    });

    test('parseJsonResponse extracts valid JSON from markdown-wrapped model output', () => {
        const parsed = aiService.parseJsonResponse('```json\n{"verdict":"Covered","score":88}\n```');
        expect(parsed).toEqual({ verdict: 'Covered', score: 88 });
    });

    test('parseJsonResponse repairs trailing commas or leading prose around JSON objects', () => {
        const parsed = aiService.parseJsonResponse('Here is your result:\n{"insurerShare": 42000, "approved": true}');
        expect(parsed.insurerShare).toBe(42000);
        expect(parsed.approved).toBe(true);
    });

    test('parinidhi detectParinidhiMode distinguishes general questions vs insurance research vs attached policy context', () => {
        const { detectParinidhiMode } = require('../src/services/parinidhi.service');
        expect(detectParinidhiMode('Compare the best laptops in 2026', null, 'auto')).toBe('general');
        expect(detectParinidhiMode('Compare best family health insurance plans in India', null, 'auto')).toBe('research');
        expect(detectParinidhiMode('What is my room rent limit?', 'pol-123', 'auto')).toBe('context');
    });

    test('mapModelForProvider translates NIM and cross-provider slugs cleanly', () => {
        expect(aiService.mapModelForProvider('nvidia/nemotron-3.5-lightning-30b-a3b', 'nvidia')).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
        expect(aiService.mapModelForProvider('nvidia/nemotron-3.5-lightning:free', 'nvidia')).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
        expect(aiService.mapModelForProvider('google/gemma-4-31b-it:free', 'gemini')).toBe('gemma-3-27b-it');
        expect(aiService.mapModelForProvider('nvidia/nemotron-3.5-lightning-30b-a3b', 'groq')).toBe('');
    });
});
