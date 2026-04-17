const express = require('express');
const { z } = require('zod');
const { register, login, refresh, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6).max(128),
        role: z.enum(['user', 'admin']).optional(),
    }),
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
    }),
});

const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1),
    }),
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [user, admin] }
 *     responses:
 *       201: { description: Registration successful }
 *       409: { description: Email already registered }
 */
router.post('/register', authLimiter, validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Tokens refreshed }
 *       401: { description: Invalid refresh token }
 */
router.post('/refresh', validate(refreshSchema), refresh);

const sendOtpSchema = z.object({
    body: z.object({
        email: z.string().email(),
    }),
});

const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email(),
        otp: z.string().length(6),
    }),
});

router.post('/send-otp', authLimiter, validate(sendOtpSchema), require('../controllers/auth.controller').sendOtp);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), require('../controllers/auth.controller').verifyOtp);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User profile }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticate, getMe);

module.exports = router;
