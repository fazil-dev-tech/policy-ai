const { pathToFileURL } = require('url');
const { supabaseAdmin } = require('../config/supabase');
const aiService = require('./ai.service');
const logger = require('../utils/logger');

let pdfjsLibPromise = null;

const getPdfJs = async () => {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            try {
                const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
                if (pdfjs.GlobalWorkerOptions) {
                    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
                }
            } catch {
                // Bundler / legacy fallback handles default relative worker resolution
            }
            return pdfjs;
        })();
    }
    return pdfjsLibPromise;
};

/**
 * DPDP Privacy Masking before sending free-form PDF text to external LLMs
 */
const maskSensitivePii = (text = '') => {
    return String(text || '')
        .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN-MASKED]')
        .replace(/\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, (m) => `[AADHAAR-****-${m.slice(-4)}]`)
        .replace(/(?:\+91[\s-]?)[6-9]\d{9}\b/g, (m) => `[PHONE-***${m.slice(-4)}]`);
};

/**
 * Group pdfjs text items by rounded Y baseline so multi-column schedules and
 * Sum Insured matrices stay aligned rather than gluing across columns.
 */
const reconstructPageLines = (items = []) => {
    const rows = new Map();
    for (const item of items) {
        if (!item?.str || !item.str.trim()) continue;
        const x = item.transform?.[4] ?? 0;
        const y = Math.round((item.transform?.[5] ?? 0) / 3) * 3;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x, width: Number(item.width || 0), str: item.str.trim() });
    }

    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    return sortedYs.map((y) => {
        const cols = rows.get(y).sort((a, b) => a.x - b.x);
        const parts = [];
        for (let i = 0; i < cols.length; i++) {
            const cur = cols[i];
            if (i > 0) {
                const prev = cols[i - 1];
                const visualGap = prev.width > 0 ? cur.x - (prev.x + prev.width) : cur.x - prev.x;
                parts.push(visualGap > 42 ? ' | ' : ' ');
            }
            parts.push(cur.str);
        }
        return parts.join('').replace(/\s+/g, ' ').trim();
    });
};

/**
 * Extract deterministic policy metadata hints (Sum Insured, Policy No, Helpline, Inception)
 */
const extractDeterministicHints = (fullText = '') => {
    const hints = {};

    const policyMatch = fullText.match(/(?:Policy|Certificate)\s*(?:No\.?|Number)[ \t\|:\-]+([A-Z0-9\/.-]{6,35})/i);
    if (policyMatch) hints.policyNumber = policyMatch[1].trim();

    const siMatch = fullText.match(/(?:Basic\s*Floater\s*|Capital\s*)?(?:Sum\s*Insured|IDV)(?:\s*in\s*Rs\.?)?[ \t\|:\-]+(?:Rs\.?|INR|₹)?\s*([\d,]{4,12}|[\d.]+)\s*(Lakhs?|Lacs?|Crores?)?/i);
    if (siMatch) {
        let parsed = parseFloat(siMatch[1].replace(/,/g, ''));
        const unit = (siMatch[2] || '').toLowerCase();
        if (unit.startsWith('lakh') || unit.startsWith('lac')) parsed *= 100000;
        else if (unit.startsWith('crore')) parsed *= 10000000;
        if (Number.isFinite(parsed) && parsed >= 10000) hints.coverageAmount = Math.round(parsed);
    }

    const periodMatch = fullText.match(/(?:PERIOD\s*OF\s*INSURANCE|Policy\s*Period)[^\n]{0,40}?(\d{1,2}[\/\-.][A-Za-z0-9]{2,3}[\/\-.]\d{4})[^\n]{0,30}?\b(?:To|Till|-)\b[^\n]{0,20}?(\d{1,2}[\/\-.][A-Za-z0-9]{2,3}[\/\-.]\d{4})/i);
    if (periodMatch) {
        hints.startDateRaw = periodMatch[1];
        hints.endDateRaw = periodMatch[2];
    }

    const inceptionMatch = fullText.match(/(?:Date\s*of\s*Inception(?:\s*of\s*First\s*Policy)?|First\s*Inception\s*Date)[ \t\|:\-]+(\d{1,2}[\/\-.][A-Za-z0-9]{2,3}[\/\-.]\d{4})/i);
    if (inceptionMatch) hints.inceptionDateRaw = inceptionMatch[1];

    const helplineMatch = fullText.match(/(?:Toll\s*Free|Helpline|24x7|Customer\s*Care)[ \t\|:\-]*(?:No\.?|Number)?[ \t\|:\-]*((?:1800|1860|022|011|044|080|\+91)[\s-]?\d{3,5}(?:[\s-]?\d{3,5})?)/i);
    if (helplineMatch) hints.helplineNumber = helplineMatch[1].replace(/\s+/g, ' ').trim();

    const intermediaryMatch = fullText.match(/Intermediary[ \t\|:\-]+([A-Z0-9\/\-]{6,25})/i);
    if (intermediaryMatch) hints.intermediary = intermediaryMatch[1].trim();

    // Parse insured members & declared PEDs from schedule lines when present
    const insuredMembers = [];
    const lines = String(fullText || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\s*(\d+)\s*\|\s*(Male|Female|Other)\s+(\d{2}[\/\-][A-Za-z0-9]{2,3}[\/\-]\d{4})\s+\d+\s+([A-Za-z\s_-]+?)\s+[A-Z0-9]{6,}/i);
        if (m) {
            const nameLine = i > 0 ? lines[i - 1].trim() : `Member ${m[1]}`;
            const nextLine = i + 1 < lines.length && /Pre\s*Existing\s*Disease/i.test(lines[i + 1]) ? lines[i + 1] : '';
            const pedText = nextLine.replace(/Pre\s*Existing\s*Disease\s*[:\|]*/i, '').trim();
            insuredMembers.push({
                name: nameLine.slice(0, 60),
                gender: m[2],
                dob: m[3],
                relationship: m[4].trim(),
                ped: pedText || 'No PED Declared',
            });
        }
    }
    if (insuredMembers.length > 0) hints.insuredMembers = insuredMembers;

    return hints;
};

/**
 * Extract structured page-by-page layout from a PDF buffer using pdfjs-dist.
 * Falls back cleanly if text density indicates scanned/image-only PDF.
 */
const parsePdfWithLayout = async (pdfBuffer) => {
    const pdfjs = await getPdfJs();
    const uint8 = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjs.getDocument({ data: uint8, verbosity: 0, isEvalSupported: false });
    const doc = await loadingTask.promise;

    const pages = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const lines = reconstructPageLines(textContent.items || []);
        const pageText = lines.join('\n').trim();
        totalChars += pageText.length;
        pages.push({
            pageNumber: pageNum,
            lines,
            text: pageText,
        });
    }

    const avgCharsPerPage = doc.numPages > 0 ? totalChars / doc.numPages : 0;
    const isLikelyScanned = totalChars < 80 || avgCharsPerPage < 40;
    const fullText = pages.map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    const hints = extractDeterministicHints(fullText);

    return {
        numPages: doc.numPages,
        pages,
        fullText,
        totalChars,
        isLikelyScanned,
        hints,
    };
};

/**
 * OCR / Vision extraction fallback for mobile photos, E-cards, doctor scripts,
 * X-rays, garage quotes, and scanned documents via OpenRouter Vision.
 */
const extractImageOrScannedEvidence = async ({ buffer, mimeType = 'image/jpeg', hintCategory = 'other' }) => {
    const base64 = buffer.toString('base64');
    const prompt = `You are an insurance & medical/motor evidence OCR specialist.
Inspect this uploaded ${hintCategory} image carefully. Respond ONLY with valid JSON:
{
  "detectedCategory": "e_card | doctor_script | lab_xray | hospital_estimate | discharge_summary | vehicle_photo | garage_quote | settlement_sheet | brochure | other",
  "readability": "high | medium | low",
  "confidenceScore": 0-100,
  "rawText": "key legible text extracted from image",
  "extractedFields": {
    "providerOrHospital": "",
    "policyOrIdNumber": "",
    "patientOrInsuredName": "",
    "diagnosisOrReason": "",
    "totalAmount": 0,
    "date": "",
    "lineItems": []
  },
  "warnings": ["list any blur, cutoff, or partial-document warnings"]
}`;

    const res = await aiService.generateVisionJson({
        prompt,
        images: [{ mimeType, base64 }],
    });

    return {
        ...res.data,
        aiModel: res.model,
        aiProvider: res.provider,
    };
};

/**
 * Split reconstructed pages into retrieval-ready clause chunks and store in policy_clauses
 * using zero-cost Postgres tsvector full-text search.
 */
const indexPolicyClauses = async ({ policyId, userId, pages = [] }) => {
    if (!policyId || !userId || !pages.length) return 0;

    await supabaseAdmin.from('policy_clauses').delete().eq('policy_id', policyId).eq('user_id', userId);

    const rows = [];
    for (const p of pages) {
        if (!p.text || p.text.trim().length < 15) continue;
        // Split very long pages into ~1200-char chunks at line boundaries so snippets remain crisp
        const chunks = [];
        let current = [];
        let len = 0;
        for (const line of p.lines || p.text.split('\n')) {
            if (len + line.length > 1200 && current.length > 0) {
                chunks.push(current.join('\n'));
                current = [];
                len = 0;
            }
            current.push(line);
            len += line.length + 1;
        }
        if (current.length > 0) chunks.push(current.join('\n'));

        chunks.forEach((chunkText, idx) => {
            const firstLine = (chunkText.split('\n')[0] || '').slice(0, 120);
            rows.push({
                policy_id: policyId,
                user_id: userId,
                page_number: p.pageNumber,
                section_title: firstLine,
                clause_text: chunkText,
                metadata: { chunkIndex: idx + 1 },
            });
        });
    }

    if (rows.length === 0) return 0;

    const batchSize = 40;
    for (let i = 0; i < rows.length; i += batchSize) {
        const { error } = await supabaseAdmin.from('policy_clauses').insert(rows.slice(i, i + batchSize));
        if (error) {
            logger.warn('Failed inserting policy_clauses batch:', error.message);
        }
    }

    return rows.length;
};

/**
 * Search policy clauses with Postgres websearch FTS + ILIKE fallback for exact Page citations.
 */
const STOPWORDS = new Set(['what', 'does', 'when', 'where', 'which', 'this', 'that', 'with', 'from', 'have', 'will', 'your', 'about', 'policy', 'insurance', 'please', 'tell', 'much', 'many']);

const searchPolicyClauses = async ({ policyId, userId, query, limit = 5 }) => {
    if (!policyId || !query) return [];
    const clean = String(query).replace(/[^\w\s₹.-]/g, ' ').trim();
    if (!clean) return [];

    try {
        const { data, error } = await supabaseAdmin
            .from('policy_clauses')
            .select('id, page_number, section_title, clause_text')
            .eq('policy_id', policyId)
            .eq('user_id', userId)
            .textSearch('search_vector', clean, { type: 'websearch', config: 'english' })
            .limit(limit);

        if (!error && data && data.length > 0) {
            return data;
        }
    } catch (err) {
        logger.warn('FTS search error, using fallback ilike:', err.message);
    }

    const keywords = clean
        .split(/\s+/)
        .map((w) => w.replace(/[%_]/g, '').toLowerCase())
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
        .slice(0, 3);
    if (keywords.length === 0) return [];

    const orFilter = keywords.map((kw) => `clause_text.ilike.%${kw}%`).join(',');
    const { data: fallback } = await supabaseAdmin
        .from('policy_clauses')
        .select('id, page_number, section_title, clause_text')
        .eq('policy_id', policyId)
        .eq('user_id', userId)
        .or(orFilter)
        .limit(limit);

    return fallback || [];
};

module.exports = {
    maskSensitivePii,
    parsePdfWithLayout,
    extractDeterministicHints,
    extractImageOrScannedEvidence,
    indexPolicyClauses,
    searchPolicyClauses,
};
