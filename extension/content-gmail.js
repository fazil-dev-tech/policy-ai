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
    if (chrome.runtime.lastError) return;
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
    if (/\.apk\b/i.test(text)) flags.push('contains_apk_download');
    if (/enter.*upi\s*pin|refund.*upi|collect\s*request/i.test(text)) flags.push('enter upi pin to receive refund');
    if (/urgent.*policy.*suspend|expire.*today|kyc.*update/i.test(text)) flags.push('urgent policy suspend click');
    return flags.join(' ');
  }

  function scanGmailUi() {
    // 1. Check Inbox Rows (`tr.zA`) by sender domain & insurance claim/APK cues locally
    document.querySelectorAll('tr.zA').forEach((row) => {
      if (row.dataset.pgScanned === '1') return;

      const senders = Array.from(row.querySelectorAll('span[email]'));
      if (senders.length === 0) return; // Defer marking scanned until hydrated
      row.dataset.pgScanned = '1';

      const senderDomains = senders.map((el) => {
        const em = el.getAttribute('email') || '';
        return em.includes('@') ? em.split('@')[1].toLowerCase() : '';
      }).filter(Boolean);
      const senderDomain = senderDomains[0] || '';
      if (!senderDomain) return;

      const rowSnippet = (row.textContent || '').slice(0, 260);
      const flags = extractAnonymizedFlags(rowSnippet);
      const cellTarget = row.querySelector('td.xY, td.yX, td.a4W');
      if (!cellTarget) return;

      // Require word boundaries around \blic\b & exact insurer brand keywords so "click"/"public" never false-positive
      const looksLikeInsurance = /\b(policy|insurance|claim|star health|hdfc ergo|icici lombard|lic|lic india|irdai|renewal)\b/i.test(rowSnippet);

      if (senderDomains.every((d) => R.isTrustedHost(d)) && !flags.includes('apk') && !flags.includes('upi')) {
        cellTarget.appendChild(
          R.createPillElement(
            { status: 'safe', domain: senderDomain, riskScore: 5, reasons: [`Verified sender (${senderDomain})`], sourceSurface: 'gmail' },
            showSafeBadges
          )
        );
        return;
      }

      // Flag free webmail / suspicious domain claiming urgent renewal, KYC, or refund action
      const isPublicWebmail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(senderDomain);
      const hasActionLure = /\b(click|verify|refund|kyc|suspend|expire|payment|upi)\b|\.apk\b/i.test(rowSnippet);
      if (looksLikeInsurance && (flags || (isPublicWebmail && hasActionLure) || senderDomain.includes('xn--'))) {
        const local = R.quickLocalRisk(`https://${senderDomain}`, `${rowSnippet} ${flags}`);
        const status = flags.includes('apk') || flags.includes('upi') ? 'threat' : 'suspicious';
        const reasons = local.reasons.length ? local.reasons : [`Unverified insurance sender (${senderDomain})`];
        if (isPublicWebmail) reasons.push(`Official insurers rarely send automated renewal/refund actions from @${senderDomain}`);
        if (status === 'threat') {
          row.classList.add('pg-box-threat');
          chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
        } else {
          row.classList.add('pg-box-suspicious');
        }
        cellTarget.appendChild(
          R.createPillElement(
            {
              status,
              domain: senderDomain,
              riskScore: status === 'threat' ? 85 : 45,
              reasons,
              url: isPublicWebmail ? '' : `https://${senderDomain}`,
              sourceSurface: 'gmail',
              safeAlternative: R.suggestSafeAlternative(senderDomain, rowSnippet),
            },
            showSafeBadges
          )
        );
      }
    });

    // 2. Check open message body (`div.a3s`) context + attachment chips + links
    document.querySelectorAll('div.a3s').forEach((bodyEl) => {
      if (bodyEl.dataset.pgBodyScanned === '1') return;
      const bodyText = (bodyEl.textContent || '').slice(0, 2200);
      const bodyFlags = extractAnonymizedFlags(bodyText);
      const hasApkChip = Array.from(document.querySelectorAll('div.aZo span, span.aV3')).some((el) => /\.apk\b/i.test(el.textContent || ''));

      if ((bodyFlags.includes('upi') || hasApkChip) && !bodyEl.querySelector('.pg-gmail-body-pill')) {
        bodyEl.dataset.pgBodyScanned = '1';
        const dummyUrl = hasApkChip ? 'https://gmail-attachment.local/attachment.apk' : 'https://gmail-message.local/lure';
        const local = R.quickLocalRisk(dummyUrl, `${bodyText} ${hasApkChip ? 'attachment.apk' : ''}`);
        const pill = R.createPillElement({ ...local, domain: 'Gmail Body Signal', sourceSurface: 'gmail' }, showSafeBadges);
        pill.classList.add('pg-gmail-body-pill');
        bodyEl.prepend(pill);
        if (local.status === 'threat') {
          chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
        }
      }
    });

    const anchors = Array.from(document.querySelectorAll('div.a3s a[href]'));
    const batchItems = [];
    const linkPairs = [];

    anchors.forEach((a) => {
      if (a.dataset.pgScanned === '1') return;
      const realUrl = R.unwrapUrl(a.href, a.getAttribute('data-saferedirecturl'));
      if (!/^https?:\/\//i.test(realUrl)) return;
      a.dataset.pgScanned = '1';

      const containerText = `${a.textContent || ''} ${(a.closest('p, div, td')?.textContent || '').slice(0, 260)}`;
      const local = R.quickLocalRisk(realUrl, `${containerText} ${realUrl}`);
      if (local.status === 'threat') {
        a.classList.add('pg-box-threat');
        a.insertAdjacentElement('afterend', R.createPillElement({ ...local, url: realUrl, domain: R.getHost(realUrl), sourceSurface: 'gmail' }, showSafeBadges));
        chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
      } else {
        batchItems.push({ url: realUrl, contextFlags: extractAnonymizedFlags(containerText) });
        linkPairs.push({ a, realUrl, local });
      }
    });

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'gmail', items: batchItems },
        (res) => {
          if (chrome.runtime.lastError) return;
          const map = res?.verdicts || {};
          linkPairs.forEach(({ a, realUrl, local }) => {
            const v = map[realUrl] || { ...local, url: realUrl, domain: R.getHost(realUrl), sourceSurface: 'gmail' };
            if (v.status === 'threat') {
              a.classList.add('pg-box-threat');
              chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
            } else if (v.status === 'suspicious') {
              a.classList.add('pg-box-suspicious');
            }
            a.insertAdjacentElement('afterend', R.createPillElement(v, showSafeBadges));
          });
        }
      );
    }
  }

  function scheduleScan(mutations) {
    if (Array.isArray(mutations) && mutations.every((m) => Array.from(m.addedNodes).every((n) => n?.classList?.contains('pg-shield-pill')))) {
      return;
    }
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanGmailUi, 550);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scanGmailUi, 1800);
})();
