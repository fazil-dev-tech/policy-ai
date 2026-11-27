jest.mock('../src/config/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(),
        storage: { from: jest.fn() },
    },
    createAuthClient: jest.fn(),
    checkSupabaseHealth: jest.fn(),
}));

const security = require('../src/services/security.service');

describe('security.service Browser Shield heuristics & URL safety', () => {
    const verifiedDomains = [
        { domain: 'hdfcergo.com', provider_name: 'HDFC ERGO', category: 'insurer' },
        { domain: 'irdai.gov.in', provider_name: 'IRDAI', category: 'regulator' },
    ];

    test('unwrapRedirectUrl unwraps Google/WhatsApp redirectors cleanly', () => {
        expect(security.unwrapRedirectUrl('https://www.google.com/url?q=https%3A%2F%2Fevil.tk%2Fclaim')).toBe(
            'https://evil.tk/claim'
        );
        expect(security.unwrapRedirectUrl('https://l.whatsapp.com/?u=https%3A%2F%2Fhdfcergo.com%2F')).toBe(
            'https://hdfcergo.com/'
        );
    });

    test('extractHostname & getRegistrableDomain normalize Indian domains and subdomains', () => {
        expect(security.extractHostname('https://www.claims.hdfcergo.com/status')).toBe('claims.hdfcergo.com');
        expect(security.getRegistrableDomain('claims.hdfcergo.com')).toBe('hdfcergo.com');
        expect(security.getRegistrableDomain('portal.irdai.gov.in')).toBe('irdai.gov.in');
        expect(security.getRegistrableDomain('scam-claim.vercel.app')).toBe('scam-claim.vercel.app');
    });

    test('sanitizeUrlForStorage strips query strings and fragments', () => {
        expect(security.sanitizeUrlForStorage('https://hdfcergo.com/renew?token=secret#frag')).toBe(
            'https://hdfcergo.com/renew'
        );
    });

    test('evaluateLocalSignals flags APK malware, reverse-UPI & brand typosquatting while whitelisting official domains', () => {
        const official = security.evaluateLocalSignals({
            url: 'https://www.hdfcergo.com/health-insurance',
            hostname: 'hdfcergo.com',
            contextText: '',
            verifiedDomains,
        });
        expect(official.status).toBe('safe');
        expect(official.riskScore).toBeLessThan(15);

        const apkThreat = security.evaluateLocalSignals({
            url: 'https://hdfcergo-claim-bonus.tk/PolicyUpdate.apk',
            hostname: 'hdfcergo-claim-bonus.tk',
            contextText: 'contains_apk',
            verifiedDomains,
        });
        expect(apkThreat.status).toBe('threat');
        expect(apkThreat.riskScore).toBeGreaterThanOrEqual(60);
        expect(apkThreat.domainRiskScore).toBeGreaterThanOrEqual(60);
        expect(apkThreat.domainReasons.length).toBeGreaterThan(0);

        const upiScam = security.evaluateLocalSignals({
            url: 'https://hdfcergo.com/refund',
            hostname: 'hdfcergo.com',
            contextText: 'Enter your UPI PIN to receive claim refund immediately',
            verifiedDomains,
        });
        expect(upiScam.status).toBe('threat');
        expect(upiScam.riskScore).toBeGreaterThanOrEqual(60);
        expect(upiScam.domainRiskScore).toBe(0);
    });

    test('unwraps Outlook SafeLinks, Instagram l.instagram.com, Facebook & Telegram redirectors', () => {
        expect(
            security.unwrapRedirectUrl(
                'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fevil.top%2Fclaim.apk&data=abc'
            )
        ).toBe('https://evil.top/claim.apk');
        expect(
            security.unwrapRedirectUrl('https://l.instagram.com/?u=https%3A%2F%2Fstarhea1th.in%2Fkyc')
        ).toBe('https://starhea1th.in/kyc');
        expect(security.unwrapRedirectUrl('https://t.me/iv?url=https%3A%2F%2Fbit.ly%2Fpromo')).toBe(
            'https://bit.ly/promo'
        );
    });

    test('catches @ userinfo auth spoofing without flagging social @handle URLs', () => {
        expect(security.extractHostname('https://hdfcergo.com@evil-scam.top/login')).toBe('evil-scam.top');
        const spoof = security.evaluateLocalSignals({
            url: 'https://hdfcergo.com@evil-scam.top/login',
            hostname: 'evil-scam.top',
            verifiedDomains,
        });
        expect(spoof.status).toBe('threat');
        expect(spoof.riskScore).toBeGreaterThanOrEqual(75);
        expect(spoof.threatCategory).toBe('phishing');

        expect(security.hasUserInfoSpoof('https://instagram.com/@officialhandle')).toBe(false);
    });

    test('catches double-extension, uppercase .APK, and executables even on whitelisted/cloud hosts', () => {
        const driveApk = security.evaluateLocalSignals({
            url: 'https://drive.google.com/uc?id=99&file=Policy.PDF.APK',
            hostname: 'drive.google.com',
            verifiedDomains,
        });
        expect(driveApk.status).toBe('threat');
        expect(driveApk.riskScore).toBeGreaterThanOrEqual(80);
        expect(driveApk.threatCategory).toBe('apk_malware');

        const whitelistedExe = security.evaluateLocalSignals({
            url: 'https://hdfcergo.com/patch',
            hostname: 'hdfcergo.com',
            filename: 'ClaimForm.pdf.ps1',
            verifiedDomains,
        });
        expect(whitelistedExe.status).toBe('threat');
        expect(whitelistedExe.riskScore).toBeGreaterThanOrEqual(80);
    });

    test('catches Cyrillic homoglyphs, zero-width spoofs & visual substitution while protecting ccTLDs', () => {
        const cyrillic = security.evaluateLocalSignals({
            url: 'https://stаrhealth.in/login',
            hostname: 'stаrhealth.in',
            verifiedDomains,
        });
        expect(cyrillic.status).toBe('threat');
        expect(cyrillic.riskScore).toBeGreaterThanOrEqual(60);

        const visual = security.evaluateLocalSignals({
            url: 'https://starhea1th.in/renew',
            hostname: 'starhea1th.in',
            verifiedDomains,
        });
        expect(visual.status).toBe('threat');
        expect(visual.threatCategory).toBe('impersonation');

        const paypalLookalike = security.evaluateLocalSignals({
            url: 'https://paypa1.com/signin',
            hostname: 'paypa1.com',
            verifiedDomains,
        });
        expect(paypalLookalike.status).toBe('threat');

        const googleIndia = security.evaluateLocalSignals({
            url: 'https://www.google.co.in/search?q=insurance',
            hostname: 'google.co.in',
            verifiedDomains,
        });
        expect(googleIndia.status).toBe('safe');

        const siteBuilderPhish = security.evaluateLocalSignals({
            url: 'https://sites.google.com/view/urgent-kyc-claim',
            hostname: 'sites.google.com',
            contextText: 'urgent policy suspend click kyc',
            verifiedDomains,
        });
        expect(siteBuilderPhish.status).not.toBe('safe');
    });

    test('detects leetspeak OTP/scam lures and avoids false positives on code/promo context', () => {
        const leetOtp = security.evaluateLocalSignals({
            url: 'https://random-chat.org/msg',
            hostname: 'random-chat.org',
            contextText: 'Sh@re y0ur 0TP c0de immediately or y0ur b@nk @cc0unt w1ll be bl0cked',
            verifiedDomains,
        });
        expect(leetOtp.status).toBe('threat');
        expect(leetOtp.threatCategory).toBe('otp_phishing');

        const devCode = security.evaluateLocalSignals({
            url: 'https://github.com/org/repo',
            hostname: 'github.com',
            contextText: 'python code for the navbar component with verification',
            verifiedDomains,
        });
        expect(devCode.status).toBe('safe');
        expect(devCode.riskScore).toBeLessThanOrEqual(5);

        const promo = security.evaluateLocalSignals({
            url: 'https://amazon.in/deals',
            hostname: 'amazon.in',
            contextText: 'Use promo code SAVE20 at checkout or scan QR code for menu',
            verifiedDomains,
        });
        expect(promo.status).toBe('safe');
    });

    test('handles raw IP hosts vs localhost dev loopback and enforces sensitivity thresholds & lists', () => {
        const localDev = security.evaluateLocalSignals({
            url: 'http://localhost:5173/shield',
            hostname: 'localhost',
            verifiedDomains,
        });
        expect(localDev.status).toBe('safe');
        expect(localDev.riskScore).toBe(0);

        const rawIpHttp = security.evaluateLocalSignals({
            url: 'http://45.33.32.156/login',
            hostname: '45.33.32.156',
            verifiedDomains,
        });
        expect(rawIpHttp.status).toBe('threat');
        expect(rawIpHttp.riskScore).toBeGreaterThanOrEqual(75);

        const rawIpHttps = security.evaluateLocalSignals({
            url: 'https://45.33.32.156/login',
            hostname: '45.33.32.156',
            verifiedDomains,
            sensitivity: 'high',
        });
        expect(rawIpHttps.status).toBe('threat');

        const relaxedShortener = security.evaluateLocalSignals({
            url: 'https://bit.ly/policy',
            hostname: 'bit.ly',
            verifiedDomains,
            sensitivity: 'relaxed',
        });
        expect(relaxedShortener.status).toBe('safe');

        const cleanDomain = security.evaluateLocalSignals({
            url: 'https://notevil.com',
            hostname: 'notevil.com',
            blacklist: ['evil.com'],
            verifiedDomains,
        });
        expect(cleanDomain.status).toBe('safe');

        const subBlocked = security.evaluateLocalSignals({
            url: 'https://sub.evil.com',
            hostname: 'sub.evil.com',
            blacklist: ['evil.com'],
            verifiedDomains,
        });
        expect(subBlocked.status).toBe('threat');

        const whitelistWithApk = security.evaluateLocalSignals({
            url: 'https://trusted-partner.org/PolicyUpdate.apk',
            hostname: 'trusted-partner.org',
            whitelist: ['trusted-partner.org'],
            verifiedDomains,
        });
        expect(whitelistWithApk.status).toBe('threat');
    });

    test('extension/shared/localRules.js mirrors all scenarios cleanly offline', () => {
        const extRules = require('../../extension/shared/localRules');

        expect(extRules.isTrustedHost('sub.sites.google.com')).toBe(false);
        expect(extRules.isTrustedHost('drive.google.com')).toBe(false);
        expect(extRules.isTrustedHost('starhealth.in')).toBe(true);
        expect(extRules.getRegistrableDomain('portal.irdai.gov.in')).toBe('irdai.gov.in');

        expect(extRules.quickLocalRisk('https://google.com@evil.top/login').status).toBe('threat');
        expect(extRules.quickLocalRisk('https://drive.google.com/doc', '', { filename: 'Report.pdf.exe' }).status).toBe('threat');
        expect(extRules.quickLocalRisk('https://arnazon.in/pay').status).toBe('threat');
        expect(extRules.quickLocalRisk('https://chat.example', 'Sh@re y0ur 0TP c0de n0w').status).toBe('threat');
        expect(extRules.quickLocalRisk('https://chat.example', 'python code for the navbar component').status).toBe('safe');
        expect(extRules.quickLocalRisk('https://amazon.in', 'Use promo code SAVE20').status).toBe('safe');
        expect(extRules.quickLocalRisk('http://localhost:5173/dashboard').status).toBe('safe');
        expect(extRules.quickLocalRisk('https://45.33.32.156/login', '', { sensitivity: 'high' }).status).toBe('threat');
    });

    test('extension contains zero plaintext API keys, zero innerHTML sinks & builds safe DOM overlays', () => {
        const fs = require('fs');
        const path = require('path');
        const extDir = path.join(__dirname, '..', '..', 'extension');
        const jsFiles = [
            'background.js',
            'popup.js',
            'site-bridge.js',
            'content-whatsapp.js',
            'content-gmail.js',
            'content-social.js',
            'content-web.js',
            'shared/stage1Engine.js',
            'shared/localRules.js',
        ];
        for (const rel of jsFiles) {
            const code = fs.readFileSync(path.join(extDir, rel), 'utf8');
            expect(code).not.toMatch(/innerHTML\s*=/);
            expect(code).not.toMatch(/x-apikey/i);
            expect(code).not.toMatch(/virustotal\.com\/api/i);
        }

        // Verify DOM overlay creation cleanly without innerHTML
        const created = [];
        const makeFakeNode = (tag) => {
            const node = {
                tagName: tag.toUpperCase(),
                className: '',
                textContent: '',
                children: [],
                style: {},
                classList: {
                    _set: new Set(),
                    add(c) { this._set.add(c); node.className += ` ${c}`; },
                    contains(c) { return this._set.has(c); },
                },
                listeners: {},
                appendChild(c) { this.children.push(c); return c; },
                setAttribute(k, v) { this[k] = v; },
                addEventListener(ev, fn) { this.listeners[ev] = fn; },
                remove() {},
            };
            created.push(node);
            return node;
        };
        const prevDoc = global.document;
        const prevWin = global.window;
        try {
            global.document = {
                createElement: makeFakeNode,
                createTextNode: (t) => ({ nodeType: 3, textContent: t }),
                getElementById: () => null,
                body: { appendChild: (n) => created.push(n) },
            };
            global.window = { innerWidth: 1280, innerHeight: 720, location: { href: 'https://web.whatsapp.com' } };

            jest.resetModules();
            const extRules = require('../../extension/shared/localRules');
            const pill = extRules.createPillElement(
                { status: 'threat', domain: 'evil.tk', riskScore: 85, reasons: ['Malicious <script>alert(1)</script>'] },
                false
            );
            expect(pill.textContent).toContain('THREAT');
            extRules.showToastModal({
                status: 'threat',
                domain: 'evil.tk',
                riskScore: 85,
                threatCategory: 'apk_malware',
                reasons: ['<img src=x onerror=alert(1)>'],
                vtStats: { malicious: 3, totalVendors: 92, flaggedBy: [{ vendor: 'Fortinet', result: 'Phishing' }] },
            });
            expect(created.some((n) => n.id === 'pg-inline-detail-banner')).toBe(true);
            expect(created.some((n) => String(n.textContent).includes('Fortinet: Phishing'))).toBe(true);
        } finally {
            global.document = prevDoc;
            global.window = prevWin;
        }
    });

    test('Stage-1 multilingual scam classifier, negated OTP safety, brand token boundary & Gmail impersonation', () => {
        const extRules = require('../../extension/shared/localRules');

        // Zero false positives on StackOverflow ("st[acko]verflow"), 3-letter acronyms (rbi.org.in, abi.com), OpenAI/Supabase/GitLab/Google
        expect(security.evaluateLocalSignals({ url: 'https://stackoverflow.com/questions', hostname: 'stackoverflow.com', verifiedDomains }).status).toBe('safe');
        expect(security.evaluateLocalSignals({ url: 'https://www.rbi.org.in', hostname: 'rbi.org.in', verifiedDomains }).status).toBe('safe');
        expect(security.evaluateLocalSignals({ url: 'https://abi.com', hostname: 'abi.com', verifiedDomains }).status).toBe('safe');
        expect(extRules.quickLocalRisk('https://stackoverflow.com/questions').status).toBe('safe');
        expect(extRules.quickLocalRisk('https://www.rbi.org.in').status).toBe('safe');
        expect(extRules.isTrustedHost('accounts.google.com')).toBe(true);
        expect(extRules.isTrustedHost('openai.com')).toBe(true);
        expect(extRules.isTrustedHost('supabase.com')).toBe(true);
        expect(extRules.isTrustedHost('gitlab.com')).toBe(true);
        expect(extRules.isTrustedHost('gitlab.io')).toBe(false);

        // Negated genuine OTP advisory & Google security alert stay SAFE
        expect(
            security.evaluateLocalSignals({
                url: 'https://hdfcbank.com',
                hostname: 'hdfcbank.com',
                contextText: '482910 is your OTP for HDFC Bank login. Please do not share this OTP with anyone.',
                verifiedDomains,
            }).status
        ).toBe('safe');
        expect(
            extRules.quickLocalRisk(
                'https://accounts.google.com',
                'Security alert - A new sign-in on Windows. If this was not you? check activity.'
            ).status
        ).toBe('safe');

        // Hinglish utility disconnect, CBI Digital Arrest + AnyDesk, Task Scam caught accurately
        expect(
            extRules.quickLocalRisk(
                'https://whatsapp-message.local/check',
                'Aapka bijli connection aaj raat 9 baje cut ho jayega, pay fee turant at http://bescom-pay.top'
            ).status
        ).toBe('threat');
        expect(
            security.evaluateLocalSignals({
                url: 'https://chat.example.org',
                hostname: 'chat.example.org',
                contextText: 'CBI Cyber Cell: Arrest warrant issued for money laundering. Stay on video call, download AnyDesk immediately.',
                verifiedDomains,
            }).status
        ).toBe('threat');
        expect(
            extRules.quickLocalRisk(
                'https://whatsapp-message.local/check',
                'Work from home part-time job! Like YouTube videos and earn Rs 5000 daily on Telegram.'
            ).status
        ).toBe('threat');

        // Gmail Display-Name vs Sender-Domain impersonation
        expect(extRules.checkSenderImpersonation('Google Security', 'random-login.top')).not.toBeNull();
        expect(extRules.checkSenderImpersonation('HDFC Bank Support', 'gmail.com')).not.toBeNull();
        expect(extRules.checkSenderImpersonation('FedEx Express Customs', 'gmail.com')).not.toBeNull();
        expect(extRules.checkSenderImpersonation('FedEx Notifications', 'fedex.com')).toBeNull();
        expect(extRules.checkSenderImpersonation('Google Gemini', 'accounts.google.com')).toBeNull();
        expect(extRules.checkSenderImpersonation('Supabase', 'supabase.io')).toBeNull();
    });

    test('Stage-1 brand token impersonation, bare URL extraction & SSRF redirect safety', async () => {
        const extRules = require('../../extension/shared/localRules');

        // Hyphenated brand phishing domains caught across backend & extension offline engine
        expect(
            security.evaluateLocalSignals({
                url: 'https://hdfc-kyc-verify.com/update',
                hostname: 'hdfc-kyc-verify.com',
                verifiedDomains,
            }).status
        ).toBe('threat');
        expect(extRules.quickLocalRisk('https://paytm-refund-support.net/claim').status).toBe('threat');
        expect(extRules.quickLocalRisk('https://fedex-parcel-customs.in/pay').status).toBe('threat');
        expect(extRules.quickLocalRisk('https://hdfc-kyc.vercel.app/verify').status).toBe('threat');

        // Official domains remain strictly safe even when surrounding anchor/page text mentions their brand or KYC/Track
        expect(security.evaluateLocalSignals({ url: 'https://www.fedex.com/track', hostname: 'fedex.com', contextText: 'FedEx Official Track', verifiedDomains }).status).toBe('safe');
        expect(security.evaluateLocalSignals({ url: 'https://www.kotak.com', hostname: 'kotak.com', verifiedDomains }).status).toBe('safe');
        expect(extRules.quickLocalRisk('https://www.fedex.com/track', 'FedEx Official Track').status).toBe('safe');
        expect(extRules.quickLocalRisk('https://www.hdfcbank.com', 'HDFC Bank KYC Update Portal').status).toBe('safe');
        expect(extRules.quickLocalRisk('https://www.airtel.in/recharge').status).toBe('safe');
        expect(extRules.quickLocalRisk('https://www.jio.com').status).toBe('safe');

        // Synthetic internal .local attachment URLs never emit spurious brand keyword hits
        const apkSynth = extRules.quickLocalRisk('https://whatsapp-attachment.local/Policy.apk', 'Policy.apk', { filename: 'Policy.apk' });
        expect(apkSynth.status).toBe('threat');
        expect(apkSynth.reasons.some((r) => r.includes('whatsapp-attachment.local'))).toBe(false);

        // extractUrlsFromText extracts bare domains & shorteners while ignoring emails and numbers
        const extracted = extRules.extractUrlsFromText(
            'Rs 4500.50 pending! Contact user@hdfcbank.com or open hdfc-kyc-verify.com/update and bit.ly/3xY9z'
        );
        expect(extracted).toContain('https://hdfc-kyc-verify.com/update');
        expect(extracted).toContain('https://bit.ly/3xY9z');
        expect(extracted.some((u) => u.includes('4500'))).toBe(false);
        expect(extracted.some((u) => u.includes('hdfcbank.com'))).toBe(false);

        // SSRF guard: private/loopback URLs never trigger shortener redirects
        const ssrfRes = await security.resolveShortUrlAsync('http://127.0.0.1:5000/api/health');
        expect(ssrfRes.expanded).toBe(false);
    });
});
