(() => {
  const config = window.SUPABASE_CONFIG;
  let session = JSON.parse(localStorage.getItem('flowbill-session') || 'null');
  let orgId = localStorage.getItem('flowbill-org-id');
  const headers = () => ({ apikey: config.publishableKey, Authorization: `Bearer ${session?.access_token || config.publishableKey}`, 'Content-Type': 'application/json' });
  const request = async (path, options = {}) => {
    const response = await fetch(config.url + path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || detail.hint || 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ'); }
    return response.status === 204 ? null : response.json();
  };
  const button = document.createElement('button'); button.className = 'ghost'; document.querySelector('.header-actions').prepend(button);
  const label = () => { button.textContent = session ? '● ฐานข้อมูลเชื่อมแล้ว' : 'เข้าสู่ระบบ'; }; label();
  const loadOrganization = async () => {
    const memberships = await request(`/rest/v1/organization_members?user_id=eq.${session.user.id}&select=organization_id`);
    if (!memberships.length) throw new Error('บัญชีนี้ยังไม่มีสิทธิ์องค์กร CRM');
    orgId = memberships[0].organization_id; localStorage.setItem('flowbill-org-id', orgId);
  };
  const syncCustomers = async () => {
    const rows = await request(`/rest/v1/customers?organization_id=eq.${orgId}&select=*&order=created_at.desc`);
    state.customers = rows.map((customer) => ({ name: customer.name, contact: customer.contact_name || '-', taxId: customer.tax_id || '-', phone: customer.phone || '-', terms: `${customer.credit_term_days} วัน`, sales: '฿ 0' }));
  };
  const syncProducts = async () => {
    const rows = await request(`/rest/v1/products?organization_id=eq.${orgId}&select=code,name,is_active,product_variants(sku,label,is_active,variant_prices(price,starts_on))&order=created_at.desc`);
    state.products = rows.flatMap((product) => (product.product_variants || []).filter((variant) => variant.is_active).map((variant) => {
      const price = (variant.variant_prices || []).sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)))[0]?.price ?? 0;
      return { sku: variant.sku || product.code, name: product.name, size: variant.label, price: Number(price).toFixed(2), status: product.is_active ? 'ใช้งาน' : 'ปิดใช้งาน' };
    }));
  };
  const syncAll = async () => { await loadOrganization(); await Promise.all([syncCustomers(), syncProducts()]); render(); };
  const login = () => { document.querySelector('#modal-content').innerHTML = '<div class="form-content"><h2>เข้าสู่ระบบ CRM</h2><label class="field"><span>อีเมล</span><input name="email" type="email" required></label><label class="field"><span>รหัสผ่าน</span><input name="password" type="password" required></label><p id="loginError" style="color:#c43d50"></p><div class="form-actions"><button value="cancel" class="ghost">ยกเลิก</button><button class="primary" value="login">เข้าสู่ระบบ</button></div></div>'; modal.dataset.type = 'login'; modal.showModal(); };
  // Always allow a fresh sign-in. This also recovers cleanly when a browser
  // restores an expired Supabase session after the page has been reopened.
  button.onclick = login;
  const addProduct = async (data) => {
    const products = await request('/rest/v1/products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, code: data.sku, name: data.name, unit: 'ชิ้น' }) });
    const variants = await request('/rest/v1/product_variants', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ product_id: products[0].id, sku: data.sku, label: data.size }) });
    await request('/rest/v1/variant_prices', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ variant_id: variants[0].id, price: Number(data.price) }) });
    await syncProducts(); render();
  };
  document.querySelector('#modal-form').addEventListener('submit', async (event) => {
    if (event.submitter.value === 'cancel' || !['login', 'customer', 'product'].includes(modal.dataset.type)) return;
    // The original prototype stores the row locally and closes this dialog.
    // Handle database-backed forms first, so the screen only changes after
    // Supabase has confirmed that the record was saved.
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (modal.dataset.type === 'login') { session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify(data) }); localStorage.setItem('flowbill-session', JSON.stringify(session)); await syncAll(); modal.close(); label(); }
      else if (modal.dataset.type === 'customer' && session && orgId) { await request('/rest/v1/customers', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ organization_id: orgId, name: data.name, contact_name: data.contact || null, tax_id: data.taxId || null, phone: data.phone || null, credit_term_days: parseInt(data.terms) || 30 }) }); await syncCustomers(); render(); modal.close(); }
      else if (modal.dataset.type === 'product' && session && orgId) { await addProduct(data); modal.close(); }
    } catch (error) { if (modal.dataset.type === 'login') document.querySelector('#loginError').textContent = error.message; else alert(error.message); }
  }, true);
  if (session) syncAll().catch(() => { session = null; localStorage.removeItem('flowbill-session'); label(); });
})();
