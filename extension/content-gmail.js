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
  const isOutlook = /outlook\.(live|office|office365)\.com$/i.test(window.location.hostname);
  const SURFACE = isOutlook ? 'outlook' : 'gmail';
  const diagStats = { surface: SURFACE, adapter: isOutlook ? 'outlook-web' : 'gmail-dom', found: 0, checked: 0, threats: 0, safe: 0 };

  function isElementVisible(el) {
    if (!el || typeof el.getClientRects !== 'function') return true;
    try { return el.getClientRects().length > 0; } catch { return true; }
  }

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
          if (cfgState.enabled) scanEmailUi();
        }
      });
    }
    chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (cfg) => {
      if (chrome.runtime.lastError) return;
      applySettingsPatch(cfg);
      if (cfgState.enabled) scanEmailUi();
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

  function extractAnonymizedFlags(text = '') {
    const flags = [];
    const norm = R.normalizeLeetspeak(text);
    const isNegatedAdvisory =
      /\b(never|do\s+not|don'?t|not\s+to|avoid|refuse)\b.{0,22}\b(share|send|tell|give|forward|disclose|enter)\b.{0,25}\b(otp|upi\s*pin|pin|password|cvv)\b/i.test(norm);

    if (/\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)\b/i.test(text)) flags.push('contains_apk_download');
    if (!isNegatedAdvisory && /enter.*upi\s*pin.*receiv|upi\s*pin.*refund|collect\s*request.*claim|reverse.?upi/i.test(norm)) {
      flags.push('enter upi pin to receive refund');
    }
    if (!isNegatedAdvisory && /(share|send|tell|give|forward|enter|verify).{0,25}\botp\b/i.test(norm)) {
      flags.push('share otp lure');
    }
    if (/urgent.*suspend|policy.*expire.*today|kyc.*block|account.*suspend|anydesk|teamviewer/i.test(norm)) {
      flags.push('urgent policy suspend click');
    }
    return flags.join(' ');
  }

  function recordOutcome(verdict) {
    const isThreat = verdict.status === 'threat';
    const isWarn = verdict.status === 'suspicious';
    chrome.runtime.sendMessage(
      {
        type: 'PG_RECORD_STATS',
        payload: { scanned: 1, threats: isThreat || isWarn ? 1 : 0, safe: !isThreat && !isWarn ? 1 : 0 },
        verdict: isThreat || isWarn ? verdict : null,
      },
      () => void chrome.runtime.lastError
    );
  }

  function isCheckboxOrStarCell(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return Boolean(el.closest('td.oZ-x3, td.apU, td.PE, td.PF, td.WA, .oZ-jc, .apU, [role="checkbox"]'));
  }

  function resolveGmailPillAnchor(row) {
    // Strictly prefer Gmail subject nodes (.bog / span.bqe) or sender wrapper — NEVER overlap checkbox/star cells
    const subj = row.querySelector('.bog') || row.querySelector('span.bqe');
    if (subj && subj.parentNode && !isCheckboxOrStarCell(subj.parentNode)) {
      return { container: subj.parentNode, beforeNode: subj, mode: 'before' };
    }
    const subjectWrap = row.querySelector('td.a4W .y6, td.xT');
    if (subjectWrap && !isCheckboxOrStarCell(subjectWrap)) {
      return { container: subjectWrap, mode: 'prepend' };
    }
    const senderWrap = row.querySelector('td.yX .yW, td.yX');
    if (senderWrap && !isCheckboxOrStarCell(senderWrap)) {
      return { container: senderWrap, mode: 'append' };
    }
    return null;
  }

  function scanGmailInbox() {
    const rows = Array.from(document.querySelectorAll('tr.zA')).filter(isElementVisible);
    diagStats.found = rows.length;
    const unknownBatchItems = [];
    const unknownRowTargets = [];

    rows.forEach((row) => {
      const rawSenders = Array.from(row.querySelectorAll('td.yX [email], .yW [email], td.yX [data-hovercard-id*="@"]'));
      const senders = rawSenders.length ? rawSenders : Array.from(row.querySelectorAll('[email], [data-hovercard-id*="@"]'));
      if (senders.length === 0) return;

      const parsedSenders = senders
        .map((el) => {
          const email = String(el.getAttribute('email') || el.getAttribute('data-hovercard-id') || '').trim().toLowerCase();
          const domain = email.includes('@') ? email.split('@')[1] : '';
          const displayName = String(el.getAttribute('name') || el.textContent || '').trim();
          const isMe = displayName.toLowerCase() === 'me';
          return { email, domain, displayName, isMe };
        })
        .filter((s) => Boolean(s.domain));

      if (parsedSenders.length === 0) return;
      const nonMeSenders = parsedSenders.filter((s) => !s.isMe);
      const effectiveSenders = nonMeSenders.length ? nonMeSenders : parsedSenders;
      const primarySender = effectiveSenders[0];
      const senderDomain = primarySender.domain;
      const anchor = resolveGmailPillAnchor(row);
      if (!anchor) return;

      const rowSnippet = R.extractCleanText(row, '.pg-shield-pill').slice(0, 420);
      const rowUrls = typeof R.extractUrlsFromText === 'function' ? R.extractUrlsFromText(rowSnippet).slice(0, 2) : [];
      const scanKey = `${senderDomain}|${primarySender.displayName}|${rowSnippet.slice(0, 140)}|${cfgState.sensitivity}`;
      const existingPill = row.querySelector('.pg-shield-pill');

      // Guard against Gmail virtual row recycling across folder/tab switches
      if (row.dataset.pgScanKey === scanKey && (row.dataset.pgVerdict === 'none' || existingPill)) {
        return;
      }

      if (existingPill) existingPill.remove();
      row.classList.remove('pg-box-threat', 'pg-box-suspicious');
      row.dataset.pgScanKey = scanKey;
      row.dataset.pgScanned = '1';

      const flags = extractAnonymizedFlags(rowSnippet);
      const impersonation = R.checkSenderImpersonation(primarySender.displayName, senderDomain);

      // Evaluate both sender domain and any URL pasted in the email subject/snippet
      let local = R.quickLocalRisk(`https://${senderDomain}`, `${rowSnippet} ${flags}`, {
        sensitivity: cfgState.sensitivity,
        whitelist: cfgState.whitelist,
        blacklist: cfgState.blacklist,
      });
      for (const ru of rowUrls) {
        const cand = R.quickLocalRisk(ru, `${rowSnippet} ${flags}`, {
          sensitivity: cfgState.sensitivity,
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        if (cand.riskScore > local.riskScore) local = cand;
      }

      const reasons = [...(local.reasons || [])];
      let score = Number(local.riskScore || 0);
      let threatCategory = local.threatCategory || 'safe';

      if (impersonation) {
        score = Math.max(score + 75, 85);
        threatCategory = 'impersonation';
        reasons.unshift(
          `Brand impersonation: Display name '${impersonation.spoofedBrand}' sent from mismatched domain @${impersonation.actualDomain}`
        );
      }

      const isPublicWebmail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'proton.me', 'aol.com'].includes(senderDomain);
      const hasActionLure = /\b(click|verify|refund|kyc|suspend|expire|payment|upi|otp|block|urgent|confirm|customs|parcel|disconnect)\b|\.(apk|exe|ps1|scr)\b/i.test(
        R.normalizeLeetspeak(rowSnippet)
      );
      const financialOrBrandContext = /\b(policy|insurance|claim|star health|hdfc|icici|lic|irdai|renewal|bank|kyc|sbi|paypal|amazon|tax|refund|challan|parivahan|fedex|bescom|aadhaar)\b/i.test(
        rowSnippet
      );

      if (isPublicWebmail && hasActionLure && (financialOrBrandContext || impersonation || flags)) {
        score = Math.max(score, impersonation || flags.includes('apk') || flags.includes('upi') || flags.includes('otp') ? 85 : 45);
        if (threatCategory === 'safe') threatCategory = 'phishing';
        reasons.push(`Official companies rarely request urgent account/payment actions from @${senderDomain}`);
      }

      const thresholds = R.resolveThresholds(cfgState.sensitivity);
      const status =
        effectiveSenders.every((s) => R.isTrustedHost(s.domain)) && rowUrls.length === 0 && !impersonation && score < thresholds.suspicious
          ? 'safe'
          : score >= thresholds.threat
            ? 'threat'
            : score >= thresholds.suspicious
              ? 'suspicious'
              : 'safe';

      const isTrusted = effectiveSenders.every((s) => R.isTrustedHost(s.domain)) && rowUrls.length === 0 && !impersonation && status === 'safe';
      if (status === 'safe' && !isTrusted) {
        row.dataset.pgVerdict = 'none';
        const rowCheckUrls = [];
        if (!isPublicWebmail) rowCheckUrls.push(`https://${senderDomain}`);
        rowUrls.forEach((ru) => rowCheckUrls.push(ru));
        if (rowCheckUrls.length > 0) {
          rowCheckUrls.forEach((cu) => unknownBatchItems.push({ url: cu, contextFlags: flags }));
          unknownRowTargets.push({ row, anchor, senderDomain, scanKey, checkUrl: rowCheckUrls[0], rowCheckUrls });
        }
        return;
      }

      paintGmailRow(row, anchor, {
        status,
        domain: status === 'safe' ? (R.getRegistrableDomain(senderDomain) || senderDomain) : senderDomain,
        riskScore: status === 'safe' ? 5 : Math.min(100, score),
        threatCategory: status === 'safe' ? 'safe' : (threatCategory === 'safe' ? 'phishing' : threatCategory),
        reasons: status === 'safe' ? [`Verified sender (${senderDomain})`] : (reasons.length ? reasons : [`Suspicious email from @${senderDomain}`]),
        url: rowUrls[0] || (isPublicWebmail ? '' : `https://${senderDomain}`),
        sourceSurface: 'gmail',
        safeAlternative: status === 'safe' ? null : R.suggestSafeAlternative(senderDomain, `${primarySender.displayName} ${rowSnippet}`),
      });
    });

    if (unknownBatchItems.length > 0) {
      const uniqueItems = [];
      const seenUrls = new Set();
      unknownBatchItems.forEach((it) => {
        if (!seenUrls.has(it.url)) { seenUrls.add(it.url); uniqueItems.push(it); }
      });
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: 'gmail', items: uniqueItems.slice(0, 50) },
        (res) => {
          if (chrome.runtime.lastError || res?.disabled) return;
          if (res?.backendOffline) {
            unknownRowTargets.forEach(({ row }) => {
              if (row.isConnected) delete row.dataset.pgScanKey;
            });
            return;
          }
          const map = res?.verdicts || {};
          unknownRowTargets.forEach(({ row, anchor, scanKey, rowCheckUrls, checkUrl }) => {
            if (!row.isConnected || row.dataset.pgScanKey !== scanKey) return;
            let best = null;
            for (const u of rowCheckUrls || [checkUrl]) {
              const cand = map[u];
              if (cand && (!best || Number(cand.riskScore || 0) > Number(best.riskScore || 0))) best = cand;
            }
            if (best && (best.status === 'threat' || best.status === 'suspicious' || (cfgState.showSafeBadges && best.verifiedProvider))) {
              paintGmailRow(row, anchor, { ...best, sourceSurface: 'gmail' });
            }
          });
        }
      );
    }
  }

  function paintGmailRow(row, anchor, verdict) {
    if (!row || !anchor || !anchor.container) return;
    row.dataset.pgVerdict = verdict.status;
    row.classList.remove('pg-box-threat', 'pg-box-suspicious');
    if (verdict.status === 'threat') {
      row.classList.add('pg-box-threat');
      chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
    } else if (verdict.status === 'suspicious') {
      row.classList.add('pg-box-suspicious');
    }

    const old = row.querySelector('.pg-shield-pill');
    if (old) old.remove();
    const pill = R.createPillElement(verdict, cfgState.showSafeBadges);
    pill.classList.add('pg-shield-pill-inline');
    if (anchor.mode === 'before' && anchor.beforeNode && anchor.beforeNode.parentNode === anchor.container) {
      anchor.container.insertBefore(pill, anchor.beforeNode);
    } else if (anchor.mode === 'prepend') {
      anchor.container.prepend(pill);
    } else {
      anchor.container.appendChild(pill);
    }

    diagStats.checked++;
    if (verdict.status === 'safe') diagStats.safe++;
    else diagStats.threats++;
    recordOutcome(verdict);
  }

  function scanEmailUi() {
    if (!cfgState.enabled) return;

    if (!isOutlook) {
      scanGmailInbox();
    } else {
      document.querySelectorAll('div[role="option"][data-convid], div[data-testid="message-list-item"]').forEach((row) => {
        if (row.dataset.pgScanned === '1' && row.querySelector('.pg-shield-pill')) return;
        const rowText = (row.textContent || '').slice(0, 320);
        const flags = extractAnonymizedFlags(rowText);
        if (!flags) return;
        row.dataset.pgScanned = '1';
        const local = R.quickLocalRisk('https://outlook-message.local/lure', rowText, {
          sensitivity: cfgState.sensitivity,
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        if (local.status !== 'safe') {
          row.classList.add(local.status === 'threat' ? 'pg-box-threat' : 'pg-box-suspicious');
          const v = { ...local, domain: 'Outlook Message', sourceSurface: 'outlook' };
          const pill = R.createPillElement(v, cfgState.showSafeBadges);
          pill.classList.add('pg-shield-pill-inline');
          row.appendChild(pill);
          recordOutcome(v);
        }
      });
    }

    const bodySelector = isOutlook
      ? 'div[role="document"], div.AllowTextSelection, div[aria-label="Message body"]'
      : 'div.a3s';

    const bodyPlainUrls = [];
    document.querySelectorAll(bodySelector).forEach((bodyEl) => {
      if (!isElementVisible(bodyEl)) return;
      if (!isOutlook && bodyEl.parentElement && bodyEl.parentElement.closest('div.a3s, .gmail_quote')) return;
      if (bodyEl.dataset.pgBodyScanned === '1' && bodyEl.querySelector('.pg-gmail-body-pill')) return;
      const bodyText = R.extractCleanText(bodyEl, '.gmail_quote, .pg-shield-pill').slice(0, 3200);
      const bodyFlags = extractAnonymizedFlags(bodyText);

      const chipSelector = isOutlook
        ? '[data-testid*="attachment"], button[title*="."], span[title*="."]'
        : 'div.aZo span, span.aV3';
      let dangerousAttachmentName = '';
      document.querySelectorAll(chipSelector).forEach((el) => {
        const txt = el.getAttribute('title') || el.textContent || '';
        if (!dangerousAttachmentName && R.checkDangerousFile('', txt)) {
          dangerousAttachmentName = txt.trim().slice(0, 120);
        }
      });

      const plainUrls = typeof R.extractUrlsFromText === 'function' ? R.extractUrlsFromText(bodyText) : [];
      plainUrls.slice(0, 8).forEach((u) => bodyPlainUrls.push({ bodyEl, url: u, bodyFlags, attachmentName: dangerousAttachmentName }));

      // Run full Stage-1 + rule classifier on ALL open email bodies (covers Digital Arrest, Courier, BESCOM, KYC, Job, Loan, UPI, OTP, Attachments)
      bodyEl.dataset.pgBodyScanned = '1';
      const syntheticUrl = dangerousAttachmentName
        ? `https://${SURFACE}-attachment.local/${encodeURIComponent(dangerousAttachmentName)}`
        : (plainUrls[0] || `https://${SURFACE}-message.local/lure`);

      let worstBodyLocal = R.quickLocalRisk(syntheticUrl, `${bodyText} ${dangerousAttachmentName}`, {
        sensitivity: cfgState.sensitivity,
        filename: dangerousAttachmentName,
        whitelist: cfgState.whitelist,
        blacklist: cfgState.blacklist,
      });
      for (const pu of plainUrls.slice(0, 4)) {
        const cand = R.quickLocalRisk(pu, `${bodyText} ${dangerousAttachmentName}`, {
          sensitivity: cfgState.sensitivity,
          filename: dangerousAttachmentName,
          whitelist: cfgState.whitelist,
          blacklist: cfgState.blacklist,
        });
        if (cand.riskScore > worstBodyLocal.riskScore) worstBodyLocal = cand;
      }

      if (worstBodyLocal.status !== 'safe' && !bodyEl.querySelector('.pg-gmail-body-pill')) {
        const v = {
          ...worstBodyLocal,
          url: syntheticUrl,
          domain: dangerousAttachmentName || (plainUrls[0] ? R.getHost(plainUrls[0]) : `${SURFACE.toUpperCase()} Body Signal`),
          sourceSurface: SURFACE,
        };
        bodyEl.classList.add(worstBodyLocal.status === 'threat' ? 'pg-box-threat' : 'pg-box-suspicious');
        const pill = R.createPillElement(v, cfgState.showSafeBadges);
        pill.classList.add('pg-gmail-body-pill');
        bodyEl.prepend(pill);
        if (worstBodyLocal.status === 'threat') {
          chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
        }
        recordOutcome(v);
      }
    });

    if (bodyPlainUrls.length > 0) {
      const uniqBodyUrls = [];
      const seenBodyU = new Set();
      bodyPlainUrls.forEach(({ url, bodyFlags, attachmentName }) => {
        if (!seenBodyU.has(url)) {
          seenBodyU.add(url);
          uniqBodyUrls.push({ url, contextFlags: bodyFlags, filename: attachmentName });
        }
      });
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: SURFACE, items: uniqBodyUrls.slice(0, 12) },
        (res) => {
          if (chrome.runtime.lastError || res?.disabled) return;
          const map = res?.verdicts || {};
          bodyPlainUrls.forEach(({ bodyEl, url }) => {
            if (!bodyEl.isConnected || bodyEl.querySelector('.pg-gmail-body-pill')) return;
            const v = map[url];
            if (v && (v.status === 'threat' || v.status === 'suspicious')) {
              const pill = R.createPillElement({ ...v, sourceSurface: SURFACE }, cfgState.showSafeBadges);
              pill.classList.add('pg-gmail-body-pill');
              bodyEl.classList.add(v.status === 'threat' ? 'pg-box-threat' : 'pg-box-suspicious');
              bodyEl.prepend(pill);
              recordOutcome(v);
            }
          });
        }
      );
    }

    const anchorSelector = isOutlook
      ? 'div[role="document"] a[href], div.AllowTextSelection a[href], div[aria-label="Message body"] a[href]'
      : 'div.a3s a[href]';
    const anchors = Array.from(document.querySelectorAll(anchorSelector));
    const batchItems = [];
    const linkPairs = [];

    anchors.forEach((a) => {
      if (a.dataset.pgScanned === '1') return;
      const realUrl = R.unwrapUrl(a.href, a.getAttribute('data-saferedirecturl') || a.getAttribute('originalsrc'));
      if (!/^https?:\/\//i.test(realUrl)) return;
      a.dataset.pgScanned = '1';

      const containerText = `${a.textContent || ''} ${(a.closest('p, div, td')?.textContent || '').slice(0, 280)}`;
      const filename = a.getAttribute('download') || '';
      const local = R.quickLocalRisk(realUrl, `${containerText} ${realUrl}`, {
        sensitivity: cfgState.sensitivity,
        filename,
        whitelist: cfgState.whitelist,
        blacklist: cfgState.blacklist,
      });
      if (local.status === 'threat') {
        const v = { ...local, url: realUrl, domain: local.domain || R.getHost(realUrl), sourceSurface: SURFACE };
        a.classList.add('pg-box-threat');
        a.setAttribute('data-pg-verdict', JSON.stringify(v));
        a.insertAdjacentElement('afterend', R.createPillElement(v, cfgState.showSafeBadges));
        chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
        recordOutcome(v);
      } else {
        batchItems.push({ url: realUrl, contextFlags: extractAnonymizedFlags(containerText), filename });
        linkPairs.push({ a, realUrl, local });
      }
    });

    if (batchItems.length > 0) {
      chrome.runtime.sendMessage(
        { type: 'PG_BATCH_CHECK', sourceSurface: SURFACE, items: batchItems },
        (res) => {
          if (chrome.runtime.lastError || res?.disabled) return;
          const map = res?.verdicts || {};
          linkPairs.forEach(({ a, realUrl, local }) => {
            const v = map[realUrl] || { ...local, url: realUrl, domain: R.getHost(realUrl), sourceSurface: SURFACE };
            if (v.status === 'threat') {
              a.classList.add('pg-box-threat');
              a.setAttribute('data-pg-verdict', JSON.stringify(v));
              chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: 'threat' }, () => void chrome.runtime.lastError);
            } else if (v.status === 'suspicious') {
              a.classList.add('pg-box-suspicious');
            }
            a.insertAdjacentElement('afterend', R.createPillElement(v, cfgState.showSafeBadges));
            recordOutcome(v);
          });
        }
      );
    }
  }

  function resetAndRescan() {
    document.querySelectorAll('[data-pg-scanned="1"], [data-pg-body-scanned="1"]').forEach((n) => {
      delete n.dataset.pgScanned;
      delete n.dataset.pgScanKey;
      delete n.dataset.pgBodyScanned;
      delete n.dataset.pgVerdict;
      n.classList.remove('pg-box-threat', 'pg-box-suspicious');
      n.removeAttribute('data-pg-verdict');
    });
    document.querySelectorAll('.pg-shield-pill').forEach((p) => p.remove());
    diagStats.found = 0; diagStats.checked = 0; diagStats.threats = 0; diagStats.safe = 0;
    if (cfgState.enabled) scanEmailUi();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PG_RESCAN_TAB') {
      resetAndRescan();
      sendResponse({ ok: true, surface: SURFACE });
      return false;
    }
    if (msg?.type === 'PG_DIAG_TAB') {
      scanEmailUi();
      const totalPills = document.querySelectorAll('.pg-shield-pill').length;
      const threatPills = document.querySelectorAll('.pg-shield-threat, .pg-shield-suspicious').length;
      const safePills = document.querySelectorAll('.pg-shield-safe').length;
      sendResponse({
        ok: true,
        diag: {
          ...diagStats,
          checked: totalPills,
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

  function scheduleScan(mutations) {
    if (isOwnUiMutation(mutations)) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanEmailUi, 450);
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('scroll', () => scheduleScan(), { capture: true, passive: true });
    window.addEventListener('hashchange', () => setTimeout(scanEmailUi, 350));
    setTimeout(scanEmailUi, 1200);
    setTimeout(scanEmailUi, 3200);
    setInterval(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        setTimeout(scanEmailUi, 350);
      } else if (!document.hidden && cfgState.enabled) {
        scanEmailUi();
      }
    }, 4000);
  }

  if (typeof window !== 'undefined' && window.PolicyGuardRules) {
    window.__pgScanEmailUi = scanEmailUi;
  }
})();
