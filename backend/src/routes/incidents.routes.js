const express = require('express');
const { z } = require('zod');
const {
    analyzeIncident,
    simulateWhatIf,
    toggleChecklistItem,
    generateSlaEscalation,
    getUserIncidents,
    downloadClaimGuidePdf,
    analyzeVehicleDamageEndpoint,
    getVehicleDamageReports,
    decodeSettlementShortfall,
    getUserSettlements,
    downloadGrievancePdf,
} = require('../controllers/incidents.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

const whatIfSchema = z.object({
    body: z.object({}).passthrough(),
});

const slaSchema = z.object({
    body: z.object({
        policyId: z.string().optional().nullable(),
        hospitalName: z.string().max(200).optional(),
        elapsedMinutes: z.coerce.number().min(0).max(10080).optional(),
    }),
});

const checklistSchema = z.object({
    body: z.object({
        key: z.string().trim().min(1, 'Checklist item key is required'),
    }),
});

// Incidents & 7-Scenario Claim Estimator
router.post('/incidents/analyze', authenticate, uploadLimiter, upload.multiEvidence.array('files', 8), analyzeIncident);
router.post('/incidents/what-if', authenticate, validate(whatIfSchema), simulateWhatIf);
router.post('/incidents/sla-escalation', authenticate, validate(slaSchema), generateSlaEscalation);
router.patch('/incidents/:id/checklist', authenticate, validate(checklistSchema), toggleChecklistItem);
router.get('/incidents', authenticate, getUserIncidents);
router.get('/incidents/:id/claim-guide.pdf', authenticate, downloadClaimGuidePdf);

// Vehicle Damage AI
router.post('/damage/analyze', authenticate, uploadLimiter, upload.imagesOnly.array('photos', 6), analyzeVehicleDamageEndpoint);
router.get('/damage', authenticate, getVehicleDamageReports);

// Settlement Shortfall Decoder & GRO Grievance Letter (accepts optional PDF/image sheet OR JSON)
router.post('/settlements/decode', authenticate, uploadLimiter, upload.singleMixed.single('file'), decodeSettlementShortfall);
router.get('/settlements', authenticate, getUserSettlements);
router.get('/settlements/:id/grievance.pdf', authenticate, downloadGrievancePdf);

module.exports = router;
