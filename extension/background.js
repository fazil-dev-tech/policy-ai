const DEFAULT_SETTINGS = {
  apiBaseUrl: 'http://localhost:5000/api',
  showSafeBadges: false,
  accessToken: '',
  userEmail: '',
  scanCache: {},
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours local browser cache

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
  return getSettings();
}

function getHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function updateTabBadge(tabId, status) {
  if (!tabId) return;
  const map = {
    threat: { text: '!', color: '#dc2626' },
    suspicious: { text: '?', color: '#d97706' },
    safe: { text: 'OK', color: '#059669' },
  };
  const cfg = map[status] || map.safe;
  try {
    await chrome.action.setBadgeText({ tabId, text: cfg.text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
  } catch {}
}

async function batchCheckRemote(items, sourceSurface) {
  const settings = await getSettings();
  const cache = { ...(settings.scanCache || {}) };
  const now = Date.now();
  const results = {};
  const toFetch = [];

  for (const item of items || []) {
    const url = typeof item === 'string' ? item : item.url;
    const host = getHostname(url);
    if (!host) continue;
    const cached = cache[host];
    if (cached && cached.expiresAt > now && !(item.contextFlags || '').trim()) {
      results[url] = { ...cached.verdict, url, sourceSurface };
    } else {
      toFetch.push(typeof item === 'string' ? { url: item } : item);
    }
  }

  if (toFetch.length > 0) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (settings.accessToken) headers.Authorization = `Bearer ${settings.accessToken}`;
      const resp = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/security/batch-check`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: toFetch.slice(0, 25), sourceSurface }),
      });
      if (resp.ok) {
        const json = await resp.json();
        for (const v of json.results || []) {
          results[v.url] = { ...v, sourceSurface };
          if (v.domain) {
            cache[v.domain] = { verdict: v, expiresAt: now + CACHE_TTL_MS };
          }
        }
        // Cap cache size cleanly
        const keys = Object.keys(cache);
        if (keys.length > 300) {
          for (const k of keys.slice(0, keys.length - 300)) delete cache[k];
        }
        await chrome.storage.local.set({ scanCache: cache });
      }
    } catch (err) {
      // Offline / backend down fallback handled gracefully by caller localRules
    }
  }

  return results;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'PG_GET_SETTINGS') {
        sendResponse(await getSettings());
        return;
      }

      if (msg.type === 'PG_SAVE_SETTINGS') {
        sendResponse(await saveSettings(msg.payload || {}));
        return;
      }

      if (msg.type === 'PG_BATCH_CHECK') {
        const verdictsMap = await batchCheckRemote(msg.items || [], msg.sourceSurface || 'web');
        const settings = await getSettings();
        sendResponse({ verdicts: verdictsMap, showSafeBadges: Boolean(settings.showSafeBadges) });
        return;
      }

      if (msg.type === 'PG_CHECK_ACTIVE_URL') {
        const settings = await getSettings();
        const headers = { 'Content-Type': 'application/json' };
        if (settings.accessToken) headers.Authorization = `Bearer ${settings.accessToken}`;
        const resp = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/security/check-url`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: msg.url,
            sourceSurface: msg.sourceSurface || 'web',
            contextFlags: msg.contextFlags || '',
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const verdict = await resp.json();
        if (msg.tabId) await updateTabBadge(msg.tabId, verdict.status);
        await chrome.storage.local.set({ lastTabVerdict: verdict });
        sendResponse({ ok: true, verdict });
        return;
      }

      if (msg.type === 'PG_SET_BADGE') {
        await updateTabBadge(sender?.tab?.id || msg.tabId, msg.status || 'safe');
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === 'PG_REPORT_SCAM') {
        const settings = await getSettings();
        const headers = { 'Content-Type': 'application/json' };
        if (settings.accessToken) headers.Authorization = `Bearer ${settings.accessToken}`;
        const resp = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/security/scam-reports`, {
          method: 'POST',
          headers,
          body: JSON.stringify(msg.payload || {}),
        });
        const data = await resp.json().catch(() => ({}));
        sendResponse({ ok: resp.ok, data });
        return;
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep async message channel open
});
