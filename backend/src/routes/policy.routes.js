const express = require('express');
const { uploadPolicy, getPolicy, getUserPolicies, deletePolicy } = require('../controllers/policy.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @swagger
 * /api/policy/upload:
 *   post:
 *     summary: Upload a policy PDF for AI analysis
 *     tags: [Policy]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *               providerName: { type: string }
 *               policyType: { type: string }
 *     responses:
 *       201: { description: Policy uploaded and analyzed }
 *       400: { description: Invalid file }
 */
router.post('/upload', authenticate, uploadLimiter, upload.single('file'), uploadPolicy);

/**
 * @swagger
 * /api/policy:
 *   get:
 *     summary: Get user's policies
 *     tags: [Policy]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, expired, cancelled] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of policies }
 */
router.get('/', authenticate, getUserPolicies);

/**
 * @swagger
 * /api/policy/{id}:
 *   get:
 *     summary: Get policy by ID
 *     tags: [Policy]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Policy details }
 *       404: { description: Policy not found }
 */
router.get('/:id', authenticate, getPolicy);

/**
 * @swagger
 * /api/policy/{id}:
 *   delete:
 *     summary: Delete a policy
 *     tags: [Policy]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Policy deleted }
 *       404: { description: Policy not found }
 */
router.delete('/:id', authenticate, deletePolicy);

module.exports = router;
