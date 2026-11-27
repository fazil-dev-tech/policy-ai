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
  const diagStats = {
    surface: 'whatsapp',
    adapter: 'multi-tier-whatsapp',
    found: 0,
    checked: 0,
    threats: 0,
    safe: 0,
    lastError: null,
  };

  const pillMap = new WeakMap(); // node -> connected pill element
  const verdictCache = new Map(); // normalized message key -> verdict

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
          if (cfgState.enabled) scanWhatsAppMessages();
        }
      });
    }
    chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (cfg) => {
      if (chrome.runtime.lastError) {
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (retryCfg) => {
            if (!chrome.runtime.lastError && retryCfg) {
              applySettingsPatch(retryCfg);
              if (cfgState.enabled) scanWhatsAppMessages();
            }
          });
        }, 350);
        return;
      }
      applySettingsPatch(cfg);
      if (cfgState.enabled) scanWhatsAppMessages();
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

  // 3-tier modern WhatsApp Web selector chain (resilient to scrambled Meta classes like _ao3e/_akbu)
  function findWhatsAppMessageNodes() {
    try {
      const root = document;
      const tier1 = [...root.querySelectorAll('div[data-id]')].filter(
        (n) =>
          /^(true|false)_/.test(n.dataset.id || '') &&
          n.querySelector('[data-pre-plain-text], .copyable-text, span.selectable-text, span._ao3e, span._akbu, span[dir="ltr"], span[dir="auto"], a[href], [data-testid*="document"], [data-testid*="link-preview"]')
      );
      if (tier1.length) {
        diagStats.adapter = 'whatsapp-data-id';
        return tier1;
      }

      const byText = [...root.querySelectorAll('[data-pre-plain-text], div.copyable-text')].map(
        (n) => n.closest('.message-in, .message-out, [role=row], div[data-id]') || n
      );
      const byRow = [...root.querySelectorAll('#main [role=row], div[data-testid="msg-container"], div.message-in, div.message-out')]
        .filter((n) =>
          !n.closest('[data-testid="system-msg"]') &&
          n.querySelector('span._ao3e, span._akbu, span.selectable-text, [data-pre-plain-text], span[dir="auto"], span[dir="ltr"], a[href], [data-testid*="document"], [data-testid*="link-preview"]')
        )
        .map((n) => n.querySelector('.message-in, .message-out') || n);

      const all = [...new Set(byText.concat(byRow))];
      diagStats.adapter = all.length ? 'whatsapp-fallback-row' : 'whatsapp-waiting';
      return all.filter((n) => !all.some((o) => o !== n && o.contains(n)));
    } catch (e) {
      diagStats.lastError = e.message;
      return [];
    }
  }

  function extractWhatsAppText(node) {
    const skipSel = '[data-testid="msg-meta"], [data-testid="quoted-message"], [data-testid*="msg-time"], .pg-shield-pill';
    const copyable = node.querySelector('[data-pre-plain-text], div.copyable-text');
    let bodyText = copyable ? R.extractCleanText(copyable, skipSel) : '';

    if (!bodyText) {
      const spanCandidates = Array.from(
        node.querySelectorAll('span.selectable-text, span._ao3e, span._akbu, span[dir="ltr"], span[dir="auto"]')
      ).filter((sp) => !sp.closest(skipSel));
      // Combine ALL non-nested spans in reading order (never discard earlier spans)
      const topSpans = spanCandidates.filter((sp) => !spanCandidates.some((other) => other !== sp && other.contains(sp)));
      bodyText = topSpans
        .map((sp) => R.extractCleanText(sp, skipSel))
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    // Include rich link-preview card titles/URLs if present outside .copyable-text
    const linkCardText = Array.from(node.querySelectorAll('a[href], [data-testid*="link-preview"]'))
      .filter((el) => !el.closest(skipSel) && !(copyable && copyable.contains(el)))
      .map((el) => R.extractCleanText(el, '.pg-shield-pill'))
      .filter(Boolean)
      .join(' ')
      .trim();

    return [bodyText, linkCardText].filter(Boolean).join(' ').trim();
  }

  function extractContextSignal(text = '') {
    const flags = [];
    const norm = R.normalizeLeetspeak(text);
    const isNegatedAdvisory =
      /\b(never|do\s+not|don'?t|not\s+to|avoid|refuse)\b.{0,22}\b(share|send|tell|give|forward|disclose|enter)\b.{0,25}\b(otp|upi\s*pin|pin|password|cvv)\b/i.test(norm);
    if (/\.(apk|exe|scr|bat|ps1|msi|jar)\b/i.test(text)) flags.push('contains_apk_download');
    if (!isNegatedAdvisory && /enter.*upi\s*pin|upi\s*pin.*receiv|refund.*upi|collect\s*request/i.test(norm)) {
      flags.push('enter upi pin to receive refund');
    }
    if (!isNegatedAdvisory && /(share|send|enter|verify).{0,25}\botp\b/i.test(norm)) {
      flags.push('share otp lure');
    }
    if (/urgent.*suspend|policy.*expire.*today|e-?challan|vahan|kyc.*block|digital\s*arrest|anydesk|teamviewer/i.test(norm)) {
      flags.push('urgent policy suspend click');
    }
    return flags.join(' ');
  }

  function detectDangerousAttachmentName(node) {
    const fileCandidates = node.querySelectorAll('span[title], div[title], [data-testid*="document"], a[download]');
    for (const el of fileCandidates) {
      const name = el.getAttribute('title') || el.getAttribute('download') || el.textContent || '';
      if (R.checkDangerousFile('', name)) return name.trim().slice(0, 120);
    }
    return '';
  }

  function cleanMatchedUrl(raw) {
    return String(raw || '').replace(/[),.!?;:'"]+$/g, '');
  }

  function hasConnectedPill(node) {
    const p = pillMap.get(node);
    return Boolean(p && p.isConnected);
  }

  function applyBadgeToNode(node, verdict) {
    const anchor = node.querySelector('[data-pre-plain-text], div.copyable-text') || node;
    const prev = pillMap.get(node);
    if (prev && prev.isConnected) return;
    anchor.querySelectorAll(':scope > .pg-shield-pill').forEach((p) => p.remove());

    const isThreat = verdict.status === 'threat';
    const isWarn = verdict.status === 'suspicious';

    anchor.classList.remove('pg-box-threat', 'pg-box-suspicious');
    if (isThreat) {
      anchor.classList.add('pg-box-threat');
      diagStats.threats++;
      chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
    } else if (isWarn) {
      anchor.classList.add('pg-box-suspicious');
      diagStats.threats++;
    } else {
      diagStats.safe++;
    }

    const pill = R.createPillElement(verdict, cfgState.showSafeBadges);
    pill.classList.add('pg-shield-pill-inline');
    pill.style.marginTop = '4px';
    anchor.appendChild(pill);
    pillMap.set(node, pill);
  }

  function scanWhatsAppMessages() {
    if (!cfgState.enabled) return;

    const candidates = findWhatsAppMessageNodes();
    diagStats.found = candidates.length;
    const batchItems = [];
    const targets = [];

    for (const node of candidates) {
      const text = extractWhatsAppText(node);
      const attachmentFilename = detectDangerousAttachmentName(node);
      const anchors = Array.from(node.querySelectorAll('a[href]'));
      const textExtractedUrls = typeof R.extractUrlsFromText === 'function'
        ? R.extractUrlsFromText(text)
        : (text.match(/https?:\/\/[^\s<>"']+/gi) || []);

      const urls = new Set();
      anchors.forEach((a) => {
        const u = cleanMatchedUrl(R.unwrapUrl(a.href, a.getAttribute('data-saferedirecturl')));
        if (/^https?:\/\//i.test(u)) urls.add(u);
      });
      textExtractedUrls.forEach((u) => {
        const cleaned = cleanMatchedUrl(R.unwrapUrl(u));
        if (/^https?:\/\//i.test(cleaned)) urls.add(cleaned);
      });

      if (!text && urls.size === 0 && !attachmentFilename) continue;

      const cacheKey = `${text.slice(0, 300)}|${Array.from(urls).join(',')}|${attachmentFilename}|${cfgState.sensitivity}`;
      if (node.dataset.pgScanKey === cacheKey && hasConnectedPill(node)) continue;
      if (node.dataset.pgScanKey === cacheKey && verdictCache.has(cacheKey)) {
        applyBadgeToNode(node, verdictCache.get(cacheKey));
        continue;
      }

      node.dataset.pgScanKey = cacheKey;
      node.dataset.pgScanned = '1';
      diagStats.checked++;

      if (urls.size === 0) {
        const syntheticUrl = attachmentFilename
          ? `https://whatsapp-attachment.local/${encodeURIComponent(attachmentFilename)}`
          : 'https://whatsapp-message.local/check';
        const local = R.quickLocalRisk(syntheticUrl, text, {
          sensitivity: cfgState.sensitivity,
          filename: attachmentFilename,
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        const finalVerdict = {
          ...local,
          url: attachmentFilename ? syntheticUrl : '',
          domain: attachmentFilename || 'WhatsApp Message',
          sourceSurface: 'whatsapp',
        };
        verdictCache.set(cacheKey, finalVerdict);
        if (finalVerdict.status === 'threat') {
          node.setAttribute('data-pg-threat-url', syntheticUrl);
          node.setAttribute('data-pg-verdict', JSON.stringify(finalVerdict));
        }
        applyBadgeToNode(node, finalVerdict);
        chrome.runtime.sendMessage(
          {
            type: 'PG_RECORD_STATS',
            payload: { scanned: 1, threats: finalVerdict.status !== 'safe' ? 1 : 0, safe: finalVerdict.status === 'safe' ? 1 : 0 },
            verdict: finalVerdict.status !== 'safe' ? finalVerdict : null,
          },
          () => void chrome.runtime.lastError
        );
        continue;
      }

      const urlList = Array.from(urls).slice(0, 4);
      let worstLocal = R.quickLocalRisk(urlList[0], text, {
        sensitivity: cfgState.sensitivity,
        filename: attachmentFilename,
        whitelist: cfgState.whitelist,
        blacklist: cfgState.blacklist,
      });
      let primaryUrl = urlList[0];

      for (const candidateUrl of urlList) {
        const scoreObj = R.quickLocalRisk(candidateUrl, text, {
          sensitivity: cfgState.sensitivity,
          filename: attachmentFilename,
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        if (scoreObj.riskScore > worstLocal.riskScore) {
          worstLocal = scoreObj;
          primaryUrl = candidateUrl;
        }
      }

      const allTrustedUrls = urlList.every((u) => R.isTrustedHost(R.getHost(u))) && !attachmentFilename;
      if (worstLocal.status === 'threat') {
        const localVerdict = {
          ...worstLocal,
          url: primaryUrl,
          domain: worstLocal.domain || R.getHost(primaryUrl),
          sourceSurface: 'whatsapp',
        };
        verdictCache.set(cacheKey, localVerdict);
        anchors.forEach((a) => a.setAttribute('data-pg-verdict', JSON.stringify(localVerdict)));
        applyBadgeToNode(node, localVerdict);
        chrome.runtime.sendMessage(
          { type: 'PG_RECORD_STATS', payload: { scanned: 1, threats: 1, safe: 0 }, verdict: localVerdict },
          () => void chrome.runtime.lastError
        );
      } else if (allTrustedUrls && worstLocal.status === 'safe') {
        const safeVerdict = {
          ...worstLocal,
          url: primaryUrl,
          domain: R.getRegistrableDomain(R.getHost(primaryUrl)) || R.getHost(primaryUrl),
          sourceSurface: 'whatsapp',
        };
        verdictCache.set(cacheKey, safeVerdict);
        applyBadgeToNode(node, safeVerdict);
        chrome.runtime.sendMessage(
          { type: 'PG_RECORD_STATS', payload: { scanned: 1, threats: 0, safe: 1 }, verdict: null },
          () => void chrome.runtime.lastError
        );
      } else {
        const contextFlags = extractContextSignal(text);
        urlList.forEach((u) => batchItems.push({ url: u, contextFlags, filename: attachmentFilename }));
        targets.push({ node, cacheKey, anchors, urlList, primaryUrl, local: worstLocal });
      }
    }

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'whatsapp', items: batchItems },
        (res) => {
          if (chrome.runtime.lastError || res?.disabled) return;
          if (res?.backendOffline) {
            targets.forEach(({ node }) => {
              if (node.isConnected) delete node.dataset.pgScanKey;
            });
          }
          const map = res?.verdicts || {};
          targets.forEach(({ node, cacheKey, anchors, urlList, primaryUrl, local }) => {
            let chosen = null;
            for (const u of urlList) {
              const cand = map[u];
              if (cand && (!chosen || Number(cand.riskScore || 0) > Number(chosen.riskScore || 0))) {
                chosen = cand;
              }
            }
            let verdict = chosen || { ...local, url: primaryUrl, domain: R.getHost(primaryUrl), sourceSurface: 'whatsapp' };
            if (local.riskScore > Number(verdict.riskScore || 0)) {
              verdict = { ...local, url: primaryUrl, domain: local.domain || R.getHost(primaryUrl), sourceSurface: 'whatsapp' };
            }
            if (!res?.backendOffline || verdict.status !== 'safe') {
              verdictCache.set(cacheKey, verdict);
            }
            if (verdict.status === 'threat') {
              anchors.forEach((a) => a.setAttribute('data-pg-verdict', JSON.stringify(verdict)));
            }
            applyBadgeToNode(node, verdict);
            chrome.runtime.sendMessage(
              {
                type: 'PG_RECORD_STATS',
                payload: { scanned: 1, threats: verdict.status !== 'safe' ? 1 : 0, safe: verdict.status === 'safe' ? 1 : 0 },
                verdict: verdict.status !== 'safe' ? verdict : null,
              },
              () => void chrome.runtime.lastError
            );
          });
        }
      );
    }
  }

  function resetAndRescan() {
    verdictCache.clear();
    document.querySelectorAll('[data-pg-scanned="1"]').forEach((n) => {
      delete n.dataset.pgScanned;
      delete n.dataset.pgScanKey;
      n.removeAttribute('data-pg-threat-url');
      n.removeAttribute('data-pg-verdict');
    });
    document.querySelectorAll('.pg-box-threat, .pg-box-suspicious').forEach((el) => {
      el.classList.remove('pg-box-threat', 'pg-box-suspicious');
    });
    document.querySelectorAll('.pg-shield-pill').forEach((p) => p.remove());
    diagStats.found = 0;
    diagStats.checked = 0;
    diagStats.threats = 0;
    diagStats.safe = 0;
    if (cfgState.enabled) scanWhatsAppMessages();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PG_RESCAN_TAB') {
      resetAndRescan();
      sendResponse({ ok: true, surface: 'whatsapp' });
      return false;
    }
    if (msg?.type === 'PG_DIAG_TAB') {
      scanWhatsAppMessages();
      const msgNodes = findWhatsAppMessageNodes();
      let threatCount = 0;
      let safeCount = 0;
      let checkedCount = 0;
      msgNodes.forEach((n) => {
        const anchor = n.querySelector('[data-pre-plain-text], div.copyable-text') || n;
        const p = anchor.querySelector(':scope > .pg-shield-pill') || pillMap.get(n);
        if (!p || !p.isConnected) return;
        checkedCount++;
        if (p.classList.contains('pg-shield-threat') || p.classList.contains('pg-shield-suspicious')) threatCount++;
        else if (p.classList.contains('pg-shield-safe')) safeCount++;
      });
      sendResponse({
        ok: true,
        diag: {
          ...diagStats,
          found: msgNodes.length,
          checked: checkedCount,
          threats: threatCount,
          safe: safeCount,
          version: '2.1.0',
          enabled: cfgState.enabled,
        },
      });
      return false;
    }
  });
  window.addEventListener('pg-rescan-local', () => resetAndRescan());

  function isOwnUiMutation(mutations) {
    return (
      Array.isArray(mutations) &&
      mutations.every(
        (m) =>
          m.addedNodes.length > 0 &&
          Array.from(m.addedNodes).every(
            (n) => n?.classList?.contains('pg-shield-pill') || n?.id === 'pg-inline-detail-banner' || n?.id === 'pg-click-intercept-modal'
          )
      )
    );
  }

  let firstAsk = 0;
  function scheduleScan(mutations, delay = 350) {
    if (mutations && isOwnUiMutation(mutations)) return;
    const now = Date.now();
    if (!firstAsk) firstAsk = now;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      firstAsk = 0;
      scanWhatsAppMessages();
    }, Math.max(0, Math.min(delay, firstAsk + 1000 - now)));
  }

  const observer = new MutationObserver((m) => scheduleScan(m, 350));
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  document.addEventListener('scroll', () => scheduleScan(null, 220), { capture: true, passive: true });
  setTimeout(scanWhatsAppMessages, 1200);
  setTimeout(scanWhatsAppMessages, 3000);
  // Navigation & periodic safety-net scanner (catches chat switches and virtualized scroll redraws)
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      scheduleScan(null, 150);
    } else if (!document.hidden && cfgState.enabled) {
      scheduleScan(null, 0);
    }
  }, 4000);
})();
