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
    state.customers = rows.map((customer) => ({ id: customer.id, name: customer.name, contact: customer.contact_name || '-', taxId: customer.tax_id || '-', phone: customer.phone || '-', terms: `${customer.credit_term_days} วัน`, sales: '฿ 0' }));
  };
  const syncProducts = async () => {
    const rows = await request(`/rest/v1/products?organization_id=eq.${orgId}&select=code,name,is_active,product_variants(sku,label,is_active,variant_prices(price,starts_on))&order=created_at.desc`);
    state.products = rows.flatMap((product) => (product.product_variants || []).filter((variant) => variant.is_active).map((variant) => {
      const price = (variant.variant_prices || []).sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)))[0]?.price ?? 0;
      return { id: variant.id, sku: variant.sku || product.code, name: product.name, size: variant.label, price: Number(price).toFixed(2), status: product.is_active ? 'ใช้งาน' : 'ปิดใช้งาน' };
    }));
  };
  const syncQuotations = async () => {
    const rows = await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.quotation&select=document_number,customer_name_snapshot,issue_date,valid_until,grand_total,status&order=created_at.desc`);
    const status = { draft: 'ร่าง', sent: 'รออนุมัติ', approved: 'อนุมัติแล้ว', cancelled: 'ยกเลิก' };
    const thaiDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    state.quotations = rows.map((quote) => ({ no: quote.document_number, customer: quote.customer_name_snapshot, date: thaiDate(quote.issue_date), expires: thaiDate(quote.valid_until), total: `฿ ${Number(quote.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, status: status[quote.status] || quote.status }));
  };
  const syncAll = async () => { await loadOrganization(); await Promise.all([syncCustomers(), syncProducts(), syncQuotations()]); render(); };
  const login = () => { document.querySelector('#modal-content').innerHTML = '<div class="form-content"><h2>เข้าสู่ระบบ CRM</h2><label class="field"><span>อีเมล</span><input name="email" type="email" required></label><label class="field"><span>รหัสผ่าน</span><input name="password" type="password" required></label><p id="loginError" style="color:#c43d50"></p><div class="form-actions"><button value="cancel" class="ghost">ยกเลิก</button><button class="primary" value="login">เข้าสู่ระบบ</button></div></div>'; modal.dataset.type = 'login'; modal.showModal(); };
  // Always allow a fresh sign-in. This also recovers cleanly when a browser
  // restores an expired Supabase session after the page has been reopened.
  button.onclick = login;
  const baseOpenForm = window.openForm;
  window.openForm = (type) => {
    if (type !== 'quotation') return baseOpenForm(type);
    const customers = state.customers.map((customer) => `<option value="${customer.id}">${customer.name}</option>`).join('');
    const products = state.products.map((product) => `<option value="${product.id}">${product.sku} — ${product.name} (${product.size}) · ฿${product.price}</option>`).join('');
    document.querySelector('#modal-content').innerHTML = `<div class="form-content"><h2>สร้างใบเสนอราคา</h2><label class="field"><span>ลูกค้า</span><select name="customerId" required>${customers}</select></label><label class="field"><span>สินค้า</span><select name="variantId" required>${products}</select></label><label class="field"><span>จำนวน</span><input name="quantity" required type="number" min="1" step="1" value="1"></label><label class="field"><span>วันหมดอายุ</span><input name="expires" required type="date"></label><p id="quoteSummary">ระบบคำนวณ VAT 7% ให้เมื่อบันทึก</p><div class="form-actions"><button value="cancel" class="ghost">ยกเลิก</button><button class="primary" value="default">บันทึกร่าง</button></div></div>`;
    modal.dataset.type = 'quotation'; modal.showModal();
  };
  const addProduct = async (data) => {
    const products = await request('/rest/v1/products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, code: data.sku, name: data.name, unit: 'ชิ้น' }) });
    const variants = await request('/rest/v1/product_variants', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ product_id: products[0].id, sku: data.sku, label: data.size }) });
    await request('/rest/v1/variant_prices', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ variant_id: variants[0].id, price: Number(data.price) }) });
    await syncProducts(); render();
  };
  const addQuotation = async (data) => {
    const customer = state.customers.find((item) => item.id === data.customerId);
    const product = state.products.find((item) => item.id === data.variantId);
    if (!customer || !product) throw new Error('ไม่พบลูกค้าหรือสินค้า กรุณาลองใหม่');
    const quantity = Number(data.quantity);
    const unitPrice = Number(product.price);
    const subtotal = quantity * unitPrice;
    const vatAmount = subtotal * 0.07;
    const today = new Date().toISOString().slice(0, 10);
    const number = `QT-${today.replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
    const documents = await request('/rest/v1/documents', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, kind: 'quotation', document_number: number, status: 'draft', customer_id: customer.id, customer_name_snapshot: customer.name, customer_tax_id_snapshot: customer.taxId === '-' ? null : customer.taxId, issue_date: today, valid_until: data.expires, subtotal, taxable_amount: subtotal, vat_rate: 7, vat_amount: vatAmount, grand_total: subtotal + vatAmount, created_by: session.user.id }) });
    await request('/rest/v1/document_items', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ document_id: documents[0].id, position: 1, product_variant_id: product.id, sku_snapshot: product.sku, product_name_snapshot: product.name, specification_snapshot: product.size, unit_snapshot: 'ชิ้น', quantity, unit_price: unitPrice, line_total: subtotal }) });
    await syncQuotations(); render();
  };
  document.querySelector('#modal-form').addEventListener('submit', async (event) => {
    if (event.submitter.value === 'cancel' || !['login', 'customer', 'product', 'quotation'].includes(modal.dataset.type)) return;
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
      else if (modal.dataset.type === 'quotation' && session && orgId) { await addQuotation(data); modal.close(); }
    } catch (error) { if (modal.dataset.type === 'login') document.querySelector('#loginError').textContent = error.message; else alert(error.message); }
  }, true);
  if (session) syncAll().catch(() => { session = null; localStorage.removeItem('flowbill-session'); label(); });
})();
