const express = require('express');
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

const router = express.Router();

// Incidents & 7-Scenario Claim Estimator
router.post('/incidents/analyze', authenticate, uploadLimiter, upload.multiEvidence.array('files', 8), analyzeIncident);
router.post('/incidents/what-if', authenticate, simulateWhatIf);
router.post('/incidents/sla-escalation', authenticate, generateSlaEscalation);
router.patch('/incidents/:id/checklist', authenticate, toggleChecklistItem);
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
