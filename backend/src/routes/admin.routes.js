const express = require('express');
const { z } = require('zod');
const {
    getStats,
    getUsers,
    getScamReportsAdmin,
    moderateScamReport,
    getVerifiedDomainsAdmin,
    upsertVerifiedDomain,
    deleteVerifiedDomain,
} = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const moderateScamSchema = z.object({
    body: z.object({
        moderationStatus: z.enum(['verified', 'rejected', 'pending']),
        moderatorNotes: z.string().max(1000).optional(),
    }),
});

const upsertDomainSchema = z.object({
    body: z.object({
        domain: z.string().trim().min(2).max(255),
        providerName: z.string().trim().min(1).max(150),
        category: z.string().optional(),
        officialHelpline: z.string().max(80).optional().nullable(),
        grievanceEmail: z.string().max(150).optional().nullable(),
        isActive: z.boolean().optional(),
    }),
});

// All admin routes require authentication and admin role
router.use(authenticate, authorize('admin'));

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard statistics }
 *       403: { description: Insufficient permissions }
 */
router.get('/stats', getStats);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin] }
 *     responses:
 *       200: { description: List of users }
 */
router.get('/users', getUsers);
router.get('/scam-reports', getScamReportsAdmin);
router.patch('/scam-reports/:id', validate(moderateScamSchema), moderateScamReport);
router.get('/verified-domains', getVerifiedDomainsAdmin);
router.post('/verified-domains', validate(upsertDomainSchema), upsertVerifiedDomain);
router.delete('/verified-domains/:id', deleteVerifiedDomain);

module.exports = router;
