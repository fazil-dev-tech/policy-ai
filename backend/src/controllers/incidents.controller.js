const aiService = require('../services/ai.service');
const { supabaseAdmin } = require('../config/supabase');
const storageService = require('../services/storage.service');
const pdfParser = require('../services/pdfParser.service');
const claimEngine = require('../services/claimEngine.service');
const pdfGenerator = require('../services/pdfGenerator.service');
const vehicleDamageService = require('../services/vehicleDamage.service');
const { mapPolicy, normalizeEnum, safeIsoDate } = require('../utils/mappers');
const logger = require('../utils/logger');

const VALID_SCENARIOS = [
    'card_only', 'medical_hospitalization', 'medical_claim', 'motor_accident',
    'life_claim', 'travel_claim', 'home_claim', 'settlement_audit', 'mis_selling', 'other',
];
const VALID_EVIDENCE_CATEGORIES = [
    'policy_pdf', 'e_card', 'doctor_script', 'lab_xray', 'hospital_estimate',
    'discharge_summary', 'vehicle_photo', 'garage_quote', 'settlement_sheet', 'brochure', 'other',
];

const safeJsonParse = (val, fallback) => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val !== 'string') return val;
    try {
        return JSON.parse(val);
    } catch {
        const err = new Error('Malformed JSON payload field');
        err.statusCode = 400;
        throw err;
    }
};

const analyzeIncident = async (req, res, next) => {
    const uploadedPathsToCleanup = [];
    try {
        const userId = req.user.id;
        const {
            policyId = null,
            scenarioType = 'medical_claim',
            incidentDate = new Date().toISOString(),
            title = 'Claim Assessment',
            description = '',
            estimatedAmount = 0,
            roomRentPerDay = 0,
            policyRoomCapPerDay = 0,
            copayPct = 0,
            deductible = 0,
            consumablesPct = 8,
            isAccident = false,
            isPedRelated = false,
            vehicleInfo = {},
            signedFiles = [],
        } = req.body;

        const safeScenario = normalizeEnum(scenarioType, VALID_SCENARIOS, 'medical_claim');
        const safeIncidentDateIso = safeIsoDate(incidentDate, new Date());
        const parsedVehicleInfo = safeJsonParse(vehicleInfo, {});
        const parsedSignedFiles = safeJsonParse(signedFiles, []);
        if (!Array.isArray(parsedSignedFiles)) {
            return res.status(400).json({ error: 'signedFiles must be an array' });
        }

        let policy = {};
        if (policyId) {
            const { data: pol } = await supabaseAdmin
                .from('policies')
                .select('*')
                .eq('id', policyId)
                .eq('user_id', userId)
                .maybeSingle();
            if (pol) policy = pol;
        }

        const totalIncoming = (req.files || []).length + parsedSignedFiles.length;
        if (totalIncoming > 8) {
            return res.status(400).json({ error: 'Maximum 8 evidence files allowed per incident analysis.' });
        }

        // Gather raw buffers from multipart files OR Vercel signed direct-to-Supabase uploads
        const fileItems = [];
        for (const f of req.files || []) {
            fileItems.push({
                buffer: f.buffer,
                mimetype: f.mimetype,
                originalname: f.originalname,
                size: f.size,
                storagePath: null,
            });
        }
        for (const sf of parsedSignedFiles) {
            if (!sf?.storagePath) continue;
            const safePath = storageService.assertSafeUserStoragePath(userId, sf.storagePath);
            const buf = await storageService.downloadBuffer(safePath);
            fileItems.push({
                buffer: buf,
                mimetype: sf.mimeType || 'application/pdf',
                originalname: sf.fileName || 'evidence',
                size: buf.length,
                storagePath: safePath,
                hintCategory: sf.docCategory || 'other',
            });
        }

        const evidenceRecords = [];
        let combinedBillTotal = Number(estimatedAmount) || 0;
        let isPartialDoc = Boolean(policy?.ai_summary?.partialDocument) || safeScenario === 'card_only';

        for (const item of fileItems) {
            const magic = storageService.validateMagicBytes(item.buffer, item.mimetype);
            if (!magic.valid) {
                for (const p of uploadedPathsToCleanup) await storageService.deleteStorageFile(p).catch(() => {});
                return res.status(400).json({ error: `${item.originalname}: ${magic.reason}` });
            }

            let storagePath = item.storagePath;
            if (!storagePath) {
                const uploaded = await storageService.uploadFileBuffer({
                    userId,
                    folder: 'incidents',
                    originalname: item.originalname,
                    buffer: item.buffer,
                    mimeType: magic.detectedMime,
                });
                storagePath = uploaded.storagePath;
                uploadedPathsToCleanup.push(storagePath);
            }

            let docCategory = normalizeEnum(item.hintCategory, VALID_EVIDENCE_CATEGORIES, 'other');
            let ocrText = '';
            let extractedData = {};
            let confidenceScore = 80;

            if (magic.detectedMime === 'application/pdf') {
                const parsed = await pdfParser.parsePdfWithLayout(item.buffer);
                ocrText = parsed.fullText.slice(0, 12000);
                confidenceScore = parsed.isLikelyScanned ? 45 : 90;
                if (docCategory === 'other') {
                    const low = ocrText.toLowerCase();
                    if (low.includes('discharge')) docCategory = 'discharge_summary';
                    else if (low.includes('garage') || low.includes('workshop')) docCategory = 'garage_quote';
                    else if (low.includes('settlement') || low.includes('deduction')) docCategory = 'settlement_sheet';
                    else if (low.includes('bill') || low.includes('estimate') || low.includes('hospital')) docCategory = 'hospital_estimate';
                    else if (low.includes('sum insured')) docCategory = 'policy_pdf';
                }
            } else if (safeScenario === 'motor_accident' && !item.originalname.toLowerCase().includes('quote')) {
                docCategory = 'vehicle_photo';
                extractedData = { queuedForVehicleVision: true };
            } else {
                try {
                    const ocr = await pdfParser.extractImageOrScannedEvidence({
                        buffer: item.buffer,
                        mimeType: magic.detectedMime,
                        hintCategory: item.hintCategory || 'evidence',
                    });
                    docCategory = normalizeEnum(ocr.detectedCategory, VALID_EVIDENCE_CATEGORIES, docCategory);
                    ocrText = ocr.rawText || '';
                    extractedData = ocr.extractedFields || {};
                    confidenceScore = Number(ocr.confidenceScore || 70);
                    if (docCategory === 'e_card') isPartialDoc = true;
                    if (!combinedBillTotal && Number(ocr.extractedFields?.totalAmount) > 0) {
                        combinedBillTotal = Number(ocr.extractedFields.totalAmount);
                    }
                } catch (ocrErr) {
                    logger.warn(`Evidence Vision OCR unavailable (${ocrErr.message}); storing image for manual review.`);
                    confidenceScore = 40;
                }
            }

            evidenceRecords.push({
                user_id: userId,
                policy_id: policy.id || null,
                file_name: item.originalname,
                mime_type: magic.detectedMime,
                file_size: item.size || item.buffer.length,
                storage_path: storagePath,
                doc_category: docCategory,
                ocr_text: ocrText,
                extracted_data: extractedData,
                confidence_score: Math.min(100, Math.max(0, Math.round(confidenceScore))),
            });
        }

        let motorReport = null;
        if (safeScenario === 'motor_accident') {
            const photoItems = fileItems
                .filter((f, idx) => evidenceRecords[idx]?.doc_category === 'vehicle_photo')
                .map((f, idx) => ({
                    buffer: f.buffer,
                    mimetype: evidenceRecords[idx]?.mime_type || f.mimetype,
                    originalname: f.originalname,
                }));
            motorReport = await vehicleDamageService.analyzeMotorAccident({
                userId,
                policyId: policy.id || null,
                imageFiles: photoItems,
                vehicleInfo: parsedVehicleInfo,
                garageQuoteTotal: combinedBillTotal,
            });
            if (motorReport.rejected) {
                for (const p of uploadedPathsToCleanup) await storageService.deleteStorageFile(p).catch(() => {});
                return res.status(400).json({ error: motorReport.error, imageQuality: motorReport.imageQuality });
            }
        }

        const payoutCalculation =
            safeScenario === 'motor_accident' && motorReport
                ? {
                      verdict: 'Estimated Own-Damage',
                      grossBill: motorReport.repairEstimate.mid,
                      insurerShare: motorReport.insurancePayout.estimatedPayout,
                      outOfPocket: motorReport.insurancePayout.outOfPocket,
                      alerts: motorReport.repairEstimate.quoteOverchargeWarning
                          ? [motorReport.repairEstimate.quoteOverchargeWarning]
                          : [],
                      waterfall: [
                          { label: 'Estimated Repair Cost (Mid)', amount: motorReport.repairEstimate.mid, type: 'gross' },
                          { label: 'IRDAI Part Depreciation', amount: -motorReport.insurancePayout.totalDepreciation, type: 'deduction' },
                          { label: 'Compulsory Deductible', amount: -motorReport.insurancePayout.compulsoryDeductible, type: 'deduction' },
                          { label: 'Estimated Motor Payout', amount: motorReport.insurancePayout.estimatedPayout, type: 'payout' },
                          { label: 'Your Out-of-Pocket', amount: motorReport.insurancePayout.outOfPocket, type: 'oop' },
                      ],
                  }
                : claimEngine.computeHealthClaimEstimate(policy, policy.structured_terms || {}, {
                      estimatedBill: combinedBillTotal,
                      roomRentPerDay: Number(roomRentPerDay) || 0,
                      policyRoomCapPerDay: Number(policyRoomCapPerDay) > 0 ? Number(policyRoomCapPerDay) : undefined,
                      copayPct: Number(copayPct) > 0 ? Number(copayPct) : undefined,
                      deductible: Number(deductible) > 0 ? Number(deductible) : undefined,
                      consumablesPct: consumablesPct || 8,
                      incidentDate: safeIncidentDateIso,
                      isAccident: isAccident === true || isAccident === 'true',
                      isPedRelated: isPedRelated === true || isPedRelated === 'true',
                      isPartialDoc,
                  });

        const readiness = claimEngine.computeReadinessChecklist(safeScenario, evidenceRecords, policy, safeIncidentDateIso);

        const { data: savedIncident, error: incErr } = await supabaseAdmin
            .from('incidents')
            .insert({
                user_id: userId,
                policy_id: policy.id || null,
                scenario_type: safeScenario,
                incident_date: safeIncidentDateIso,
                title: String(title || 'Claim Assessment').slice(0, 180),
                description: String(description || '').slice(0, 4000),
                estimated_amount: combinedBillTotal,
                claimant_details: parsedVehicleInfo,
                payout_calculation: payoutCalculation,
                readiness_score: readiness.readinessScore,
                readiness_checklist: readiness.checks,
                audit_trail: payoutCalculation.auditTrail || { calculatedAt: new Date().toISOString() },
                status: 'analyzed',
            })
            .select()
            .single();

        if (incErr) {
            for (const p of uploadedPathsToCleanup) await storageService.deleteStorageFile(p).catch(() => {});
            throw incErr;
        }

        if (evidenceRecords.length > 0) {
            const { error: evErr } = await supabaseAdmin
                .from('evidence_files')
                .insert(evidenceRecords.map((er) => ({ ...er, incident_id: savedIncident.id })));
            if (evErr) logger.warn('Failed saving evidence_files rows:', evErr.message);
        }

        if (motorReport?.report?.id) {
            const { error: dmErr } = await supabaseAdmin
                .from('damage_reports')
                .update({ incident_id: savedIncident.id })
                .eq('id', motorReport.report.id);
            if (dmErr) logger.warn('Failed linking damage_report to incident:', dmErr.message);
        }

        logger.info(`Incident ${savedIncident.id} (${safeScenario}) analyzed for user ${userId}`);
        res.status(201).json({
            incident: savedIncident,
            evidenceCount: evidenceRecords.length,
            evidenceFiles: evidenceRecords.map(({ ocr_text, ...rest }) => rest),
            payoutCalculation,
            readiness,
            motorReport,
        });
    } catch (error) {
        for (const p of uploadedPathsToCleanup) await storageService.deleteStorageFile(p).catch(() => {});
        next(error);
    }
};

const simulateWhatIf = async (req, res, next) => {
    try {
        const result = claimEngine.computeWhatIfRoomRent(req.body || {});
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const getUserIncidents = async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('incidents')
            .select('*, policies(id, policy_number, provider_name, policy_type)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) return next(error);
        res.json({ incidents: data || [] });
    } catch (error) {
        next(error);
    }
};

const downloadClaimGuidePdf = async (req, res, next) => {
    try {
        const { data: incident, error } = await supabaseAdmin
            .from('incidents')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!incident) return res.status(404).json({ error: 'Incident not found' });

        let policy = {};
        if (incident.policy_id) {
            const { data: pol } = await supabaseAdmin.from('policies').select('*').eq('id', incident.policy_id).maybeSingle();
            if (pol) policy = pol;
        }

        const pdfBuffer = await pdfGenerator.generateClaimGuidePdf({
            policy,
            incident,
            calculation: incident.payout_calculation || {},
            readiness: {
                readinessScore: incident.readiness_score,
                checks: incident.readiness_checklist || [],
            },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="PolicyGuard_Claim_Guide_${incident.id.slice(0, 8)}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

const analyzeVehicleDamageEndpoint = async (req, res, next) => {
    try {
        const vehicleInfo = safeJsonParse(req.body?.vehicleInfo, {});
        const manualParts = safeJsonParse(req.body?.manualParts, []);
        const signedFiles = safeJsonParse(req.body?.signedFiles, []);
        if (!Array.isArray(signedFiles) || signedFiles.length + (req.files || []).length > 6) {
            return res.status(400).json({ error: 'Maximum 6 accident photos allowed per damage check.' });
        }

        const rawFiles = [...(req.files || [])];
        for (const sf of signedFiles) {
            if (!sf?.storagePath) continue;
            const safePath = storageService.assertSafeUserStoragePath(req.user.id, sf.storagePath);
            const buffer = await storageService.downloadBuffer(safePath);
            rawFiles.push({ buffer, mimetype: sf.mimeType || 'image/jpeg', originalname: sf.fileName || 'photo.jpg' });
        }

        const imageFiles = [];
        for (const f of rawFiles) {
            const magic = storageService.validateMagicBytes(f.buffer, f.mimetype);
            if (!magic.valid || !String(magic.detectedMime || '').startsWith('image/')) {
                return res.status(400).json({ error: `${f.originalname}: Only valid JPG, PNG, or WEBP photos are allowed.` });
            }
            imageFiles.push({ ...f, mimetype: magic.detectedMime });
        }

        if (imageFiles.length === 0 && (!Array.isArray(manualParts) || manualParts.length === 0)) {
            return res.status(400).json({ error: 'Upload at least 1 accident photo or select damaged vehicle parts.' });
        }

        const result = await vehicleDamageService.analyzeMotorAccident({
            userId: req.user.id,
            policyId: req.body.policyId || null,
            imageFiles,
            vehicleInfo,
            manualParts,
            garageQuoteTotal: Number(req.body.garageQuoteTotal || 0),
        });

        if (result.rejected) {
            return res.status(400).json(result);
        }

        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
};

const toggleChecklistItem = async (req, res, next) => {
    try {
        const { key } = req.body || {};
        if (!key || typeof key !== 'string') {
            return res.status(400).json({ error: 'Checklist item key is required' });
        }
        const { data: inc, error } = await supabaseAdmin
            .from('incidents')
            .select('id, readiness_checklist')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!inc) return res.status(404).json({ error: 'Incident not found' });

        const list = Array.isArray(inc.readiness_checklist) ? inc.readiness_checklist : [];
        if (!list.some((item) => item.key === key)) {
            return res.status(404).json({ error: `Checklist item '${key}' not found` });
        }
        const updated = list.map((item) => (item.key === key ? { ...item, completed: !item.completed } : item));
        const doneCount = updated.filter((i) => i.completed).length;
        const readinessScore = updated.length ? Math.round((doneCount / updated.length) * 100) : 0;

        const { data: saved, error: upErr } = await supabaseAdmin
            .from('incidents')
            .update({ readiness_checklist: updated, readiness_score: readinessScore })
            .eq('id', inc.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (upErr) return next(upErr);
        res.json({
            incident: saved,
            readiness: { readinessScore, doneCount, totalCount: updated.length, checks: updated },
        });
    } catch (error) {
        next(error);
    }
};

const generateSlaEscalation = async (req, res, next) => {
    try {
        const { policyId = null, hospitalName = 'Hospital Billing Desk', elapsedMinutes = 180 } = req.body || {};
        let policy = {};
        if (policyId) {
            const { data } = await supabaseAdmin
                .from('policies')
                .select('*')
                .eq('id', policyId)
                .eq('user_id', req.user.id)
                .maybeSingle();
            if (data) policy = data;
        }
        const insurer = policy.provider_name || 'Insurance Provider';
        const policyNum = policy.policy_number || 'N/A';
        const draft = `Subject: URGENT – Breach of IRDAI 3-Hour Cashless Discharge SLA | Policy #${policyNum}

To: Cashless Claims & Grievance Redressal Officer (GRO), ${insurer}
CC: IRDAI Bima Bharosa Portal (complaints@irdai.gov.in)

Dear Sir/Madam,

Final discharge documents for the cashless claim under Policy No. ${policyNum} (${req.user.name}) at ${hospitalName} were submitted over ${elapsedMinutes} minutes ago.

Under the IRDAI Master Circular on Health Insurance Business (May 2024), final authorization for cashless discharge must be granted within 3 hours of receiving discharge bills, failing which any additional hospital stay charges are to be borne by the insurer without impacting the policyholder's Sum Insured.

Kindly issue the final approval immediately and treat this email as formal notice for Bima Bharosa SLA escalation.

Sincerely,
${req.user.name}`;

        res.json({ draft, helpline: policy.ai_summary?.helplineNumber || '155255 (IRDAI)' });
    } catch (error) {
        next(error);
    }
};

const getVehicleDamageReports = async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('damage_reports')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) return next(error);
        res.json({ reports: data || [] });
    } catch (error) {
        next(error);
    }
};

const decodeSettlementShortfall = async (req, res, next) => {
    try {
        let { policyId = null, claimedAmount = 0, approvedAmount = 0, lineItems = [], preferOcr = false, storagePath = null } = req.body || {};
        if (typeof lineItems === 'string') {
            lineItems = safeJsonParse(lineItems, []);
        }

        let fileBuffer = req.file?.buffer || null;
        let fileMime = req.file?.mimetype || req.body?.mimeType || 'application/pdf';
        if (!fileBuffer && storagePath) {
            const safePath = storageService.assertSafeUserStoragePath(req.user.id, storagePath);
            fileBuffer = await storageService.downloadBuffer(safePath);
        }

        // Real document extraction if settlement sheet / rejection letter PDF or photo was uploaded
        if (fileBuffer) {
            const magic = storageService.validateMagicBytes(fileBuffer, fileMime);
            if (!magic.valid) return res.status(400).json({ error: magic.reason });
            let sheetText = '';
            if (magic.detectedMime === 'application/pdf') {
                const parsed = await pdfParser.parsePdfWithLayout(fileBuffer);
                sheetText = parsed.fullText.slice(0, 8000);
            } else {
                const ocr = await pdfParser.extractImageOrScannedEvidence({
                    buffer: fileBuffer,
                    mimeType: magic.detectedMime,
                    hintCategory: 'settlement_sheet',
                });
                sheetText = ocr.rawText || JSON.stringify(ocr.extractedFields || {});
            }

            try {
                const aiRes = await aiService.generateJson(
                    `Extract settlement figures and deduction line items from this Indian insurance settlement sheet or rejection letter. Respond ONLY with JSON:
{
  "claimedAmount": 0,
  "approvedAmount": 0,
  "lineItems": [{"itemName": "", "claimed": 0, "approved": 0, "reason": ""}]
}
Document:\n${sheetText}`,
                    { maxTokens: 2048 }
                );
                const useOcr = preferOcr === true || preferOcr === 'true';
                if (Number(aiRes.data?.claimedAmount) > 0 && (useOcr || !Number(claimedAmount))) {
                    claimedAmount = Number(aiRes.data.claimedAmount);
                }
                const aiApp = aiRes.data?.approvedAmount;
                if (
                    aiApp !== null &&
                    aiApp !== undefined &&
                    aiApp !== '' &&
                    Number.isFinite(Number(aiApp)) &&
                    Number(aiApp) >= 0 &&
                    (useOcr || req.body.approvedAmount === undefined)
                ) {
                    approvedAmount = Number(aiApp);
                }
                if (
                    Array.isArray(aiRes.data?.lineItems) &&
                    aiRes.data.lineItems.length > 0 &&
                    (useOcr || !Array.isArray(lineItems) || lineItems.length === 0)
                ) {
                    lineItems = aiRes.data.lineItems;
                }
            } catch (err) {
                logger.warn('Settlement OCR AI extraction fallback to manual/submitted figures:', err.message);
            }
        }

        let policy = {};
        if (policyId) {
            const { data: pol } = await supabaseAdmin
                .from('policies')
                .select('*')
                .eq('id', policyId)
                .eq('user_id', req.user.id)
                .maybeSingle();
            if (pol) policy = pol;
        }

        const decoded = claimEngine.computeSettlementShortfall({
            claimedAmount,
            approvedAmount,
            lineItems: Array.isArray(lineItems) ? lineItems : [],
            policyNumber: policy.policy_number || req.body.policyNumber || 'N/A',
            insurerName: policy.provider_name || req.body.insurerName || 'Insurance Provider',
            claimantName: req.user.name,
        });

        const { data: saved, error } = await supabaseAdmin
            .from('settlements')
            .insert({
                user_id: req.user.id,
                policy_id: policy.id || null,
                claimed_amount: decoded.claimedAmount,
                approved_amount: decoded.approvedAmount,
                shortfall_amount: decoded.shortfallAmount,
                line_items: Array.isArray(lineItems) ? lineItems : [],
                discrepancy_flags: decoded.discrepancyFlags,
                grievance_letter: decoded.grievanceLetter,
            })
            .select()
            .single();

        if (error) return next(error);
        res.status(201).json({ settlement: saved, ...decoded });
    } catch (error) {
        next(error);
    }
};

const getUserSettlements = async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('settlements')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) return next(error);
        res.json({ settlements: data || [] });
    } catch (error) {
        next(error);
    }
};

const downloadGrievancePdf = async (req, res, next) => {
    try {
        const { data: settlement, error } = await supabaseAdmin
            .from('settlements')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!settlement) return res.status(404).json({ error: 'Settlement audit not found' });

        let policy = {};
        if (settlement.policy_id) {
            const { data: pol } = await supabaseAdmin.from('policies').select('*').eq('id', settlement.policy_id).maybeSingle();
            if (pol) policy = pol;
        }

        const pdfBuffer = await pdfGenerator.generateGrievanceLetterPdf({ settlement, policy });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="PolicyGuard_Grievance_${settlement.id.slice(0, 8)}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

module.exports = {
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
};
