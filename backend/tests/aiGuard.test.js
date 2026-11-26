const aiService = require('../src/services/ai.service');

describe('ai.service free-first model guardrails & JSON parsing', () => {
    test('getActiveAiMetadata prioritizes free-tier models when configured', () => {
        const meta = aiService.getActiveAiMetadata();
        expect(meta).toHaveProperty('provider');
        expect(meta).toHaveProperty('model');
        expect(Array.isArray(meta.fallbackChain)).toBe(true);
        if (meta.provider === 'openrouter' && meta.fallbackChain.length > 0) {
            expect(meta.fallbackChain.some((m) => String(m).endsWith(':free'))).toBe(true);
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
});
