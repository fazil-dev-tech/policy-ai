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

  function extractContextSignal(text = '') {
    // Only extract anonymized risk flag phrases — NEVER send personal chat text externally
    const flags = [];
    if (/\.apk\b/i.test(text)) flags.push('contains_apk_download');
    if (/enter.*upi\s*pin|upi\s*pin.*receiv|refund.*upi/i.test(text)) flags.push('enter upi pin to receive refund');
    if (/urgent.*suspend|policy.*expire.*today|e-?challan|vahan/i.test(text)) flags.push('urgent policy suspend click');
    return flags.join(' ');
  }

  function scanWhatsAppMessages() {
    const nodes = document.querySelectorAll('div[data-testid="msg-container"], div.message-in, div.message-out');
    const batchItems = [];
    const targets = [];

    nodes.forEach((node) => {
      if (node.dataset.pgScanned === '1') return;

      const text = node.innerText || '';
      const anchors = Array.from(node.querySelectorAll('a[href]'));
      const urlRegexMatches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];

      const urls = new Set();
      anchors.forEach((a) => {
        const u = R.unwrapUrl(a.href, a.dataset.saferedirecturl);
        if (/^https?:\/\//i.test(u)) urls.add(u);
      });
      urlRegexMatches.forEach((u) => urls.add(R.unwrapUrl(u)));

      const apkMention = /\.apk\b/i.test(text);
      const contextFlags = extractContextSignal(text);

      if (urls.size === 0 && !apkMention && !contextFlags) return;
      node.dataset.pgScanned = '1';

      if (urls.size === 0 && (apkMention || contextFlags)) {
        // Pure text / attachment scam warning inside WhatsApp without URL
        const local = R.quickLocalRisk('https://whatsapp-attachment.local/attachment.apk', text);
        applyBadgeToNode(node, { ...local, domain: 'WhatsApp Message', sourceSurface: 'whatsapp' });
        return;
      }

      const firstUrl = Array.from(urls)[0];
      const local = R.quickLocalRisk(firstUrl, text);
      if (local.status === 'threat') {
        applyBadgeToNode(node, { ...local, url: firstUrl, domain: R.getHost(firstUrl), sourceSurface: 'whatsapp' });
      } else {
        batchItems.push({ url: firstUrl, contextFlags });
        targets.push({ node, url: firstUrl, local });
      }
    });

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'whatsapp', items: batchItems },
        (res) => {
          const map = res?.verdicts || {};
          targets.forEach(({ node, url, local }) => {
            const v = map[url] || { ...local, url, domain: R.getHost(url), sourceSurface: 'whatsapp' };
            applyBadgeToNode(node, v);
          });
        }
      );
    }
  }

  function applyBadgeToNode(node, verdict) {
    if (node.querySelector('.pg-shield-pill')) return;
    if (verdict.status === 'threat') node.classList.add('pg-box-threat');
    else if (verdict.status === 'suspicious') node.classList.add('pg-box-suspicious');

    const pill = R.createPillElement(verdict, showSafeBadges);
    pill.style.marginTop = '4px';
    node.appendChild(pill);
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanWhatsAppMessages, 450);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scanWhatsAppMessages, 1500);
})();
