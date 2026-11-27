const PRODUCTION_API_URL = 'https://policyguard-ai-ecru.vercel.app/api';

const DEFAULT_SETTINGS = {
  enabled: true,
  apiBaseUrl: PRODUCTION_API_URL,
  showSafeBadges: false,
  sensitivity: 'balanced',
  interceptClicks: true,
  whitelist: [],
  blacklist: [],
  accessToken: '',
  refreshToken: '',
  userEmail: '',
  scanCache: {},
  scanHistory: [],
  tabThreats: {},
  stats: {
    scannedMessages: 0,
    threatsBlocked: 0,
    safeVerified: 0,
  },
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    stats: { ...DEFAULT_SETTINGS.stats, ...(stored.stats || {}) },
    whitelist: Array.isArray(stored.whitelist) ? stored.whitelist : [],
    blacklist: Array.isArray(stored.blacklist) ? stored.blacklist : [],
    tabThreats: stored.tabThreats && typeof stored.tabThreats === 'object' ? stored.tabThreats : {},
  };
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

function normalizeRuleDomain(input = '') {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

async function recordScanHistory(verdict) {
  if (!verdict || !verdict.domain) return;
  const { scanHistory = [] } = await chrome.storage.local.get(['scanHistory']);
  const entry = {
    domain: verdict.domain,
    status: verdict.status || 'safe',
    riskScore: Number(verdict.riskScore || 0),
    threatCategory: verdict.threatCategory || 'safe',
    surface: verdict.sourceSurface || 'web',
    ts: Date.now(),
  };
  const deduped = [entry, ...scanHistory.filter((h) => h.domain !== entry.domain)].slice(0, 15);
  await chrome.storage.local.set({ scanHistory: deduped });
}

async function incrementStats({ scanned = 0, threats = 0, safe = 0 }) {
  const latest = await chrome.storage.local.get(['stats']);
  const cur = { ...DEFAULT_SETTINGS.stats, ...(latest.stats || {}) };
  cur.scannedMessages = Number(cur.scannedMessages || 0) + scanned;
  cur.threatsBlocked = Number(cur.threatsBlocked || 0) + threats;
  cur.safeVerified = Number(cur.safeVerified || 0) + safe;
  await chrome.storage.local.set({ stats: cur });
  return cur;
}

async function recordTabThreat(tabId, verdict) {
  if (!tabId || !verdict) return;
  const latest = await chrome.storage.local.get(['tabThreats']);
  const tabThreats = { ...(latest.tabThreats || {}) };
  const key = String(tabId);
  const existing = Array.isArray(tabThreats[key]) ? tabThreats[key] : [];
  const item = {
    domain: verdict.domain || 'Unknown',
    url: verdict.url || '',
    status: verdict.status || 'suspicious',
    riskScore: Number(verdict.riskScore || 0),
    threatCategory: verdict.threatCategory || 'suspicious',
    reasons: (verdict.reasons || []).slice(0, 3),
    surface: verdict.sourceSurface || 'web',
    ts: Date.now(),
  };
  const nextList = [item, ...existing.filter((x) => x.domain !== item.domain || x.url !== item.url)].slice(0, 15);
  tabThreats[key] = nextList;
  const tabKeys = Object.keys(tabThreats);
  if (tabKeys.length > 25) {
    for (const oldKey of tabKeys.slice(0, tabKeys.length - 25)) delete tabThreats[oldKey];
  }
  await chrome.storage.local.set({ tabThreats });
}

if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const latest = await chrome.storage.local.get(['tabThreats']);
    const tabThreats = { ...(latest.tabThreats || {}) };
    if (tabThreats[String(tabId)]) {
      delete tabThreats[String(tabId)];
      await chrome.storage.local.set({ tabThreats });
    }
  });
}

if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.url) {
      const latest = await chrome.storage.local.get(['tabThreats']);
      const tabThreats = { ...(latest.tabThreats || {}) };
      if (tabThreats[String(tabId)]) {
        delete tabThreats[String(tabId)];
        await chrome.storage.local.set({ tabThreats });
      }
    }
  });
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
    off: { text: 'OFF', color: '#64748b' },
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

function matchesCustomList(host, list = []) {
  if (!host || !Array.isArray(list)) return null;
  for (const raw of list) {
    const entry = normalizeRuleDomain(raw);
    if (!entry) continue;
    if (host === entry || host.endsWith(`.${entry}`)) return entry;
  }
  return null;
}

function isUrlScopedCacheTarget(rawUrl = '', host = '') {
  const s = String(rawUrl || '').toLowerCase();
  const h = String(host || '').toLowerCase();
  const SHORT_OR_MULTI = [
    'bit.ly', 'tinyurl.com', 't.co', 'rb.gy', 'is.gd', 'cutt.ly', 'goo.gl', 'shorturl.at',
    'rebrand.ly', 'wa.link', 't.ly', 'ow.ly', 'sites.google.com', 'drive.google.com',
    'docs.google.com', 'github.io', 'gitlab.io', 'vercel.app', 'netlify.app', 'pages.dev',
    'web.app', 'firebaseapp.com', 'blogspot.com', 'wordpress.com', 'ngrok-free.app',
    'trycloudflare.com', 'carrd.co', 'webflow.io', 'canva.site', 'forms.gle',
  ];
  return (
    /\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#)/i.test(s) ||
    /^[^/?#]*@/.test(s.replace(/^[a-z]+:\/\//i, '')) ||
    SHORT_OR_MULTI.some((d) => h === d || h.endsWith(`.${d}`))
  );
}

async function batchCheckRemote(items, sourceSurface, tabId = null) {
  const settings = await getSettings();
  if (!settings.enabled) return { verdicts: {}, backendOffline: false };

  const initialCache = { ...(settings.scanCache || {}) };
  const now = Date.now();
  const results = {};
  const toFetch = [];
  let backendOffline = false;

  for (const item of items || []) {
    const url = typeof item === 'string' ? item : item.url;
    const filename = typeof item === 'object' ? item.filename || '' : '';
    const host = getHostname(url);
    if (!host) continue;

    const blacklisted = matchesCustomList(host, settings.blacklist);
    if (blacklisted) {
      results[url] = {
        url,
        domain: host,
        status: 'threat',
        riskScore: 90,
        threatCategory: 'phishing',
        sourceSurface,
        reasons: [`Blocked by custom user blacklist (${blacklisted})`],
      };
      if (tabId) await recordTabThreat(tabId, results[url]);
      continue;
    }

    const urlScoped = isUrlScopedCacheTarget(`${url} ${filename}`, host);
    const cached = urlScoped ? null : initialCache[host];

    if (
      cached &&
      cached.expiresAt > now &&
      !(item.contextFlags || '').trim() &&
      !matchesCustomList(host, settings.whitelist)
    ) {
      results[url] = { ...cached.verdict, url, sourceSurface };
    } else {
      toFetch.push(typeof item === 'string' ? { url: item } : item);
    }
  }

  // Process up to 75 items in clean 25-item chunks so Chrome web pages & full Gmail views are never truncated at 25
  const CHUNK_SIZE = 25;
  const maxItems = toFetch.slice(0, 75);
  for (let i = 0; i < maxItems.length; i += CHUNK_SIZE) {
    const chunk = maxItems.slice(i, i + CHUNK_SIZE);
    try {
      const resp = await fetchWithAutoRefresh(
        `${settings.apiBaseUrl.replace(/\/$/, '')}/security/batch-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: chunk,
            sourceSurface,
            sensitivity: settings.sensitivity || 'balanced',
          }),
        },
        settings
      );
      if (!resp.ok) {
        backendOffline = true;
        continue;
      }
      const json = await resp.json();
      const latest = await chrome.storage.local.get(['scanCache']);
      const mergedCache = { ...(latest.scanCache || {}) };

      for (const v of json.results || []) {
        const mapKey = v.requestedUrl || v.url;
        const host = getHostname(mapKey) || v.domain;
        let finalVerdict = { ...v, sourceSurface };

        // Apply custom user whitelist only if no critical malware/UPI/OTP danger exists
        const whitelisted = matchesCustomList(host, settings.whitelist);
        if (whitelisted && !/\.(apk|exe|ps1|scr)/i.test(mapKey) && Number(v.riskScore || 0) < 60) {
          finalVerdict = {
            ...finalVerdict,
            status: 'safe',
            riskScore: 5,
            threatCategory: 'safe',
            reasons: [`Trusted by user whitelist (${whitelisted})`],
          };
        }

        results[mapKey] = finalVerdict;
        if (v.url && v.url !== mapKey) results[v.url] = finalVerdict;

        // Only cache non-scoped hosts when actually researched or verified safe or flagged (prevents unresearched SAFE cache poisoning)
        const actuallyVerified =
          Boolean(finalVerdict.researched) ||
          Boolean(finalVerdict.verifiedProvider) ||
          finalVerdict.status !== 'safe';
        if (host && !isUrlScopedCacheTarget(mapKey, host) && actuallyVerified) {
          mergedCache[host] = { verdict: finalVerdict, expiresAt: now + CACHE_TTL_MS };
        }
        if (finalVerdict.status === 'threat' || finalVerdict.status === 'suspicious') {
          await recordScanHistory(finalVerdict);
          if (tabId) await recordTabThreat(tabId, finalVerdict);
        }
      }
      const keys = Object.keys(mergedCache);
      if (keys.length > 300) {
        for (const k of keys.slice(0, keys.length - 300)) delete mergedCache[k];
      }
      await chrome.storage.local.set({ scanCache: mergedCache });
    } catch {
      backendOffline = true;
    }
  }

  return { verdicts: results, backendOffline };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'PG_GET_SETTINGS') {
        sendResponse(await getSettings());
        return;
      }

      if (msg.type === 'PG_SAVE_SETTINGS') {
        const payload = { ...(msg.payload || {}) };
        if (payload.apiBaseUrl !== undefined || payload.sensitivity !== undefined) {
          payload.scanCache = {};
        }
        sendResponse(await saveSettings(payload));
        return;
      }

      if (msg.type === 'PG_RECORD_STATS') {
        const stats = await incrementStats(msg.payload || {});
        if (msg.verdict && (sender?.tab?.id || msg.tabId)) {
          await recordTabThreat(sender?.tab?.id || msg.tabId, msg.verdict);
        }
        sendResponse({ ok: true, stats });
        return;
      }

      if (msg.type === 'PG_RECORD_TAB_THREAT') {
        await recordTabThreat(sender?.tab?.id || msg.tabId, msg.verdict);
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === 'PG_GET_TAB_STATE') {
        const settings = await getSettings();
        const tabKey = String(msg.tabId || '');
        sendResponse({
          ok: true,
          threats: settings.tabThreats[tabKey] || [],
          stats: settings.stats,
        });
        return;
      }

      if (msg.type === 'PG_ADD_WHITELIST' || msg.type === 'PG_ADD_BLACKLIST') {
        const settings = await getSettings();
        const domain = normalizeRuleDomain(msg.domain);
        if (!domain) {
          sendResponse({ ok: false, error: 'Invalid domain' });
          return;
        }
        const targetKey = msg.type === 'PG_ADD_WHITELIST' ? 'whitelist' : 'blacklist';
        const otherKey = msg.type === 'PG_ADD_WHITELIST' ? 'blacklist' : 'whitelist';
        const nextTarget = Array.from(new Set([domain, ...(settings[targetKey] || [])])).slice(0, 100);
        const nextOther = (settings[otherKey] || []).filter((d) => normalizeRuleDomain(d) !== domain);
        const cache = { ...(settings.scanCache || {}) };
        delete cache[domain];
        const saved = await saveSettings({ [targetKey]: nextTarget, [otherKey]: nextOther, scanCache: cache });
        sendResponse({ ok: true, settings: saved });
        return;
      }

      if (msg.type === 'PG_REMOVE_LIST_RULE') {
        const settings = await getSettings();
        const domain = normalizeRuleDomain(msg.domain);
        const key = msg.listType === 'blacklist' ? 'blacklist' : 'whitelist';
        const next = (settings[key] || []).filter((d) => normalizeRuleDomain(d) !== domain);
        const cache = { ...(settings.scanCache || {}) };
        delete cache[domain];
        const saved = await saveSettings({ [key]: next, scanCache: cache });
        sendResponse({ ok: true, settings: saved });
        return;
      }

      if (msg.type === 'PG_BATCH_CHECK') {
        const settings = await getSettings();
        const tabId = sender?.tab?.id || msg.tabId || null;
        if (!settings.enabled) {
          sendResponse({ verdicts: {}, disabled: true, showSafeBadges: false, backendOffline: false });
          return;
        }
        const { verdicts: verdictsMap, backendOffline } = await batchCheckRemote(msg.items || [], msg.sourceSurface || 'web', tabId);
        sendResponse({
          verdicts: verdictsMap,
          backendOffline,
          showSafeBadges: Boolean(settings.showSafeBadges),
          sensitivity: settings.sensitivity || 'balanced',
        });
        return;
      }

      if (msg.type === 'PG_CHECK_ACTIVE_URL') {
        const settings = await getSettings();
        const targetTabId = msg.tabId || sender?.tab?.id;
        if (!settings.enabled) {
          if (targetTabId) await updateTabBadge(targetTabId, 'off');
          sendResponse({
            ok: true,
            verdict: { status: 'safe', riskScore: 0, domain: getHostname(msg.url), reasons: ['PolicyGuard Shield is paused'] },
            disabled: true,
          });
          return;
        }

        const host = getHostname(msg.url);
        const blacklisted = matchesCustomList(host, settings.blacklist);
        if (blacklisted) {
          const blkVerdict = {
            url: msg.url,
            domain: host,
            status: 'threat',
            riskScore: 95,
            threatCategory: 'phishing',
            sourceSurface: msg.sourceSurface || 'web',
            reasons: [`Blocked by custom user blacklist (${blacklisted})`],
          };
          if (targetTabId) {
            await updateTabBadge(targetTabId, 'threat');
            await recordTabThreat(targetTabId, blkVerdict);
          }
          sendResponse({ ok: true, verdict: blkVerdict });
          return;
        }

        const now = Date.now();
        const hasPayloadOrTrick =
          /\.(apk|exe|scr|bat|cmd|vbs|ps1|msi|jar)(\?|$|#)/i.test(msg.url || '') ||
          /^[^/?#]*@/.test(String(msg.url || '').replace(/^[a-z]+:\/\//i, ''));
        const cached = settings.scanCache?.[host];

        if (
          cached &&
          cached.expiresAt > now &&
          !(msg.contextFlags || '').trim() &&
          !hasPayloadOrTrick &&
          !matchesCustomList(host, settings.whitelist)
        ) {
          const verdict = { ...cached.verdict, sourceSurface: msg.sourceSurface || 'web', cached: true };
          if (targetTabId) {
            await updateTabBadge(targetTabId, verdict.status);
            if (verdict.status !== 'safe') await recordTabThreat(targetTabId, verdict);
          }
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
              sensitivity: settings.sensitivity || 'balanced',
              filename: msg.filename || '',
            }),
          },
          settings
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        let verdict = await resp.json();
        verdict.sourceSurface = msg.sourceSurface || 'web';

        const whitelisted = matchesCustomList(host, settings.whitelist);
        if (whitelisted && !hasPayloadOrTrick && Number(verdict.riskScore || 0) < 60) {
          verdict = {
            ...verdict,
            status: 'safe',
            riskScore: 5,
            threatCategory: 'safe',
            reasons: [`Trusted by user whitelist (${whitelisted})`],
          };
        }

        if (targetTabId) {
          await updateTabBadge(targetTabId, verdict.status);
          if (verdict.status !== 'safe') await recordTabThreat(targetTabId, verdict);
        }
        if (host && !hasPayloadOrTrick) {
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
