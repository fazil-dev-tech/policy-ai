(function (rootScope) {
  const globalObj = typeof window !== 'undefined' ? window : rootScope;
  let Stage1 = globalObj && globalObj.PolicyGuardStage1 ? globalObj.PolicyGuardStage1 : null;
  if (!Stage1 && typeof require === 'function') {
    try { Stage1 = require('./stage1Engine'); } catch {}
  }

  const SENSITIVITY_THRESHOLDS = {
    high: { threat: 45, suspicious: 15 },
    balanced: { threat: 60, suspicious: 25 },
    relaxed: { threat: 80, suspicious: 45 },
  };

  function resolveThresholds(sensitivity = 'balanced') {
    return SENSITIVITY_THRESHOLDS[String(sensitivity || '').toLowerCase()] || SENSITIVITY_THRESHOLDS.balanced;
  }

  const TRUSTED_DOMAINS = [
    'starhealth.in',
    'hdfcergo.com',
    'hdfcbank.com',
    'hdfclife.com',
    'icicilombard.com',
    'icicibank.com',
    'iciciprulife.com',
    'licindia.in',
    'bajajallianz.com',
    'bajajfinserv.in',
    'newindia.co.in',
    'tataaig.com',
    'careinsurance.com',
    'nivabupa.com',
    'acko.com',
    'godigit.com',
    'sbigeneral.in',
    'irdai.gov.in',
    'bimabharosa.irdai.gov.in',
    'parivahan.gov.in',
    'echallan.parivahan.gov.in',
    'policybazaar.com',
    'razorpay.com',
    'billdesk.com',
    'payu.in',
    'mediassistindia.com',
    'fhpl.net',
    'vidalhealthtpa.com',
    'google.com',
    'google.co.in',
    'youtube.com',
    'microsoft.com',
    'apple.com',
    'icloud.com',
    'openai.com',
    'chatgpt.com',
    'anthropic.com',
    'claude.ai',
    'supabase.com',
    'supabase.io',
    'gitlab.com',
    'github.com',
    'vercel.com',
    'netlify.com',
    'cloudflare.com',
    'puter.com',
    'stackoverflow.com',
    'linkedin.com',
    'slack.com',
    'zoom.us',
    'notion.so',
    'figma.com',
    'netflix.com',
    'spotify.com',
    'stripe.com',
    'paypal.com',
    'amazon.com',
    'amazon.in',
    'flipkart.com',
    'phonepe.com',
    'paytm.com',
    'zerodha.com',
    'groww.in',
    'cred.club',
    'sbi.co.in',
    'onlinesbi.sbi',
    'npci.org.in',
    'uidai.gov.in',
    'incometax.gov.in',
    'digilocker.gov.in',
    'epfindia.gov.in',
    'irctc.co.in',
    'irctc.com',
    'wa.me',
    'whatsapp.com',
    'telegram.org',
    't.me',
    'instagram.com',
    'facebook.com',
    'kotak.com',
    'axisbank.com',
    'idfcfirstbank.com',
    'indusind.com',
    'yesbank.in',
    'canarabank.com',
    'bankofbaroda.in',
    'pnbindia.in',
    'rbi.org.in',
    'sbicard.com',
    'paytmbank.com',
    'upstox.com',
    'fedex.com',
    'bluedart.com',
    'delhivery.com',
    'dhl.com',
    'indiapost.gov.in',
    'airtel.in',
    'airtel.com',
    'jio.com',
    'bsnl.co.in',
    'bescom.co.in',
    'bescom.karnataka.gov.in',
    'zomato.com',
    'swiggy.com',
    'myntra.com',
    'meesho.com',
    'docusign.com',
    'dropbox.com',
    'adobe.com',
    'binance.com',
    'coinbase.com',
    'discord.com',
    'steampowered.com',
    'steamcommunity.com',
    'ebay.com',
    'ebay.in',
    'wikipedia.org',
    'mozilla.org',
    'npmjs.com',
    'pypi.org',
    'bing.com',
    'duckduckgo.com',
    'reddit.com',
    'x.com',
    'twitter.com',
    'hdfc.com',
    'icicidirect.com',
  ];

  // Shared user-content hosts that attackers routinely abuse for .apk / KYC pages
  const MULTI_TENANT_HOSTS = new Set([
    'sites.google.com',
    'drive.google.com',
    'docs.google.com',
    'script.google.com',
    'storage.googleapis.com',
    'vercel.app',
    'github.io',
    'gitlab.io',
    'netlify.app',
    'pages.dev',
    'web.app',
    'firebaseapp.com',
    'blogspot.com',
    'wordpress.com',
    'herokuapp.com',
    'onrender.com',
    'workers.dev',
    'ngrok-free.app',
    'trycloudflare.com',
    'replit.app',
    'webflow.io',
    'carrd.co',
    'canva.site',
    'forms.gle',
    'lovable.app',
    'notion.site',
    'railway.app',
    'fly.dev',
    'chat.whatsapp.com',
    'bit.ly',
    'tinyurl.com',
    't.co',
    'rb.gy',
    'is.gd',
    'cutt.ly',
    'rebrand.ly',
    'shorturl.at',
    'goo.gl',
    'wa.link',
    'ow.ly',
    'buff.ly',
    't.ly',
    'lnkd.in',
  ]);

  const SAFE_PORTALS = [
    { key: 'star', name: 'Star Health Official Portal', url: 'https://www.starhealth.in' },
    { key: 'hdfc', name: 'HDFC ERGO Official Portal', url: 'https://www.hdfcergo.com' },
    { key: 'icici', name: 'ICICI Lombard Official Portal', url: 'https://www.icicilombard.com' },
    { key: 'lic', name: 'LIC India Official Portal', url: 'https://www.licindia.in' },
    { key: 'bajaj', name: 'Bajaj Allianz Official Portal', url: 'https://www.bajajallianz.com' },
    { key: 'sbi', name: 'State Bank of India Official', url: 'https://www.sbi.co.in' },
    { key: 'parivahan', name: 'Parivahan / e-Challan Official', url: 'https://parivahan.gov.in' },
    { key: 'challan', name: 'Parivahan / e-Challan Official', url: 'https://parivahan.gov.in' },
    { key: 'paypal', name: 'PayPal Official', url: 'https://www.paypal.com' },
    { key: 'amazon', name: 'Amazon Official', url: 'https://www.amazon.in' },
  ];

  const RISKY_TLDS = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.loan', '.zip', '.mov'];
  const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'rb.gy', 'is.gd', 'cutt.ly'];
  const DANGEROUS_EXT_REGEX = /\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#|\s)/i;
  const DOUBLE_EXT_REGEX = /\.[a-z0-9]{2,5}\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#|\s)/i;

  const BRAND_WORDS = [
    'starhealth', 'hdfcergo', 'hdfclife', 'hdfcbank', 'icicilombard', 'icicipru', 'icicibank',
    'licindia', 'bajajallianz', 'policybazaar', 'careinsurance', 'nivabupa', 'acko', 'godigit',
    'tataaig', 'irdai', 'bimabharosa', 'parivahan', 'echallan', 'sbi', 'npci', 'uidai', 'aadhaar',
    'paypal', 'amazon', 'microsoft', 'google',
  ];

  const PROTECTED_TYPOSQUAT_TARGETS = [
    { domain: 'starhealth.in', label: 'Star Health' },
    { domain: 'hdfcergo.com', label: 'HDFC ERGO' },
    { domain: 'hdfcbank.com', label: 'HDFC Bank' },
    { domain: 'icicilombard.com', label: 'ICICI Lombard' },
    { domain: 'icicibank.com', label: 'ICICI Bank' },
    { domain: 'licindia.in', label: 'LIC India' },
    { domain: 'bajajallianz.com', label: 'Bajaj Allianz' },
    { domain: 'policybazaar.com', label: 'Policybazaar' },
    { domain: 'sbi.co.in', label: 'State Bank of India' },
    { domain: 'irdai.gov.in', label: 'IRDAI' },
    { domain: 'parivahan.gov.in', label: 'Parivahan Sewa' },
    { domain: 'npci.org.in', label: 'NPCI' },
    { domain: 'uidai.gov.in', label: 'UIDAI' },
    { domain: 'paypal.com', label: 'PayPal' },
    { domain: 'amazon.in', label: 'Amazon India' },
    { domain: 'google.com', label: 'Google' },
    { domain: 'microsoft.com', label: 'Microsoft' },
    { domain: 'openai.com', label: 'OpenAI' },
    { domain: 'supabase.com', label: 'Supabase' },
    { domain: 'gitlab.com', label: 'GitLab' },
  ];

  // Display-name vs sender-domain spoofing map for Gmail / Outlook inbox rows
  const SENDER_BRAND_DOMAIN_MAP = [
    { nameRegex: /\b(google|gmail|gemini|youtube)\b/i, domains: ['google.com', 'google.co.in', 'youtube.com', 'accounts.google.com', 'withgoogle.com'] },
    { nameRegex: /\b(chatgpt|openai)\b/i, domains: ['openai.com', 'chatgpt.com'] },
    { nameRegex: /\bsupabase\b/i, domains: ['supabase.com', 'supabase.io'] },
    { nameRegex: /\bgitlab\b/i, domains: ['gitlab.com'] },
    { nameRegex: /\bgithub\b/i, domains: ['github.com'] },
    { nameRegex: /\bstar\s*health\b/i, domains: ['starhealth.in'] },
    { nameRegex: /\bhdfc\s*(ergo|bank|life)?\b/i, domains: ['hdfcergo.com', 'hdfcbank.com', 'hdfclife.com'] },
    { nameRegex: /\bicici\s*(lombard|bank|pru)?\b/i, domains: ['icicilombard.com', 'icicibank.com', 'iciciprulife.com'] },
    { nameRegex: /\bsbi\b|\bstate\s*bank\b/i, domains: ['sbi.co.in', 'onlinesbi.sbi', 'sbigeneral.in'] },
    { nameRegex: /\blic\s*(india)?\b/i, domains: ['licindia.in'] },
    { nameRegex: /\bbajaj\s*(allianz|finserv)?\b/i, domains: ['bajajallianz.com', 'bajajfinserv.in'] },
    { nameRegex: /\birdai\b|\bbima\s*bharosa\b/i, domains: ['irdai.gov.in'] },
    { nameRegex: /\bparivahan\b|\be-?challan\b/i, domains: ['parivahan.gov.in'] },
    { nameRegex: /\bpaypal\b/i, domains: ['paypal.com'] },
    { nameRegex: /\bamazon\b/i, domains: ['amazon.in', 'amazon.com'] },
    { nameRegex: /\bmicrosoft\b|\boutlook\b/i, domains: ['microsoft.com', 'office.com'] },
    { nameRegex: /\bapple\b|\bicloud\b/i, domains: ['apple.com', 'icloud.com'] },
    { nameRegex: /\bpaytm\b/i, domains: ['paytm.com', 'paytmbank.com'] },
    { nameRegex: /\bphonepe\b/i, domains: ['phonepe.com'] },
    { nameRegex: /\bkotak\b/i, domains: ['kotak.com', 'kotakbank.com', 'kotak.bank.in'] },
    { nameRegex: /\baxis\s*bank\b/i, domains: ['axisbank.com', 'axis.bank.in'] },
    { nameRegex: /\bfedex\b/i, domains: ['fedex.com'] },
    { nameRegex: /\bblue\s*dart\b/i, domains: ['bluedart.com'] },
    { nameRegex: /\bdelhivery\b/i, domains: ['delhivery.com'] },
    { nameRegex: /\bdhl\b/i, domains: ['dhl.com', 'dhl.co.in'] },
    { nameRegex: /\bflipkart\b/i, domains: ['flipkart.com'] },
    { nameRegex: /\bjio\b|\breliance\s*jio\b/i, domains: ['jio.com', 'jiomart.com'] },
    { nameRegex: /\bairtel\b/i, domains: ['airtel.in', 'airtel.com'] },
    { nameRegex: /\buidai\b|\baadhaar\b/i, domains: ['uidai.gov.in'] },
    { nameRegex: /\bincome\s*tax\b/i, domains: ['incometax.gov.in', 'incometaxindia.gov.in'] },
    { nameRegex: /\birctc\b/i, domains: ['irctc.co.in', 'irctc.com'] },
    { nameRegex: /\bbescom\b/i, domains: ['bescom.co.in', 'bescom.karnataka.gov.in'] },
  ];

  function checkSenderImpersonation(displayName = '', senderDomain = '') {
    const dn = String(displayName || '').trim();
    const dom = getRegistrableDomain(String(senderDomain || '').toLowerCase());
    if (!dn || !dom || dn.includes('@')) return null;
    for (const rule of SENDER_BRAND_DOMAIN_MAP) {
      if (rule.nameRegex.test(dn)) {
        const isLegit = rule.domains.some((d) => dom === d || senderDomain.endsWith('.' + d));
        if (!isLegit) {
          return {
            spoofedBrand: dn.slice(0, 50),
            actualDomain: dom,
            expectedDomains: rule.domains,
          };
        }
      }
    }
    return null;
  }

  function unwrapUrl(rawUrl, saferUrl) {
    const candidate = String(saferUrl || rawUrl || '').trim();
    if (!candidate) return '';
    try {
      const baseHref = typeof window !== 'undefined' && window.location ? window.location.href : 'https://policyguard.local';
      const parsed = new URL(candidate, baseHref);
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
        if (inner && /^https?:\/\//i.test(inner)) return inner;
      }
      return parsed.href;
    } catch {
      return candidate;
    }
  }

  function getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function isIpHost(host = '') {
    const h = String(host || '').replace(/^\[|\]$/g, '');
    if (!h) return false;
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':');
  }

  function isLoopbackHost(host = '') {
    const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  }

  function getRegistrableDomain(hostname = '') {
    const h = String(hostname || '').toLowerCase().replace(/^www\./, '');
    if (!h || isIpHost(h) || isLoopbackHost(h)) return h;
    const parts = h.split('.').filter(Boolean);
    if (parts.length <= 2) return h;
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
  }

  function matchesRuleList(hostname = '', regDomain = '', list = []) {
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
  }

  function isTrustedHost(host) {
    if (!host) return false;
    const h = String(host).toLowerCase().replace(/^www\./, '');
    for (const m of MULTI_TENANT_HOSTS) {
      if (h === m || h.endsWith('.' + m)) return false;
    }
    const reg = getRegistrableDomain(h);
    return TRUSTED_DOMAINS.some((d) => reg === d || h === d);
  }

  function hasUserInfoSpoof(rawUrl = '') {
    try {
      const stripped = String(rawUrl || '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
      const authority = stripped.split(/[/?#]/)[0] || '';
      return authority.includes('@');
    } catch {
      return false;
    }
  }

  function normalizeVisualLookalike(label = '') {
    return String(label || '')
      .toLowerCase()
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')
      .replace(/vv/g, 'w')
      .replace(/rn/g, 'm');
  }

  function normalizeLeetspeak(text = '') {
    return String(text || '')
      .toLowerCase()
      .replace(/@/g, 'a')
      .replace(/0/g, 'o')
      .replace(/[1!|]/g, 'i')
      .replace(/\$/g, 's')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't');
  }

  function levenshtein(a = '', b = '') {
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
  }

  function detectHomoglyphs(rawUrl = '', host = '') {
    const combined = `${rawUrl} ${host}`;
    const hasZeroWidth = /[\u200B-\u200D\uFEFF]/.test(combined);
    const hasMixedScript = /[a-zA-Z]/.test(combined) && (/[\u0400-\u04FF]/.test(combined) || /[\u0370-\u03FF]/.test(combined));
    const hasPunycode = String(host || '').includes('xn--');
    return { hasZeroWidth, hasMixedScript, hasPunycode };
  }

  function checkDangerousFile(rawUrl = '', filename = '') {
    const target = `${String(rawUrl || '').toLowerCase()} ${String(filename || '').toLowerCase()}`.trim();
    const isDoubleExt = DOUBLE_EXT_REGEX.test(target);
    const match = target.match(DANGEROUS_EXT_REGEX);
    if (!match && !/contains_apk/i.test(target)) return null;
    const ext = match ? `.${match[1].toLowerCase()}` : '.apk';
    return { ext, isDoubleExt };
  }

  function suggestSafeAlternative(host = '', contextText = '') {
    const combined = `${host} ${contextText}`.toLowerCase();
    for (const p of SAFE_PORTALS) {
      if (combined.includes(p.key)) return p;
    }
    return { name: 'IRDAI Bima Bharosa Registry', url: 'https://bimabharosa.irdai.gov.in' };
  }

  function quickLocalRisk(url, surroundingText = '', options = {}) {
    const rawUrl = String(url || '');
    const unwrapped = unwrapUrl(rawUrl);
    const host = getHost(unwrapped);
    const regDomain = getRegistrableDomain(host);
    const lowerUrl = unwrapped.toLowerCase();
    const ctxLeet = normalizeLeetspeak(surroundingText);
    const thresholds = resolveThresholds(options.sensitivity || 'balanced');
    const filename = options.filename || '';
    const whitelist = Array.isArray(options.whitelist) ? options.whitelist : [];
    const blacklist = Array.isArray(options.blacklist) ? options.blacklist : [];

    const reasons = [];
    let score = 0;
    let threatCategory = 'safe';
    const setCategory = (cat) => {
      if (threatCategory === 'safe' || cat === 'apk_malware' || cat === 'upi_scam' || ((cat === 'otp_phishing' || cat === 'otp_upi_fraud') && threatCategory === 'phishing_kyc')) {
        threatCategory = cat;
      }
    };

    // 0. User custom blacklist (exact host/registrable domain match)
    const blk = matchesRuleList(host, regDomain, blacklist);
    if (blk) {
      score += 85;
      setCategory('phishing');
      reasons.push(`Blocked by user custom blacklist (${blk})`);
    }

    // 1. '@' Userinfo URL auth spoofing (check BEFORE parsing strips authority username and BEFORE whitelist)
    if (hasUserInfoSpoof(rawUrl) || hasUserInfoSpoof(unwrapped)) {
      score += 75;
      setCategory('phishing');
      reasons.push(`CRITICAL: '@' authentication spoofing hides real destination (${host || 'unknown'})`);
    }

    // 2. Dangerous payloads (.apk, .exe, .ps1...) + double-extension disguise BEFORE whitelist
    const fileDanger = checkDangerousFile(`${lowerUrl} ${String(surroundingText || '').toLowerCase()}`, filename);
    if (fileDanger) {
      score += fileDanger.isDoubleExt ? 85 : 75;
      setCategory('apk_malware');
      if (fileDanger.isDoubleExt) {
        reasons.push(`CRITICAL: Double-extension disguise (${fileDanger.ext}) hides executable malware`);
      } else if (fileDanger.ext === '.apk') {
        reasons.push('CRITICAL: Android .apk malware attachment or download link');
      } else {
        reasons.push(`CRITICAL: Dangerous executable payload (${fileDanger.ext}) detected`);
      }
    }

    // 3. Stage-1 Multilingual AI Classifier + Leetspeak scam NLP (with negated advisory & benign dev/OTP guard)
    const stage1 = Stage1 && surroundingText
      ? Stage1.scoreMessage(surroundingText)
      : { score: 0, verdict: 'SAFE', category: 'safe', reasons: [], signals: [], entities: {} };

    if (stage1.score >= 30) {
      score = Math.max(score, Math.round(stage1.score));
      setCategory(stage1.category);
      (stage1.reasons || []).slice(0, 3).forEach((r) => reasons.push(r));
    }

    const isNegatedAdvisory =
      /\b(never|do\s+not|don'?t|not\s+to|avoid|refuse)\b.{0,22}\b(share|send|tell|give|forward|disclose|enter)\b.{0,25}\b(otp|upi\s*pin|pin|password|cvv)\b/i.test(ctxLeet) ||
      (stage1.score < 20 && (stage1.signals || []).some((s) => s.signal === 'protective_advice' || s.signal === 'otp_delivery'));

    if (!isNegatedAdvisory && /enter.*upi\s*pin.*receiv|upi\s*pin.*refund|collect\s*request.*claim|kyc.*update\.apk|reverse.?upi|pay.*pin.*to.*receiv/i.test(ctxLeet)) {
      score += 65;
      setCategory('upi_scam');
      reasons.push('CRITICAL: Reverse-UPI refund / fake KYC scam phrasing detected');
    } else if (!isNegatedAdvisory && /(share|send|tell|give|forward|enter|verify).{0,25}\botp\b|\botp\b.{0,20}(expire|block|suspend|verif|urgent|secret)/i.test(ctxLeet)) {
      score += 65;
      setCategory('otp_phishing');
      reasons.push('CRITICAL: OTP / 2FA credential theft lure detected');
    } else if (/(bank|account|kyc|policy|pan|aadhaar|card).{0,25}(block|suspend|deactivat|freeze|terminat|expire|update\s*urgent)/i.test(ctxLeet)) {
      score += 45;
      setCategory('phishing');
      reasons.push('Account / KYC suspension scare tactic detected');
    } else if (/urgent.*policy.*suspend|expire.*today|e-?challan|vahan.*fine|anydesk|teamviewer|quicksupport/i.test(ctxLeet)) {
      score += 40;
      setCategory(/anydesk|teamviewer|quicksupport/i.test(ctxLeet) ? 'tech_support' : 'phishing');
      reasons.push('Urgency, remote-access tool, or fake e-challan lure');
    } else if (/(won|winner|claimed|prize|lottery|jackpot|guaranteed\s*profit|airdrop|double\s*your\s*(money|crypto|btc))/i.test(ctxLeet)) {
      score += 40;
      setCategory('lottery_scam');
      reasons.push('Lottery / guaranteed crypto profit scam phrasing');
    }

    // 4. Loopback dev vs raw IP address host
    if (isLoopbackHost(host)) {
      if (score < thresholds.suspicious && !blk) {
        return {
          status: 'safe',
          riskScore: 0,
          threatCategory: 'safe',
          domain: host,
          reasons: ['Local development address'],
          safeAlternative: null,
        };
      }
    } else if (isIpHost(host)) {
      score += 50;
      setCategory('phishing');
      reasons.push('Direct raw IP address link obscures sender identity');
    }

    // 5. Verified / official domains & custom whitelist (exempts benign Stage1 keyword hits unless a CRITICAL threat or blacklist fired)
    const customWhite = matchesRuleList(host, regDomain, whitelist);
    const hasCriticalLure =
      Boolean(blk) ||
      reasons.some((r) => r.startsWith('CRITICAL:')) ||
      /\b(anydesk|teamviewer|quicksupport|rustdesk)\b/i.test(ctxLeet);
    if ((isTrustedHost(host) || customWhite) && !hasCriticalLure) {
      return {
        status: 'safe',
        riskScore: 5,
        threatCategory: 'safe',
        domain: regDomain || host,
        reasons: [customWhite ? `Trusted by user whitelist (${customWhite})` : `Verified official domain (${regDomain || host})`],
        safeAlternative: null,
      };
    }

    // 6. Homoglyphs & Punycode
    const glyphs = detectHomoglyphs(rawUrl, host);
    if (glyphs.hasZeroWidth) {
      score += 45;
      setCategory('phishing');
      reasons.push('Zero-width invisible spoofing character detected');
    }
    if (glyphs.hasMixedScript) {
      score += 60;
      setCategory('impersonation');
      reasons.push('Homoglyph spoofing: mixed Cyrillic/Greek Unicode script in domain');
    } else if (glyphs.hasPunycode) {
      score += 45;
      setCategory('impersonation');
      reasons.push('IDN Punycode lookalike domain (xn--)');
    }

    // 7. Insecure HTTP (15 pts so plain http:// links don't trigger noisy false alarms alone unless high sensitivity or paired with IP/TLD/lure)
    if (lowerUrl.startsWith('http://') && host && !isLoopbackHost(host)) {
      score += 15;
      reasons.push('Insecure HTTP link (no HTTPS encryption)');
    }

    // 8. Extended Risky TLD / URL shortener / Free-hosting phishing paths (including EXT KAV Stage-1 lists)
    const tldSuffix = (regDomain || host).split('.').pop();
    const isRiskyTld =
      (host && RISKY_TLDS.some((t) => host.endsWith(t))) ||
      (Stage1 && tldSuffix && Stage1.RISKY_TLDS.includes(tldSuffix) && !isTrustedHost(host));
    if (isRiskyTld) {
      score += 30;
      setCategory('phishing');
      reasons.push(`High-risk / disposable top-level domain (.${tldSuffix})`);
    }
    if (
      host &&
      (URL_SHORTENERS.includes(host) ||
        URL_SHORTENERS.includes(regDomain) ||
        ['wa.link', 'l.wl.co', 'bitly.com', 'shorturl.at', 'rebrand.ly', 'goo.gl'].includes(regDomain) ||
        (Stage1 && Stage1.SHORTENERS.includes(regDomain)))
    ) {
      score += 25;
      if (threatCategory === 'safe') setCategory('suspicious');
      reasons.push(`URL shortener (${regDomain}) obscures final destination`);
    }

    const isFreeHost =
      host &&
      !isTrustedHost(host) &&
      (MULTI_TENANT_HOSTS.has(regDomain) ||
        (Stage1 && Array.isArray(Stage1.FREE_HOSTING) && Stage1.FREE_HOSTING.some((fh) => host === fh || host.endsWith('.' + fh))));
    if (isFreeHost) {
      const pathAndCtx = `${lowerUrl} ${ctxLeet}`;
      if (/(claim|kyc|refund|renewal|challan|vahan|policy|premium|irdai|otp|verify|login|signin|wallet|aadhaar|pan|reward|customs)/i.test(pathAndCtx)) {
        score += 35;
        setCategory('phishing');
        reasons.push(`Free cloud/site-builder host (${regDomain || host}) serving a claim/KYC/login lure`);
      }
    }

    // 9. Offline visual lookalike & Levenshtein typosquatting + token-aware brand spoofing (including Stage1.BRANDS)
    const AMBIGUOUS_BRAND_TOKENS = new Set(['apple', 'amazon', 'chase', 'steam', 'office365', 'discord', 'yahoo', 'dropbox', 'ebay', 'roblox', 'whatsapp', 'facebook', 'instagram', 'linkedin', 'telegram']);
    const LURE_TOKENS_RE = /\b(kyc|verify|verification|update|login|signin|sign-in|secure|security|support|refund|claim|billing|pay|payment|alert|account|wallet|bonus|reward|unlock|suspend|suspended|helpdesk|parcel|customs|otp|challan|renew|renewal|apk|app)\b/i;

    const isOfficialBrandDomain = (brandKey) => {
      const list = Stage1 && Stage1.BRANDS ? Stage1.BRANDS[brandKey] : null;
      if (!Array.isArray(list)) return false;
      return list.some((d) => host === d || regDomain === d || host.endsWith('.' + d));
    };

    if (host && !isTrustedHost(host) && !isIpHost(host) && !isLoopbackHost(host) && !host.endsWith('.local')) {
      const baseA = (regDomain || host).split('.')[0] || '';
      const visualA = normalizeVisualLookalike(baseA);
      let matchedLookalike = false;

      for (const cand of PROTECTED_TYPOSQUAT_TARGETS) {
        const baseB = cand.domain.split('.')[0];
        if (!baseB) continue;
        const visualB = normalizeVisualLookalike(baseB);
        if (visualA === visualB && baseA !== baseB) {
          score += 60;
          setCategory('impersonation');
          reasons.push(`Visual homoglyph domain (${regDomain}) mimics official ${cand.label} (${cand.domain})`);
          matchedLookalike = true;
          break;
        }
        if (baseB.length < 5) continue;
        const maxDist = baseB.length <= 6 ? 1 : 2;
        const dist = levenshtein(baseA, baseB);
        if (dist > 0 && dist <= maxDist && Math.abs(baseA.length - baseB.length) <= 2) {
          score += 55;
          setCategory('impersonation');
          reasons.push(`Lookalike typosquat domain (${regDomain}) mimics official ${cand.label} (${cand.domain})`);
          matchedLookalike = true;
          break;
        }
      }

      if (!matchedLookalike) {
        const hostTokens = host.split(/[.-]/).filter(Boolean);
        let brandHit = null;
        for (const b of BRAND_WORDS) {
          const hit = (b.length >= 7 ? host.includes(b) : hostTokens.includes(b)) && !isOfficialBrandDomain(b);
          if (hit) {
            brandHit = b;
            break;
          }
        }
        if (!brandHit && Stage1 && Stage1.BRANDS) {
          const lureInUrl = LURE_TOKENS_RE.test(`${host.replace(/[.-]/g, ' ')} ${lowerUrl}`);
          for (const [brandKey, officialDomains] of Object.entries(Stage1.BRANDS)) {
            if (!brandKey || brandKey.length < 3 || brandKey === 'gov' || !Array.isArray(officialDomains) || officialDomains.length === 0) continue;
            const hit = hostTokens.includes(brandKey) || (brandKey.length >= 6 && host.includes(brandKey));
            if (!hit || isOfficialBrandDomain(brandKey)) continue;
            if (AMBIGUOUS_BRAND_TOKENS.has(brandKey) && !lureInUrl) continue;
            brandHit = brandKey;
            break;
          }
        }
        if (brandHit) {
          const lurePaired = LURE_TOKENS_RE.test(`${host.replace(/[.-]/g, ' ')} ${lowerUrl}`);
          score += lurePaired ? 60 : 45;
          setCategory('impersonation');
          reasons.push(`Mentions official brand keyword '${brandHit}' on unverified domain (${regDomain || host})`);
        }
      }
    }

    const bounded = Math.min(100, Math.max(0, score));
    const status = bounded >= thresholds.threat ? 'threat' : bounded >= thresholds.suspicious ? 'suspicious' : 'safe';
    if (status === 'safe') threatCategory = 'safe';
    else if (threatCategory === 'safe') threatCategory = 'suspicious';

    return {
      status,
      riskScore: bounded,
      threatCategory,
      domain: regDomain || host,
      reasons,
      safeAlternative: status !== 'safe' ? suggestSafeAlternative(host, surroundingText) : null,
    };
  }

  function analyzeTarget({ url = '', text = '', filename = '', settings = {} } = {}) {
    return quickLocalRisk(url, text, {
      sensitivity: settings.sensitivity || 'balanced',
      filename,
      whitelist: settings.whitelist || [],
      blacklist: settings.blacklist || [],
    });
  }

  function makeEl(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined && textContent !== null) el.textContent = String(textContent);
    return el;
  }

  function createPillElement(verdict, showSafeBadges) {
    const status = verdict?.status || 'safe';
    const span = makeEl('span', `pg-shield-pill pg-shield-${status}`);
    if (status === 'safe' && !showSafeBadges) {
      span.classList.add('pg-shield-hidden-safe');
    }

    const labels = {
      threat: '🚨 THREAT',
      suspicious: '⚠ SUSPICIOUS',
      safe: '✓ SAFE',
    };
    span.textContent = labels[status] || '✓ SAFE';

    const reasons = (verdict?.reasons || []).join(' • ');
    span.title = `PolicyGuard (${verdict?.domain || 'link'} — Risk ${Number(verdict?.riskScore ?? 0)}/100): ${reasons || 'Verified'}`;

    span.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    span.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToastModal(verdict, span);
    });

    return span;
  }

  function positionPopupNearAnchor(box, anchorEl) {
    if (!anchorEl || typeof anchorEl.getBoundingClientRect !== 'function' || typeof window === 'undefined') return;
    const rect = anchorEl.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const boxWidth = 370;
    const left = Math.max(12, Math.min(rect.left, vw - boxWidth - 16));
    const preferBelow = rect.bottom + 260 < vh;
    box.style.right = 'auto';
    box.style.left = `${left}px`;
    if (preferBelow) {
      box.style.top = `${Math.max(12, rect.bottom + 8)}px`;
    } else {
      box.style.top = `${Math.max(12, rect.top - 260)}px`;
    }
  }

  function showToastModal(verdict, anchorEl = null) {
    const existing = document.getElementById('pg-inline-detail-banner');
    if (existing) existing.remove();

    const status = verdict?.status || 'suspicious';
    const safeStatus = ['threat', 'suspicious', 'safe'].includes(status) ? status : 'suspicious';
    const score = Number.isFinite(Number(verdict?.riskScore)) ? Number(verdict.riskScore) : 0;
    const alt =
      verdict?.safeAlternative ||
      (safeStatus !== 'safe' ? suggestSafeAlternative(verdict?.domain || '', (verdict?.reasons || []).join(' ')) : null);

    const box = makeEl('div', `pg-floating-banner ${safeStatus}`);
    box.id = 'pg-inline-detail-banner';

    const header = makeEl('h4');
    const titleSpan = makeEl(
      'span',
      '',
      safeStatus === 'threat'
        ? '🚨 PolicyGuard Threat Alert'
        : safeStatus === 'suspicious'
          ? '⚠ PolicyGuard Warning'
          : '✓ PolicyGuard Verified'
    );
    const closeBtn = makeEl('button', 'pg-banner-btn ghost', '✕');
    closeBtn.setAttribute('aria-label', 'Close alert');
    closeBtn.addEventListener('click', () => box.remove());
    header.appendChild(titleSpan);
    header.appendChild(closeBtn);
    box.appendChild(header);

    const domainRow = makeEl('p');
    domainRow.appendChild(makeEl('strong', '', 'Target: '));
    domainRow.appendChild(document.createTextNode(`${verdict?.domain || 'Unknown'} (Risk ${score}/100)`));
    if (verdict?.threatCategory && verdict.threatCategory !== 'safe') {
      domainRow.appendChild(makeEl('span', 'pg-cat-chip', verdict.threatCategory));
    }
    box.appendChild(domainRow);

    const ul = makeEl('ul');
    const reasonList = Array.isArray(verdict?.reasons) && verdict.reasons.length ? verdict.reasons : ['No threat indicators found'];
    reasonList.forEach((r) => {
      ul.appendChild(makeEl('li', '', r));
    });
    box.appendChild(ul);

    const vt = verdict?.vtStats || {};
    if (vt && (Number(vt.malicious || 0) > 0 || Number(vt.totalVendors || 0) > 0)) {
      const vtBox = makeEl('div', 'pg-vt-box');
      vtBox.appendChild(
        makeEl(
          'div',
          'pg-vt-title',
          `VirusTotal: ${Number(vt.malicious || 0)} malicious · ${Number(vt.suspicious || 0)} suspicious / ${Number(vt.totalVendors || 0) || '—'} engines`
        )
      );
      if (Array.isArray(vt.flaggedBy) && vt.flaggedBy.length > 0) {
        const vendorsWrap = makeEl('div', 'pg-vt-vendors');
        vt.flaggedBy.slice(0, 4).forEach((entry) => {
          vendorsWrap.appendChild(makeEl('span', 'pg-vt-chip', `${entry.vendor}: ${entry.result || entry.category}`));
        });
        vtBox.appendChild(vendorsWrap);
      }
      box.appendChild(vtBox);
    }

    if (alt && safeStatus !== 'safe') {
      const altP = makeEl('p');
      altP.appendChild(makeEl('strong', '', 'Official Check: '));
      const a = document.createElement('a');
      a.href = alt.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `${alt.name} ↗`;
      a.style.cssText = 'color:inherit;text-decoration:underline;font-weight:700;';
      altP.appendChild(a);
      box.appendChild(altP);
    }

    if (safeStatus === 'threat') {
      const emP = makeEl('p');
      emP.appendChild(makeEl('strong', '', 'Emergency: '));
      emP.appendChild(document.createTextNode('Do NOT enter OTP/UPI PIN or install .apk files. If scammed, dial '));
      emP.appendChild(makeEl('strong', '', '1930'));
      emP.appendChild(document.createTextNode(' immediately.'));
      box.appendChild(emP);
    }

    const actions = makeEl('div', 'pg-banner-actions');
    const feedbackMsg = makeEl('p', 'pg-banner-feedback');

    if (verdict?.url && !/^(gmail|yahoo|outlook|hotmail)\.com$/i.test(verdict?.domain || '')) {
      const reportBtn = makeEl('button', 'pg-banner-btn danger', 'Report Scam');
      reportBtn.addEventListener('click', () => {
        reportBtn.disabled = true;
        reportBtn.textContent = 'Submitting...';
        chrome.runtime.sendMessage(
          {
            type: 'PG_REPORT_SCAM',
            payload: {
              url: verdict.url,
              sourceSurface: verdict.sourceSurface || 'web',
              category: /apk/i.test(reasonList.join(' ')) ? 'apk_malware' : 'phishing',
              description: `Reported inline via PolicyGuard extension: ${reasonList.join('; ')}`,
            },
          },
          (res) => {
            if (chrome.runtime.lastError || !res?.ok) {
              reportBtn.disabled = false;
              reportBtn.textContent = 'Report Scam';
              feedbackMsg.textContent = 'Could not submit scam report. Check extension backend API settings.';
              return;
            }
            feedbackMsg.textContent = '✓ Submitted for admin verification & community warning.';
            setTimeout(() => box.remove(), 2200);
          }
        );
      });
      actions.appendChild(reportBtn);
    }

    if (safeStatus !== 'threat' && verdict?.domain && !isLoopbackHost(verdict.domain)) {
      const trustBtn = makeEl('button', 'pg-banner-btn secondary', 'Trust Domain');
      trustBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'PG_ADD_WHITELIST', domain: verdict.domain }, (res) => {
          if (!chrome.runtime.lastError && res?.ok) {
            feedbackMsg.textContent = `✓ Added ${verdict.domain} to custom whitelist.`;
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('pg-rescan-local'));
            }
            setTimeout(() => box.remove(), 1200);
          }
        });
      });
      actions.appendChild(trustBtn);
    }

    const dismissBtn = makeEl('button', 'pg-banner-btn ghost', 'Dismiss');
    dismissBtn.addEventListener('click', () => box.remove());
    actions.appendChild(dismissBtn);

    box.appendChild(actions);
    box.appendChild(feedbackMsg);

    if (anchorEl) positionPopupNearAnchor(box, anchorEl);
    document.body.appendChild(box);
  }

  const bypassedNodes = new WeakSet();

  function showClickBlockModal(verdict, targetEl, onProceed) {
    const existing = document.getElementById('pg-click-intercept-modal');
    if (existing) existing.remove();

    const backdrop = makeEl('div', 'pg-modal-backdrop');
    backdrop.id = 'pg-click-intercept-modal';

    const card = makeEl('div', 'pg-modal-card');
    card.appendChild(makeEl('div', 'pg-modal-title', '🛡️ PolicyGuard Blocked Dangerous Navigation'));
    card.appendChild(
      makeEl(
        'div',
        'pg-modal-sub',
        `Target: ${verdict?.domain || verdict?.url || 'Unknown link'} · Risk Score: ${Number(verdict?.riskScore || 75)}/100`
      )
    );

    const ul = makeEl('ul', 'pg-modal-reasons');
    (verdict?.reasons || ['High-risk phishing or malware indicator detected']).forEach((r) => {
      ul.appendChild(makeEl('li', '', r));
    });
    card.appendChild(ul);

    card.appendChild(
      makeEl(
        'div',
        'pg-modal-helpline',
        'Insurers and banks never distribute .apk installers or request your UPI PIN to receive refunds. Scammed? Call 1930.'
      )
    );

    const actions = makeEl('div', 'pg-modal-actions');
    const stayBtn = makeEl('button', 'pg-modal-btn-safe', 'Block & Stay Safe');
    stayBtn.addEventListener('click', () => backdrop.remove());

    const proceedBtn = makeEl('button', 'pg-modal-btn-proceed', 'Proceed anyway (unsafe)');
    proceedBtn.addEventListener('click', () => {
      backdrop.remove();
      if (targetEl) bypassedNodes.add(targetEl);
      if (typeof onProceed === 'function') onProceed();
      else if (targetEl && typeof targetEl.click === 'function') targetEl.click();
    });

    actions.appendChild(stayBtn);
    actions.appendChild(proceedBtn);
    card.appendChild(actions);
    backdrop.appendChild(card);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  function installClickInterceptor(options = {}) {
    if (typeof document === 'undefined' || globalObj.__pgClickInterceptorInstalled) return;
    globalObj.__pgClickInterceptorInstalled = true;

    const getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({ enabled: true, interceptClicks: true, sensitivity: 'balanced', whitelist: [], blacklist: [] });

    document.addEventListener(
      'click',
      (e) => {
        const cfg = getConfig();
        if (cfg.enabled === false || cfg.interceptClicks === false) return;
        const target = e.target && e.target.closest ? e.target.closest('a[href], [data-pg-threat-url]') : null;
        if (!target || bypassedNodes.has(target)) return;
        if (target.closest('#pg-inline-detail-banner, #pg-click-intercept-modal')) return;

        const rawHref = target.getAttribute('data-pg-threat-url') || target.href || '';
        if (!/^https?:\/\//i.test(rawHref) && !DANGEROUS_EXT_REGEX.test(rawHref)) return;

        const realUrl = unwrapUrl(rawHref, target.getAttribute('data-saferedirecturl'));
        const contextText = `${target.textContent || ''} ${(target.closest('[data-testid="msg-container"], div.a3s, tr, article, .comment, .message')?.textContent || '').slice(0, 400)}`;
        const storedVerdictJson = target.getAttribute('data-pg-verdict');
        let verdict = null;
        if (storedVerdictJson) {
          try { verdict = JSON.parse(storedVerdictJson); } catch {}
        }
        if (!verdict) {
          verdict = analyzeTarget({ url: realUrl, text: contextText, filename: target.getAttribute('download') || '', settings: cfg });
        }

        if (verdict && verdict.status === 'threat') {
          e.preventDefault();
          e.stopPropagation();
          showClickBlockModal(verdict, target, () => {
            if (target.tagName === 'A' && target.href) {
              if (target.target === '_blank') window.open(target.href, '_blank', 'noopener,noreferrer');
              else window.location.href = target.href;
            } else if (typeof target.click === 'function') {
              target.click();
            }
          });
        }
      },
      true
    );
  }

  function extractCleanText(el, skipSelector = '') {
    if (!el) return '';
    let out = '';
    const BLOCK_TAGS = /^(DIV|P|LI|TR|TD|H[1-6]|BLOCKQUOTE|TABLE|UL|OL|SECTION|ARTICLE|PRE|HEADER|FOOTER)$/;
    const walk = (node, depth) => {
      if (depth > 55) return;
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { out += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        if (c.matches && (c.matches('script, style, noscript, template, svg, .pg-shield-pill') || (skipSelector && c.matches(skipSelector)))) continue;
        if (c.tagName === 'BR') { out += '\n'; continue; }
        if (c.tagName === 'IMG') { out += c.getAttribute('alt') || ''; continue; }
        const block = BLOCK_TAGS.test(c.tagName);
        if (block) out += '\n';
        walk(c, depth + 1);
        if (block) out += '\n';
      }
    };
    walk(el, 0);
    return out.replace(/[ \t\u00a0\u200b]+/g, ' ').replace(/ *\n[\s]*/g, '\n').trim();
  }

  function extractUrlsFromText(text = '') {
    const src = String(text || '');
    if (!src) return [];
    const found = new Set();
    const cleanTrail = (u) => String(u || '').replace(/[),.!?;:'"\]>]+$/g, '');

    const protoMatches = src.match(/https?:\/\/[^\s<>"']+/gi) || [];
    for (const m of protoMatches) {
      const unwrapped = unwrapUrl(cleanTrail(m));
      if (/^https?:\/\//i.test(unwrapped)) found.add(unwrapped);
    }

    // Also catch bare scam domains written without https:// (e.g. hdfc-kyc-verify.com/update or bit.ly/3xyz)
    // while ignoring email addresses (@domain) and numeric decimals (12.45)
    const bareRe = /(^|[\s(])((?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:co\.in|org\.in|gov\.in|nic\.in|co\.uk|bank\.in|com|in|net|org|co|io|ly|gy|gd|gl|me|app|dev|site|online|live|club|shop|link|click|vip|cc|tk|ml|ga|cf|gq|xyz|top|info|buzz|icu|ru|cn|biz|ws|uk)(?![a-z0-9-])(?:\/[^\s<>"']*)?)/gi;
    let match;
    while ((match = bareRe.exec(src)) !== null) {
      const candidate = cleanTrail(match[2]);
      const prevIdx = match.index + (match[1] ? match[1].length : 0);
      if (prevIdx > 0 && src[prevIdx - 1] === '@') continue;
      if (!candidate || /^\d+\.\d+/.test(candidate)) continue;
      const full = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
      found.add(unwrapUrl(full));
    }

    return Array.from(found);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const api = {
    SENSITIVITY_THRESHOLDS,
    resolveThresholds,
    unwrapUrl,
    getHost,
    getRegistrableDomain,
    isTrustedHost,
    checkSenderImpersonation,
    hasUserInfoSpoof,
    normalizeVisualLookalike,
    normalizeLeetspeak,
    levenshtein,
    detectHomoglyphs,
    checkDangerousFile,
    quickLocalRisk,
    analyzeTarget,
    extractCleanText,
    extractUrlsFromText,
    scoreStage1: (txt) => (Stage1 ? Stage1.scoreMessage(txt) : { score: 0, verdict: 'SAFE', category: 'safe', reasons: [] }),
    createPillElement,
    showToastModal,
    showClickBlockModal,
    installClickInterceptor,
    escapeHtml,
    suggestSafeAlternative,
  };

  if (globalObj) {
    globalObj.PolicyGuardRules = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
