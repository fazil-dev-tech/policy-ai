const express = require('express');
const {
    uploadPolicy,
    getPolicy,
    getUserPolicies,
    getPolicyInsights,
    compareRenewalPolicy,
    auditAgentFollowup,
    downloadEmergencyCardPdf,
    deletePolicy,
} = require('../controllers/policy.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Accepts standard multipart file upload (PDF/Image) OR JSON body { storagePath } (Vercel signed upload flow)
router.post('/upload', authenticate, uploadLimiter, upload.singleMixed.single('file'), uploadPolicy);
router.get('/', authenticate, getUserPolicies);
router.get('/:id/insights', authenticate, getPolicyInsights);
router.post('/:id/renewal-diff', authenticate, uploadLimiter, upload.single('file'), compareRenewalPolicy);
router.post('/:id/agent-audit', authenticate, auditAgentFollowup);
router.get('/:id/emergency-card.pdf', authenticate, downloadEmergencyCardPdf);
router.get('/:id', authenticate, getPolicy);
router.delete('/:id', authenticate, deletePolicy);

module.exports = router;
