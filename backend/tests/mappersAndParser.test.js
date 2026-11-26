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

    test('extractDeterministicHints parses multi-row insured members (including Female) and multi-line PEDs cleanly', () => {
        const scheduleText = [
            'Total Premium : Rs. 20,143/-',
            'Optional Cover (Deductible) : No | Deductible : Rs. 0/-',
            'SACHIN S .',
            '1 | Male 07-Sep-1997 27 | Self PI0008893356 23-May-2025',
            'Pre Existing Disease : All complications related to surgeries',
            'Hyperuricemia(Gout) and its complications',
            'KAVITHA T',
            '2 | Female 24-Aug-2000 24 | Spouse ME0471009281 23-May-2025',
            'Pre Existing Disease : No PED Declared',
            'Nominee Details :',
            '1 KAVITHA T Spouse 24 100',
        ].join('\n');
        const hints = extractDeterministicHints(scheduleText);
        expect(hints.totalPremium).toBe(20143);
        expect(hints.deductibleAmount).toBe(0);
        expect(hints.nominee).toEqual({ name: 'KAVITHA T', relationship: 'Spouse', age: 24, sharePct: 100 });
        expect(hints.insuredMembers).toHaveLength(2);
        expect(hints.insuredMembers[0].name).toBe('SACHIN S .');
        expect(hints.insuredMembers[0].ped).toContain('Hyperuricemia(Gout)');
        expect(hints.insuredMembers[1].name).toBe('KAVITHA T');
        expect(hints.insuredMembers[1].gender).toBe('Female');
        expect(hints.insuredMembers[1].ped).toBe('No PED Declared');
    });

    test('storageService exports assertSafeUserStoragePath and enforces ownership prefix', () => {
        expect(typeof storageService.assertSafeUserStoragePath).toBe('function');
        expect(storageService.assertSafeUserStoragePath('user-1', 'user-1/policies/doc.pdf')).toBe('user-1/policies/doc.pdf');
        expect(() => storageService.assertSafeUserStoragePath('user-1', 'user-2/policies/doc.pdf')).toThrow();
        expect(() => storageService.assertSafeUserStoragePath('user-1', 'user-1/../secret.pdf')).toThrow();
    });
});
