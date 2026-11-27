document.addEventListener('DOMContentLoaded', async () => {
  const DEFAULT_API = 'https://policyguard-ai-ecru.vercel.app/api';
  const statusBadge = document.getElementById('statusBadge');
  const activeDomain = document.getElementById('activeDomain');
  const riskScore = document.getElementById('riskScore');
  const reasonsList = document.getElementById('reasonsList');
  const enabledToggle = document.getElementById('enabledToggle');
  const showSafeToggle = document.getElementById('showSafeToggle');
  const interceptClicksToggle = document.getElementById('interceptClicksToggle');
  const sensitivitySelect = document.getElementById('sensitivitySelect');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const reportFeedback = document.getElementById('reportFeedback');
  const apiFeedback = document.getElementById('apiFeedback');
  const authFeedback = document.getElementById('authFeedback');
  const scanHistoryList = document.getElementById('scanHistoryList');
  const tabThreatsCard = document.getElementById('tabThreatsCard');
  const tabThreatCount = document.getElementById('tabThreatCount');
  const tabThreatsList = document.getElementById('tabThreatsList');
  const customRulesList = document.getElementById('customRulesList');
  const customRulesFeedback = document.getElementById('customRulesFeedback');

  let activeUrl = '';
  let activeTabId = null;

  function sendMsg(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (resp) => {
        if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
        resolve(resp);
      });
    });
  }

  function detectSurface(url = '') {
    if (url.includes('web.whatsapp.com')) return 'whatsapp';
    if (url.includes('mail.google.com')) return 'gmail';
    if (/outlook\.(live|office|office365)\.com/i.test(url)) return 'outlook';
    if (url.includes('telegram.org')) return 'telegram';
    if (url.includes('instagram.com')) return 'instagram';
    return 'web';
  }

  function renderStats(stats = {}) {
    document.getElementById('statScanned').textContent = String(Number(stats.scannedMessages || 0));
    document.getElementById('statThreats').textContent = String(Number(stats.threatsBlocked || 0));
    document.getElementById('statSafe').textContent = String(Number(stats.safeVerified || 0));
  }

  function renderVerdict(v, disabled = false) {
    if (disabled) {
      statusBadge.className = 'pg-badge off';
      statusBadge.textContent = 'PAUSED';
    } else {
      const status = v?.status || 'safe';
      statusBadge.className = `pg-badge ${status}`;
      statusBadge.textContent = status.toUpperCase();
    }
    activeDomain.textContent = v?.domain || 'Local / Browser Page';
    riskScore.textContent = `${Number(v?.riskScore ?? 0)} / 100`;
    reasonsList.textContent = '';
    const list = (v?.reasons || []).length ? v.reasons : ['No threat flags detected'];
    list.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsList.appendChild(li);
    });
  }

  function renderTabThreats(threats = []) {
    tabThreatsList.textContent = '';
    if (!Array.isArray(threats) || threats.length === 0) {
      tabThreatsCard.style.display = 'none';
      return;
    }
    tabThreatsCard.style.display = 'block';
    tabThreatCount.textContent = String(threats.length);
    threats.slice(0, 6).forEach((t) => {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = `${String(t.status || 'threat').toUpperCase()} · ${t.domain}`;
      li.appendChild(strong);
      li.appendChild(document.createTextNode(` (${Number(t.riskScore || 0)}/100): ${(t.reasons || []).join('; ')}`));
      tabThreatsList.appendChild(li);
    });
  }

  function renderHistory(history = []) {
    if (!scanHistoryList) return;
    scanHistoryList.textContent = '';
    if (!Array.isArray(history) || history.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No recent scans recorded yet.';
      scanHistoryList.appendChild(li);
      return;
    }
    history.slice(0, 8).forEach((h) => {
      const li = document.createElement('li');
      li.textContent = `${String(h.status || 'safe').toUpperCase()} · ${h.domain} (${Number(h.riskScore || 0)}/100 via ${h.surface || 'web'})`;
      scanHistoryList.appendChild(li);
    });
  }

  function renderCustomRules(whitelist = [], blacklist = []) {
    customRulesList.textContent = '';
    const entries = [
      ...blacklist.map((d) => ({ domain: d, listType: 'blacklist' })),
      ...whitelist.map((d) => ({ domain: d, listType: 'whitelist' })),
    ];
    if (entries.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No custom whitelist or blacklist domains yet.';
      customRulesList.appendChild(li);
      return;
    }
    entries.forEach(({ domain, listType }) => {
      const li = document.createElement('li');
      li.textContent = `${listType === 'blacklist' ? 'BLOCK' : 'TRUST'} · ${domain}`;
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'pg-rule-rm';
      rmBtn.textContent = 'Remove';
      rmBtn.addEventListener('click', async () => {
        const res = await sendMsg({ type: 'PG_REMOVE_LIST_RULE', domain, listType });
        if (res?.settings) {
          renderCustomRules(res.settings.whitelist, res.settings.blacklist);
          customRulesFeedback.textContent = `Removed ${domain}.`;
        }
      });
      li.appendChild(rmBtn);
      customRulesList.appendChild(li);
    });
  }

  const settings = await sendMsg({ type: 'PG_GET_SETTINGS' });
  enabledToggle.checked = settings?.enabled !== false;
  showSafeToggle.checked = Boolean(settings?.showSafeBadges);
  interceptClicksToggle.checked = settings?.interceptClicks !== false;
  sensitivitySelect.value = settings?.sensitivity || 'balanced';
  apiUrlInput.value = settings?.apiBaseUrl || DEFAULT_API;
  renderStats(settings?.stats || {});
  renderHistory(settings?.scanHistory || []);
  renderCustomRules(settings?.whitelist || [], settings?.blacklist || []);

  if (settings?.userEmail && settings?.accessToken) {
    document.getElementById('authSignedOut').style.display = 'none';
    document.getElementById('authSignedIn').style.display = 'block';
    document.getElementById('connectedEmail').textContent = settings.userEmail;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeUrl = tab?.url || '';
  activeTabId = tab?.id || null;

  async function refreshTabThreats() {
    if (!activeTabId) return;
    const state = await sendMsg({ type: 'PG_GET_TAB_STATE', tabId: activeTabId });
    if (state?.ok) {
      renderTabThreats(state.threats || []);
      renderStats(state.stats || {});
    }
  }

  async function scanActive(triggerInlineRescan = false) {
    if (!enabledToggle.checked) {
      renderVerdict({ domain: 'Protection Paused', riskScore: 0, reasons: ['Toggle shield ON to resume active protection'] }, true);
      await sendMsg({ type: 'PG_SET_BADGE', tabId: activeTabId, status: 'off' });
      return;
    }

    if (triggerInlineRescan && activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: 'PG_RESCAN_TAB' }, () => void chrome.runtime.lastError);
    }

    if (!activeUrl || !/^https?:\/\//i.test(activeUrl)) {
      renderVerdict({ status: 'safe', domain: 'chrome://internal', riskScore: 0, reasons: ['Protected browser internal page'] });
      await refreshTabThreats();
      return;
    }

    statusBadge.textContent = 'SCANNING...';
    const surface = detectSurface(activeUrl);
    const res = await sendMsg({
      type: 'PG_CHECK_ACTIVE_URL',
      url: activeUrl,
      tabId: activeTabId,
      sourceSurface: surface,
    });

    if (res?.verdict) {
      renderVerdict(res.verdict, Boolean(res.disabled));
      const updated = await sendMsg({ type: 'PG_GET_SETTINGS' });
      renderHistory(updated?.scanHistory || []);
      renderStats(updated?.stats || {});
    } else {
      let host = 'Website';
      try { host = new URL(activeUrl).hostname.replace(/^www\./, ''); } catch {}
      const R = window.PolicyGuardRules;
      const local = R
        ? R.quickLocalRisk(activeUrl, '', {
            sensitivity: sensitivitySelect.value,
            whitelist: settings?.whitelist || [],
            blacklist: settings?.blacklist || [],
          })
        : { status: 'suspicious', riskScore: 25, reasons: [] };
      const reasons = [...(local.reasons || []), 'Backend unreachable — offline local heuristics applied'];
      renderVerdict({ ...local, domain: host, reasons });
      await sendMsg({ type: 'PG_SET_BADGE', tabId: activeTabId, status: local.status });
    }
    await refreshTabThreats();
  }

  await scanActive(false);

  document.getElementById('rescanBtn').addEventListener('click', () => scanActive(true));

  document.getElementById('diagBtn')?.addEventListener('click', async () => {
    const diagFeedback = document.getElementById('diagFeedback');
    if (!activeTabId) {
      diagFeedback.textContent = 'No active browser tab detected.';
      return;
    }
    chrome.tabs.sendMessage(activeTabId, { type: 'PG_DIAG_TAB' }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        diagFeedback.textContent = 'Scanner not active on this tab yet — reload the page (F5) once after installing or updating.';
        return;
      }
      const d = res.diag || {};
      diagFeedback.textContent = `Surface: ${d.surface} · Adapter: ${d.adapter} · Found: ${d.found || 0} msgs · Checked: ${d.checked || 0} · Flagged: ${d.threats || 0}`;
    });
  });

  enabledToggle.addEventListener('change', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { enabled: enabledToggle.checked } });
    await scanActive(true);
  });

  sensitivitySelect.addEventListener('change', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { sensitivity: sensitivitySelect.value } });
    await scanActive(true);
  });

  interceptClicksToggle.addEventListener('change', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { interceptClicks: interceptClicksToggle.checked } });
  });

  showSafeToggle.addEventListener('change', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { showSafeBadges: showSafeToggle.checked } });
  });

  async function addRule(msgType) {
    const input = document.getElementById('ruleDomainInput');
    const domain = input.value.trim();
    if (!domain) {
      customRulesFeedback.textContent = 'Enter a domain like example.xyz first.';
      return;
    }
    const res = await sendMsg({ type: msgType, domain });
    if (res?.ok && res.settings) {
      input.value = '';
      renderCustomRules(res.settings.whitelist, res.settings.blacklist);
      customRulesFeedback.textContent = `Updated ${msgType === 'PG_ADD_WHITELIST' ? 'whitelist' : 'blacklist'} rule.`;
      await scanActive(true);
    } else {
      customRulesFeedback.textContent = res?.error || 'Could not save rule.';
    }
  }

  document.getElementById('addWhitelistBtn').addEventListener('click', () => addRule('PG_ADD_WHITELIST'));
  document.getElementById('addBlacklistBtn').addEventListener('click', () => addRule('PG_ADD_BLACKLIST'));

  document.getElementById('presetProdBtn')?.addEventListener('click', () => {
    apiUrlInput.value = DEFAULT_API;
  });
  document.getElementById('presetLocalBtn')?.addEventListener('click', () => {
    apiUrlInput.value = 'http://localhost:5000/api';
  });

  document.getElementById('saveApiBtn').addEventListener('click', async () => {
    const val = apiUrlInput.value.trim();
    if (!/^https?:\/\/.+/i.test(val)) {
      apiFeedback.textContent = 'Enter a valid http:// or https:// API base URL.';
      return;
    }
    apiFeedback.textContent = '';
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { apiBaseUrl: val } });
    apiFeedback.textContent = 'Saved API URL cleanly.';
    await scanActive(true);
  });

  document.getElementById('reportBtn').addEventListener('click', async () => {
    if (!activeUrl || !/^https?:\/\//i.test(activeUrl)) {
      reportFeedback.textContent = 'Open an HTTP/HTTPS page to report.';
      return;
    }
    const category = document.getElementById('reportCategory').value;
    const description = document.getElementById('reportDesc').value.trim();
    const res = await sendMsg({
      type: 'PG_REPORT_SCAM',
      payload: {
        url: activeUrl,
        category,
        description: description || 'Reported from PolicyGuard popup',
        sourceSurface: detectSurface(activeUrl),
      },
    });
    reportFeedback.textContent = res?.ok ? 'Submitted (marked Unverified pending admin check).' : 'Failed to submit report — check API URL.';
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    authFeedback.textContent = '';
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const base = apiUrlInput.value.trim().replace(/\/$/, '');
    if (!email || !password) {
      authFeedback.textContent = 'Enter email and password.';
      return;
    }
    try {
      const resp = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.accessToken) throw new Error(json.error || 'Login failed');
      await sendMsg({
        type: 'PG_SAVE_SETTINGS',
        payload: {
          accessToken: json.accessToken,
          refreshToken: json.refreshToken || '',
          userEmail: json.user?.email || email,
        },
      });
      document.getElementById('authSignedOut').style.display = 'none';
      document.getElementById('authSignedIn').style.display = 'block';
      document.getElementById('connectedEmail').textContent = json.user?.email || email;
      authFeedback.textContent = 'Account synced cleanly.';
    } catch (e) {
      authFeedback.textContent = `Account connect error: ${e.message}`;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { accessToken: '', refreshToken: '', userEmail: '' } });
    document.getElementById('authSignedOut').style.display = 'block';
    document.getElementById('authSignedIn').style.display = 'none';
    authFeedback.textContent = 'Disconnected.';
  });
});
