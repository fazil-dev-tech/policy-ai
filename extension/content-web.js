(function () {
  const R = window.PolicyGuardRules;
  if (!R) return;

  let lastCheckedHref = '';

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

  function evaluateCurrentPage() {
    const url = window.location.href;
    if (url === lastCheckedHref) return;
    lastCheckedHref = url;

    const host = R.getHost(url);
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host === 'policyguard-ai-ecru.vercel.app'
    ) {
      return;
    }

    const pageSample = `${document.title || ''} ${(document.body?.textContent || '').slice(0, 1400)}`;
    const hasSensitivePrompt = /enter.*upi\s*pin|policy\s*renewal|claim\s*refund|enter\s*otp|aadhaar/i.test(pageSample);
    const { hasCardOrPinInput, hasCrossOriginForm } = inspectFormsAndInputs(host);

    const flags = [];
    if (hasSensitivePrompt) flags.push('payment/otp prompt');
    if (hasCardOrPinInput) flags.push('sensitive card/upi/otp form input');
    if (hasCrossOriginForm) flags.push('external form submission');

    const local = R.quickLocalRisk(url, `${pageSample} ${flags.join(' ')}`);

    chrome.runtime.sendMessage(
      { type: 'PG_CHECK_ACTIVE_URL', url, sourceSurface: 'web', contextFlags: flags.join(' ') },
      (res) => {
        if (chrome.runtime.lastError) return;
        const verdict = res?.verdict || { ...local, url, domain: host, sourceSurface: 'web' };
        chrome.runtime.sendMessage({ type: 'PG_SET_BADGE', status: verdict.status }, () => void chrome.runtime.lastError);

        if (verdict.status === 'threat' || verdict.status === 'suspicious') {
          R.showToastModal(verdict);
        }
      }
    );
  }

  evaluateCurrentPage();
  window.addEventListener('popstate', () => setTimeout(evaluateCurrentPage, 400));
  window.addEventListener('hashchange', () => setTimeout(evaluateCurrentPage, 400));
})();
