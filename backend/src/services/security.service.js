const { URL, domainToUnicode } = require('url');
const net = require('net');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

// Protect VirusTotal free quota: max 4 requests per rolling 60 seconds
const vtCallTimestamps = [];
const VT_MAX_PER_MIN = 4;

const MULTI_TENANT_HOSTS = new Set([
    'vercel.app', 'github.io', 'netlify.app', 'pages.dev', 'web.app',
    'firebaseapp.com', 'blogspot.com', 'wordpress.com', 'herokuapp.com',
    'sites.google.com', 'drive.google.com', 'docs.google.com',
    'chat.whatsapp.com', 'bit.ly', 'tinyurl.com', 't.co', 'rb.gy', 'is.gd', 'cutt.ly',
]);

const isPrivateOrIpHost = (hostname = '') => {
    const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!h) return true;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
    if (net.isIP(h)) {
        if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
        const parts = h.split('.').map(Number);
        if (parts.length === 4) {
            if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
            if (parts[0] === 169 && parts[1] === 254) return true;
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
            if (parts[0] === 192 && parts[1] === 168) return true;
        }
        return true; // Do not send raw IP literals as domains to RDAP
    }
    return false;
};

const sanitizeUrlForStorage = (rawUrl = '') => {
    try {
        const u = new URL(rawUrl);
        return `${u.origin}${u.pathname}`.slice(0, 500);
    } catch {
        return String(rawUrl || '').split('?')[0].split('#')[0].slice(0, 500);
    }
};

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
    if (!hostname) return '';
    if (isPrivateOrIpHost(hostname)) return hostname;
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length <= 2) return hostname;
    const secondLast = parts[parts.length - 2];
    const last = parts[parts.length - 1];
    const ccSecondLevel = ['co', 'gov', 'ac', 'org', 'net', 'edu', 'res', 'nic', 'com', 'gen', 'mil'];
    if (['in', 'uk', 'au', 'jp', 'nz', 'za', 'sg'].includes(last) && ccSecondLevel.includes(secondLast) && parts.length >= 3) {
        return parts.slice(-3).join('.');
    }
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_TENANT_HOSTS.has(lastTwo) && parts.length >= 3) {
        return parts.slice(-3).join('.');
    }
    return lastTwo;
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
    let urlScopedRisk = false;
    const lowerUrl = url.toLowerCase();
    const regDomain = getRegistrableDomain(hostname);
    const unicodeDomain = (domainToUnicode(hostname) || hostname).toLowerCase();

    if (isPrivateOrIpHost(hostname)) {
        const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        return {
            status: isLocalDev ? 'safe' : 'suspicious',
            riskScore: isLocalDev ? 0 : 45,
            reasons: [isLocalDev ? 'Local development address' : 'Direct private/reserved IP address link requires caution'],
            verifiedProvider: null,
            urlScopedRisk: true,
        };
    }

    // 1. Check critical page/payload signals BEFORE verified-domain whitelist
    if (/\.apk(\?|$|#)/i.test(lowerUrl)) {
        score += 75;
        urlScopedRisk = true;
        reasons.push('CRITICAL: Direct .apk Android malware download link detected — insurers never send APK files');
    }

    const ctxLower = String(contextText || '').toLowerCase();
    if (/enter.*upi\s*pin.*receiv|upi\s*pin.*refund|collect\s*request.*claim|kyc.*update\.apk|reverse.?upi/i.test(ctxLower)) {
        score += 65;
        urlScopedRisk = true;
        reasons.push('CRITICAL: Reverse-UPI refund / fake KYC scam pattern detected');
    } else if (/urgent.*policy.*suspend|expire.*today.*pay|claim\s*bonus.*click|vahan|e-challan|contains_apk|otp\s*prompt|payment\/otp/i.test(ctxLower)) {
        score += 35;
        urlScopedRisk = true;
        reasons.push('Suspicious urgency, APK attachment, or payment/OTP prompt detected');
    }

    // 2. Exact Verified Registry Match (only short-circuit when no critical payload/context threats exist)
    const verifiedMatch = verifiedDomains.find((v) => regDomain === v.domain || hostname === v.domain);
    if (verifiedMatch && score < 25) {
        return {
            status: 'safe',
            riskScore: 5,
            reasons: [`Verified ${verifiedMatch.category}: ${verifiedMatch.provider_name}`],
            verifiedProvider: verifiedMatch,
            urlScopedRisk: false,
        };
    }

    // 3. HTTP / Non-HTTPS on insurance or payment link
    if (lowerUrl.startsWith('http://')) {
        score += 25;
        urlScopedRisk = true;
        reasons.push('Unencrypted HTTP link (no TLS/HTTPS)');
    }

    // 4. Punycode IDN homoglyph attack (xn--)
    if (hostname.includes('xn--')) {
        score += 45;
        reasons.push(`Punycode/IDN homoglyph domain detected (${unicodeDomain})`);
    }

    // 5. Lookalike typo-squatting against verified insurers (skip ultra-short <=4 char bases unless distance === 1)
    if (!verifiedMatch) {
        for (const v of verifiedDomains) {
            const baseA = regDomain.split('.')[0];
            const baseB = v.domain.split('.')[0];
            const maxDist = Math.min(baseA.length, baseB.length) <= 4 ? 1 : 2;
            const dist = levenshtein(baseA, baseB);
            if (dist > 0 && dist <= maxDist && Math.abs(baseA.length - baseB.length) <= 2) {
                score += 55;
                reasons.push(`Lookalike domain (${regDomain}) closely mimics official '${v.domain}' (${v.provider_name})`);
                break;
            }
        }
    }

    // 6. Brand keyword spoofing on unofficial domain (e.g., starhealth-renewal-offer.com)
    if (!verifiedMatch) {
        for (const brand of BRAND_KEYWORDS) {
            if (hostname.includes(brand)) {
                score += 45;
                reasons.push(`Brand impersonation risk: mentions '${brand}' on unverified domain '${regDomain}'`);
                break;
            }
        }
    }

    // 6b. Free site-builder / cloud-hosted claim or KYC phishing paths (e.g. sites.google.com/view/...)
    const PHISHING_HOST_PATTERNS = /(^|\.)(sites\.google\.com|blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|github\.io|netlify\.app|vercel\.app|pages\.dev|workers\.dev|glitch\.me)$/i;
    if (!verifiedMatch && PHISHING_HOST_PATTERNS.test(hostname)) {
        const pathAndCtx = `${lowerUrl} ${ctxLower}`;
        if (/(claim|kyc|refund|renewal|challan|vahan|policy|premium|irdai)/i.test(pathAndCtx)) {
            score += 35;
            urlScopedRisk = true;
            reasons.push(`Free cloud/site-builder host (${regDomain}) serving an insurance claim/KYC/refund lure`);
        }
    }

    // 7. Risky TLD / URL shorteners
    if (RISKY_TLDS.some((tld) => hostname.endsWith(tld))) {
        score += 30;
        reasons.push('High-risk / disposable top-level domain');
    }
    if (URL_SHORTENERS.includes(hostname) || URL_SHORTENERS.includes(regDomain)) {
        score += 25;
        urlScopedRisk = true;
        reasons.push(`URL shortener (${regDomain}) obscures final destination`);
    }

    const boundedScore = Math.min(100, Math.max(0, score));
    const status = boundedScore >= 60 ? 'threat' : boundedScore >= 25 ? 'suspicious' : 'safe';
    return { status, riskScore: boundedScore, reasons, verifiedProvider: verifiedMatch || null, urlScopedRisk };
};

const fetchRdapAgeDays = async (regDomain) => {
    if (!regDomain || isPrivateOrIpHost(regDomain)) return null;
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
        const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(regDomain)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/rdap+json' },
        });
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
    } finally {
        clearTimeout(timer);
    }
};

const queryVirusTotalDomain = async (regDomain) => {
    if (!env.VIRUSTOTAL_API_KEY || !regDomain || isPrivateOrIpHost(regDomain)) return null;
    if (!canCallVirusTotal()) {
        return { rateLimited: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
        vtCallTimestamps.push(Date.now());
        const resp = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(regDomain)}`, {
            signal: controller.signal,
            headers: { 'x-apikey': env.VIRUSTOTAL_API_KEY },
        });
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
    } finally {
        clearTimeout(timer);
    }
};

const checkUrlThreat = async ({
    rawUrl,
    sourceSurface = 'web',
    contextFlags = '',
    userId = null,
    allowExternalIntel = true,
    preloadedVerifiedDomains = null,
}) => {
    const cleanUrl = unwrapRedirectUrl(rawUrl);
    const hostname = extractHostname(cleanUrl);
    const safeUrl = sanitizeUrlForStorage(cleanUrl);
    const normalizedSurface = ['web', 'whatsapp', 'gmail', 'manual'].includes(sourceSurface) ? sourceSurface : 'web';

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
    const isPrivate = isPrivateOrIpHost(hostname);

    const verifiedPromise = preloadedVerifiedDomains
        ? Promise.resolve({ data: preloadedVerifiedDomains })
        : supabaseAdmin.from('verified_domains').select('*').eq('is_active', true);

    const [{ data: verifiedDomains }, { data: cachedScan }, { data: verifiedScam }] = await Promise.all([
        verifiedPromise,
        isPrivate ? Promise.resolve({ data: null }) : supabaseAdmin.from('site_scans').select('*').eq('domain', regDomain).maybeSingle(),
        isPrivate
            ? Promise.resolve({ data: null })
            : supabaseAdmin
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

    if (local.verifiedProvider && local.riskScore < 25) {
        return {
            url: safeUrl,
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
            url: safeUrl,
            domain: regDomain,
            status: 'threat',
            riskScore: 95,
            reasons: [`Admin-Verified Community Scam (${verifiedScam.category}): ${verifiedScam.description || 'Confirmed fraudulent URL'}`],
            vtStats: cachedScan?.vt_stats || {},
            rdapAgeDays: cachedScan?.rdap_age_days ?? null,
            cached: true,
        };
    }

    // Fresh domain-level cache hit merged cleanly with per-URL/page context signals
    if (cachedScan && new Date(cachedScan.expires_at) > new Date()) {
        const mergedScore = Math.max(cachedScan.risk_score || 0, local.riskScore);
        const mergedStatus = mergedScore >= 60 ? 'threat' : mergedScore >= 25 ? 'suspicious' : cachedScan.status;
        const mergedReasons = Array.from(new Set([...(cachedScan.reasons || []), ...local.reasons]));
        return {
            url: safeUrl,
            domain: regDomain,
            status: mergedStatus,
            riskScore: mergedScore,
            reasons: mergedReasons.length ? mergedReasons : ['No threat indicators cached'],
            verifiedProvider: local.verifiedProvider || null,
            vtStats: cachedScan.vt_stats || {},
            rdapAgeDays: cachedScan.rdap_age_days ?? null,
            cached: true,
        };
    }

    let score = local.riskScore;
    const reasons = [...local.reasons];
    let domainScore = 0;
    const domainReasons = [];
    let vtStats = {};
    let rdapAgeDays = null;

    if (allowExternalIntel && !isPrivate) {
        const [rdapResult, vtResult] = await Promise.all([
            fetchRdapAgeDays(regDomain),
            queryVirusTotalDomain(regDomain),
        ]);

        rdapAgeDays = rdapResult;
        if (rdapAgeDays !== null && rdapAgeDays < 60) {
            score += 35;
            domainScore += 35;
            const msg = `Newly registered domain (${rdapAgeDays} days old)`;
            reasons.push(msg);
            domainReasons.push(msg);
        }

        if (vtResult && !vtResult.rateLimited && !vtResult.errorStatus) {
            vtStats = vtResult;
            if (vtResult.malicious >= 2) {
                score = Math.max(score + 55, 80);
                domainScore = Math.max(domainScore + 55, 80);
                const msg = `VirusTotal flagged malicious by ${vtResult.malicious} security engines`;
                reasons.push(msg);
                domainReasons.push(msg);
            } else if (vtResult.malicious === 1 || vtResult.suspicious >= 2) {
                score += 35;
                domainScore += 35;
                const msg = `VirusTotal flagged suspicious (${vtResult.malicious} malicious, ${vtResult.suspicious} suspicious)`;
                reasons.push(msg);
                domainReasons.push(msg);
            }
        }
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const status = finalScore >= 60 ? 'threat' : finalScore >= 25 ? 'suspicious' : 'safe';
    if (reasons.length === 0 && status === 'safe') {
        reasons.push('No malicious flags found across local rules & threat checks');
    }

    // Persist ONLY domain-level reputation to site_scans (skip private/local IPs & avoid poisoning multi-tenant hosts with URL-scoped .apk/context signals)
    if (!isPrivate) {
        const cacheScore = local.urlScopedRisk ? domainScore : finalScore;
        const cacheStatus = cacheScore >= 60 ? 'threat' : cacheScore >= 25 ? 'suspicious' : 'safe';
        const cacheReasons = local.urlScopedRisk
            ? domainReasons.length ? domainReasons : ['Domain baseline clean']
            : reasons;

        const { error: upsertErr } = await supabaseAdmin.from('site_scans').upsert(
            {
                user_id: userId || cachedScan?.user_id || null,
                url: safeUrl,
                domain: regDomain,
                source_surface: normalizedSurface,
                status: cacheStatus,
                risk_score: cacheScore,
                reasons: cacheReasons,
                vt_stats: vtStats,
                rdap_age_days: rdapAgeDays,
                hit_count: (cachedScan?.hit_count || 0) + 1,
                last_scanned_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            },
            { onConflict: 'domain' }
        );
        if (upsertErr) logger.warn('Failed saving site_scans cache:', upsertErr.message);
    }

    return {
        url: safeUrl,
        domain: regDomain,
        status,
        riskScore: finalScore,
        reasons,
        verifiedProvider: local.verifiedProvider || null,
        vtStats,
        rdapAgeDays,
        cached: false,
    };
};

const batchCheckUrls = async ({ items = [], sourceSurface = 'web', userId = null }) => {
    const safeList = Array.isArray(items) ? items : [];
    const capped = safeList.slice(0, 25);
    const { data: verifiedDomains } = await supabaseAdmin.from('verified_domains').select('*').eq('is_active', true);

    const seenDomains = new Set();
    let externalCallsUsed = 0;
    const results = [];

    for (const item of capped) {
        const rawUrl = typeof item === 'string' ? item : item?.url;
        const contextFlags = typeof item === 'object' ? item?.contextFlags || '' : '';
        if (!rawUrl || typeof rawUrl !== 'string') continue;

        const host = extractHostname(rawUrl);
        const reg = getRegistrableDomain(host);
        const allowExternal = reg && !isPrivateOrIpHost(host) && !seenDomains.has(reg) && externalCallsUsed < 2;
        if (reg) seenDomains.add(reg);

        const verdict = await checkUrlThreat({
            rawUrl,
            sourceSurface,
            contextFlags,
            userId,
            allowExternalIntel: allowExternal,
            preloadedVerifiedDomains: verifiedDomains || [],
        });
        if (!verdict.cached && allowExternal) externalCallsUsed += 1;
        results.push({ ...verdict, requestedUrl: rawUrl });
    }

    return results;
};

module.exports = {
    unwrapRedirectUrl,
    extractHostname,
    getRegistrableDomain,
    sanitizeUrlForStorage,
    checkUrlThreat,
    batchCheckUrls,
    evaluateLocalSignals,
};
