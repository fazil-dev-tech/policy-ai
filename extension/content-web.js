(function () {
  const R = window.PolicyGuardRules;
  if (!R) return;

  const url = window.location.href;
  const host = R.getHost(url);
  if (!host || host === 'localhost' || host === '127.0.0.1') return;

  const pageSample = `${document.title || ''} ${(document.body?.innerText || '').slice(0, 1400)}`;
  const hasSensitivePrompt = /enter.*upi\s*pin|policy\s*renewal|claim\s*refund|enter\s*otp|aadhaar/i.test(pageSample);
  const flags = hasSensitivePrompt ? 'policy renewal or payment/otp prompt' : '';
  const local = R.quickLocalRisk(url, pageSample);

  chrome.runtime.sendMessage(
    { type: 'PG_CHECK_ACTIVE_URL', url, sourceSurface: 'web', contextFlags: flags },
    (res) => {
      const verdict = res?.verdict || { ...local, url, domain: host, sourceSurface: 'web' };
      chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: verdict.status });

      if (verdict.status === 'threat' || verdict.status === 'suspicious') {
        R.showToastModal(verdict);
      }
    }
  );
})();
