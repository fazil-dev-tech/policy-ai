document.addEventListener('DOMContentLoaded', async () => {
  const DEFAULT_API = 'https://policyguard-ai-ecru.vercel.app/api';
  const statusBadge = document.getElementById('statusBadge');
  const activeDomain = document.getElementById('activeDomain');
  const riskScore = document.getElementById('riskScore');
  const reasonsList = document.getElementById('reasonsList');
  const showSafeToggle = document.getElementById('showSafeToggle');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const reportFeedback = document.getElementById('reportFeedback');
  const apiFeedback = document.getElementById('apiFeedback');
  const authFeedback = document.getElementById('authFeedback');
  const scanHistoryList = document.getElementById('scanHistoryList');

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
    return 'web';
  }

  function renderVerdict(v) {
    const status = v?.status || 'safe';
    statusBadge.className = `pg-badge ${status}`;
    statusBadge.textContent = status.toUpperCase();
    activeDomain.textContent = v?.domain || 'Local / Browser Page';
    riskScore.textContent = `${Number(v?.riskScore ?? 0)} / 100`;
    reasonsList.innerHTML = '';
    const list = (v?.reasons || []).length ? v.reasons : ['No threat flags detected'];
    list.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsList.appendChild(li);
    });
  }

  function renderHistory(history = []) {
    if (!scanHistoryList) return;
    scanHistoryList.innerHTML = '';
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

  const settings = await sendMsg({ type: 'PG_GET_SETTINGS' });
  showSafeToggle.checked = Boolean(settings?.showSafeBadges);
  apiUrlInput.value = settings?.apiBaseUrl || DEFAULT_API;
  renderHistory(settings?.scanHistory || []);

  if (settings?.userEmail && settings?.accessToken) {
    document.getElementById('authSignedOut').style.display = 'none';
    document.getElementById('authSignedIn').style.display = 'block';
    document.getElementById('connectedEmail').textContent = settings.userEmail;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeUrl = tab?.url || '';
  activeTabId = tab?.id || null;

  async function scanActive() {
    if (!activeUrl || !/^https?:\/\//i.test(activeUrl)) {
      renderVerdict({ status: 'safe', domain: 'chrome://internal', riskScore: 0, reasons: ['Protected browser internal page'] });
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
      renderVerdict(res.verdict);
      const updated = await sendMsg({ type: 'PG_GET_SETTINGS' });
      renderHistory(updated?.scanHistory || []);
    } else {
      // Offline local heuristic fallback using PolicyGuardRules
      let host = 'Website';
      try { host = new URL(activeUrl).hostname.replace(/^www\./, ''); } catch {}
      const R = window.PolicyGuardRules;
      const local = R ? R.quickLocalRisk(activeUrl, '') : { status: 'suspicious', riskScore: 25, reasons: [] };
      const reasons = [...(local.reasons || []), 'Backend unreachable — offline local heuristics applied'];
      renderVerdict({ ...local, domain: host, reasons });
      await sendMsg({ type: 'PG_SET_BADGE', tabId: activeTabId, status: local.status });
    }
  }

  await scanActive();

  document.getElementById('rescanBtn').addEventListener('click', scanActive);

  showSafeToggle.addEventListener('change', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { showSafeBadges: showSafeToggle.checked } });
  });

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
    await scanActive();
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
