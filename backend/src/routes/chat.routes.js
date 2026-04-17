const express = require('express');
const { sendMessage, getHistory, getSessions } = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Send a chat message and get AI response
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               policyId: { type: string }
 *               sessionId: { type: string }
 *               aiModel: { type: string, enum: [puter], default: puter }
 *     responses:
 *       200: { description: AI response }
 */
router.post('/message', authenticate, chatLimiter, sendMessage);

/**
 * @swagger
 * /api/chat/history:
 *   get:
 *     summary: Get chat history
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: Chat history }
 */
router.get('/history', authenticate, getHistory);

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: Get user chat sessions
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of sessions }
 */
router.get('/sessions', authenticate, getSessions);

module.exports = router;
