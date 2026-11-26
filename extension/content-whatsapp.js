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

  function extractContextSignal(text = '') {
    // Only extract anonymized risk flag tokens — NEVER send personal chat text externally
    const flags = [];
    if (/\.apk\b/i.test(text)) flags.push('contains_apk_download');
    if (/enter.*upi\s*pin|upi\s*pin.*receiv|refund.*upi|collect\s*request/i.test(text)) flags.push('enter upi pin to receive refund');
    if (/urgent.*suspend|policy.*expire.*today|e-?challan|vahan/i.test(text)) flags.push('urgent policy suspend click');
    return flags.join(' ');
  }

  function cleanMatchedUrl(raw) {
    return String(raw || '').replace(/[),.!?;:'"]+$/g, '');
  }

  function scanWhatsAppMessages() {
    const candidates = Array.from(document.querySelectorAll('div[data-testid="msg-container"], div.message-in, div.message-out'));
    const batchItems = [];
    const targets = [];

    for (const node of candidates) {
      if (node.dataset.pgScanned === '1') continue;
      // Avoid duplicate badges when WhatsApp renders nested .message-in > [data-testid="msg-container"]
      if (node.parentElement?.closest('[data-pg-scanned="1"]')) continue;
      if (node.querySelector('div[data-testid="msg-container"]') && node !== node.querySelector('div[data-testid="msg-container"]')) {
        continue;
      }

      const text = node.textContent || '';
      const anchors = Array.from(node.querySelectorAll('a[href]'));
      const urlRegexMatches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];

      const urls = new Set();
      anchors.forEach((a) => {
        const u = cleanMatchedUrl(R.unwrapUrl(a.href, a.dataset.saferedirecturl));
        if (/^https?:\/\//i.test(u)) urls.add(u);
      });
      urlRegexMatches.forEach((u) => {
        const cleaned = cleanMatchedUrl(R.unwrapUrl(u));
        if (/^https?:\/\//i.test(cleaned)) urls.add(cleaned);
      });

      const apkMention = /\.apk\b/i.test(text);
      const contextFlags = extractContextSignal(text);

      if (urls.size === 0 && !apkMention && !contextFlags) continue;
      node.dataset.pgScanned = '1';

      if (urls.size === 0 && (apkMention || contextFlags)) {
        const dummyUrl = apkMention ? 'https://whatsapp-attachment.local/attachment.apk' : 'https://whatsapp-message.local/lure';
        const local = R.quickLocalRisk(dummyUrl, text);
        applyBadgeToNode(node, { ...local, domain: 'WhatsApp Message', sourceSurface: 'whatsapp' });
        continue;
      }

      // Evaluate ALL URLs in the message (up to 4) and surface the highest risk found
      const urlList = Array.from(urls).slice(0, 4);
      let worstLocal = R.quickLocalRisk(urlList[0], text);
      let primaryUrl = urlList[0];

      for (const candidateUrl of urlList) {
        const scoreObj = R.quickLocalRisk(candidateUrl, text);
        if (scoreObj.riskScore > worstLocal.riskScore) {
          worstLocal = scoreObj;
          primaryUrl = candidateUrl;
        }
      }

      if (worstLocal.status === 'threat') {
        applyBadgeToNode(node, { ...worstLocal, url: primaryUrl, domain: R.getHost(primaryUrl), sourceSurface: 'whatsapp' });
      } else {
        urlList.forEach((u) => batchItems.push({ url: u, contextFlags }));
        targets.push({ node, urlList, primaryUrl, local: worstLocal });
      }
    }

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'whatsapp', items: batchItems },
        (res) => {
          if (chrome.runtime.lastError) return;
          const map = res?.verdicts || {};
          targets.forEach(({ node, urlList, primaryUrl, local }) => {
            let chosen = null;
            for (const u of urlList) {
              const cand = map[u];
              if (cand && (!chosen || Number(cand.riskScore || 0) > Number(chosen.riskScore || 0))) {
                chosen = cand;
              }
            }
            const verdict = chosen || { ...local, url: primaryUrl, domain: R.getHost(primaryUrl), sourceSurface: 'whatsapp' };
            applyBadgeToNode(node, verdict);
          });
        }
      );
    }
  }

  function applyBadgeToNode(node, verdict) {
    if (node.querySelector('.pg-shield-pill')) return;
    if (verdict.status === 'threat') {
      node.classList.add('pg-box-threat');
      chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
    } else if (verdict.status === 'suspicious') {
      node.classList.add('pg-box-suspicious');
    }

    const pill = R.createPillElement(verdict, showSafeBadges);
    pill.style.marginTop = '4px';
    node.appendChild(pill);
  }

  function scheduleScan(mutations) {
    if (Array.isArray(mutations) && mutations.every((m) => Array.from(m.addedNodes).every((n) => n?.classList?.contains('pg-shield-pill')))) {
      return;
    }
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanWhatsAppMessages, 450);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scanWhatsAppMessages, 1500);
})();
