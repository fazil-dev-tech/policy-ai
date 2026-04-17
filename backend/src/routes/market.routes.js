const express = require('express');
const { getProviders, getInsights, addProvider } = require('../controllers/market.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/market/providers:
 *   get:
 *     summary: Get insurance providers with market data
 *     tags: [Market]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: rating }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: policyType
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of providers }
 */
router.get('/providers', authenticate, getProviders);

/**
 * @swagger
 * /api/market/insights:
 *   get:
 *     summary: Get AI-generated market insights
 *     tags: [Market]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Market insights }
 */
router.get('/insights', authenticate, getInsights);

/**
 * @swagger
 * /api/market/providers:
 *   post:
 *     summary: Add a market data provider (admin only)
 *     tags: [Market]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Provider added }
 */
router.post('/providers', authenticate, authorize('admin'), addProvider);

module.exports = router;
