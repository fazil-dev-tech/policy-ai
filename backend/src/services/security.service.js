const { URL, domainToUnicode } = require('url');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

// Protect VirusTotal free quota: max 4 requests per rolling 60 seconds
const vtCallTimestamps = [];
const VT_MAX_PER_MIN = 4;

const canCallVirusTotal = () => {
    const now = Date.now();
    while (vtCallTimestamps.length > 0 && now - vtCallTimestamps[0] > 60000) {
        vtCallTimestamps.shift();
    }
    return vtCallTimestamps.length < VT_MAX_PER_MIN;
};

const unwrapRedirectUrl = (rawUrl = '') => {
    let target = String(rawUrl || '').trim();
    if (!target) return '';
    if (!/^https?:\/\//i.test(target) && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(target)) {
        target = `https://${target}`;
    }
    try {
        const parsed = new URL(target);
        if (
            (parsed.hostname.includes('google.') && parsed.pathname === '/url') ||
            parsed.hostname === 'l.whatsapp.com' ||
            parsed.hostname === 'l.wl.co'
        ) {
            const inner = parsed.searchParams.get('q') || parsed.searchParams.get('u') || parsed.searchParams.get('url');
            if (inner && /^https?:\/\//i.test(inner)) {
                return inner;
            }
        }
        // Strip query params when persisting domains/paths cleanly so sensitive tokens aren't logged unnecessarily
        return target;
    } catch {
        return target;
    }
};

const extractHostname = (rawUrl) => {
    try {
        const u = new URL(unwrapRedirectUrl(rawUrl));
        return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
};

const getRegistrableDomain = (hostname = '') => {
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length <= 2) return hostname;
    const secondLast = parts[parts.length - 2];
    const last = parts[parts.length - 1];
    if (last === 'in' && ['co', 'gov', 'ac', 'org', 'net'].includes(secondLast) && parts.length >= 3) {
        return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
};

const levenshtein = (a, b) => {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
};

const RISKY_TLDS = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.loan', '.zip', '.mov'];
const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'rb.gy', 'is.gd', 'cutt.ly'];
const BRAND_KEYWORDS = ['starhealth', 'hdfcergo', 'icicilombard', 'licindia', 'bajajallianz', 'policybazaar', 'acko', 'godigit', 'tataaig', 'careinsurance', 'irdai', 'parivahan', 'echallan'];

const evaluateLocalSignals = ({ url, hostname, contextText = '', verifiedDomains = [] }) => {
    const reasons = [];
    let score = 0;
    const lowerUrl = url.toLowerCase();
    const regDomain = getRegistrableDomain(hostname);
    const unicodeDomain = (domainToUnicode(hostname) || hostname).toLowerCase();

    // 1. Exact Verified Registry Match
    const verifiedMatch = verifiedDomains.find((v) => regDomain === v.domain || hostname === v.domain);
    if (verifiedMatch) {
        return {
            status: 'safe',
            riskScore: 5,
            reasons: [`Verified ${verifiedMatch.category}: ${verifiedMatch.provider_name}`],
            verifiedProvider: verifiedMatch,
        };
    }

    // 2. HTTP / Non-HTTPS on insurance or payment link
    if (lowerUrl.startsWith('http://')) {
        score += 25;
        reasons.push('Unencrypted HTTP link (no TLS/HTTPS)');
    }

    // 3. Android APK malware lure (major Indian WhatsApp/Gmail insurance scam vector)
    if (/\.apk(\?|$|#)/i.test(lowerUrl)) {
        score += 75;
        reasons.push('CRITICAL: Direct .apk Android malware download link detected — insurers never send APK files');
    }

    // 4. Reverse-UPI / Refund PIN trap in surrounding client-flagged tokens
    const ctxLower = String(contextText || '').toLowerCase();
    if (/enter.*upi\s*pin.*receiv|upi\s*pin.*refund|collect\s*request.*claim|kyc.*update\.apk/i.test(ctxLower)) {
        score += 65;
        reasons.push('CRITICAL: Reverse-UPI refund / fake KYC scam pattern detected');
    } else if (/urgent.*policy.*suspend|expire.*today.*pay|claim\s*bonus.*click|vahan|e-challan/i.test(ctxLower)) {
        score += 35;
        reasons.push('Urgency or fake challan/policy suspension lure detected');
    }

    // 5. Punycode IDN homoglyph attack (xn--)
    if (hostname.includes('xn--')) {
        score += 45;
        reasons.push(`Punycode/IDN homoglyph domain detected (${unicodeDomain})`);
    }

    // 6. Lookalike typo-squatting against verified insurers
    for (const v of verifiedDomains) {
        const baseA = regDomain.split('.')[0];
        const baseB = v.domain.split('.')[0];
        const dist = levenshtein(baseA, baseB);
        if (dist > 0 && dist <= 2 && Math.abs(baseA.length - baseB.length) <= 2) {
            score += 55;
            reasons.push(`Lookalike domain (${regDomain}) closely mimics official '${v.domain}' (${v.provider_name})`);
            break;
        }
    }

    // 7. Brand keyword spoofing on unofficial domain (e.g., starhealth-renewal-offer.com)
    if (!verifiedMatch) {
        for (const brand of BRAND_KEYWORDS) {
            if (hostname.includes(brand)) {
                score += 45;
                reasons.push(`Brand impersonation risk: mentions '${brand}' on unverified domain '${regDomain}'`);
                break;
            }
        }
    }

    // 8. Risky TLD / URL shorteners
    if (RISKY_TLDS.some((tld) => hostname.endsWith(tld))) {
        score += 30;
        reasons.push('High-risk / disposable top-level domain');
    }
    if (URL_SHORTENERS.includes(regDomain)) {
        score += 25;
        reasons.push(`URL shortener (${regDomain}) obscures final destination`);
    }

    const boundedScore = Math.min(100, Math.max(0, score));
    const status = boundedScore >= 60 ? 'threat' : boundedScore >= 25 ? 'suspicious' : 'safe';
    return { status, riskScore: boundedScore, reasons, verifiedProvider: null };
};

const fetchRdapAgeDays = async (regDomain) => {
    const cacheKey = `rdap_${regDomain}`;
    const { data: cached } = await supabaseAdmin
        .from('research_cache')
        .select('result_json')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (cached?.result_json?.ageDays !== undefined) {
        return cached.result_json.ageDays;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(regDomain)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/rdap+json' },
        });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const json = await resp.json();
        const regEvent = (json.events || []).find((e) => e.eventAction === 'registration');
        if (!regEvent?.eventDate) return null;
        const ageDays = Math.max(0, Math.floor((Date.now() - new Date(regEvent.eventDate).getTime()) / (1000 * 60 * 60 * 24)));
        await supabaseAdmin.from('research_cache').upsert(
            {
                cache_key: cacheKey,
                source: 'rdap',
                query: regDomain,
                result_json: { ageDays },
                expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
            },
            { onConflict: 'cache_key' }
        );
        return ageDays;
    } catch {
        return null;
    }
};

const queryVirusTotalDomain = async (regDomain) => {
    if (!env.VIRUSTOTAL_API_KEY || !regDomain) return null;
    if (!canCallVirusTotal()) {
        return { rateLimited: true };
    }

    try {
        vtCallTimestamps.push(Date.now());
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const resp = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(regDomain)}`, {
            signal: controller.signal,
            headers: { 'x-apikey': env.VIRUSTOTAL_API_KEY },
        });
        clearTimeout(timer);
        if (!resp.ok) {
            return { errorStatus: resp.status };
        }
        const json = await resp.json();
        const stats = json?.data?.attributes?.last_analysis_stats || {};
        return {
            malicious: Number(stats.malicious || 0),
            suspicious: Number(stats.suspicious || 0),
            harmless: Number(stats.harmless || 0),
            reputation: Number(json?.data?.attributes?.reputation || 0),
        };
    } catch (err) {
        logger.warn('VirusTotal check error:', err.message);
        return null;
    }
};

const checkUrlThreat = async ({ rawUrl, sourceSurface = 'web', contextFlags = '', userId = null, allowExternalIntel = true }) => {
    const cleanUrl = unwrapRedirectUrl(rawUrl);
    const hostname = extractHostname(cleanUrl);
    if (!hostname) {
        return {
            url: rawUrl,
            domain: '',
            status: 'suspicious',
            riskScore: 40,
            reasons: ['Malformed or non-standard link format'],
            vtStats: {},
            rdapAgeDays: null,
        };
    }
    const regDomain = getRegistrableDomain(hostname);

    const [{ data: verifiedDomains }, { data: cachedScan }, { data: verifiedScam }] = await Promise.all([
        supabaseAdmin.from('verified_domains').select('*').eq('is_active', true),
        supabaseAdmin.from('site_scans').select('*').eq('domain', regDomain).maybeSingle(),
        supabaseAdmin
            .from('scam_reports')
            .select('category, description')
            .eq('domain', regDomain)
            .eq('moderation_status', 'verified')
            .limit(1)
            .maybeSingle(),
    ]);

    const local = evaluateLocalSignals({
        url: cleanUrl,
        hostname,
        contextText: contextFlags,
        verifiedDomains: verifiedDomains || [],
    });

    if (local.verifiedProvider) {
        return {
            url: cleanUrl,
            domain: regDomain,
            status: 'safe',
            riskScore: 5,
            reasons: local.reasons,
            verifiedProvider: local.verifiedProvider,
            vtStats: cachedScan?.vt_stats || {},
            rdapAgeDays: cachedScan?.rdap_age_days ?? null,
            cached: true,
        };
    }

    if (verifiedScam) {
        return {
            url: cleanUrl,
            domain: regDomain,
            status: 'threat',
            riskScore: 95,
            reasons: [`Admin-Verified Community Scam (${verifiedScam.category}): ${verifiedScam.description || 'Confirmed fraudulent URL'}`],
            vtStats: cachedScan?.vt_stats || {},
            rdapAgeDays: cachedScan?.rdap_age_days ?? null,
            cached: true,
        };
    }

    // Fresh cache hit (no extra VT burn), merged with current page context signals (e.g., .apk link or reverse-UPI message)
    if (cachedScan && new Date(cachedScan.expires_at) > new Date()) {
        const mergedScore = Math.max(cachedScan.risk_score || 0, local.riskScore);
        const mergedStatus = mergedScore >= 60 ? 'threat' : mergedScore >= 25 ? 'suspicious' : cachedScan.status;
        const mergedReasons = Array.from(new Set([...(cachedScan.reasons || []), ...local.reasons]));
        return {
            url: cleanUrl,
            domain: regDomain,
            status: mergedStatus,
            riskScore: mergedScore,
            reasons: mergedReasons.length ? mergedReasons : ['No threat indicators cached'],
            vtStats: cachedScan.vt_stats || {},
            rdapAgeDays: cachedScan.rdap_age_days ?? null,
            cached: true,
        };
    }

    let score = local.riskScore;
    const reasons = [...local.reasons];
    let vtStats = {};
    let rdapAgeDays = null;

    if (allowExternalIntel) {
        const [rdapResult, vtResult] = await Promise.all([
            fetchRdapAgeDays(regDomain),
            queryVirusTotalDomain(regDomain),
        ]);

        rdapAgeDays = rdapResult;
        if (rdapAgeDays !== null && rdapAgeDays < 60) {
            score += 35;
            reasons.push(`Newly registered domain (${rdapAgeDays} days old)`);
        }

        if (vtResult && !vtResult.rateLimited && !vtResult.errorStatus) {
            vtStats = vtResult;
            if (vtResult.malicious >= 2) {
                score = Math.max(score + 55, 80);
                reasons.push(`VirusTotal flagged malicious by ${vtResult.malicious} security engines`);
            } else if (vtResult.malicious === 1 || vtResult.suspicious >= 2) {
                score += 35;
                reasons.push(`VirusTotal flagged suspicious (${vtResult.malicious} malicious, ${vtResult.suspicious} suspicious)`);
            }
        }
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const status = finalScore >= 60 ? 'threat' : finalScore >= 25 ? 'suspicious' : 'safe';
    if (reasons.length === 0 && status === 'safe') {
        reasons.push('No malicious flags found across local rules & threat checks');
    }

    // Persist cache to Supabase site_scans
    try {
        await supabaseAdmin.from('site_scans').upsert(
            {
                user_id: userId || cachedScan?.user_id || null,
                url: cleanUrl.slice(0, 500),
                domain: regDomain,
                source_surface: sourceSurface,
                status,
                risk_score: finalScore,
                reasons,
                vt_stats: vtStats,
                rdap_age_days: rdapAgeDays,
                hit_count: (cachedScan?.hit_count || 0) + 1,
                last_scanned_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            },
            { onConflict: 'domain' }
        );
    } catch (err) {
        logger.warn('Failed saving site_scans cache:', err.message);
    }

    return {
        url: cleanUrl,
        domain: regDomain,
        status,
        riskScore: finalScore,
        reasons,
        vtStats,
        rdapAgeDays,
        cached: false,
    };
};

const batchCheckUrls = async ({ items = [], sourceSurface = 'web', userId = null }) => {
    const capped = (items || []).slice(0, 25);
    const seenDomains = new Set();
    let externalCallsUsed = 0;
    const results = [];

    for (const item of capped) {
        const rawUrl = typeof item === 'string' ? item : item?.url;
        const contextFlags = typeof item === 'object' ? item?.contextFlags || '' : '';
        if (!rawUrl) continue;

        const host = extractHostname(rawUrl);
        const reg = getRegistrableDomain(host);
        const allowExternal = reg && !seenDomains.has(reg) && externalCallsUsed < 2;
        if (reg) seenDomains.add(reg);

        const verdict = await checkUrlThreat({
            rawUrl,
            sourceSurface,
            contextFlags,
            userId,
            allowExternalIntel: allowExternal,
        });
        if (!verdict.cached && allowExternal) externalCallsUsed += 1;
        results.push(verdict);
    }

    return results;
};

module.exports = {
    unwrapRedirectUrl,
    extractHostname,
    getRegistrableDomain,
    checkUrlThreat,
    batchCheckUrls,
};
