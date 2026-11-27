const { URL, domainToUnicode } = require('url');
const net = require('net');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const stage1Engine = require('../utils/stage1Engine');

// Protect VirusTotal free quota: max 4 requests per rolling 60 seconds
const vtCallTimestamps = [];
const VT_MAX_PER_MIN = 4;

const MULTI_TENANT_HOSTS = new Set([
    'vercel.app', 'github.io', 'gitlab.io', 'netlify.app', 'pages.dev', 'web.app',
    'firebaseapp.com', 'blogspot.com', 'wordpress.com', 'herokuapp.com', 'onrender.com',
    'workers.dev', 'ngrok-free.app', 'trycloudflare.com', 'replit.app', 'webflow.io',
    'carrd.co', 'canva.site', 'forms.gle', 'lovable.app', 'notion.site', 'railway.app', 'fly.dev',
    'sites.google.com', 'drive.google.com', 'docs.google.com', 'script.google.com', 'storage.googleapis.com',
    'chat.whatsapp.com', 'bit.ly', 'tinyurl.com', 't.co', 'rb.gy', 'is.gd', 'cutt.ly',
    'rebrand.ly', 'shorturl.at', 'goo.gl', 'wa.link', 'ow.ly', 'buff.ly', 't.ly', 'lnkd.in',
]);

const SENSITIVITY_THRESHOLDS = {
    high: { threat: 45, suspicious: 15 },
    balanced: { threat: 60, suspicious: 25 },
    relaxed: { threat: 80, suspicious: 45 },
};

const resolveThresholds = (sensitivity = 'balanced') =>
    SENSITIVITY_THRESHOLDS[String(sensitivity || '').toLowerCase()] || SENSITIVITY_THRESHOLDS.balanced;

const DANGEROUS_FILE_EXTENSIONS = ['.apk', '.exe', '.scr', '.bat', '.cmd', '.vbs', '.ps1', '.msi', '.jar'];
const DANGEROUS_EXT_REGEX = /\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#|\s)/i;
const DOUBLE_EXT_REGEX = /\.[a-z0-9]{2,5}\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#|\s)/i;

const OFFICIAL_SAFE_BASELINE = {
    'google.com': 'Google',
    'google.co.in': 'Google India',
    'youtube.com': 'YouTube',
    'microsoft.com': 'Microsoft',
    'apple.com': 'Apple',
    'icloud.com': 'iCloud',
    'openai.com': 'OpenAI / ChatGPT',
    'chatgpt.com': 'ChatGPT',
    'anthropic.com': 'Anthropic',
    'claude.ai': 'Claude',
    'supabase.com': 'Supabase',
    'supabase.io': 'Supabase',
    'gitlab.com': 'GitLab',
    'github.com': 'GitHub',
    'vercel.com': 'Vercel',
    'netlify.com': 'Netlify',
    'cloudflare.com': 'Cloudflare',
    'puter.com': 'Puter',
    'stackoverflow.com': 'Stack Overflow',
    'linkedin.com': 'LinkedIn',
    'slack.com': 'Slack',
    'zoom.us': 'Zoom',
    'notion.so': 'Notion',
    'figma.com': 'Figma',
    'netflix.com': 'Netflix',
    'spotify.com': 'Spotify',
    'stripe.com': 'Stripe',
    'paypal.com': 'PayPal',
    'amazon.com': 'Amazon',
    'amazon.in': 'Amazon India',
    'flipkart.com': 'Flipkart',
    'hdfcbank.com': 'HDFC Bank',
    'icicibank.com': 'ICICI Bank',
    'sbi.co.in': 'State Bank of India',
    'onlinesbi.sbi': 'State Bank of India',
    'phonepe.com': 'PhonePe',
    'paytm.com': 'Paytm',
    'zerodha.com': 'Zerodha',
    'groww.in': 'Groww',
    'cred.club': 'CRED',
    'npci.org.in': 'NPCI',
    'uidai.gov.in': 'UIDAI Aadhaar',
    'incometax.gov.in': 'Income Tax India',
    'digilocker.gov.in': 'DigiLocker',
    'epfindia.gov.in': 'EPFO India',
    'irctc.co.in': 'IRCTC',
    'irctc.com': 'IRCTC',
    'starhealth.in': 'Star Health Insurance',
    'hdfcergo.com': 'HDFC ERGO',
    'hdfclife.com': 'HDFC Life',
    'hdfc.com': 'HDFC Bank',
    'icicilombard.com': 'ICICI Lombard',
    'iciciprulife.com': 'ICICI Prudential',
    'icicidirect.com': 'ICICI Direct',
    'licindia.in': 'LIC India',
    'bajajallianz.com': 'Bajaj Allianz',
    'bajajfinserv.in': 'Bajaj Finserv',
    'policybazaar.com': 'Policybazaar',
    'acko.com': 'Acko Insurance',
    'godigit.com': 'Go Digit Insurance',
    'tataaig.com': 'Tata AIG',
    'careinsurance.com': 'Care Health Insurance',
    'nivabupa.com': 'Niva Bupa Health',
    'irdai.gov.in': 'IRDAI',
    'parivahan.gov.in': 'Parivahan Sewa',
    'wa.me': 'WhatsApp Official',
    'whatsapp.com': 'WhatsApp Official',
    'kotak.com': 'Kotak Mahindra Bank',
    'axisbank.com': 'Axis Bank',
    'idfcfirstbank.com': 'IDFC FIRST Bank',
    'indusind.com': 'IndusInd Bank',
    'yesbank.in': 'Yes Bank',
    'canarabank.com': 'Canara Bank',
    'bankofbaroda.in': 'Bank of Baroda',
    'pnbindia.in': 'Punjab National Bank',
    'rbi.org.in': 'Reserve Bank of India',
    'sbicard.com': 'SBI Card',
    'paytmbank.com': 'Paytm Payments Bank',
    'razorpay.com': 'Razorpay',
    'upstox.com': 'Upstox',
    'fedex.com': 'FedEx Official',
    'bluedart.com': 'Blue Dart',
    'delhivery.com': 'Delhivery',
    'dhl.com': 'DHL Express',
    'indiapost.gov.in': 'India Post',
    'airtel.in': 'Airtel India',
    'airtel.com': 'Airtel',
    'jio.com': 'Reliance Jio',
    'bsnl.co.in': 'BSNL India',
    'bescom.co.in': 'BESCOM',
    'bescom.karnataka.gov.in': 'BESCOM Official',
    'zomato.com': 'Zomato',
    'swiggy.com': 'Swiggy',
    'myntra.com': 'Myntra',
    'meesho.com': 'Meesho',
    'docusign.com': 'DocuSign',
    'dropbox.com': 'Dropbox',
    'adobe.com': 'Adobe',
    'binance.com': 'Binance',
    'coinbase.com': 'Coinbase',
    'discord.com': 'Discord',
    'steampowered.com': 'Steam',
    'steamcommunity.com': 'Steam Community',
    'ebay.com': 'eBay',
    'ebay.in': 'eBay India',
    'wikipedia.org': 'Wikipedia',
    'mozilla.org': 'Mozilla',
    'npmjs.com': 'npm',
    'pypi.org': 'PyPI',
    'bing.com': 'Microsoft Bing',
    'duckduckgo.com': 'DuckDuckGo',
    'reddit.com': 'Reddit',
    'x.com': 'X (Twitter)',
    'twitter.com': 'X (Twitter)',
};

const isLoopbackDevHost = (hostname = '') => {
    const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
};

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
        const h = parsed.hostname.toLowerCase();
        if (
            (h.includes('google.') && parsed.pathname === '/url') ||
            h === 'l.whatsapp.com' ||
            h === 'l.wl.co' ||
            h === 'l.instagram.com' ||
            h === 'l.facebook.com' ||
            h === 'lm.facebook.com' ||
            h.endsWith('.safelinks.protection.outlook.com') ||
            (h === 't.me' && parsed.pathname === '/iv')
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

const hasUserInfoSpoof = (rawUrl = '') => {
    try {
        const stripped = String(rawUrl || '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
        const authority = stripped.split(/[/?#]/)[0] || '';
        return authority.includes('@');
    } catch {
        return false;
    }
};

const normalizeVisualLookalike = (label = '') =>
    String(label || '')
        .toLowerCase()
        .replace(/0/g, 'o')
        .replace(/1/g, 'l')
        .replace(/vv/g, 'w')
        .replace(/rn/g, 'm');

const normalizeLeetspeak = (text = '') =>
    String(text || '')
        .toLowerCase()
        .replace(/@/g, 'a')
        .replace(/0/g, 'o')
        .replace(/[1!|]/g, 'i')
        .replace(/\$/g, 's')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't');

const matchesDomainRuleList = (hostname = '', regDomain = '', list = []) => {
    if (!Array.isArray(list) || !list.length) return null;
    for (const rawEntry of list) {
        const entry = String(rawEntry || '')
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0];
        if (!entry) continue;
        if (hostname === entry || regDomain === entry || hostname.endsWith(`.${entry}`)) {
            return entry;
        }
    }
    return null;
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
    const lastThree = parts.slice(-3).join('.');
    if (MULTI_TENANT_HOSTS.has(lastThree)) {
        return parts.length >= 4 ? parts.slice(-4).join('.') : lastThree;
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
const BRAND_KEYWORDS = [
    'starhealth', 'hdfcergo', 'icicilombard', 'licindia', 'bajajallianz', 'policybazaar',
    'acko', 'godigit', 'tataaig', 'careinsurance', 'irdai', 'parivahan', 'echallan',
    'hdfcbank', 'icicibank', 'sbi', 'npci', 'uidai', 'aadhaar', 'paypal', 'amazon',
];

const evaluateLocalSignals = ({
    url,
    hostname,
    contextText = '',
    verifiedDomains = [],
    sensitivity = 'balanced',
    filename = '',
    whitelist = [],
    blacklist = [],
}) => {
    const reasons = [];
    const domainReasons = [];
    let score = 0;
    let domainRiskScore = 0;
    let urlScopedRisk = false;
    let threatCategory = 'safe';
    const thresholds = resolveThresholds(sensitivity);
    const lowerUrl = String(url || '').toLowerCase();
    const lowerFilename = String(filename || '').toLowerCase().trim();
    const regDomain = getRegistrableDomain(hostname);
    const unicodeDomain = (domainToUnicode(hostname) || hostname).toLowerCase();
    const ctxLower = String(contextText || '').toLowerCase();
    const ctxLeet = normalizeLeetspeak(contextText);

    const setCategory = (cat) => {
        if (threatCategory === 'safe' || cat === 'apk_malware' || cat === 'upi_scam' || ((cat === 'otp_phishing' || cat === 'otp_upi_fraud') && threatCategory === 'phishing_kyc')) {
            threatCategory = cat;
        }
    };

    // 0. User custom blacklist (exact host/registrable domain match, never naive substring)
    const blacklistedMatch = matchesDomainRuleList(hostname, regDomain, blacklist);
    if (blacklistedMatch) {
        score += 85;
        domainRiskScore += 85;
        setCategory('phishing');
        const msg = `Blocked by user custom blacklist rule (${blacklistedMatch})`;
        reasons.push(msg);
        domainReasons.push(msg);
    }

    // 1. Critical URL-level '@' authentication spoofing (runs BEFORE verified whitelist)
    if (hasUserInfoSpoof(url)) {
        score += 75;
        urlScopedRisk = true;
        setCategory('phishing');
        reasons.push(`CRITICAL: '@' authentication spoofing in URL hides real destination host (${hostname})`);
    }

    // 2. Dangerous executables (.apk, .exe, .ps1, etc.) & double-extension disguises BEFORE whitelist
    const payloadTarget = `${lowerUrl} ${lowerFilename}`.trim();
    const isDoubleExt = DOUBLE_EXT_REGEX.test(payloadTarget);
    const extMatch = payloadTarget.match(DANGEROUS_EXT_REGEX);
    if (extMatch || /contains_apk/i.test(ctxLower)) {
        const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.apk';
        score += isDoubleExt ? 85 : 75;
        urlScopedRisk = true;
        setCategory('apk_malware');
        if (isDoubleExt) {
            reasons.push(`CRITICAL: Double-extension malware disguise detected (${ext}) — attackers fake PDFs/images to install malware`);
        } else if (ext === '.apk') {
            reasons.push('CRITICAL: Direct .apk Android malware payload detected — insurers and banks never send APK installers');
        } else {
            reasons.push(`CRITICAL: Dangerous executable payload (${ext}) detected in link or attachment`);
        }
    }

    // 3. Stage-1 Multilingual AI Classifier + Leetspeak Scam NLP (with negated advisory & benign dev/OTP guard)
    const stage1 = contextText ? stage1Engine.scoreMessage(contextText) : { score: 0, verdict: 'SAFE', category: 'safe', reasons: [], signals: [], entities: {} };
    const isNegatedSecurityAdvisory =
        /\b(never|do\s+not|don'?t|not\s+to|avoid|refuse)\b.{0,22}\b(share|send|tell|give|forward|disclose|enter)\b.{0,25}\b(otp|upi\s*pin|pin|password|cvv)\b/i.test(ctxLeet) ||
        (stage1.score < 20 && (stage1.signals || []).some((s) => s.signal === 'protective_advice' || s.signal === 'otp_delivery'));

    if (stage1.score >= 30) {
        score = Math.max(score, Math.round(stage1.score));
        urlScopedRisk = true;
        setCategory(stage1.category);
        (stage1.reasons || []).slice(0, 3).forEach((r) => reasons.push(r));
    }

    if (!isNegatedSecurityAdvisory && /enter.*upi\s*pin.*receiv|upi\s*pin.*refund|collect\s*request.*claim|kyc.*update\.apk|reverse.?upi|pay.*pin.*to.*receiv/i.test(ctxLeet)) {
        score += 65;
        urlScopedRisk = true;
        setCategory('upi_scam');
        reasons.push('CRITICAL: Reverse-UPI refund / fake KYC scam pattern detected');
    } else if (!isNegatedSecurityAdvisory && /(share|send|tell|give|forward|enter|verify).{0,25}\botp\b|\botp\b.{0,20}(expire|block|suspend|verif|urgent|secret)/i.test(ctxLeet)) {
        score += 65;
        urlScopedRisk = true;
        setCategory('otp_phishing');
        reasons.push('CRITICAL: OTP / 2FA credential theft lure detected in message text');
    } else if (/(bank|account|kyc|policy|pan|aadhaar|card).{0,25}(block|suspend|deactivat|freeze|terminat|expire|update\s*urgent)/i.test(ctxLeet)) {
        score += 45;
        urlScopedRisk = true;
        setCategory('phishing');
        reasons.push('Bank/Policy KYC suspension & account freeze scare tactic detected');
    } else if (/urgent.*policy.*suspend|expire.*today.*pay|claim\s*bonus.*click|vahan|e-?challan|payment\/otp|anydesk|teamviewer|quicksupport/i.test(ctxLeet)) {
        score += 40;
        urlScopedRisk = true;
        setCategory(/anydesk|teamviewer|quicksupport/i.test(ctxLeet) ? 'tech_support' : 'phishing');
        reasons.push('Suspicious urgency, remote-access tool, or payment/challan lure detected');
    } else if (/(won|winner|claimed|prize|lottery|jackpot|guaranteed\s*profit|airdrop|double\s*your\s*(money|crypto|btc))/i.test(ctxLeet)) {
        score += 40;
        urlScopedRisk = true;
        setCategory('lottery_scam');
        reasons.push('Lottery / guaranteed financial reward scam pattern detected');
    }

    // 4. Local loopback vs raw IP host handling (loopback clean unless critical payload/scam matched above)
    if (isPrivateOrIpHost(hostname)) {
        if (isLoopbackDevHost(hostname) && score < thresholds.suspicious) {
            return {
                status: 'safe',
                riskScore: 0,
                domainRiskScore: 0,
                threatCategory: 'safe',
                reasons: ['Local development address'],
                domainReasons: [],
                verifiedProvider: null,
                urlScopedRisk: true,
            };
        }
        if (!isLoopbackDevHost(hostname)) {
            score += 50;
            urlScopedRisk = true;
            setCategory('phishing');
            reasons.push('Direct IP address host obscures identity and commonly indicates raw phishing infrastructure');
        }
    }

    // 5. Verified Registry + Official Baseline + Custom Whitelist (exempts benign Stage1 keyword hits unless a CRITICAL threat or blacklist fired)
    const verifiedMatch = (verifiedDomains || []).find((v) => regDomain === v.domain || hostname === v.domain);
    const officialBaselineName = OFFICIAL_SAFE_BASELINE[regDomain] || OFFICIAL_SAFE_BASELINE[hostname] || null;
    const customWhitelisted = matchesDomainRuleList(hostname, regDomain, whitelist);
    const hasCriticalLure =
        Boolean(blacklistedMatch) ||
        reasons.some((r) => r.startsWith('CRITICAL:')) ||
        /\b(anydesk|teamviewer|quicksupport|rustdesk)\b/i.test(ctxLeet);

    if ((verifiedMatch || officialBaselineName || customWhitelisted) && !hasCriticalLure) {
        const provider = verifiedMatch || (officialBaselineName
            ? { domain: regDomain, provider_name: officialBaselineName, category: 'verified_brand' }
            : { domain: regDomain, provider_name: `User Whitelist (${customWhitelisted})`, category: 'user_whitelist' });
        return {
            status: 'safe',
            riskScore: 5,
            domainRiskScore: 5,
            threatCategory: 'safe',
            reasons: [`Verified ${provider.category}: ${provider.provider_name}`],
            domainReasons: [`Verified ${provider.category}: ${provider.provider_name}`],
            verifiedProvider: provider,
            urlScopedRisk: false,
        };
    }

    // 6. HTTP / Non-HTTPS on insurance or payment link
    if (lowerUrl.startsWith('http://')) {
        score += 25;
        urlScopedRisk = true;
        reasons.push('Unencrypted HTTP link (no TLS/HTTPS)');
    }

    // 7. Zero-width invisible chars, mixed Cyrillic/Greek homoglyphs & Punycode (xn--)
    const hasZeroWidth = /[\u200B-\u200D\uFEFF]/.test(`${url} ${unicodeDomain}`);
    const hasMixedUnicodeScript =
        /[a-zA-Z]/.test(unicodeDomain) && (/[\u0400-\u04FF]/.test(unicodeDomain) || /[\u0370-\u03FF]/.test(unicodeDomain));

    if (hasZeroWidth) {
        score += 45;
        domainRiskScore += 45;
        setCategory('phishing');
        const msg = 'Zero-width invisible spoofing characters detected in URL or domain';
        reasons.push(msg);
        domainReasons.push(msg);
    }
    if (hasMixedUnicodeScript) {
        score += 60;
        domainRiskScore += 60;
        setCategory('impersonation');
        const msg = `Homoglyph spoofing: mixed Unicode script (Cyrillic/Greek lookalike) detected in '${unicodeDomain}'`;
        reasons.push(msg);
        domainReasons.push(msg);
    } else if (hostname.includes('xn--')) {
        score += 45;
        domainRiskScore += 45;
        setCategory('impersonation');
        const msg = `Punycode/IDN homoglyph domain detected (${unicodeDomain})`;
        reasons.push(msg);
        domainReasons.push(msg);
    }

    // 8. Lookalike typosquatting & visual confusable substitution (0->o, 1->l, vv->w, rn->m)
    if (!verifiedMatch && !officialBaselineName && !isPrivateOrIpHost(hostname)) {
        const baseA = regDomain.split('.')[0] || '';
        const visualA = normalizeVisualLookalike(baseA);
        const candidates = [
            ...(verifiedDomains || []).map((v) => ({ domain: v.domain, label: v.provider_name })),
            ...Object.entries(OFFICIAL_SAFE_BASELINE).map(([domain, label]) => ({ domain, label })),
        ];
        for (const cand of candidates) {
            const baseB = String(cand.domain || '').split('.')[0];
            if (!baseB) continue;
            const visualB = normalizeVisualLookalike(baseB);
            if (visualA === visualB && baseA !== baseB) {
                score += 60;
                domainRiskScore += 60;
                setCategory('impersonation');
                const msg = `Visual homoglyph substitution (${regDomain}) mimics official '${cand.domain}' (${cand.label})`;
                reasons.push(msg);
                domainReasons.push(msg);
                break;
            }
            // Skip fuzzy edit distance on short 3-4 letter acronym domains (e.g. sbi/acko) to avoid false positives on rbi/abi/ski
            if (baseB.length < 5) continue;
            const maxDist = baseB.length <= 6 ? 1 : 2;
            const dist = levenshtein(baseA, baseB);
            if (dist > 0 && dist <= maxDist && Math.abs(baseA.length - baseB.length) <= 2) {
                score += 55;
                domainRiskScore += 55;
                setCategory('impersonation');
                const msg = `Lookalike domain (${regDomain}) closely mimics official '${cand.domain}' (${cand.label})`;
                reasons.push(msg);
                domainReasons.push(msg);
                break;
            }
        }
    }

    // 9. Token-aware brand keyword spoofing on unofficial domain (prevents substring false positives like "stackoverflow" -> "acko")
    const AMBIGUOUS_BRAND_TOKENS = new Set(['apple', 'amazon', 'chase', 'steam', 'office365', 'discord', 'yahoo', 'dropbox', 'ebay', 'roblox', 'whatsapp', 'facebook', 'instagram', 'linkedin', 'telegram']);
    const LURE_TOKENS_RE = /\b(kyc|verify|verification|update|login|signin|sign-in|secure|security|support|refund|claim|billing|pay|payment|alert|account|wallet|bonus|reward|unlock|suspend|suspended|helpdesk|parcel|customs|otp|challan|renew|renewal|apk|app)\b/i;

    const isOfficialForBrand = (brandKey) => {
        const officialList = stage1Engine.BRANDS?.[brandKey];
        if (!Array.isArray(officialList)) return false;
        return officialList.some((d) => hostname === d || regDomain === d || hostname.endsWith(`.${d}`));
    };

    if (!verifiedMatch && !officialBaselineName && !isPrivateOrIpHost(hostname)) {
        const hostTokens = hostname.split(/[.-]/).filter(Boolean);
        let brandSpoofFound = null;

        for (const brand of BRAND_KEYWORDS) {
            const matchedBrand = brand.length >= 7 ? hostname.includes(brand) : hostTokens.includes(brand);
            if (matchedBrand && !isOfficialForBrand(brand)) {
                brandSpoofFound = brand;
                break;
            }
        }

        if (!brandSpoofFound && stage1Engine.BRANDS) {
            const lureInHostOrUrl = LURE_TOKENS_RE.test(`${hostname.replace(/[.-]/g, ' ')} ${lowerUrl}`);
            for (const [brandKey, officialDomains] of Object.entries(stage1Engine.BRANDS)) {
                if (!brandKey || brandKey.length < 3 || brandKey === 'gov' || !Array.isArray(officialDomains) || officialDomains.length === 0) continue;
                const tokenMatched = hostTokens.includes(brandKey) || (brandKey.length >= 6 && hostname.includes(brandKey));
                if (!tokenMatched) continue;
                if (isOfficialForBrand(brandKey)) continue;
                if (AMBIGUOUS_BRAND_TOKENS.has(brandKey) && !lureInHostOrUrl) continue;
                brandSpoofFound = brandKey;
                break;
            }
        }

        if (brandSpoofFound) {
            const lurePaired = LURE_TOKENS_RE.test(`${hostname.replace(/[.-]/g, ' ')} ${lowerUrl}`);
            const pts = lurePaired ? 60 : 45;
            score += pts;
            domainRiskScore += pts;
            setCategory('impersonation');
            const msg = `Brand impersonation risk: mentions '${brandSpoofFound}' on unverified domain '${regDomain}'`;
            reasons.push(msg);
            domainReasons.push(msg);
        }
    }

    // 10. Free site-builder / cloud-hosted claim or KYC phishing paths (including EXT KAV free hosting hosts)
    const PHISHING_HOST_PATTERNS = /(^|\.)(sites\.google\.com|blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|github\.io|netlify\.app|vercel\.app|pages\.dev|workers\.dev|glitch\.me|carrd\.co|webflow\.io|canva\.site|lovable\.app|forms\.gle|notion\.site|ngrok-free\.app|trycloudflare\.com)$/i;
    const isExtendedFreeHost = Array.isArray(stage1Engine.FREE_HOSTING) && stage1Engine.FREE_HOSTING.some((fh) => hostname === fh || hostname.endsWith(`.${fh}`));
    if (!verifiedMatch && !officialBaselineName && (PHISHING_HOST_PATTERNS.test(hostname) || isExtendedFreeHost)) {
        const pathAndCtx = `${lowerUrl} ${ctxLeet}`;
        if (/(claim|kyc|refund|renewal|challan|vahan|policy|premium|irdai|otp|verify|login|signin|wallet|aadhaar|pan|reward|customs)/i.test(pathAndCtx)) {
            score += 35;
            urlScopedRisk = true;
            setCategory('phishing');
            reasons.push(`Free cloud/site-builder host (${regDomain}) serving a claim/KYC/login lure`);
        }
    }

    // 11. Extended Risky TLDs / URL shorteners (including EXT KAV 72 risky TLDs + 32 shorteners)
    const tldSuffix = regDomain.split('.').pop();
    const isExtendedRiskyTld =
        RISKY_TLDS.some((tld) => hostname.endsWith(tld)) ||
        (tldSuffix && stage1Engine.RISKY_TLDS.includes(tldSuffix) && !verifiedMatch && !officialBaselineName);
    if (isExtendedRiskyTld) {
        score += 30;
        domainRiskScore += 30;
        setCategory('phishing');
        const msg = `High-risk / disposable top-level domain (.${tldSuffix})`;
        reasons.push(msg);
        domainReasons.push(msg);
    }
    const isShortenerHost =
        URL_SHORTENERS.includes(hostname) ||
        URL_SHORTENERS.includes(regDomain) ||
        stage1Engine.SHORTENERS.includes(regDomain) ||
        ['wa.link', 'l.wl.co'].includes(regDomain);
    if (isShortenerHost) {
        score += 25;
        urlScopedRisk = true;
        setCategory('suspicious');
        reasons.push(`URL shortener (${regDomain}) obscures final destination`);
    }

    const boundedScore = Math.min(100, Math.max(0, score));
    const boundedDomainScore = Math.min(100, Math.max(0, domainRiskScore));
    const status = boundedScore >= thresholds.threat ? 'threat' : boundedScore >= thresholds.suspicious ? 'suspicious' : 'safe';
    if (status === 'suspicious' && threatCategory === 'safe') threatCategory = 'suspicious';
    if (status === 'safe') threatCategory = 'safe';

    return {
        status,
        riskScore: boundedScore,
        domainRiskScore: boundedDomainScore,
        threatCategory,
        reasons,
        domainReasons,
        verifiedProvider: verifiedMatch || (officialBaselineName ? { domain: regDomain, provider_name: officialBaselineName, category: 'verified_brand' } : null),
        urlScopedRisk,
    };
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

const getResearchCache = async (cacheKey) => {
    try {
        const { data } = await supabaseAdmin
            .from('research_cache')
            .select('result_json')
            .eq('cache_key', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        return data?.result_json || null;
    } catch {
        return null;
    }
};

const setResearchCache = async (cacheKey, source, query, resultJson, ttlHours = 6) => {
    try {
        await supabaseAdmin.from('research_cache').upsert(
            {
                cache_key: cacheKey,
                source,
                query: String(query || '').slice(0, 500),
                result_json: resultJson,
                expires_at: new Date(Date.now() + ttlHours * 3600 * 1000).toISOString(),
            },
            { onConflict: 'cache_key' }
        );
    } catch {
        // Ignore cache write failures cleanly (including test mocks)
    }
};

const isShortenerDomain = (hostname = '', regDomain = '') => {
    const h = String(hostname || '').toLowerCase();
    const r = String(regDomain || '').toLowerCase();
    return Boolean(
        URL_SHORTENERS.includes(h) ||
        URL_SHORTENERS.includes(r) ||
        stage1Engine.SHORTENERS?.includes(r) ||
        ['wa.link', 'l.wl.co', 'bitly.com', 't.co'].includes(r)
    );
};

// SSRF-safe async HTTP redirect expander for URL shorteners (bit.ly, tinyurl, t.co, rb.gy, etc.)
const resolveShortUrlAsync = async (rawUrl, maxHops = 3) => {
    const initialHost = extractHostname(rawUrl);
    const initialReg = getRegistrableDomain(initialHost);
    if (!initialHost || isPrivateOrIpHost(initialHost) || !isShortenerDomain(initialHost, initialReg)) {
        return { finalUrl: rawUrl, expanded: false, hops: 0 };
    }

    const cacheKey = `short_${Buffer.from(String(rawUrl).slice(0, 300)).toString('base64url').slice(0, 120)}`;
    const cached = await getResearchCache(cacheKey);
    if (cached?.finalUrl) {
        return cached;
    }

    let currentUrl = rawUrl;
    let hops = 0;

    for (let i = 0; i < maxHops; i++) {
        let parsed;
        try {
            parsed = new URL(currentUrl);
        } catch {
            break;
        }
        if (!/^https?:$/i.test(parsed.protocol)) break;
        const hopHost = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (isPrivateOrIpHost(hopHost)) break;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        let nextLoc = '';
        try {
            let resp = await fetch(currentUrl, {
                method: 'HEAD',
                redirect: 'manual',
                signal: controller.signal,
                headers: { 'User-Agent': 'PolicyGuard-Shield/2.1' },
            });
            if (resp.status === 405 || resp.status === 403 || resp.status === 501) {
                resp = await fetch(currentUrl, {
                    method: 'GET',
                    redirect: 'manual',
                    signal: controller.signal,
                    headers: { 'User-Agent': 'PolicyGuard-Shield/2.1' },
                });
                if (resp.body && typeof resp.body.cancel === 'function') {
                    resp.body.cancel().catch(() => {});
                }
            }
            if (resp.status >= 300 && resp.status < 400) {
                const loc = resp.headers.get('location');
                if (loc) {
                    const resolved = new URL(loc, currentUrl);
                    const nextHost = resolved.hostname.toLowerCase().replace(/^www\./, '');
                    if (/^https?:$/i.test(resolved.protocol) && !isPrivateOrIpHost(nextHost)) {
                        nextLoc = resolved.href;
                    }
                }
            }
        } catch {
            break;
        } finally {
            clearTimeout(timer);
        }

        if (!nextLoc || nextLoc === currentUrl) break;
        currentUrl = unwrapRedirectUrl(nextLoc);
        hops += 1;

        const nextReg = getRegistrableDomain(extractHostname(currentUrl));
        if (!isShortenerDomain(extractHostname(currentUrl), nextReg)) break;
    }

    const result = {
        finalUrl: currentUrl,
        expanded: hops > 0 && currentUrl !== rawUrl,
        hops,
    };
    await setResearchCache(cacheKey, 'shortener', rawUrl, result, 6);
    return result;
};

const parseVtResponse = (json) => {
    const attrs = json?.data?.attributes || {};
    const stats = attrs.last_analysis_stats || {};
    const results = attrs.last_analysis_results || {};
    const flaggedBy = Object.entries(results)
        .filter(([, entry]) => entry && (entry.category === 'malicious' || entry.category === 'suspicious'))
        .slice(0, 6)
        .map(([vendor, entry]) => ({
            vendor,
            category: entry.category,
            result: entry.result || entry.category,
        }));
    return {
        malicious: Number(stats.malicious || 0),
        suspicious: Number(stats.suspicious || 0),
        harmless: Number(stats.harmless || 0),
        undetected: Number(stats.undetected || 0),
        reputation: Number(attrs.reputation || 0),
        totalVendors: Object.keys(results).length,
        flaggedBy,
    };
};

const queryVirusTotalDomain = async (regDomain) => {
    if (!env.VIRUSTOTAL_API_KEY || !regDomain || isPrivateOrIpHost(regDomain)) return null;
    const cacheKey = `vt_dom_${regDomain}`;
    const cached = await getResearchCache(cacheKey);
    if (cached && cached.totalVendors !== undefined) return cached;

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
        const parsed = parseVtResponse(await resp.json());
        await setResearchCache(cacheKey, 'virustotal_domain', regDomain, parsed, 2);
        return parsed;
    } catch (err) {
        logger.warn('VirusTotal domain check error:', err.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
};

const queryVirusTotalUrl = async (targetUrl) => {
    if (!env.VIRUSTOTAL_API_KEY || !targetUrl) return null;
    const host = extractHostname(targetUrl);
    if (!host || isPrivateOrIpHost(host)) return null;

    const vtId = Buffer.from(targetUrl).toString('base64url');
    const cacheKey = `vt_url_${vtId.slice(0, 120)}`;
    const cached = await getResearchCache(cacheKey);
    if (cached && cached.totalVendors !== undefined) return cached;

    if (!canCallVirusTotal()) {
        return { rateLimited: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
        vtCallTimestamps.push(Date.now());
        const resp = await fetch(`https://www.virustotal.com/api/v3/urls/${vtId}`, {
            signal: controller.signal,
            headers: { 'x-apikey': env.VIRUSTOTAL_API_KEY },
        });
        if (!resp.ok) {
            return { errorStatus: resp.status };
        }
        const parsed = parseVtResponse(await resp.json());
        await setResearchCache(cacheKey, 'virustotal_url', sanitizeUrlForStorage(targetUrl), parsed, 2);
        return parsed;
    } catch (err) {
        logger.warn('VirusTotal URL check error:', err.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
};

const queryUrlhaus = async (targetUrl, regDomain) => {
    if (!targetUrl || !regDomain || isPrivateOrIpHost(regDomain)) return null;
    const cacheKey = `uh_url_${Buffer.from(String(targetUrl).slice(0, 260)).toString('base64url').slice(0, 110)}`;
    const cached = await getResearchCache(cacheKey);
    if (cached !== null) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
        const resp = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ url: targetUrl }).toString(),
        });
        if (!resp.ok) return null;
        const json = await resp.json();
        const result =
            json?.query_status === 'ok'
                ? { listed: true, threat: json.threat || 'malware_download', urlStatus: json.url_status || 'online', tags: Array.isArray(json.tags) ? json.tags.slice(0, 5) : [] }
                : { listed: false };
        await setResearchCache(cacheKey, 'urlhaus', sanitizeUrlForStorage(targetUrl), result, 3);
        return result;
    } catch {
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
    sensitivity = 'balanced',
    filename = '',
    whitelist = [],
    blacklist = [],
}) => {
    const initialUrl = unwrapRedirectUrl(rawUrl);
    const initialHost = extractHostname(initialUrl);
    const thresholds = resolveThresholds(sensitivity);
    const VALID_CHECK_SURFACES = ['web', 'whatsapp', 'gmail', 'outlook', 'telegram', 'instagram', 'manual'];
    const normalizedSurface = VALID_CHECK_SURFACES.includes(sourceSurface) ? sourceSurface : 'web';

    if (!initialHost) {
        return {
            url: rawUrl,
            domain: '',
            status: 'suspicious',
            riskScore: 40,
            threatCategory: 'suspicious',
            sourceSurface: normalizedSurface,
            reasons: ['Malformed or non-standard link format'],
            vtStats: {},
            rdapAgeDays: null,
        };
    }

    const initialRegDomain = getRegistrableDomain(initialHost);
    let cleanUrl = initialUrl;
    let hostname = initialHost;
    let regDomain = initialRegDomain;
    let expandedFrom = '';

    if (allowExternalIntel && isShortenerDomain(initialHost, initialRegDomain)) {
        const resolved = await resolveShortUrlAsync(initialUrl);
        if (resolved.expanded && resolved.finalUrl) {
            const destHost = extractHostname(resolved.finalUrl);
            if (destHost) {
                expandedFrom = initialRegDomain;
                cleanUrl = resolved.finalUrl;
                hostname = destHost;
                regDomain = getRegistrableDomain(destHost);
            }
        }
    }

    const safeUrl = sanitizeUrlForStorage(cleanUrl);
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
        sensitivity,
        filename,
        whitelist,
        blacklist,
    });

    if (expandedFrom && hostname !== initialHost) {
        local.reasons.unshift(`Shortener (${expandedFrom}) expanded to ${regDomain || hostname}`);
    }

    if (local.verifiedProvider && local.riskScore < thresholds.suspicious) {
        if (normalizedSurface === 'manual' && !isPrivate) {
            const { error: manualUpsertErr } = await supabaseAdmin.from('site_scans').upsert(
                {
                    user_id: userId || cachedScan?.user_id || null,
                    url: safeUrl,
                    domain: regDomain,
                    source_surface: 'manual',
                    status: 'safe',
                    risk_score: 5,
                    reasons: local.reasons,
                    vt_stats: cachedScan?.vt_stats || {},
                    rdap_age_days: cachedScan?.rdap_age_days ?? null,
                    hit_count: (cachedScan?.hit_count || 0) + 1,
                    last_scanned_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                },
                { onConflict: 'domain' }
            );
            if (manualUpsertErr) logger.warn('Failed saving manual safe scan:', manualUpsertErr.message);
        }
        return {
            url: safeUrl,
            domain: regDomain,
            status: 'safe',
            riskScore: 5,
            threatCategory: 'safe',
            sourceSurface: normalizedSurface,
            reasons: local.reasons,
            verifiedProvider: local.verifiedProvider,
            vtStats: cachedScan?.vt_stats || {},
            rdapAgeDays: cachedScan?.rdap_age_days ?? null,
            cached: normalizedSurface !== 'manual',
            expandedFrom: expandedFrom || undefined,
        };
    }

    if (verifiedScam) {
        return {
            url: safeUrl,
            domain: regDomain,
            status: 'threat',
            riskScore: 95,
            threatCategory: verifiedScam.category || 'phishing',
            sourceSurface: normalizedSurface,
            reasons: [`Admin-Verified Community Scam (${verifiedScam.category}): ${verifiedScam.description || 'Confirmed fraudulent URL'}`],
            vtStats: cachedScan?.vt_stats || {},
            rdapAgeDays: cachedScan?.rdap_age_days ?? null,
            cached: true,
            expandedFrom: expandedFrom || undefined,
        };
    }

    const cacheHasResearch =
        Boolean(cachedScan?.vt_stats && Number(cachedScan.vt_stats.totalVendors || 0) > 0) ||
        cachedScan?.rdap_age_days !== null;
    const isMultiTenant = MULTI_TENANT_HOSTS.has(regDomain) || local.urlScopedRisk;

    // Only reuse fresh domain cache if it actually contains threat intel OR external intel is disabled / not needed
    if (
        cachedScan &&
        new Date(cachedScan.expires_at) > new Date() &&
        !expandedFrom &&
        !isMultiTenant &&
        (cacheHasResearch || cachedScan.status !== 'safe' || !allowExternalIntel)
    ) {
        const mergedScore = Math.max(cachedScan.risk_score || 0, local.riskScore);
        const mergedStatus = mergedScore >= thresholds.threat ? 'threat' : mergedScore >= thresholds.suspicious ? 'suspicious' : cachedScan.status;
        const mergedReasons = Array.from(new Set([...(cachedScan.reasons || []), ...local.reasons]));
        return {
            url: safeUrl,
            domain: regDomain,
            status: mergedStatus,
            riskScore: mergedScore,
            threatCategory: local.threatCategory !== 'safe' ? local.threatCategory : (mergedStatus === 'safe' ? 'safe' : 'phishing'),
            sourceSurface: normalizedSurface,
            reasons: mergedReasons.length ? mergedReasons : ['No threat indicators cached'],
            verifiedProvider: local.verifiedProvider || null,
            vtStats: cachedScan.vt_stats || {},
            rdapAgeDays: cachedScan.rdap_age_days ?? null,
            cached: true,
        };
    }

    let score = local.riskScore;
    const reasons = [...local.reasons];
    let domainScore = local.domainRiskScore || 0;
    const domainReasons = [...(local.domainReasons || [])];
    let vtStats = {};
    let rdapAgeDays = null;
    let externalIntelCompleted = false;

    if (allowExternalIntel && !isPrivate) {
        const isShort = isShortenerDomain(hostname, regDomain);
        const isMulti = MULTI_TENANT_HOSTS.has(regDomain) || isShort;
        const shouldCheckVtUrl =
            isMultiTenant ||
            Boolean(expandedFrom) ||
            isShort ||
            (cleanUrl.includes('/') && new URL(cleanUrl).pathname.length > 1);

        // On multi-tenant / shortener domains, avoid apex VT domain noise (e.g. bit.ly / sites.google.com) and check exact full URL instead
        const [rdapResult, vtDomainRes, vtUrlRes, urlhausRes] = await Promise.all([
            isMulti ? Promise.resolve(null) : fetchRdapAgeDays(regDomain),
            isMulti ? Promise.resolve(null) : queryVirusTotalDomain(regDomain),
            shouldCheckVtUrl ? queryVirusTotalUrl(cleanUrl) : Promise.resolve(null),
            queryUrlhaus(cleanUrl, regDomain),
        ]);

        rdapAgeDays = rdapResult;
        if (rdapAgeDays !== null) externalIntelCompleted = true;
        if (rdapAgeDays !== null && rdapAgeDays < 60) {
            score += 35;
            domainScore += 35;
            const msg = `Newly registered domain (${rdapAgeDays} days old)`;
            reasons.push(msg);
            domainReasons.push(msg);
        }

        if (urlhausRes?.listed) {
            externalIntelCompleted = true;
            score = Math.max(score + 70, 90);
            urlScopedRisk = urlScopedRisk || isMultiTenant;
            const msg = `URLhaus active malware/phishing feed (${urlhausRes.threat || 'listed'})`;
            reasons.unshift(msg);
            if (!isMultiTenant) domainReasons.unshift(msg);
        }

        const pickMoreSevereVt = (a, b) => {
            const validA = a && !a.rateLimited && !a.errorStatus ? a : null;
            const validB = b && !b.rateLimited && !b.errorStatus ? b : null;
            if (!validA) return validB;
            if (!validB) return validA;
            const sevA = validA.malicious * 10 + validA.suspicious;
            const sevB = validB.malicious * 10 + validB.suspicious;
            return sevB > sevA ? validB : validA;
        };

        const vtResult = pickMoreSevereVt(vtDomainRes, vtUrlRes);
        if (vtResult) {
            externalIntelCompleted = true;
            vtStats = vtResult;
            if (vtResult.malicious >= 2) {
                score = Math.max(score + 55, 80);
                if (!isMultiTenant) domainScore = Math.max(domainScore + 55, 80);
                const msg = `VirusTotal flagged malicious by ${vtResult.malicious} security engines`;
                reasons.push(msg);
                if (!isMultiTenant) domainReasons.push(msg);
            } else if (vtResult.malicious === 1 || vtResult.suspicious >= 2) {
                score += 35;
                if (!isMultiTenant) domainScore += 35;
                const msg = `VirusTotal flagged suspicious (${vtResult.malicious} malicious, ${vtResult.suspicious} suspicious)`;
                reasons.push(msg);
                if (!isMultiTenant) domainReasons.push(msg);
            }
        }
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const status = finalScore >= thresholds.threat ? 'threat' : finalScore >= thresholds.suspicious ? 'suspicious' : 'safe';
    const finalCategory =
        local.threatCategory && local.threatCategory !== 'safe'
            ? local.threatCategory
            : status === 'safe'
              ? 'safe'
              : vtStats?.malicious >= 2
                ? 'malware_vt'
                : 'phishing';
    if (reasons.length === 0 && status === 'safe') {
        reasons.push('No malicious flags found across local rules & threat checks');
    }

    // Persist domain-level reputation to site_scans ONLY when research ran or a real threat/suspicious signal was observed
    if (!isPrivate && (externalIntelCompleted || status !== 'safe')) {
        const cacheScore = Math.min(100, Math.max(0, local.urlScopedRisk ? domainScore : finalScore));
        const cacheStatus = cacheScore >= thresholds.threat ? 'threat' : cacheScore >= thresholds.suspicious ? 'suspicious' : 'safe';
        const cacheReasons = local.urlScopedRisk
            ? domainReasons.length ? domainReasons : ['Domain baseline clean']
            : reasons;

        const ttlMs = externalIntelCompleted ? 24 * 3600 * 1000 : 15 * 60 * 1000;
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
                expires_at: new Date(Date.now() + ttlMs).toISOString(),
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
        threatCategory: finalCategory,
        sourceSurface: normalizedSurface,
        reasons,
        verifiedProvider: local.verifiedProvider || null,
        vtStats,
        rdapAgeDays,
        cached: false,
        researched: externalIntelCompleted,
        expandedFrom: expandedFrom || undefined,
    };
};

const batchCheckUrls = async ({ items = [], sourceSurface = 'web', userId = null, sensitivity = 'balanced' }) => {
    const safeList = Array.isArray(items) ? items : [];
    const capped = safeList.slice(0, 25);
    const { data: verifiedDomains } = await supabaseAdmin.from('verified_domains').select('*').eq('is_active', true);

    const seenDomains = new Set();
    let externalCallsUsed = 0;

    // Prioritize unknown/shortener/multi-tenant URLs for external research budget (max 8 domains per batch; VT rolling cap still guards 4/min)
    const prepared = capped
        .map((item) => {
            const rawUrl = typeof item === 'string' ? item : item?.url;
            if (!rawUrl || typeof rawUrl !== 'string') return null;
            const contextFlags = typeof item === 'object' ? item?.contextFlags || '' : '';
            const filename = typeof item === 'object' ? item?.filename || '' : '';
            const host = extractHostname(rawUrl);
            const reg = getRegistrableDomain(host);
            const needsExternal = Boolean(reg && !isPrivateOrIpHost(host) && !OFFICIAL_SAFE_BASELINE[reg]);
            const allowExternal = needsExternal && !seenDomains.has(reg) && externalCallsUsed < 8;
            if (reg) seenDomains.add(reg);
            if (allowExternal) externalCallsUsed += 1;
            return { rawUrl, contextFlags, filename, allowExternal };
        })
        .filter(Boolean);

    const results = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < prepared.length; i += CONCURRENCY) {
        const chunk = prepared.slice(i, i + CONCURRENCY);
        const chunkVerdicts = await Promise.all(
            chunk.map(async ({ rawUrl, contextFlags, filename, allowExternal }) => {
                const verdict = await checkUrlThreat({
                    rawUrl,
                    sourceSurface,
                    contextFlags,
                    userId,
                    allowExternalIntel: allowExternal,
                    preloadedVerifiedDomains: verifiedDomains || [],
                    sensitivity,
                    filename,
                });
                return { ...verdict, requestedUrl: rawUrl };
            })
        );
        results.push(...chunkVerdicts);
    }

    return results;
};

module.exports = {
    unwrapRedirectUrl,
    resolveShortUrlAsync,
    extractHostname,
    getRegistrableDomain,
    sanitizeUrlForStorage,
    normalizeLeetspeak,
    normalizeVisualLookalike,
    hasUserInfoSpoof,
    resolveThresholds,
    checkUrlThreat,
    batchCheckUrls,
    evaluateLocalSignals,
};
