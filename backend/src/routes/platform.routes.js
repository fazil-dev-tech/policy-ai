const express = require('express');
const { z } = require('zod');
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
const validate = require('../middleware/validate');

const checkUrlSchema = z.object({
    body: z.object({
        url: z.string().trim().min(1, 'url is required').max(2048),
        sourceSurface: z.string().optional(),
        contextFlags: z.string().optional(),
    }),
});

const batchCheckSchema = z.object({
    body: z.object({
        items: z.array(z.any()).max(30).optional(),
        urls: z.array(z.any()).max(30).optional(),
        sourceSurface: z.string().optional(),
    }),
});

const scamReportSchema = z.object({
    body: z.object({
        url: z.string().trim().min(1, 'url is required').max(2048),
        category: z.string().optional(),
        description: z.string().max(1500).optional(),
        sourceSurface: z.string().optional(),
    }),
});

const parinidhiChatSchema = z.object({
    body: z.object({
        message: z.string().trim().min(1, 'message is required').max(4000),
        policyId: z.string().optional().nullable(),
        sessionId: z.string().optional().nullable(),
        mode: z.string().optional(),
        language: z.string().optional(),
    }),
});

const liveResearchSchema = z.object({
    body: z.object({
        query: z.string().trim().min(2, 'query is required').max(500),
        prefer: z.enum(['tavily', 'serper']).optional(),
    }),
});

const verifyInsurerSchema = z.object({
    body: z.object({
        providerName: z.string().trim().min(1, 'providerName is required').max(150),
    }),
});

const createFamilySchema = z.object({
    body: z.object({
        fullName: z.string().trim().min(1, 'fullName is required').max(120),
        relationship: z.string().optional(),
        dateOfBirth: z.string().optional().nullable(),
        bloodGroup: z.string().max(10).optional().nullable(),
        emergencyContact: z.string().max(60).optional().nullable(),
        chronicConditions: z.union([z.array(z.string()), z.string()]).optional(),
        notes: z.string().max(1000).optional().nullable(),
        linkPolicyId: z.string().optional().nullable(),
    }),
});

const linkPolicySchema = z.object({
    body: z.object({
        policyId: z.string().trim().min(1, 'policyId is required'),
    }),
});

const signedUploadSchema = z.object({
    body: z.object({
        fileName: z.string().trim().min(1, 'fileName is required').max(255),
        mimeType: z.string().optional(),
        folder: z.enum(['policies', 'incidents', 'documents']).optional(),
    }),
});

// Separate routers so /api/security mounts cleanly under securityLimiter
const securityRouter = express.Router();
securityRouter.use(securityLimiter);
securityRouter.post('/check-url', validate(checkUrlSchema), checkSingleUrl);
securityRouter.post('/batch-check', validate(batchCheckSchema), batchCheckUrls);
securityRouter.get('/verified-domains', getVerifiedDomains);
securityRouter.get('/scans', authenticate, getRecentScans);
securityRouter.get('/scam-reports', getScamReports);
securityRouter.post('/scam-reports', validate(scamReportSchema), submitScamReport);
securityRouter.get('/extension/download', downloadExtensionZip);

const platformRouter = express.Router();
platformRouter.post('/parinidhi/chat', authenticate, chatLimiter, validate(parinidhiChatSchema), chatWithParinidhi);
platformRouter.post('/research/live', authenticate, validate(liveResearchSchema), runLiveResearch);
platformRouter.post('/research/verify-insurer', authenticate, validate(verifyInsurerSchema), verifyInsurerInfo);
platformRouter.get('/research/benchmarks', authenticate, getBenchmarks);

platformRouter.get('/family', authenticate, getFamilyMembers);
platformRouter.post('/family', authenticate, validate(createFamilySchema), createFamilyMember);
platformRouter.post('/family/:id/link-policy', authenticate, validate(linkPolicySchema), linkPolicyToMember);
platformRouter.delete('/family/:id', authenticate, deleteFamilyMember);

platformRouter.post('/storage/signed-upload', authenticate, validate(signedUploadSchema), getSignedUploadUrl);

module.exports = { securityRouter, platformRouter };
