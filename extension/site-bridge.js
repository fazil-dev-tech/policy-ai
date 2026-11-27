// PolicyGuard Site Bridge (adapted cleanly from EXT KAV): lets PolicyGuard web app detect installation & sync API/session config.
(function () {
  const version = (() => {
    try { return chrome.runtime.getManifest().version; } catch { return '2.1.0'; }
  })();
  document.documentElement.dataset.policyguardExtension = version;

  // Automatically align backend API base when testing locally against PolicyGuard frontend
  const isLocalDev = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  if (isLocalDev) {
    try {
      chrome.runtime.sendMessage({ type: 'PG_GET_SETTINGS' }, (cfg) => {
        if (chrome.runtime.lastError || !cfg) return;
        if (!cfg.apiBaseUrl || cfg.apiBaseUrl.includes('vercel.app')) {
          chrome.runtime.sendMessage({ type: 'PG_SAVE_SETTINGS', payload: { apiBaseUrl: 'http://localhost:5000/api' } });
        }
      });
    } catch {}
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || !e.data.policyguard) return;
    if (e.data.policyguard === 'ping') {
      window.postMessage({ policyguard: 'pong', version }, window.location.origin);
      return;
    }
    if (e.data.policyguard === 'sync_config' && e.data.payload && typeof e.data.payload === 'object') {
      chrome.runtime.sendMessage(
        { type: 'PG_SAVE_SETTINGS', payload: e.data.payload },
        (saved) => {
          window.postMessage(
            { policyguard: 'synced', ok: !chrome.runtime.lastError, version, apiBaseUrl: saved?.apiBaseUrl || '' },
            window.location.origin
          );
        }
      );
    }
  });
})();
