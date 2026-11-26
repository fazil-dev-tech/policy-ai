(function () {
  if (window.PolicyGuardRules) return;

  const TRUSTED_DOMAINS = [
    'starhealth.in',
    'hdfcergo.com',
    'icicilombard.com',
    'licindia.in',
    'bajajallianz.com',
    'newindia.co.in',
    'tataaig.com',
    'careinsurance.com',
    'nivabupa.com',
    'acko.com',
    'godigit.com',
    'sbigeneral.in',
    'irdai.gov.in',
    'bimabharosa.irdai.gov.in',
    'policybazaar.com',
    'razorpay.com',
    'billdesk.com',
    'payu.in',
    'mediassistindia.com',
    'google.com',
    'whatsapp.com',
  ];

  const RISKY_TLDS = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.loan', '.zip'];
  const BRAND_WORDS = ['starhealth', 'hdfc', 'icici', 'lic', 'bajaj', 'policybazaar', 'irdai', 'parivahan', 'echallan'];

  function unwrapUrl(rawUrl, saferUrl) {
    const candidate = saferUrl || rawUrl || '';
    try {
      const parsed = new URL(candidate, window.location.href);
      if (
        (parsed.hostname.includes('google.') && parsed.pathname === '/url') ||
        parsed.hostname === 'l.whatsapp.com' ||
        parsed.hostname === 'l.wl.co'
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

  function isTrustedHost(host) {
    if (!host) return false;
    return TRUSTED_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
  }

  function quickLocalRisk(url, surroundingText = '') {
    const host = getHost(url);
    const lowerUrl = String(url || '').toLowerCase();
    const ctx = String(surroundingText || '').toLowerCase();
    const reasons = [];
    let score = 0;

    if (isTrustedHost(host)) {
      return { status: 'safe', riskScore: 5, reasons: [`Verified domain (${host})`] };
    }

    if (/\.apk(\?|$|#)/i.test(lowerUrl) || /\.apk\b/i.test(ctx)) {
      score += 75;
      reasons.push('CRITICAL: Android .apk malware attachment or download link');
    }

    if (/enter.*upi\s*pin.*receiv|upi\s*pin.*refund|collect.*request.*claim|kyc.*update/i.test(ctx)) {
      score += 65;
      reasons.push('Reverse-UPI refund / fake KYC scam phrasing detected');
    }

    if (/urgent.*policy.*suspend|expire.*today|e-?challan|vahan.*fine/i.test(ctx)) {
      score += 35;
      reasons.push('Urgency / fake e-challan or policy suspension lure');
    }

    if (host.includes('xn--')) {
      score += 45;
      reasons.push('IDN Punycode lookalike domain (xn--)');
    }

    if (lowerUrl.startsWith('http://') && host && host !== 'localhost') {
      score += 25;
      reasons.push('Insecure HTTP link');
    }

    if (host && RISKY_TLDS.some((t) => host.endsWith(t))) {
      score += 30;
      reasons.push('Suspicious top-level domain');
    }

    if (host && BRAND_WORDS.some((b) => host.includes(b))) {
      score += 45;
      reasons.push(`Mentions insurer/portal brand on unverified domain (${host})`);
    }

    const bounded = Math.min(100, score);
    const status = bounded >= 60 ? 'threat' : bounded >= 25 ? 'suspicious' : 'safe';
    return { status, riskScore: bounded, reasons };
  }

  function createPillElement(verdict, showSafeBadges) {
    const status = verdict?.status || 'safe';
    const span = document.createElement('span');
    span.className = `pg-shield-pill pg-shield-${status}`;
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
    span.title = `PolicyGuard (${verdict?.domain || 'link'} — Risk ${verdict?.riskScore ?? 0}/100): ${reasons || 'Verified'}`;

    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToastModal(verdict);
    });

    return span;
  }

  function showToastModal(verdict) {
    const existing = document.getElementById('pg-inline-detail-banner');
    if (existing) existing.remove();

    const status = verdict?.status || 'suspicious';
    const box = document.createElement('div');
    box.id = 'pg-inline-detail-banner';
    box.className = `pg-floating-banner ${status === 'threat' ? 'threat' : 'suspicious'}`;

    const reasonsHtml = (verdict?.reasons || ['No details']).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    box.innerHTML = `
      <h4>
        <span>${status === 'threat' ? '🚨 PolicyGuard Threat Alert' : status === 'suspicious' ? '⚠ PolicyGuard Warning' : '✓ PolicyGuard Verified'}</span>
        <button class="pg-banner-btn ghost" id="pg-close-detail">✕</button>
      </h4>
      <p><strong>Domain:</strong> ${escapeHtml(verdict?.domain || 'Unknown')} (Risk: ${verdict?.riskScore ?? 0}/100)</p>
      <ul>${reasonsHtml}</ul>
      ${status === 'threat' ? '<p><strong>Emergency:</strong> Do NOT enter OTP/UPI PIN or install .apk files. If scammed, dial <strong>1930</strong> immediately.</p>' : ''}
      <div class="pg-banner-actions">
        ${verdict?.url ? '<button class="pg-banner-btn danger" id="pg-report-scam-btn">Report Scam</button>' : ''}
        <button class="pg-banner-btn ghost" id="pg-dismiss-btn">Dismiss</button>
      </div>
    `;

    document.body.appendChild(box);
    box.querySelector('#pg-close-detail')?.addEventListener('click', () => box.remove());
    box.querySelector('#pg-dismiss-btn')?.addEventListener('click', () => box.remove());
    box.querySelector('#pg-report-scam-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage(
        {
          type: 'PG_REPORT_SCAM',
          payload: {
            url: verdict.url,
            sourceSurface: verdict.sourceSurface || 'web',
            category: /apk/i.test((verdict.reasons || []).join(' ')) ? 'apk_malware' : 'phishing',
            description: `Reported inline via PolicyGuard extension: ${(verdict.reasons || []).join('; ')}`,
          },
        },
        () => {
          box.innerHTML = '<h4>✓ Scam Reported</h4><p>Submitted for admin review and community warning.</p>';
          setTimeout(() => box.remove(), 2200);
        }
      );
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.PolicyGuardRules = {
    unwrapUrl,
    getHost,
    isTrustedHost,
    quickLocalRisk,
    createPillElement,
    showToastModal,
    escapeHtml,
  };
})();
