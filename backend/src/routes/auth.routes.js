const express = require('express');
const { z } = require('zod');
const {
    register,
    login,
    refresh,
    getMe,
    sendOtp,
    verifyOtp,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

const registerSchema = z.object({
    body: z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email(),
        password: z.string().min(6).max(128),
    }),
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().email(),
        password: z.string().min(1),
    }),
});

const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1),
    }),
});

const sendOtpSchema = z.object({
    body: z.object({
        email: z.string().trim().email(),
        type: z.enum(['email', 'signup', 'magiclink']).optional(),
        createIfMissing: z.boolean().optional(),
    }),
});

const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().trim().email(),
        otp: z.string().trim().regex(/^\d{6,8}$/, 'OTP must be 6 to 8 digits'),
        type: z.enum(['email', 'signup', 'magiclink']).optional(),
    }),
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user via Supabase Auth
 *     tags: [Auth]
 */
router.post('/register', authLimiter, validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user via Supabase Auth
 *     tags: [Auth]
 */
router.post('/login', authLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh Supabase access token
 *     tags: [Auth]
 */
router.post('/refresh', validate(refreshSchema), refresh);

router.post('/send-otp', authLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), verifyOtp);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', authenticate, getMe);

module.exports = router;
