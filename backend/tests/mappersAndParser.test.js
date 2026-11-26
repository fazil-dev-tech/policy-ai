jest.mock('../src/config/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(),
        storage: { from: jest.fn() },
    },
    createAuthClient: jest.fn(),
    checkSupabaseHealth: jest.fn(),
}));

const {
    normalizeEnum,
    safeIsoDate,
    mapProfile,
    mapPolicy,
    mapMarketProvider,
} = require('../src/utils/mappers');
const {
    maskSensitivePii,
    extractDeterministicHints,
} = require('../src/services/pdfParser.service');
const storageService = require('../src/services/storage.service');

describe('mappers, pdfParser hints & storage path guards', () => {
    test('normalizeEnum matches allowed values or returns fallback', () => {
        expect(normalizeEnum('Medical_Claim', ['medical_claim', 'general'], 'general')).toBe('medical_claim');
        expect(normalizeEnum('unknown_val', ['health', 'auto'], 'other')).toBe('other');
    });

    test('safeIsoDate parses Indian DD/MM/YYYY and DD/MMM/YYYY dates cleanly', () => {
        expect(safeIsoDate('15/03/2025')).toBe('2025-03-15T00:00:00.000Z');
        expect(safeIsoDate('05-Jan-2026')).toBe('2026-01-05T00:00:00.000Z');
        const fallback = new Date('2025-01-01T00:00:00.000Z');
        expect(safeIsoDate('not-a-date', fallback)).toBe('2025-01-01T00:00:00.000Z');
    });

    test('mapProfile, mapPolicy and mapMarketProvider map snake_case DB rows to camelCase DTOs', () => {
        const profile = mapProfile({ id: 'u1', name: 'Test User', email: 'u@example.com', role: 'user' });
        expect(profile._id).toBe('u1');
        expect(profile.role).toBe('user');

        const policy = mapPolicy({ id: 'p1', user_id: 'u1', policy_number: 'P123', coverage_amount: '500000' });
        expect(policy.coverageAmount).toBe(500000);
        expect(policy.pdfUrl).toBe('/api/policy/p1/file');

        const provider = mapMarketProvider({ id: 'm1', provider_name: 'HDFC ERGO', claim_settlement_ratio: '98.5', rating: '4.5' });
        expect(provider.claimSettlementRatio).toBe(98.5);
        expect(provider.rating).toBe(4.5);
    });

    test('maskSensitivePii masks PAN, Aadhaar and +91 mobile numbers', () => {
        const masked = maskSensitivePii('PAN: ABCDE1234F, Aadhaar 1234 5678 9012, Phone +91 9876543210');
        expect(masked).toContain('[PAN-MASKED]');
        expect(masked).toContain('[AADHAAR-****-9012]');
        expect(masked).toContain('[PHONE-***3210]');
    });

    test('extractDeterministicHints extracts policy metadata from raw schedule text', () => {
        const text = [
            'Policy Number: OG-24-1102-8401-00012345',
            'Basic Floater Sum Insured: Rs. 10 Lakhs',
            'Policy Period: 01/04/2025 To 31/03/2026',
            'Date of Inception of First Policy: 01/04/2019',
            '24x7 Helpline: 1800-266-5844',
        ].join('\n');
        const hints = extractDeterministicHints(text);
        expect(hints.policyNumber).toBe('OG-24-1102-8401-00012345');
        expect(hints.coverageAmount).toBe(1000000);
        expect(hints.startDateRaw).toBe('01/04/2025');
        expect(hints.endDateRaw).toBe('31/03/2026');
        expect(hints.inceptionDateRaw).toBe('01/04/2019');
        expect(hints.helplineNumber).toBe('1800-266-5844');
    });

    test('storageService exports assertSafeUserStoragePath and enforces ownership prefix', () => {
        expect(typeof storageService.assertSafeUserStoragePath).toBe('function');
        expect(storageService.assertSafeUserStoragePath('user-1', 'user-1/policies/doc.pdf')).toBe('user-1/policies/doc.pdf');
        expect(() => storageService.assertSafeUserStoragePath('user-1', 'user-2/policies/doc.pdf')).toThrow();
        expect(() => storageService.assertSafeUserStoragePath('user-1', 'user-1/../secret.pdf')).toThrow();
    });
});
