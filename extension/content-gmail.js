(function () {
  const R = window.PolicyGuardRules;
  if (!R) return;

  let showSafeBadges = false;
  let scanTimer = null;

  function syncSafeVisibility() {
    document.querySelectorAll('.pg-shield-safe').forEach((el) => {
      if (showSafeBadges) el.classList.remove('pg-shield-hidden-safe');
      else el.classList.add('pg-shield-hidden-safe');
    });
  }

  chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (cfg) => {
    if (cfg) {
      showSafeBadges = Boolean(cfg.showSafeBadges);
      syncSafeVisibility();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.showSafeBadges) {
      showSafeBadges = Boolean(changes.showSafeBadges.newValue);
      syncSafeVisibility();
    }
  });

  function extractAnonymizedFlags(text = '') {
    const flags = [];
    if (/\.apk\b/i.test(text)) flags.push('contains_apk');
    if (/enter.*upi\s*pin|refund.*upi|collect\s*request/i.test(text)) flags.push('enter upi pin to receive refund');
    if (/urgent.*policy.*suspend|expire.*today|kyc.*update/i.test(text)) flags.push('urgent policy suspend click');
    return flags.join(' ');
  }

  function scanGmailUi() {
    // 1. Check Inbox Rows (`tr.zA`) by sender domain & insurance claim/APK cues locally
    document.querySelectorAll('tr.zA').forEach((row) => {
      if (row.dataset.pgScanned === '1') return;
      row.dataset.pgScanned = '1';

      const senderEl = row.querySelector('span[email]');
      const senderEmail = senderEl?.getAttribute('email') || '';
      const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1].toLowerCase() : '';
      const rowSnippet = (row.innerText || '').slice(0, 260);
      const flags = extractAnonymizedFlags(rowSnippet);

      if (!senderDomain) return;

      const looksLikeInsurance = /policy|insurance|claim|star health|hdfc|icici|lic|irdai|renewal/i.test(rowSnippet);
      if (senderDomain && R.isTrustedHost(senderDomain)) {
        const target = row.querySelector('td.xY, td.yX') || row;
        target.appendChild(
          R.createPillElement(
            { status: 'safe', domain: senderDomain, riskScore: 5, reasons: [`Verified sender (${senderDomain})`], sourceSurface: 'gmail' },
            showSafeBadges
          )
        );
        return;
      }

      // Flag free webmail / suspicious domain claiming urgent renewal, KYC, or refund action
      const isPublicWebmail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(senderDomain);
      const hasActionLure = /click|verify|refund|kyc|suspend|expire|payment|upi|\.apk/i.test(rowSnippet);
      if (looksLikeInsurance && (flags || (isPublicWebmail && hasActionLure) || senderDomain.includes('xn--'))) {
        const local = R.quickLocalRisk(`https://${senderDomain}`, `${rowSnippet} ${flags}`);
        const status = flags.includes('apk') || flags.includes('upi') ? 'threat' : 'suspicious';
        const reasons = local.reasons.length ? local.reasons : [`Unverified insurance sender (${senderDomain})`];
        if (isPublicWebmail) reasons.push(`Official insurers rarely send automated renewal/refund actions from @${senderDomain}`);
        if (status === 'threat') row.classList.add('pg-box-threat');
        else row.classList.add('pg-box-suspicious');
        const target = row.querySelector('td.yX') || row;
        target.appendChild(
          R.createPillElement(
            { status, domain: senderDomain, riskScore: status === 'threat' ? 85 : 45, reasons, url: `https://${senderDomain}`, sourceSurface: 'gmail' },
            showSafeBadges
          )
        );
      }
    });

    // 2. Check links inside open Gmail message body (`div.a3s a[href]`)
    const anchors = Array.from(document.querySelectorAll('div.a3s a[href]'));
    const batchItems = [];
    const linkPairs = [];

    anchors.forEach((a) => {
      if (a.dataset.pgScanned === '1') return;
      const realUrl = R.unwrapUrl(a.href, a.getAttribute('data-saferedirecturl'));
      if (!/^https?:\/\//i.test(realUrl)) return;
      a.dataset.pgScanned = '1';

      const anchorText = `${a.innerText || ''} ${realUrl}`;
      const local = R.quickLocalRisk(realUrl, anchorText);
      if (local.status === 'threat') {
        a.classList.add('pg-box-threat');
        a.insertAdjacentElement('afterend', R.createPillElement({ ...local, url: realUrl, domain: R.getHost(realUrl), sourceSurface: 'gmail' }, showSafeBadges));
      } else {
        batchItems.push({ url: realUrl, contextFlags: extractAnonymizedFlags(anchorText) });
        linkPairs.push({ a, realUrl, local });
      }
    });

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'gmail', items: batchItems },
        (res) => {
          const map = res?.verdicts || {};
          linkPairs.forEach(({ a, realUrl, local }) => {
            const v = map[realUrl] || { ...local, url: realUrl, domain: R.getHost(realUrl), sourceSurface: 'gmail' };
            if (v.status === 'threat') a.classList.add('pg-box-threat');
            else if (v.status === 'suspicious') a.classList.add('pg-box-suspicious');
            a.insertAdjacentElement('afterend', R.createPillElement(v, showSafeBadges));
          });
        }
      );
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanGmailUi, 550);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scanGmailUi, 1800);
})();
