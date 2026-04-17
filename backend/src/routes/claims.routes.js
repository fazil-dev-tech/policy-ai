const express = require('express');
const { z } = require('zod');
const { createClaim, getClaimsByPolicy, getUserClaims } = require('../controllers/claims.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const createClaimSchema = z.object({
    body: z.object({
        policyId: z.string().min(1),
        claimAmount: z.number().positive(),
        description: z.string().min(10).max(2000),
    }),
});

/**
 * @swagger
 * /api/claims:
 *   post:
 *     summary: File a new claim
 *     tags: [Claims]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [policyId, claimAmount, description]
 *             properties:
 *               policyId: { type: string }
 *               claimAmount: { type: number }
 *               description: { type: string }
 *     responses:
 *       201: { description: Claim filed }
 */
router.post('/', authenticate, validate(createClaimSchema), createClaim);

/**
 * @swagger
 * /api/claims:
 *   get:
 *     summary: Get user's claims
 *     tags: [Claims]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of claims }
 */
router.get('/', authenticate, getUserClaims);

/**
 * @swagger
 * /api/claims/{policyId}:
 *   get:
 *     summary: Get claims for a specific policy
 *     tags: [Claims]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of claims }
 */
router.get('/:policyId', authenticate, getClaimsByPolicy);

module.exports = router;
