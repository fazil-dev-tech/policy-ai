const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const securityService = require('../services/security.service');
const parinidhiService = require('../services/parinidhi.service');
const searchService = require('../services/search.service');
const storageService = require('../services/storage.service');
const claimEngine = require('../services/claimEngine.service');
const logger = require('../utils/logger');

const { normalizeEnum } = require('../utils/mappers');

const VALID_SCAM_CATEGORIES = ['phishing', 'fake_portal', 'reverse_upi', 'apk_malware', 'fake_agent', 'other'];
const VALID_SURFACES = ['web', 'whatsapp', 'gmail', 'manual'];
const VALID_RELATIONSHIPS = ['self', 'spouse', 'parent', 'child', 'sibling', 'other'];

/**
 * Optional auth helper: attaches req.userId if Bearer token is valid, otherwise continues anonymously
 * (required for out-of-the-box Chrome extension GREEN/ORANGE/RED alerts without login).
 */
const resolveOptionalUserId = async (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.slice(7).trim();
        if (!token) return null;
        const { data } = await supabaseAdmin.auth.getUser(token);
        return data?.user?.id || null;
    } catch {
        return null;
    }
};

// ─── Browser Shield & Extension Security Endpoints ──────────────────────────
const checkSingleUrl = async (req, res, next) => {
    try {
        const { url, sourceSurface = 'manual', contextFlags = '' } = req.body || {};
        if (!url) return res.status(400).json({ error: 'url is required' });
        const userId = await resolveOptionalUserId(req);
        const result = await securityService.checkUrlThreat({
            rawUrl: url,
            sourceSurface,
            contextFlags,
            userId,
            allowExternalIntel: true,
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const batchCheckUrls = async (req, res, next) => {
    try {
        const { items = [], urls = [], sourceSurface = 'web' } = req.body || {};
        const normalized = items.length ? items : urls;
        const userId = await resolveOptionalUserId(req);
        const results = await securityService.batchCheckUrls({
            items: normalized,
            sourceSurface,
            userId,
        });
        res.json({ results, count: results.length });
    } catch (error) {
        next(error);
    }
};

const getVerifiedDomains = async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('verified_domains')
            .select('*')
            .eq('is_active', true)
            .order('provider_name', { ascending: true });
        if (error) return next(error);
        res.json({ domains: data || [] });
    } catch (error) {
        next(error);
    }
};

const getRecentScans = async (req, res, next) => {
    try {
        let query = supabaseAdmin
            .from('site_scans')
            .select('id, url, domain, source_surface, status, risk_score, reasons, vt_stats, rdap_age_days, hit_count, last_scanned_at')
            .order('last_scanned_at', { ascending: false })
            .limit(30);

        if (req.user?.role !== 'admin') {
            query = query.eq('user_id', req.user.id);
        }

        const { data, error } = await query;
        if (error) return next(error);
        res.json({ scans: data || [] });
    } catch (error) {
        next(error);
    }
};

const getScamReports = async (req, res, next) => {
    try {
        const userId = await resolveOptionalUserId(req);
        let query = supabaseAdmin
            .from('scam_reports')
            .select('id, reported_url, domain, source_surface, category, description, moderation_status, created_at')
            .order('created_at', { ascending: false })
            .limit(40);

        if (userId) {
            query = query.or(`moderation_status.eq.verified,user_id.eq.${userId}`);
        } else {
            query = query.eq('moderation_status', 'verified');
        }

        const { data, error } = await query;
        if (error) return next(error);
        res.json({ reports: data || [] });
    } catch (error) {
        next(error);
    }
};

const submitScamReport = async (req, res, next) => {
    try {
        const { url, category = 'phishing', description = '', sourceSurface = 'web' } = req.body || {};
        if (!url) return res.status(400).json({ error: 'url is required' });
        const userId = await resolveOptionalUserId(req);
        const safeCategory = normalizeEnum(category, VALID_SCAM_CATEGORIES, 'phishing');
        const safeSurface = normalizeEnum(sourceSurface, VALID_SURFACES, 'web');
        const safeUrl = securityService.sanitizeUrlForStorage(String(url));
        const domain = securityService.getRegistrableDomain(securityService.extractHostname(url)) || safeUrl.slice(0, 100);

        const { data, error } = await supabaseAdmin
            .from('scam_reports')
            .insert({
                user_id: userId,
                reported_url: safeUrl,
                domain,
                source_surface: safeSurface,
                category: safeCategory,
                description: String(description || '').slice(0, 1000),
                moderation_status: 'pending',
            })
            .select()
            .single();

        if (error) return next(error);
        res.status(201).json({
            message: 'Scam report submitted cleanly (labeled Unverified until reviewed by an admin).',
            report: data,
        });
    } catch (error) {
        next(error);
    }
};

const downloadExtensionZip = async (req, res, next) => {
    try {
        const prebuiltZip = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'policyguard-extension.zip');
        if (fs.existsSync(prebuiltZip)) {
            return res.download(prebuiltZip, 'policyguard-extension.zip');
        }

        const extensionDir = path.join(__dirname, '..', '..', '..', 'extension');
        if (fs.existsSync(extensionDir)) {
            const archiverMod = await import('archiver');
            const archiverFn = archiverMod.default || archiverMod;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="policyguard-extension.zip"');
            const createArchiver = typeof archiverFn === 'function' ? archiverFn : archiverFn.create;
            const archive = createArchiver('zip', { zlib: { level: 9 } });
            archive.on('error', (err) => next(err));
            archive.pipe(res);
            archive.directory(extensionDir, false);
            await archive.finalize();
            return;
        }

        return res.redirect('/policyguard-extension.zip');
    } catch (error) {
        next(error);
    }
};

// ─── Parinidhi Voice & Research Agent Endpoints ─────────────────────────────
const chatWithParinidhi = async (req, res, next) => {
    try {
        const { message, policyId, sessionId, mode, language } = req.body || {};
        if (!message || !String(message).trim()) {
            return res.status(400).json({ error: 'message is required' });
        }
        const result = await parinidhiService.processParinidhiTurn({
            userId: req.user.id,
            message,
            policyId: policyId || null,
            sessionId: sessionId || null,
            mode: mode || 'auto',
            language: language || 'English',
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ─── Live Research & Benchmarks Endpoints ───────────────────────────────────
const runLiveResearch = async (req, res, next) => {
    try {
        const { query, prefer = 'tavily' } = req.body || {};
        if (!query) return res.status(400).json({ error: 'query is required' });
        const result = await searchService.liveSearch(query, {
            prefix: 'manual_research',
            prefer,
            searchDepth: 'basic',
            maxResults: 6,
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const verifyInsurerInfo = async (req, res, next) => {
    try {
        const { providerName } = req.body || {};
        if (!providerName) return res.status(400).json({ error: 'providerName is required' });
        const [{ data: registry }, searchRes] = await Promise.all([
            supabaseAdmin
                .from('verified_domains')
                .select('*')
                .ilike('provider_name', `%${String(providerName).replace(/[%_,]/g, '')}%`)
                .limit(3),
            searchService.verifyInsurerWebPresence(providerName),
        ]);
        res.json({
            providerName,
            verifiedRegistry: registry || [],
            webVerification: searchRes,
        });
    } catch (error) {
        next(error);
    }
};

const getBenchmarks = async (req, res, next) => {
    try {
        const [{ data: vehicle }, { data: medical }] = await Promise.all([
            supabaseAdmin.from('vehicle_repair_benchmarks').select('*').order('part_label', { ascending: true }),
            supabaseAdmin.from('medical_cost_benchmarks').select('*').order('procedure_name', { ascending: true }),
        ]);
        res.json({ vehicleBenchmarks: vehicle || [], medicalBenchmarks: medical || [] });
    } catch (error) {
        next(error);
    }
};

// ─── Family Vault Endpoints ─────────────────────────────────────────────────
const getFamilyMembers = async (req, res, next) => {
    try {
        const { data: members, error } = await supabaseAdmin
            .from('family_members')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: true });
        if (error) return next(error);

        const { data: policies } = await supabaseAdmin
            .from('policies')
            .select('id, policy_number, provider_name, policy_type, coverage_amount, end_date, status, family_member_id, cis_summary, ai_summary')
            .eq('user_id', req.user.id);

        const policiesByMember = {};
        for (const p of policies || []) {
            const key = p.family_member_id || 'unassigned';
            if (!policiesByMember[key]) policiesByMember[key] = [];
            policiesByMember[key].push(p);
        }

        res.json({
            members: (members || []).map((m) => ({
                ...m,
                policies: policiesByMember[m.id] || [],
            })),
            unassignedPolicies: policiesByMember.unassigned || [],
        });
    } catch (error) {
        next(error);
    }
};

const createFamilyMember = async (req, res, next) => {
    try {
        const { fullName, relationship = 'self', dateOfBirth = null, bloodGroup = '', emergencyContact = '', chronicConditions = [], notes = '', linkPolicyId = null } = req.body || {};
        if (!fullName || !String(fullName).trim()) {
            return res.status(400).json({ error: 'fullName is required' });
        }

        const safeRelationship = normalizeEnum(relationship, VALID_RELATIONSHIPS, 'other');
        let cleanDob = null;
        if (dateOfBirth) {
            const parsedDob = new Date(dateOfBirth);
            if (Number.isNaN(parsedDob.getTime())) {
                return res.status(400).json({ error: 'Invalid dateOfBirth format (expected YYYY-MM-DD)' });
            }
            cleanDob = parsedDob.toISOString().slice(0, 10);
        }

        const { data: member, error } = await supabaseAdmin
            .from('family_members')
            .insert({
                user_id: req.user.id,
                full_name: String(fullName).trim().slice(0, 120),
                relationship: safeRelationship,
                date_of_birth: cleanDob,
                blood_group: String(bloodGroup || '').slice(0, 10),
                emergency_contact: String(emergencyContact || '').slice(0, 60),
                chronic_conditions: Array.isArray(chronicConditions)
                    ? chronicConditions
                    : String(chronicConditions || '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                notes: String(notes || '').slice(0, 1000),
            })
            .select()
            .single();

        if (error) return next(error);

        if (linkPolicyId) {
            await supabaseAdmin
                .from('policies')
                .update({ family_member_id: member.id })
                .eq('id', linkPolicyId)
                .eq('user_id', req.user.id);
        }

        res.status(201).json({ member });
    } catch (error) {
        next(error);
    }
};

const linkPolicyToMember = async (req, res, next) => {
    try {
        const { policyId } = req.body || {};
        if (!policyId) return res.status(400).json({ error: 'policyId is required' });

        // Ownership check: verify req.user.id owns BOTH family_members row and policies row
        const { data: member, error: memErr } = await supabaseAdmin
            .from('family_members')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();
        if (memErr) return next(memErr);
        if (!member) return res.status(404).json({ error: 'Family member not found' });

        const { data, error } = await supabaseAdmin
            .from('policies')
            .update({ family_member_id: member.id })
            .eq('id', policyId)
            .eq('user_id', req.user.id)
            .select()
            .maybeSingle();

        if (error) return next(error);
        if (!data) return res.status(404).json({ error: 'Policy not found for this account' });
        res.json({ policy: data });
    } catch (error) {
        next(error);
    }
};

const deleteFamilyMember = async (req, res, next) => {
    try {
        const { data: deleted, error } = await supabaseAdmin
            .from('family_members')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select('id')
            .maybeSingle();
        if (error) return next(error);
        if (!deleted) return res.status(404).json({ error: 'Family member not found' });
        res.json({ message: 'Family member deleted' });
    } catch (error) {
        next(error);
    }
};

// ─── Signed Direct Storage Upload (Vercel >4.5 MB Bypass) ───────────────────
const getSignedUploadUrl = async (req, res, next) => {
    try {
        const { fileName, mimeType = 'application/pdf', folder = 'incidents' } = req.body || {};
        if (!fileName) return res.status(400).json({ error: 'fileName is required' });
        const safeFolder = ['policies', 'incidents', 'documents'].includes(folder) ? folder : 'incidents';
        const uploadMeta = await storageService.createSignedUploadUrl({
            userId: req.user.id,
            folder: safeFolder,
            originalname: fileName,
            mimeType,
        });
        res.json(uploadMeta);
    } catch (error) {
        next(error);
    }
};

module.exports = {
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
};
