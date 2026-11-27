(function () {
  const R = window.PolicyGuardRules;
  if (!R) return;

  let lastCheckedHref = '';
  let scanTimer = null;
  let cfgState = {
    enabled: true,
    showSafeBadges: false,
    sensitivity: 'balanced',
    interceptClicks: true,
    whitelist: [],
    blacklist: [],
  };
  const diagStats = {
    surface: 'web',
    adapter: 'web-dom-batch',
    found: 0,
    checked: 0,
    threats: 0,
    safe: 0,
    lastError: null,
  };

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
          if (cfgState.enabled) {
            evaluateCurrentPage();
            scanInlineLinksAndMessages();
          }
        }
      });
    }
    chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (cfg) => {
      if (chrome.runtime.lastError) return;
      applySettingsPatch(cfg);
      if (cfgState.enabled) {
        evaluateCurrentPage();
        scanInlineLinksAndMessages();
      }
    });
  }
  loadInitialSettings();

  chrome.storage.onChanged.addListener((changes) => {
    const next = { ...cfgState };
    let shouldRescan = false;
    if (changes.showSafeBadges) next.showSafeBadges = Boolean(changes.showSafeBadges.newValue);
    if (changes.enabled) {
      next.enabled = changes.enabled.newValue !== false;
      shouldRescan = true;
    }
    if (changes.sensitivity) {
      next.sensitivity = changes.sensitivity.newValue || 'balanced';
      shouldRescan = true;
    }
    if (changes.interceptClicks) next.interceptClicks = changes.interceptClicks.newValue !== false;
    if (changes.whitelist) {
      next.whitelist = changes.whitelist.newValue || [];
      shouldRescan = true;
    }
    if (changes.blacklist) {
      next.blacklist = changes.blacklist.newValue || [];
      shouldRescan = true;
    }
    applySettingsPatch(next);
    if (shouldRescan) resetAndRescan();
  });

  R.installClickInterceptor({ getConfig: () => cfgState });

  function isLocalOrPolicyGuardHost(host = '') {
    return (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host === 'policyguard-ai-ecru.vercel.app'
    );
  }

  function inspectFormsAndInputs(host) {
    const forms = Array.from(document.querySelectorAll('form'));
    const hasCardOrPinInput = Array.from(document.querySelectorAll('input')).some((inp) => {
      const attrs = `${inp.name || ''} ${inp.id || ''} ${inp.placeholder || ''} ${inp.autocomplete || ''}`.toLowerCase();
      return /card|cvv|upi|pin|otp|aadhaar|pan_no|passcode/.test(attrs);
    });
    const hasCrossOriginForm = forms.some((f) => {
      const action = f.getAttribute('action') || '';
      if (!/^https?:\/\//i.test(action)) return false;
      const actionHost = R.getHost(action);
      return actionHost && host && actionHost !== host && !actionHost.endsWith('.' + host);
    });
    return { hasCardOrPinInput, hasCrossOriginForm };
  }

  function isExternalOrInterestingLink(el, realUrl, filename) {
    if (filename && R.checkDangerousFile(realUrl, filename)) return true;
    if (!/^https?:\/\//i.test(realUrl)) return false;
    const host = R.getHost(realUrl);
    if (!host || isLocalOrPolicyGuardHost(host)) return false;
    try {
      const targetUrl = new URL(realUrl);
      const curHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
      // On search engines (Google, Bing, DuckDuckGo) or web pages, prioritize external links & dangerous payloads
      if (targetUrl.pathname === '/url' && targetUrl.searchParams.get('q')) return true;
      if (host === curHost && targetUrl.pathname === window.location.pathname) return false;
      return host !== curHost || /\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#)/i.test(realUrl);
    } catch {
      return false;
    }
  }

  function applyLinkVerdict(el, verdict) {
    if (!el || !el.isConnected || !verdict) return;
    if (el.nextElementSibling?.classList?.contains('pg-shield-pill')) {
      el.nextElementSibling.remove();
    }
    el.classList.remove('pg-box-threat', 'pg-box-suspicious');
    if (verdict.status === 'threat') {
      el.classList.add('pg-box-threat');
      el.setAttribute('data-pg-verdict', JSON.stringify(verdict));
      chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
      diagStats.threats++;
    } else if (verdict.status === 'suspicious') {
      el.classList.add('pg-box-suspicious');
      el.setAttribute('data-pg-verdict', JSON.stringify(verdict));
      diagStats.threats++;
    } else {
      diagStats.safe++;
    }
    const pill = R.createPillElement(verdict, cfgState.showSafeBadges);
    pill.classList.add('pg-shield-pill-inline');
    el.insertAdjacentElement('afterend', pill);
    chrome.runtime.sendMessage(
      {
        type: 'PG_RECORD_STATS',
        payload: { scanned: 1, threats: verdict.status !== 'safe' ? 1 : 0, safe: verdict.status === 'safe' ? 1 : 0 },
        verdict: verdict.status !== 'safe' ? verdict : null,
      },
      () => void chrome.runtime.lastError
    );
  }

  function scanInlineLinksAndMessages() {
    if (!cfgState.enabled) return;

    // 1. Collect external links & executable downloads (never waste budget on header nav '#' links)
    const rawAnchors = Array.from(document.querySelectorAll('a[href], [download]'));
    const candidateLinks = [];
    for (const el of rawAnchors) {
      if (el.closest('#pg-inline-detail-banner, #pg-click-intercept-modal')) continue;
      const rawUrl = el.href || el.getAttribute('data-href') || '';
      const filename = el.getAttribute('download') || '';
      const realUrl = R.unwrapUrl(rawUrl, el.getAttribute('data-saferedirecturl'));
      if (!isExternalOrInterestingLink(el, realUrl, filename)) continue;
      candidateLinks.push({ el, rawUrl, realUrl, filename });
      if (candidateLinks.length >= 120) break;
    }

    diagStats.found = candidateLinks.length;
    const remoteItems = [];
    const seenUrls = new Set();
    const pendingRemote = [];

    candidateLinks.forEach(({ el, rawUrl, realUrl, filename }) => {
      if (el.dataset.pgScanned === '1') return;
      el.dataset.pgScanned = '1';
      diagStats.checked++;

      const effectiveUrl = realUrl || `https://download.local/${filename}`;
      const contextText = `${el.textContent || ''} ${(el.closest('p, li, div, article, .comment, .message, [data-sokoban-container]')?.textContent || '').slice(0, 260)}`;
      const local = R.analyzeTarget({
        url: effectiveUrl,
        text: contextText,
        filename,
        settings: cfgState,
      });

      const localVerdict = {
        ...local,
        url: realUrl || rawUrl,
        domain: local.domain || R.getHost(realUrl) || filename,
        sourceSurface: 'web',
      };

      const host = R.getHost(effectiveUrl);
      const isTrusted = R.isTrustedHost(host) && !R.checkDangerousFile(effectiveUrl, filename);

      if (local.status === 'threat') {
        applyLinkVerdict(el, localVerdict);
        return;
      }

      if (local.status === 'suspicious') {
        applyLinkVerdict(el, localVerdict);
      }

      // Send unverified / suspicious external links to backend threat research (VT URL/Domain, URLhaus, RDAP, Shortener expansion)
      if (!isTrusted && /^https?:\/\//i.test(effectiveUrl)) {
        pendingRemote.push({ el, effectiveUrl, localVerdict });
        if (!seenUrls.has(effectiveUrl) && remoteItems.length < 50) {
          seenUrls.add(effectiveUrl);
          remoteItems.push({ url: effectiveUrl, filename });
        }
      } else if (isTrusted) {
        applyLinkVerdict(el, localVerdict);
      }
    });

    if (remoteItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'web', items: remoteItems },
        (res) => {
          if (chrome.runtime.lastError || res?.disabled) return;
          if (res?.backendOffline) {
            pendingRemote.forEach(({ el }) => {
              if (el.isConnected) delete el.dataset.pgScanned;
            });
            return;
          }
          const map = res?.verdicts || {};
          pendingRemote.forEach(({ el, effectiveUrl, localVerdict }) => {
            if (!el.isConnected) return;
            const remote = map[effectiveUrl];
            let finalVerdict = remote ? { ...remote, sourceSurface: 'web' } : localVerdict;
            if (Number(localVerdict.riskScore || 0) > Number(finalVerdict.riskScore || 0)) {
              finalVerdict = { ...localVerdict, vtStats: finalVerdict.vtStats || {}, rdapAgeDays: finalVerdict.rdapAgeDays ?? null };
            }
            applyLinkVerdict(el, finalVerdict);
          });
        }
      );
    }

    // 2. Scan inline comment/message/article blocks for non-link social engineering lures (OTP / Reverse-UPI / .apk / Digital Arrest mentions)
    const msgContainers = Array.from(document.querySelectorAll('.comment, .message, .chat-message, [data-testid="scam-sample"], article')).slice(0, 40);
    msgContainers.forEach((box) => {
      if (box.dataset.pgScanned === '1' || box.querySelector('.pg-shield-pill')) return;
      const text = R.extractCleanText(box, '.pg-shield-pill').slice(0, 1200);
      if (text.length < 18) return;
      box.dataset.pgScanned = '1';

      const local = R.analyzeTarget({ url: 'https://web-message.local/check', text, settings: cfgState });
      if (local.status === 'threat' || local.status === 'suspicious') {
        const verdict = { ...local, url: window.location.href, domain: 'Page Message', sourceSurface: 'web' };
        box.classList.add(local.status === 'threat' ? 'pg-box-threat' : 'pg-box-suspicious');
        box.appendChild(R.createPillElement(verdict, cfgState.showSafeBadges));
        chrome.runtime.sendMessage(
          { type: 'PG_RECORD_STATS', payload: { scanned: 1, threats: 1, safe: 0 }, verdict },
          () => void chrome.runtime.lastError
        );
      }
    });
  }

  function evaluateCurrentPage() {
    if (!cfgState.enabled) return;
    const url = window.location.href;
    if (url === lastCheckedHref) return;
    lastCheckedHref = url;

    const host = R.getHost(url);
    if (isLocalOrPolicyGuardHost(host)) {
      return;
    }

    const pageSample = `${document.title || ''} ${R.extractCleanText(document.body, '.pg-shield-pill').slice(0, 3200)}`;
    const hasSensitivePrompt = /enter.*upi\s*pin|policy\s*renewal|claim\s*refund|enter\s*otp|aadhaar/i.test(pageSample);
    const { hasCardOrPinInput, hasCrossOriginForm } = inspectFormsAndInputs(host);

    const flags = [];
    if (hasSensitivePrompt) flags.push('payment/otp prompt');
    if (hasCardOrPinInput) flags.push('sensitive card/upi/otp form input');
    if (hasCrossOriginForm) flags.push('external form submission');

    const local = R.analyzeTarget({ url, text: `${pageSample} ${flags.join(' ')}`, settings: cfgState });

    chrome.runtime.sendMessage(
      { type: 'PG_CHECK_ACTIVE_URL', url, sourceSurface: 'web', contextFlags: flags.join(' ') },
      (res) => {
        if (chrome.runtime.lastError || res?.disabled) return;
        const verdict = res?.verdict || { ...local, url, domain: host, sourceSurface: 'web' };
        chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: verdict.status }, () => void chrome.runtime.lastError);

        if (verdict.status === 'threat' || (verdict.status === 'suspicious' && Number(verdict.riskScore || 0) >= 40)) {
          R.showToastModal(verdict);
        }
      }
    );
  }

  function resetAndRescan() {
    lastCheckedHref = '';
    document.querySelectorAll('[data-pg-scanned="1"]').forEach((n) => {
      delete n.dataset.pgScanned;
      n.classList.remove('pg-box-threat', 'pg-box-suspicious');
      n.removeAttribute('data-pg-verdict');
    });
    document.querySelectorAll('.pg-shield-pill').forEach((p) => p.remove());
    diagStats.found = 0; diagStats.checked = 0; diagStats.threats = 0; diagStats.safe = 0;
    if (cfgState.enabled) {
      evaluateCurrentPage();
      scanInlineLinksAndMessages();
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PG_RESCAN_TAB') {
      resetAndRescan();
      sendResponse({ ok: true, surface: 'web' });
      return false;
    }
    if (msg?.type === 'PG_DIAG_TAB') {
      scanInlineLinksAndMessages();
      const totalPills = document.querySelectorAll('.pg-shield-pill').length;
      const threatPills = document.querySelectorAll('.pg-shield-threat, .pg-shield-suspicious').length;
      const safePills = document.querySelectorAll('.pg-shield-safe').length;
      sendResponse({
        ok: true,
        diag: {
          ...diagStats,
          checked: Math.max(diagStats.checked, totalPills),
          threats: threatPills,
          safe: safePills,
          version: '2.1.0',
          enabled: cfgState.enabled,
        },
      });
      return false;
    }
  });
  window.addEventListener('pg-rescan-local', () => resetAndRescan());

  function scheduleInlineScan(mutations) {
    if (
      Array.isArray(mutations) &&
      mutations.every(
        (m) =>
          m.addedNodes.length > 0 &&
          Array.from(m.addedNodes).every((n) => n?.classList?.contains('pg-shield-pill') || n?.id === 'pg-inline-detail-banner' || n?.id === 'pg-click-intercept-modal')
      )
    ) {
      return;
    }
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanInlineLinksAndMessages, 450);
  }

  const observer = new MutationObserver(scheduleInlineScan);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('scroll', () => scheduleInlineScan(), { capture: true, passive: true });
  window.addEventListener('popstate', () => setTimeout(() => { evaluateCurrentPage(); scanInlineLinksAndMessages(); }, 400));
  window.addEventListener('hashchange', () => setTimeout(() => { evaluateCurrentPage(); scanInlineLinksAndMessages(); }, 400));
  if (typeof window !== 'undefined' && window.PolicyGuardRules) {
    window.__pgScanWebLinks = scanInlineLinksAndMessages;
  }
})();
