const mockAuthState = {
    authUser: {
        id: 'user-123',
        email: 'tester@example.com',
        user_metadata: { name: 'Tester' },
    },
    profile: {
        id: 'user-123',
        name: 'Tester',
        email: 'tester@example.com',
        role: 'user',
    },
};

const createMockChain = (result = { data: null, error: null }) => {
    const chain = {
        select: jest.fn(() => chain),
        update: jest.fn(() => chain),
        insert: jest.fn(() => chain),
        upsert: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => result),
        single: jest.fn(async () => result),
    };
    return chain;
};

jest.mock('../src/config/supabase', () => ({
    supabaseAdmin: {
        auth: {
            getUser: jest.fn(async (token) => {
                if (!token || token === 'bad-token') {
                    return { data: { user: null }, error: { message: 'Invalid token' } };
                }
                return { data: { user: mockAuthState.authUser }, error: null };
            }),
        },
        from: jest.fn((table) => {
            if (table === 'profiles') {
                return createMockChain({ data: mockAuthState.profile, error: null });
            }
            return createMockChain({ data: null, error: null });
        }),
        storage: { from: jest.fn() },
    },
    createAuthClient: jest.fn(),
    checkSupabaseHealth: jest.fn(async () => ({ status: 'connected', latencyMs: 4 })),
}));

const request = require('supertest');
const app = require('../src/app');

describe('Express app route auth, Zod validation, CORS & SLA checks', () => {
    beforeEach(() => {
        mockAuthState.authUser = { id: 'user-123', email: 'tester@example.com', user_metadata: { name: 'Tester' } };
        mockAuthState.profile = { id: 'user-123', name: 'Tester', email: 'tester@example.com', role: 'user' };
    });

    test('GET /api/health returns 200 and expected status structure', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.databaseProvider).toBe('supabase');
    });

    test('Protected routes reject missing bearer token with 401', async () => {
        const res = await request(app).get('/api/policy');
        expect(res.statusCode).toBe(401);
    });

    test('CORS allows approved frontend origins and blocks untrusted origins', async () => {
        const allowed = await request(app)
            .get('/api/health')
            .set('Origin', 'https://policyguard-ai-ecru.vercel.app');
        expect(allowed.headers['access-control-allow-origin']).toBe('https://policyguard-ai-ecru.vercel.app');

        const blocked = await request(app)
            .get('/api/health')
            .set('Origin', 'https://untrusted-evil-site.example');
        expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('Zod validates POST /api/chat/message, /api/family, /api/security/check-url, and /api/admin routes', async () => {
        const chatErr = await request(app)
            .post('/api/chat/message')
            .set('Authorization', 'Bearer valid-token')
            .send({ message: '   ' });
        expect(chatErr.statusCode).toBe(400);
        expect(chatErr.body.error).toBe('Validation failed');

        const familyErr = await request(app)
            .post('/api/family')
            .set('Authorization', 'Bearer valid-token')
            .send({ relationship: 'parent' });
        expect(familyErr.statusCode).toBe(400);
        expect(familyErr.body.error).toBe('Validation failed');

        const secErr = await request(app)
            .post('/api/security/check-url')
            .send({ url: '' });
        expect(secErr.statusCode).toBe(400);
        expect(secErr.body.error).toBe('Validation failed');

        mockAuthState.profile.role = 'admin';
        const adminErr = await request(app)
            .patch('/api/admin/scam-reports/rep-1')
            .set('Authorization', 'Bearer admin-token')
            .send({ moderationStatus: 'unknown_status' });
        expect(adminErr.statusCode).toBe(400);
        expect(adminErr.body.error).toBe('Validation failed');
    });

    test('POST /api/incidents/sla-escalation distinguishes pre-breach monitoring vs >180m breach', async () => {
        const early = await request(app)
            .post('/api/incidents/sla-escalation')
            .set('Authorization', 'Bearer valid-token')
            .send({ hospitalName: 'Apollo Hospital', elapsedMinutes: 45 });
        expect(early.statusCode).toBe(200);
        expect(early.body.isBreached).toBe(false);
        expect(early.body.elapsedMinutes).toBe(45);
        expect(early.body.draft).toContain('SLA Monitoring Draft');

        const breached = await request(app)
            .post('/api/incidents/sla-escalation')
            .set('Authorization', 'Bearer valid-token')
            .send({ hospitalName: 'Apollo Hospital', elapsedMinutes: 195 });
        expect(breached.statusCode).toBe(200);
        expect(breached.body.isBreached).toBe(true);
        expect(breached.body.elapsedMinutes).toBe(195);
        expect(breached.body.draft).toContain('URGENT – Breach of IRDAI');
    });

    test('POST /api/auth/verify-otp verifies OTP cleanly and returns session without server errors', async () => {
        const { createAuthClient } = require('../src/config/supabase');
        const verifyOtpMock = jest.fn(async ({ email, token, type }) => {
            if (email === 'tester@example.com' && token === '761933' && type === 'email') {
                return {
                    data: {
                        user: mockAuthState.authUser,
                        session: {
                            access_token: 'mock-access-token',
                            refresh_token: 'mock-refresh-token',
                        },
                    },
                    error: null,
                };
            }
            return { data: { user: null, session: null }, error: { message: 'Token has expired or is invalid' } };
        });
        createAuthClient.mockReturnValueOnce({ auth: { verifyOtp: verifyOtpMock } });

        const okRes = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'tester@example.com', otp: '761933', type: 'email' });

        expect(okRes.statusCode).toBe(200);
        expect(okRes.body.message).toBe('Login successful');
        expect(okRes.body.accessToken).toBe('mock-access-token');
        expect(okRes.body.refreshToken).toBe('mock-refresh-token');
        expect(okRes.body.user.email).toBe('tester@example.com');
        expect(verifyOtpMock).toHaveBeenCalledWith({
            email: 'tester@example.com',
            token: '761933',
            type: 'email',
        });

        createAuthClient.mockReturnValueOnce({ auth: { verifyOtp: verifyOtpMock } });
        const badRes = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'tester@example.com', otp: '000000', type: 'magiclink' });

        expect(badRes.statusCode).toBe(401);
        expect(badRes.body.error).toBe('Token has expired or is invalid');
    });

    test('Branded OTP email builder renders PolicyGuard AI UI card without Confirm email link', () => {
        const emailService = require('../src/services/email.service');
        const signupPayload = emailService.buildOtpEmailPayload('454136', { mode: 'signup', userName: 'Fazil Pasha' });
        expect(signupPayload.subject).toContain('PolicyGuard AI');
        expect(signupPayload.subject).toContain('454136');
        expect(signupPayload.html).toContain('PolicyGuard AI');
        expect(signupPayload.html).toContain('454136');
        expect(signupPayload.html).toContain('Hi Fazil,');
        expect(signupPayload.html).not.toMatch(/Confirm email address/i);
        expect(signupPayload.html).not.toMatch(/Confirm your PolicyAI/i);
    });
});
