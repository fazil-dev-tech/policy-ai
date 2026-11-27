(function () {
  const R = window.PolicyGuardRules;
  if (!R) return;

  let cfgState = {
    enabled: true,
    showSafeBadges: false,
    sensitivity: 'balanced',
    interceptClicks: true,
    whitelist: [],
    blacklist: [],
  };
  let scanTimer = null;
  let lastHref = window.location.href;

  const isTelegram =
    window.location.hostname.includes('telegram.org') ||
    (!window.location.hostname.includes('instagram.com') &&
      Boolean(document.querySelector('.bubble[data-mid], .Message[data-message-id], .message-list-item[data-message-id]')));
  const SURFACE = isTelegram ? 'telegram' : 'instagram';
  const diagStats = { surface: SURFACE, adapter: SURFACE, found: 0, checked: 0, threats: 0, safe: 0 };

  function syncSafeVisibility() {
    document.querySelectorAll('.pg-shield-safe').forEach((el) => {
      if (cfgState.showSafeBadges && cfgState.enabled) el.classList.remove('pg-shield-hidden-safe');
      else el.classList.add('pg-shield-hidden-safe');
    });
  }

  function applySettingsPatch(cfg) {
    if (!cfg) return;
    cfgState = {
      enabled: cfg.enabled !== false,
      showSafeBadges: Boolean(cfg.showSafeBadges),
      sensitivity: cfg.sensitivity || 'balanced',
      interceptClicks: cfg.interceptClicks !== false,
      whitelist: Array.isArray(cfg.whitelist) ? cfg.whitelist : [],
      blacklist: Array.isArray(cfg.blacklist) ? cfg.blacklist : [],
    };
    syncSafeVisibility();
  }

  function loadInitialSettings() {
    if (chrome.storage?.local) {
      chrome.storage.local.get(['enabled', 'showSafeBadges', 'sensitivity', 'interceptClicks', 'whitelist', 'blacklist'], (stored) => {
        if (!chrome.runtime.lastError && stored && Object.keys(stored).length > 0) {
          applySettingsPatch(stored);
          if (cfgState.enabled) scanSocialMessages();
        }
      });
    }
    chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (cfg) => {
      if (chrome.runtime.lastError) return;
      applySettingsPatch(cfg);
      if (cfgState.enabled) scanSocialMessages();
    });
  }
  loadInitialSettings();

  chrome.storage.onChanged.addListener((changes) => {
    const next = { ...cfgState };
    let shouldRescan = false;
    if (changes.showSafeBadges) next.showSafeBadges = Boolean(changes.showSafeBadges.newValue);
    if (changes.enabled) { next.enabled = changes.enabled.newValue !== false; shouldRescan = true; }
    if (changes.sensitivity) { next.sensitivity = changes.sensitivity.newValue || 'balanced'; shouldRescan = true; }
    if (changes.interceptClicks) next.interceptClicks = changes.interceptClicks.newValue !== false;
    if (changes.whitelist) { next.whitelist = changes.whitelist.newValue || []; shouldRescan = true; }
    if (changes.blacklist) { next.blacklist = changes.blacklist.newValue || []; shouldRescan = true; }
    applySettingsPatch(next);
    if (shouldRescan) resetAndRescan();
  });

  R.installClickInterceptor({ getConfig: () => cfgState });

  function extractContextSignal(text = '') {
    const flags = [];
    const norm = R.normalizeLeetspeak(text);
    const isNegatedAdvisory =
      /\b(never|do\s+not|don'?t|not\s+to|avoid|refuse)\b.{0,22}\b(share|send|tell|give|forward|disclose|enter)\b.{0,25}\b(otp|upi\s*pin|pin|password|cvv)\b/i.test(norm);
    if (/\.(apk|exe|scr|bat|ps1|msi)\b/i.test(text)) flags.push('contains_apk_download');
    if (!isNegatedAdvisory && /enter.*upi\s*pin|upi\s*pin.*receiv|refund.*upi|collect\s*request/i.test(norm)) flags.push('enter upi pin to receive refund');
    if (!isNegatedAdvisory && /(share|send|enter|verify).{0,25}\botp\b/i.test(norm)) flags.push('share otp lure');
    if (/urgent.*suspend|policy.*expire.*today|e-?challan|vahan|kyc.*block|digital\s*arrest/i.test(norm)) flags.push('urgent policy suspend click');
    return flags.join(' ');
  }

  function cleanMatchedUrl(raw) {
    return String(raw || '').replace(/[),.!?;:'"]+$/g, '');
  }

  // Telegram Web K & Web A + fallback (adapted from EXT KAV)
  function getMessageNodes() {
    if (isTelegram) {
      const k = Array.from(document.querySelectorAll('.bubble[data-mid]')).filter((n) => !n.classList.contains('service'));
      if (k.length) { diagStats.adapter = 'telegram-web-k'; return k; }
      const a = Array.from(document.querySelectorAll('.Message[data-message-id], .message-list-item[data-message-id], [id^="message-"]')).filter((n) => !/^message-\d+$/.test(n.id) ? true : true);
      if (a.length) { diagStats.adapter = 'telegram-web-a'; return a; }
      const fb = Array.from(document.querySelectorAll('[data-mid], [data-message-id]')).filter(
        (n) => !(n.parentElement && n.parentElement.closest('[data-mid], [data-message-id]'))
      );
      diagStats.adapter = 'telegram-fallback';
      return fb;
    }
    if (!window.location.pathname.includes('/direct')) return [];
    diagStats.adapter = 'instagram-dm';
    return Array.from(document.querySelectorAll('div[role="row"], div[role="listitem"]'));
  }

  function scanSocialMessages() {
    if (!cfgState.enabled) return;

    const candidates = getMessageNodes();
    diagStats.found = candidates.length;
    const batchItems = [];
    const targets = [];

    for (const node of candidates) {
      if (node.dataset.pgScanned === '1' && node.querySelector('.pg-shield-pill')) continue;
      if (node.parentElement?.closest('[data-pg-scanned="1"]')) continue;

      const textNodes = Array.from(node.querySelectorAll('.text-content, .translatable-message, .message'));
      const topTextNodes = textNodes.filter((el) => !textNodes.some((o) => o !== el && o.contains(el)));
      const text = topTextNodes.length
        ? topTextNodes.map((el) => R.extractCleanText(el, '.time, .time-inner, .message-time, .MessageMeta, .meta, .reactions, .pg-shield-pill')).filter(Boolean).join(' ')
        : R.extractCleanText(node, '.time, .time-inner, .message-time, .MessageMeta, .meta, .reactions, .pg-shield-pill');
      const anchors = Array.from(node.querySelectorAll('a[href]'));
      const urlRegexMatches = typeof R.extractUrlsFromText === 'function'
        ? R.extractUrlsFromText(text)
        : (text.match(/https?:\/\/[^\s<>"']+/gi) || []);

      const urls = new Set();
      anchors.forEach((a) => {
        const u = cleanMatchedUrl(R.unwrapUrl(a.href, a.getAttribute('data-saferedirecturl')));
        if (/^https?:\/\//i.test(u)) urls.add(u);
      });
      urlRegexMatches.forEach((u) => {
        const cleaned = cleanMatchedUrl(R.unwrapUrl(u));
        if (/^https?:\/\//i.test(cleaned)) urls.add(cleaned);
      });

      const fileCard = node.querySelector('.document-name, .file-title, [download], [title*="."]');
      const attachmentName = fileCard ? (fileCard.getAttribute('title') || fileCard.getAttribute('download') || fileCard.textContent || '').trim() : '';
      const dangerFile = R.checkDangerousFile('', attachmentName);

      if (!text && urls.size === 0 && !dangerFile) continue;
      node.dataset.pgScanned = '1';
      diagStats.checked++;

      if (urls.size === 0) {
        const syntheticUrl = dangerFile
          ? `https://${SURFACE}-attachment.local/${encodeURIComponent(attachmentName)}`
          : `https://${SURFACE}-message.local/check`;
        const local = R.quickLocalRisk(syntheticUrl, text, {
          sensitivity: cfgState.sensitivity,
          filename: dangerFile ? attachmentName : '',
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        const v = { ...local, url: dangerFile ? syntheticUrl : '', domain: dangerFile ? attachmentName : `${SURFACE} Message`, sourceSurface: SURFACE };
        if (v.status === 'threat') {
          node.setAttribute('data-pg-threat-url', syntheticUrl);
          node.setAttribute('data-pg-verdict', JSON.stringify(v));
        }
        applyBadgeToNode(node, v);
        continue;
      }

      const urlList = Array.from(urls).slice(0, 4);
      let worstLocal = R.quickLocalRisk(urlList[0], text, {
        sensitivity: cfgState.sensitivity,
        filename: dangerFile ? attachmentName : '',
        whitelist: cfgState.whitelist,
        blacklist: cfgState.blacklist,
      });
      let primaryUrl = urlList[0];

      for (const candidateUrl of urlList) {
        const scoreObj = R.quickLocalRisk(candidateUrl, text, {
          sensitivity: cfgState.sensitivity,
          filename: dangerFile ? attachmentName : '',
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        if (scoreObj.riskScore > worstLocal.riskScore) {
          worstLocal = scoreObj;
          primaryUrl = candidateUrl;
        }
      }

      const allTrusted = urlList.every((u) => R.isTrustedHost(R.getHost(u))) && !dangerFile;
      if (worstLocal.status === 'threat') {
        const v = { ...worstLocal, url: primaryUrl, domain: worstLocal.domain || R.getHost(primaryUrl), sourceSurface: SURFACE };
        anchors.forEach((a) => a.setAttribute('data-pg-verdict', JSON.stringify(v)));
        applyBadgeToNode(node, v);
      } else if (allTrusted && worstLocal.status === 'safe') {
        const v = { ...worstLocal, url: primaryUrl, domain: R.getRegistrableDomain(R.getHost(primaryUrl)) || R.getHost(primaryUrl), sourceSurface: SURFACE };
        applyBadgeToNode(node, v);
      } else {
        const contextFlags = extractContextSignal(text);
        urlList.forEach((u) => batchItems.push({ url: u, contextFlags, filename: dangerFile ? attachmentName : '' }));
        targets.push({ node, anchors, urlList, primaryUrl, local: worstLocal });
      }
    }

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: SURFACE, items: batchItems },
        (res) => {
          if (chrome.runtime.lastError || res?.disabled) return;
          const map = res?.verdicts || {};
          targets.forEach(({ node, anchors, urlList, primaryUrl, local }) => {
            let chosen = null;
            for (const u of urlList) {
              const cand = map[u];
              if (cand && (!chosen || Number(cand.riskScore || 0) > Number(chosen.riskScore || 0))) {
                chosen = cand;
              }
            }
            let verdict = chosen || { ...local, url: primaryUrl, domain: R.getHost(primaryUrl), sourceSurface: SURFACE };
            if (local.riskScore > Number(verdict.riskScore || 0)) {
              verdict = { ...local, url: primaryUrl, domain: local.domain || R.getHost(primaryUrl), sourceSurface: SURFACE };
            }
            if (verdict.status === 'threat') {
              anchors.forEach((a) => a.setAttribute('data-pg-verdict', JSON.stringify(verdict)));
            }
            applyBadgeToNode(node, verdict);
          });
        }
      );
    }
  }

  function applyBadgeToNode(node, verdict) {
    if (node.querySelector('.pg-shield-pill')) return;
    const isThreat = verdict.status === 'threat';
    const isWarn = verdict.status === 'suspicious';
    if (isThreat) {
      node.classList.add('pg-box-threat');
      diagStats.threats++;
      chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
    } else if (isWarn) {
      node.classList.add('pg-box-suspicious');
      diagStats.threats++;
    } else {
      diagStats.safe++;
    }

    chrome.runtime.sendMessage(
      {
        type: 'PG_RECORD_STATS',
        payload: { scanned: 1, threats: isThreat || isWarn ? 1 : 0, safe: !isThreat && !isWarn ? 1 : 0 },
        verdict: isThreat || isWarn ? verdict : null,
      },
      () => void chrome.runtime.lastError
    );

    const pill = R.createPillElement(verdict, cfgState.showSafeBadges);
    pill.classList.add('pg-shield-pill-inline');
    pill.style.marginTop = '4px';
    node.appendChild(pill);
  }

  function resetAndRescan() {
    document.querySelectorAll('[data-pg-scanned="1"]').forEach((n) => {
      delete n.dataset.pgScanned;
      n.classList.remove('pg-box-threat', 'pg-box-suspicious');
      n.removeAttribute('data-pg-threat-url');
      n.removeAttribute('data-pg-verdict');
    });
    document.querySelectorAll('.pg-shield-pill').forEach((p) => p.remove());
    diagStats.found = 0; diagStats.checked = 0; diagStats.threats = 0; diagStats.safe = 0;
    if (cfgState.enabled) scanSocialMessages();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PG_RESCAN_TAB') {
      resetAndRescan();
      sendResponse({ ok: true, surface: SURFACE });
      return false;
    }
    if (msg?.type === 'PG_DIAG_TAB') {
      scanSocialMessages();
      sendResponse({ ok: true, diag: { ...diagStats, version: '2.1.0', enabled: cfgState.enabled } });
      return false;
    }
  });

  function isOwnUiMutation(mutations) {
    return (
      Array.isArray(mutations) &&
      mutations.every(
        (m) =>
          m.addedNodes.length > 0 &&
          Array.from(m.addedNodes).every((n) => n?.classList?.contains('pg-shield-pill'))
      )
    );
  }

  function scheduleScan(mutations) {
    if (mutations && isOwnUiMutation(mutations)) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanSocialMessages, 450);
  }

  const observer = new MutationObserver(scheduleScan);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('scroll', () => scheduleScan(), { capture: true, passive: true });
  setTimeout(scanSocialMessages, 1500);
  setInterval(() => {
    if (window.location.href !== lastHref) { lastHref = window.location.href; scanSocialMessages(); }
    else if (!document.hidden && cfgState.enabled) scanSocialMessages();
  }, 4000);
})();
