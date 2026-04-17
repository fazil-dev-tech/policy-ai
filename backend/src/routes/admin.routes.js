const express = require('express');
const { getStats, getUsers } = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
