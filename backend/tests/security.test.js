jest.mock('../src/config/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(),
        storage: { from: jest.fn() },
    },
    createAuthClient: jest.fn(),
    checkSupabaseHealth: jest.fn(),
}));

const security = require('../src/services/security.service');

describe('security.service Browser Shield heuristics & URL safety', () => {
    const verifiedDomains = [
        { domain: 'hdfcergo.com', provider_name: 'HDFC ERGO', category: 'insurer' },
        { domain: 'irdai.gov.in', provider_name: 'IRDAI', category: 'regulator' },
    ];

    test('unwrapRedirectUrl unwraps Google/WhatsApp redirectors cleanly', () => {
        expect(security.unwrapRedirectUrl('https://www.google.com/url?q=https%3A%2F%2Fevil.tk%2Fclaim')).toBe(
            'https://evil.tk/claim'
        );
        expect(security.unwrapRedirectUrl('https://l.whatsapp.com/?u=https%3A%2F%2Fhdfcergo.com%2F')).toBe(
            'https://hdfcergo.com/'
        );
    });

    test('extractHostname & getRegistrableDomain normalize Indian domains and subdomains', () => {
        expect(security.extractHostname('https://www.claims.hdfcergo.com/status')).toBe('claims.hdfcergo.com');
        expect(security.getRegistrableDomain('claims.hdfcergo.com')).toBe('hdfcergo.com');
        expect(security.getRegistrableDomain('portal.irdai.gov.in')).toBe('irdai.gov.in');
        expect(security.getRegistrableDomain('scam-claim.vercel.app')).toBe('scam-claim.vercel.app');
    });

    test('sanitizeUrlForStorage strips query strings and fragments', () => {
        expect(security.sanitizeUrlForStorage('https://hdfcergo.com/renew?token=secret#frag')).toBe(
            'https://hdfcergo.com/renew'
        );
    });

    test('evaluateLocalSignals flags APK malware, reverse-UPI & brand typosquatting while whitelisting official domains', () => {
        const official = security.evaluateLocalSignals({
            url: 'https://www.hdfcergo.com/health-insurance',
            hostname: 'hdfcergo.com',
            contextText: '',
            verifiedDomains,
        });
        expect(official.status).toBe('safe');
        expect(official.riskScore).toBeLessThan(15);

        const apkThreat = security.evaluateLocalSignals({
            url: 'https://hdfcergo-claim-bonus.tk/PolicyUpdate.apk',
            hostname: 'hdfcergo-claim-bonus.tk',
            contextText: 'contains_apk',
            verifiedDomains,
        });
        expect(apkThreat.status).toBe('threat');
        expect(apkThreat.riskScore).toBeGreaterThanOrEqual(60);

        const upiScam = security.evaluateLocalSignals({
            url: 'https://hdfcergo.com/refund',
            hostname: 'hdfcergo.com',
            contextText: 'Enter your UPI PIN to receive claim refund immediately',
            verifiedDomains,
        });
        expect(upiScam.status).toBe('threat');
        expect(upiScam.riskScore).toBeGreaterThanOrEqual(60);
    });
});
