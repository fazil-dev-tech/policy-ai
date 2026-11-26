const PRODUCTION_API_URL = 'https://policyguard-ai-ecru.vercel.app/api';

const DEFAULT_SETTINGS = {
  apiBaseUrl: PRODUCTION_API_URL,
  showSafeBadges: false,
  accessToken: '',
  refreshToken: '',
  userEmail: '',
  scanCache: {},
  scanHistory: [],
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

async function recordScanHistory(verdict) {
  if (!verdict || !verdict.domain) return;
  const { scanHistory = [] } = await chrome.storage.local.get(['scanHistory']);
  const entry = {
    domain: verdict.domain,
    status: verdict.status || 'safe',
    riskScore: Number(verdict.riskScore || 0),
    surface: verdict.sourceSurface || 'web',
    ts: Date.now(),
  };
  const deduped = [entry, ...scanHistory.filter((h) => h.domain !== entry.domain)].slice(0, 12);
  await chrome.storage.local.set({ scanHistory: deduped });
}

async function fetchWithAutoRefresh(url, init = {}, settings = null) {
  const cfg = settings || (await getSettings());
  const headers = { ...(init.headers || {}) };
  if (cfg.accessToken) headers.Authorization = `Bearer ${cfg.accessToken}`;
  let resp = await fetch(url, { ...init, headers });

  if (resp.status === 401 && cfg.refreshToken) {
    try {
      const refResp = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, '')}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: cfg.refreshToken }),
      });
      if (refResp.ok) {
        const refData = await refResp.json();
        if (refData.accessToken) {
          await saveSettings({
            accessToken: refData.accessToken,
            refreshToken: refData.refreshToken || cfg.refreshToken,
          });
          headers.Authorization = `Bearer ${refData.accessToken}`;
          resp = await fetch(url, { ...init, headers });
        }
      }
    } catch {}
  }
  return resp;
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
  const initialCache = { ...(settings.scanCache || {}) };
  const now = Date.now();
  const results = {};
  const toFetch = [];

  for (const item of items || []) {
    const url = typeof item === 'string' ? item : item.url;
    const host = getHostname(url);
    if (!host) continue;
    const cached = initialCache[host];
    if (cached && cached.expiresAt > now && !(item.contextFlags || '').trim() && !/\.apk(\?|$|#)/i.test(url)) {
      results[url] = { ...cached.verdict, url, sourceSurface };
    } else {
      toFetch.push(typeof item === 'string' ? { url: item } : item);
    }
  }

  if (toFetch.length > 0) {
    try {
      const resp = await fetchWithAutoRefresh(
        `${settings.apiBaseUrl.replace(/\/$/, '')}/security/batch-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toFetch.slice(0, 25), sourceSurface }),
        },
        settings
      );
      if (resp.ok) {
        const json = await resp.json();
        // Re-read scanCache right before merge so concurrent scans don't overwrite each other
        const latest = await chrome.storage.local.get(['scanCache']);
        const mergedCache = { ...(latest.scanCache || {}) };

        for (const v of json.results || []) {
          const mapKey = v.requestedUrl || v.url;
          results[mapKey] = { ...v, sourceSurface };
          if (v.url && v.url !== mapKey) results[v.url] = { ...v, sourceSurface };
          const h = getHostname(mapKey) || v.domain;
          if (h && !/\.apk(\?|$|#)/i.test(mapKey)) {
            mergedCache[h] = { verdict: v, expiresAt: now + CACHE_TTL_MS };
          }
          if (v.status === 'threat' || v.status === 'suspicious') {
            await recordScanHistory({ ...v, sourceSurface });
          }
        }
        const keys = Object.keys(mergedCache);
        if (keys.length > 300) {
          for (const k of keys.slice(0, keys.length - 300)) delete mergedCache[k];
        }
        await chrome.storage.local.set({ scanCache: mergedCache });
      }
    } catch {}
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
        const payload = msg.payload || {};
        if (payload.apiBaseUrl !== undefined) {
          payload.scanCache = {}; // Clear stale cache when switching backend API
        }
        sendResponse(await saveSettings(payload));
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
        const host = getHostname(msg.url);
        const now = Date.now();
        const cached = settings.scanCache?.[host];
        if (cached && cached.expiresAt > now && !(msg.contextFlags || '').trim() && !/\.apk(\?|$|#)/i.test(msg.url || '')) {
          const verdict = { ...cached.verdict, sourceSurface: msg.sourceSurface || 'web', cached: true };
          if (msg.tabId || sender?.tab?.id) await updateTabBadge(msg.tabId || sender.tab.id, verdict.status);
          sendResponse({ ok: true, verdict });
          return;
        }

        const resp = await fetchWithAutoRefresh(
          `${settings.apiBaseUrl.replace(/\/$/, '')}/security/check-url`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: msg.url,
              sourceSurface: msg.sourceSurface || 'web',
              contextFlags: msg.contextFlags || '',
            }),
          },
          settings
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const verdict = await resp.json();
        verdict.sourceSurface = msg.sourceSurface || 'web';
        if (msg.tabId || sender?.tab?.id) await updateTabBadge(msg.tabId || sender.tab.id, verdict.status);
        if (host && !/\.apk(\?|$|#)/i.test(msg.url || '')) {
          const latest = await chrome.storage.local.get(['scanCache']);
          const cache = { ...(latest.scanCache || {}) };
          cache[host] = { verdict, expiresAt: now + CACHE_TTL_MS };
          await chrome.storage.local.set({ scanCache: cache });
        }
        await recordScanHistory(verdict);
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
        const resp = await fetchWithAutoRefresh(
          `${settings.apiBaseUrl.replace(/\/$/, '')}/security/scam-reports`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg.payload || {}),
          },
          settings
        );
        const data = await resp.json().catch(() => ({}));
        sendResponse({ ok: resp.ok, data });
        return;
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});
