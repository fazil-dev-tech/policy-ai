const express = require('express');
const {
    checkSingleUrl,
    batchCheckUrls,
    getVerifiedDomains,
    getRecentScans,
    getScamReports,
    submitScamReport,
    downloadExtensionZip,
    chatWithParinidhi,
    runLiveResearch,
    verifyInsurerInfo,
    getBenchmarks,
    getFamilyMembers,
    createFamilyMember,
    linkPolicyToMember,
    deleteFamilyMember,
    getSignedUploadUrl,
} = require('../controllers/platform.controller');
const { authenticate } = require('../middleware/auth');
const { chatLimiter, securityLimiter } = require('../middleware/rateLimiter');

// Separate routers so /api/security mounts cleanly under securityLimiter
const securityRouter = express.Router();
securityRouter.use(securityLimiter);
securityRouter.post('/check-url', checkSingleUrl);
securityRouter.post('/batch-check', batchCheckUrls);
securityRouter.get('/verified-domains', getVerifiedDomains);
securityRouter.get('/scans', getRecentScans);
securityRouter.get('/scam-reports', getScamReports);
securityRouter.post('/scam-reports', submitScamReport);
securityRouter.get('/extension/download', downloadExtensionZip);

const platformRouter = express.Router();
platformRouter.post('/parinidhi/chat', authenticate, chatLimiter, chatWithParinidhi);
platformRouter.post('/research/live', authenticate, runLiveResearch);
platformRouter.post('/research/verify-insurer', authenticate, verifyInsurerInfo);
platformRouter.get('/research/benchmarks', authenticate, getBenchmarks);

platformRouter.get('/family', authenticate, getFamilyMembers);
platformRouter.post('/family', authenticate, createFamilyMember);
platformRouter.post('/family/:id/link-policy', authenticate, linkPolicyToMember);
platformRouter.delete('/family/:id', authenticate, deleteFamilyMember);

platformRouter.post('/storage/signed-upload', authenticate, getSignedUploadUrl);

module.exports = { securityRouter, platformRouter };
