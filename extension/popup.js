document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const activeDomain = document.getElementById('activeDomain');
  const riskScore = document.getElementById('riskScore');
  const reasonsList = document.getElementById('reasonsList');
  const showSafeToggle = document.getElementById('showSafeToggle');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const reportFeedback = document.getElementById('reportFeedback');

  let activeUrl = '';
  let activeTabId = null;

  function sendMsg(payload) {
    return new Promise((resolve) => chrome.runtime.sendMessage(payload, resolve));
  }

  function renderVerdict(v) {
    const status = v?.status || 'safe';
    statusBadge.className = `pg-badge ${status}`;
    statusBadge.textContent = status.toUpperCase();
    activeDomain.textContent = v?.domain || 'Local / Browser Page';
    riskScore.textContent = `${v?.riskScore ?? 0} / 100`;
    reasonsList.innerHTML = '';
    const list = (v?.reasons || []).length ? v.reasons : ['No threat flags detected'];
    list.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsList.appendChild(li);
    });
  }

  const settings = await sendMsg({ type: 'PG_GET_SETTINGS' });
  showSafeToggle.checked = Boolean(settings?.showSafeBadges);
  apiUrlInput.value = settings?.apiBaseUrl || 'http://localhost:5000/api';

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
    const res = await sendMsg({
      type: 'PG_CHECK_ACTIVE_URL',
      url: activeUrl,
      tabId: activeTabId,
      sourceSurface: activeUrl.includes('whatsapp') ? 'whatsapp' : activeUrl.includes('mail.google') ? 'gmail' : 'web',
    });
    if (res?.verdict) {
      renderVerdict(res.verdict);
    } else {
      renderVerdict({ status: 'suspicious', domain: new URL(activeUrl).hostname, riskScore: 30, reasons: ['Backend unreachable — running local heuristics only'] });
    }
  }

  await scanActive();

  document.getElementById('rescanBtn').addEventListener('click', scanActive);

  showSafeToggle.addEventListener('change', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { showSafeBadges: showSafeToggle.checked } });
  });

  document.getElementById('saveApiBtn').addEventListener('click', async () => {
    const val = apiUrlInput.value.trim();
    if (val) {
      await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { apiBaseUrl: val } });
      await scanActive();
    }
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
        sourceSurface: 'web',
      },
    });
    reportFeedback.textContent = res?.ok ? 'Submitted (marked Unverified pending admin check).' : 'Failed to submit report — check API URL.';
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const base = apiUrlInput.value.trim().replace(/\/$/, '');
    try {
      const resp = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.accessToken) throw new Error(json.error || 'Login failed');
      await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { accessToken: json.accessToken, userEmail: json.user?.email || email } });
      document.getElementById('authSignedOut').style.display = 'none';
      document.getElementById('authSignedIn').style.display = 'block';
      document.getElementById('connectedEmail').textContent = json.user?.email || email;
    } catch (e) {
      reportFeedback.textContent = `Account connect error: ${e.message}`;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sendMsg({ type: 'PG_SAVE_SETTINGS', payload: { accessToken: '', userEmail: '' } });
    document.getElementById('authSignedOut').style.display = 'block';
    document.getElementById('authSignedIn').style.display = 'none';
  });
});
