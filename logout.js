(() => {
  const button = document.getElementById('logout-button');
  const leave = () => location.replace(new URL('login.html', location.href).href);
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'กำลังออกจากระบบ…';
    let session;
    try { session = JSON.parse(localStorage.getItem('flowbill-session') || 'null'); } catch {}
    // Clear this browser immediately, including other open CRM tabs.
    ['flowbill-session', 'flowbill-org-id', 'flowbill-crm'].forEach(key => localStorage.removeItem(key));
    const config = window.SUPABASE_CONFIG;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      if (session?.access_token && config?.url && config?.publishableKey) {
        await fetch(config.url + '/auth/v1/logout?scope=local', {
          method: 'POST', signal: controller.signal,
          headers: { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}` }
        });
      }
    } catch { /* Offline logout still clears this browser and returns to login. */ }
    finally { clearTimeout(timeout); leave(); }
  });
  window.addEventListener('storage', event => {
    if (event.key === 'flowbill-session' && !event.newValue) leave();
  });
  window.addEventListener('pageshow', () => {
    if (!localStorage.getItem('flowbill-session')) leave();
  });
})();
