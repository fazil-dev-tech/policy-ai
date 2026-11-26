const { supabaseAdmin } = require('../config/supabase');
const geminiService = require('../services/gemini.service');
const fraudService = require('../services/fraud.service');
const storageService = require('../services/storage.service');
const pdfParser = require('../services/pdfParser.service');
const claimEngine = require('../services/claimEngine.service');
const pdfGenerator = require('../services/pdfGenerator.service');
const { mapPolicy, normalizeEnum, safeIsoDate } = require('../utils/mappers');
const logger = require('../utils/logger');

const VALID_POLICY_TYPES = ['health', 'life', 'auto', 'home', 'travel', 'business', 'other', 'document', 'general'];

const enrichAndMapPolicy = (row, signedUrl = null) => {
    const mapped = mapPolicy(row, signedUrl);
    if (!mapped) return null;
    const structuredTerms = row.structured_terms || {};
    const evalRes = claimEngine.calculateHealthScore(row, structuredTerms);
    const cisSummary = Object.keys(row.cis_summary || {}).length
        ? row.cis_summary
        : claimEngine.buildCisCard(row, structuredTerms, evalRes);

    return {
        ...mapped,
        structuredTerms,
        healthScore: Number(row.health_score || evalRes.healthScore),
        inceptionDate: row.inception_date || null,
        cisSummary,
        renewalDiff: row.renewal_diff || {},
        familyMemberId: row.family_member_id || null,
        healthEvaluation: evalRes,
    };
};

const analyzeAndStorePolicyBuffer = async ({ userId, buffer, mimeType, originalname, body = {}, preUploadedStoragePath = null }) => {
    const magic = storageService.validateMagicBytes(buffer, mimeType);
    if (!magic.valid) {
        const err = new Error(magic.reason || 'Invalid uploaded file');
        err.statusCode = 400;
        throw err;
    }

    if (body.familyMemberId) {
        const { data: famOwned } = await supabaseAdmin
            .from('family_members')
            .select('id')
            .eq('id', body.familyMemberId)
            .eq('user_id', userId)
            .maybeSingle();
        if (!famOwned) {
            const err = new Error('Selected family member not found for this account');
            err.statusCode = 403;
            throw err;
        }
    }

    let extracted;
    let parsedPdf = null;
    let isScannedOrPartial = false;

    if (magic.detectedMime === 'application/pdf') {
        parsedPdf = await pdfParser.parsePdfWithLayout(buffer);
        if (parsedPdf.isLikelyScanned) {
            isScannedOrPartial = true;
            extracted = {
                policyNumber: parsedPdf.hints.policyNumber || '',
                providerName: body.providerName || 'Scanned Policy (Manual Review Recommended)',
                policyType: body.policyType || 'other',
                coverageAmount: parsedPdf.hints.coverageAmount || 0,
                helplineNumber: parsedPdf.hints.helplineNumber || '',
                overview: 'This PDF appears scanned or image-based with minimal embedded text.',
                simpleSummary:
                    'Scanned/image-only PDF detected. Please re-upload a digital PDF or photograph pages as JPG/PNG for automatic Vision OCR extraction.',
                coverage: 'Verify Policy Schedule page manually or upload clear page photos.',
                exclusions: 'Cannot read exclusions reliably from non-selectable scanned PDF.',
                claimProcedure: 'Contact your insurer toll-free helpline before hospitalization.',
                requiredDocuments: 'Policy Schedule, ID Proof, Medical/Repair Estimate',
                fraudIndicators: 'Low extractable text confidence — confirm Schedule limits carefully.',
                verificationScore: 45,
                structuredTerms: { partialDocument: true },
            };
        } else {
            extracted = await geminiService.extractPolicyInfo(parsedPdf.fullText, parsedPdf.hints);
        }
    } else {
        isScannedOrPartial = true;
        extracted = await geminiService.extractPolicyFromScannedImages([
            { mimeType: magic.detectedMime, base64: buffer.toString('base64') },
        ]);
        extracted.structuredTerms = { ...(extracted.structuredTerms || {}), partialDocument: true };
    }

    let storagePath = preUploadedStoragePath;
    if (!storagePath) {
        const stored = await storageService.uploadFileBuffer({
            userId,
            folder: 'policies',
            originalname,
            buffer,
            mimeType: magic.detectedMime,
        });
        storagePath = stored.storagePath;
    }

    const now = new Date();
    const defaultEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const policyType = normalizeEnum(extracted.policyType || body.policyType, VALID_POLICY_TYPES, 'other');
    const rawScore = Number(extracted.verificationScore);
    const verificationScore = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : 60;
    const structuredTerms = extracted.structuredTerms || {};
    const inceptionDateIso = extracted.inceptionDate ? safeIsoDate(extracted.inceptionDate, now) : null;

    const baseDraft = {
        user_id: userId,
        policy_number: extracted.policyNumber || `POL-${Date.now()}`,
        provider_name: extracted.providerName || body.providerName || 'Unknown',
        policy_type: policyType,
        coverage_amount: Math.max(0, parseFloat(extracted.coverageAmount) || 0),
        start_date: safeIsoDate(extracted.startDate, now),
        end_date: safeIsoDate(extracted.endDate, defaultEnd),
        inception_date: inceptionDateIso,
        family_member_id: body.familyMemberId || null,
        pdf_url: '',
        storage_path: storagePath,
        ai_summary: {
            overview: extracted.overview || '',
            coverage: extracted.coverage || '',
            exclusions: extracted.exclusions || '',
            claimProcedure: extracted.claimProcedure || '',
            requiredDocuments: extracted.requiredDocuments || '',
            fraudIndicators: extracted.fraudIndicators || '',
            simpleSummary: extracted.simpleSummary || '',
            helplineNumber: extracted.helplineNumber || '',
            partialDocument: isScannedOrPartial,
        },
        structured_terms: structuredTerms,
        verification_score: verificationScore,
        status: 'active',
    };

    const healthEval = claimEngine.calculateHealthScore(baseDraft, structuredTerms);
    const cisSummary = claimEngine.buildCisCard(baseDraft, structuredTerms, healthEval);

    const insertPayload = {
        ...baseDraft,
        health_score: healthEval.healthScore,
        cis_summary: cisSummary,
    };

    const { data: created, error } = await supabaseAdmin.from('policies').insert(insertPayload).select().single();
    if (error) {
        await storageService.deleteStorageFile(storagePath).catch(() => {});
        throw error;
    }

    if (parsedPdf && parsedPdf.pages?.length) {
        await pdfParser.indexPolicyClauses({
            policyId: created.id,
            userId,
            pages: parsedPdf.pages,
        });
    }

    const signedUrl = await storageService.createSignedUrl(storagePath);
    const mapped = enrichAndMapPolicy(created, signedUrl);

    // Run fraud check within a strict short window before returning so Vercel serverless doesn't freeze mid-update
    try {
        const fraudRes = await Promise.race([
            fraudService.analyzePolicyFraud(mapped),
            new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
        if (fraudRes && fraudRes.overallScore > 0) {
            const fraudCeiling = Math.max(0, Math.min(100, 100 - fraudRes.overallScore));
            const updatedScore = Math.min(verificationScore, fraudCeiling);
            if (updatedScore !== verificationScore) {
                const { error: updateErr } = await supabaseAdmin
                    .from('policies')
                    .update({ verification_score: updatedScore })
                    .eq('id', created.id);
                if (!updateErr) mapped.verificationScore = updatedScore;
            }
        }
    } catch (err) {
        logger.warn('Non-fatal fraud check error on upload:', err.message);
    }

    return mapped;
};

const uploadPolicy = async (req, res, next) => {
    try {
        if (req.file) {
            const policy = await analyzeAndStorePolicyBuffer({
                userId: req.user.id,
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                originalname: req.file.originalname,
                body: req.body,
            });
            logger.info(`Policy uploaded: ${policy.policyNumber} by user ${req.user.id}`);
            return res.status(201).json({
                message: 'Policy uploaded and analyzed successfully',
                policy,
            });
        }

        // Vercel >4.5 MB Signed-Storage Direct Upload fallback
        if (req.body?.storagePath) {
            const storagePath = storageService.assertSafeUserStoragePath(req.user.id, req.body.storagePath);
            const buffer = await storageService.downloadBuffer(storagePath);
            const policy = await analyzeAndStorePolicyBuffer({
                userId: req.user.id,
                buffer,
                mimeType: req.body.mimeType || 'application/pdf',
                originalname: req.body.fileName || 'policy.pdf',
                body: req.body,
                preUploadedStoragePath: storagePath,
            });
            return res.status(201).json({
                message: 'Policy analyzed from direct storage upload',
                policy,
            });
        }

        return res.status(400).json({ error: 'No policy file uploaded' });
    } catch (error) {
        next(error);
    }
};

const getPolicy = async (req, res, next) => {
    try {
        const { data: policy, error } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        const signedUrl = await storageService.createSignedUrl(policy.storage_path);
        res.json({ policy: enrichAndMapPolicy(policy, signedUrl) });
    } catch (error) {
        next(error);
    }
};

const getUserPolicies = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const { status, type } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin.from('policies').select('*', { count: 'exact' }).eq('user_id', req.user.id);
        if (status && status !== 'all') query = query.eq('status', String(status));
        if (type && type !== 'all') query = query.eq('policy_type', String(type));

        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
        if (error) return next(error);

        const policies = await storageService.attachSignedUrls(data, enrichAndMapPolicy);
        const total = count || 0;

        res.json({
            policies,
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        next(error);
    }
};

const getPolicyInsights = async (req, res, next) => {
    try {
        const { data: policy, error } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        const q = String(req.query.q || '').trim();
        const [clauses, agentLogs] = await Promise.all([
            q
                ? pdfParser.searchPolicyClauses({ policyId: policy.id, userId: req.user.id, query: q, limit: 8 })
                : supabaseAdmin
                      .from('policy_clauses')
                      .select('id, page_number, section_title, clause_text')
                      .eq('policy_id', policy.id)
                      .eq('user_id', req.user.id)
                      .order('page_number', { ascending: true })
                      .limit(10)
                      .then((r) => r.data || []),
            supabaseAdmin
                .from('agent_followups')
                .select('*')
                .eq('policy_id', policy.id)
                .eq('user_id', req.user.id)
                .order('created_at', { ascending: false }),
        ]);

        const evalRes = claimEngine.calculateHealthScore(policy, policy.structured_terms || {});
        const cisCard = claimEngine.buildCisCard(policy, policy.structured_terms || {}, evalRes);

        res.json({
            policyId: policy.id,
            healthEvaluation: evalRes,
            cisCard,
            clauses: clauses || [],
            agentFollowups: agentLogs.data || [],
            renewalDiff: policy.renewal_diff || {},
        });
    } catch (error) {
        next(error);
    }
};

const VALID_FOLLOWUP_CHANNELS = ['agent', 'broker', 'bank', 'online', 'direct', 'other'];

const compareRenewalPolicy = async (req, res, next) => {
    try {
        const { data: oldPolicy, error } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!oldPolicy) return res.status(404).json({ error: 'Original policy not found' });

        let buffer = req.file?.buffer;
        let originalname = req.file?.originalname || req.body?.fileName || 'renewal.pdf';
        let mimeType = req.file?.mimetype || req.body?.mimeType || 'application/pdf';
        let preUploadedPath = null;

        if (!buffer && req.body?.storagePath) {
            preUploadedPath = storageService.assertSafeUserStoragePath(req.user.id, req.body.storagePath);
            buffer = await storageService.downloadBuffer(preUploadedPath);
        }
        if (!buffer) return res.status(400).json({ error: 'Upload renewal policy PDF to compare' });

        const magic = storageService.validateMagicBytes(buffer, mimeType);
        if (!magic.valid) return res.status(400).json({ error: magic.reason });

        let renewalExtracted;
        if (magic.detectedMime === 'application/pdf') {
            const parsed = await pdfParser.parsePdfWithLayout(buffer);
            renewalExtracted = parsed.isLikelyScanned
                ? { overview: 'Scanned renewal PDF', simpleSummary: 'Scanned renewal uploaded', coverageAmount: oldPolicy.coverage_amount }
                : await geminiService.extractPolicyInfo(parsed.fullText, parsed.hints);
        } else {
            renewalExtracted = await geminiService.extractPolicyFromScannedImages([
                { mimeType: magic.detectedMime, base64: buffer.toString('base64') },
            ]);
        }

        const diffs = claimEngine.comparePolicyRenewal(
            oldPolicy.ai_summary,
            renewalExtracted,
            oldPolicy.coverage_amount,
            renewalExtracted.coverageAmount || oldPolicy.coverage_amount
        );

        const diffPayload = {
            comparedAt: new Date().toISOString(),
            renewalFileName: originalname,
            renewalPolicyNumber: renewalExtracted.policyNumber || oldPolicy.policy_number,
            diffs,
        };

        const { error: updateErr } = await supabaseAdmin
            .from('policies')
            .update({ renewal_diff: diffPayload })
            .eq('id', oldPolicy.id)
            .eq('user_id', req.user.id);
        if (updateErr) return next(updateErr);

        res.json({ renewalDiff: diffPayload });
    } catch (error) {
        next(error);
    }
};

const auditAgentFollowup = async (req, res, next) => {
    try {
        const { data: policy, error } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        const { agentName = '', intermediaryCode = '', channel = 'agent', promisedTerms = {} } = req.body || {};
        const safeChannel = normalizeEnum(channel, VALID_FOLLOWUP_CHANNELS, 'agent');
        const mappedPolicy = enrichAndMapPolicy(policy);
        const audit = claimEngine.auditAgentPromise(promisedTerms, mappedPolicy);

        const { data: record, error: insErr } = await supabaseAdmin
            .from('agent_followups')
            .insert({
                user_id: req.user.id,
                policy_id: policy.id,
                agent_name: String(agentName || '').slice(0, 120),
                intermediary_code: String(intermediaryCode || '').slice(0, 60),
                channel: safeChannel,
                promised_terms: promisedTerms,
                discrepancy_report: audit.discrepancies,
                status: audit.status,
            })
            .select()
            .single();

        if (insErr) return next(insErr);

        res.status(201).json({ followup: record, audit });
    } catch (error) {
        next(error);
    }
};

const downloadPolicyFile = async (req, res, next) => {
    try {
        const { data: policy, error } = await supabaseAdmin
            .from('policies')
            .select('id, policy_number, storage_path')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!policy || !policy.storage_path) return res.status(404).json({ error: 'Policy file not found' });

        const buffer = await storageService.downloadBuffer(policy.storage_path);
        const magic = storageService.validateMagicBytes(buffer, '');
        const contentType = magic.detectedMime || 'application/pdf';
        const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] || 'bin';
        const safeName = String(policy.policy_number || 'Policy').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${safeName}.${ext}"`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};

const downloadEmergencyCardPdf = async (req, res, next) => {
    try {
        const { data: policy, error } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        let member = null;
        if (policy.family_member_id) {
            const { data: fam } = await supabaseAdmin
                .from('family_members')
                .select('*')
                .eq('id', policy.family_member_id)
                .eq('user_id', req.user.id)
                .maybeSingle();
            member = fam;
        }

        const cis = claimEngine.buildCisCard(policy, policy.structured_terms || {});
        const pdfBuf = await pdfGenerator.generateEmergencyCardPdf({ policy, cis, member });
        const safeFileNum = String(policy.policy_number || 'Policy').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Emergency_Card_${safeFileNum}.pdf"`);
        res.send(pdfBuf);
    } catch (error) {
        next(error);
    }
};

const deletePolicy = async (req, res, next) => {
    try {
        const { data: policy, error } = await supabaseAdmin
            .from('policies')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .maybeSingle();

        if (error) return next(error);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        await storageService.deleteStorageFile(policy.storage_path);
        logger.info(`Policy deleted: ${policy.policy_number}`);

        res.json({ message: 'Policy deleted successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadPolicy,
    getPolicy,
    getUserPolicies,
    getPolicyInsights,
    compareRenewalPolicy,
    auditAgentFollowup,
    downloadPolicyFile,
    downloadEmergencyCardPdf,
    deletePolicy,
};
