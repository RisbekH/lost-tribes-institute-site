// Sends each email sign-up to the Institute's list in Kit, tagged with the
// topics the person chose, then lets the form go on to Netlify as usual.
// Netlify keeps a backup copy of every sign-up and shows the thank-you page,
// so nobody is lost even if Kit can't be reached.
(() => {
  const KIT_FORM = 'https://app.kit.com/forms/10216264/subscriptions';
  const TAGS = { symposiums: '26181902', projects: '26181903', essays: '26181904' };

  document.querySelectorAll('form[name="subscribe"]').forEach(form => {
    form.addEventListener('submit', async e => {
      if (e.defaultPrevented || form.dataset.sent) return;
      e.preventDefault();
      if (form.querySelector('[name="bot-field"]')?.value) return;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Signing you up…'; }

      const fd = new FormData();
      fd.append('email_address', form.querySelector('[name="email"]').value.trim());
      const name = form.querySelector('[name="name"]')?.value.trim();
      if (name) fd.append('fields[first_name]', name);
      for (const [field, id] of Object.entries(TAGS)) {
        const el = form.querySelector(`[name="${field}"]`);
        if (el && (el.type !== 'checkbox' || el.checked)) fd.append('tags[]', id);
      }

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(KIT_FORM, { method: 'POST', body: fd, headers: { Accept: 'application/json' }, signal: ctrl.signal });
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (data.status === 'failed' && data.errors?.fields?.includes('email_address')) {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
          alertBox(form, 'That email address doesn’t look right. Please check it and try again.');
          return;
        }
      } catch (_) { /* Kit unreachable: Netlify still records the sign-up below */ }

      form.dataset.sent = '1';
      form.submit();
    });
  });

  function alertBox(form, msg) {
    let p = form.querySelector('.sub-kit-err');
    if (!p) { p = document.createElement('p'); p.className = 'sub-kit-err sub-err'; p.setAttribute('role', 'alert'); form.appendChild(p); }
    p.textContent = msg; p.hidden = false;
  }
})();
