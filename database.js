(() => {
  const config = window.SUPABASE_CONFIG;
  let session = JSON.parse(localStorage.getItem('flowbill-session') || 'null');
  let orgId = localStorage.getItem('flowbill-org-id');
  const headers = () => ({ apikey: config.publishableKey, Authorization: `Bearer ${session?.access_token || config.publishableKey}`, 'Content-Type': 'application/json' });
  const request = async (path, options = {}) => {
    const response = await fetch(config.url + path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const body = await response.text();
    if (!response.ok) { const detail = JSON.parse(body || '{}'); throw new Error(detail.message || detail.hint || 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ'); }
    return body ? JSON.parse(body) : null;
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
    const rows = await request(`/rest/v1/products?organization_id=eq.${orgId}&select=code,name,is_active,product_variants(id,sku,label,is_active,variant_prices(price,starts_on))&order=created_at.desc`);
    state.products = rows.flatMap((product) => (product.product_variants || []).filter((variant) => variant.is_active).map((variant) => {
      const price = (variant.variant_prices || []).sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)))[0]?.price ?? 0;
      return { id: variant.id, sku: variant.sku || product.code, name: product.name, size: variant.label, price: Number(price).toFixed(2), status: product.is_active ? 'ใช้งาน' : 'ปิดใช้งาน' };
    }));
  };
  const syncCompanyProfile = async () => {
    const organization = (await request(`/rest/v1/organizations?id=eq.${orgId}&select=name,tax_id,address,vat_rate&limit=1`))[0];
    if (!organization) return;
    const settings = document.querySelector('#settings');
    settings.innerHTML = `<article class="panel settings-card"><h3>ข้อมูลบริษัท</h3><p>ข้อมูลนี้จะแสดงบนใบเสนอราคา ใบวางบิล และใบกำกับภาษี</p><form id="company-profile-form"><label class="field"><span>ชื่อบริษัท</span><input name="name" required value="${organization.name || ''}"></label><label class="field"><span>เลขประจำตัวผู้เสียภาษี</span><input name="taxId" value="${organization.tax_id || ''}" placeholder="13 หลัก"></label><label class="field"><span>ที่อยู่บริษัท</span><textarea name="address" rows="3" placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์">${organization.address || ''}</textarea></label><label class="field"><span>อัตรา VAT (%)</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="${organization.vat_rate ?? 7}"></label><div class="form-actions"><button class="primary" type="submit">บันทึกข้อมูลบริษัท</button></div></form></article>`;
    settings.querySelector('#company-profile-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {
        await request(`/rest/v1/organizations?id=eq.${orgId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name: data.name, tax_id: data.taxId || null, address: data.address || null, vat_rate: Number(data.vatRate) || 0 }) });
        await syncCompanyProfile();
        alert('บันทึกข้อมูลบริษัทแล้ว');
      } catch (error) { alert(error.message); }
    });
  };
  const syncQuotations = async () => {
    const rows = await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.quotation&select=document_number,customer_name_snapshot,issue_date,valid_until,grand_total,status&order=created_at.desc`);
    const status = { draft: 'ร่าง', sent: 'รออนุมัติ', approved: 'อนุมัติแล้ว', cancelled: 'ยกเลิก' };
    const thaiDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    state.quotations = rows.map((quote) => ({ no: quote.document_number, customer: quote.customer_name_snapshot, date: thaiDate(quote.issue_date), expires: thaiDate(quote.valid_until), total: `฿ ${Number(quote.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, status: status[quote.status] || quote.status }));
  };
  const syncBillingNotes = async () => {
    const documents = await request(`/rest/v1/documents?organization_id=eq.${orgId}&select=id,document_number,customer_name_snapshot,grand_total,status,kind&order=created_at.desc`);
    const rows = documents.filter((document) => document.kind === 'billing_note');
    const taxInvoices = documents.filter((document) => document.kind === 'tax_invoice');
    const statusLabel = (status) => ({ draft: 'ร่าง', paid: 'ชำระแล้ว' }[status] || status);
    document.querySelector('#invoices').innerHTML = `<div class="page-toolbar"><h2>ใบวางบิล</h2></div><article class="panel table-panel"><table><thead><tr><th>เลขที่เอกสาร</th><th>ลูกค้า</th><th>ยอดรวม</th><th>สถานะ</th><th></th></tr></thead><tbody>${rows.map((bill) => `<tr><td><strong>${bill.document_number}</strong></td><td>${bill.customer_name_snapshot}</td><td>฿ ${Number(bill.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td><td>${statusLabel(bill.status)}</td><td>${bill.status === 'paid' ? 'ออกใบกำกับแล้ว' : `<button class="ghost" data-tax-invoice="${bill.id}">ออกใบกำกับภาษี</button>`}</td></tr>`).join('')}</tbody></table></article><article class="panel table-panel" style="margin-top:16px"><div class="panel-title"><div><h3>ใบกำกับภาษี / ใบเสร็จ</h3><p>เอกสารที่ออกหลังได้รับชำระเงิน</p></div></div><table><thead><tr><th>เลขที่เอกสาร</th><th>ลูกค้า</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead><tbody>${taxInvoices.length ? taxInvoices.map((invoice) => `<tr><td><strong>${invoice.document_number}</strong></td><td>${invoice.customer_name_snapshot}</td><td>฿ ${Number(invoice.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td><td>${statusLabel(invoice.status)}</td></tr>`).join('') : '<tr><td colspan="4">ยังไม่มีใบกำกับภาษี</td></tr>'}</tbody></table></article>`;
  };
  const renderDocumentActions = () => document.querySelectorAll('#quotation-body tr').forEach((row, index) => {
    const quote = state.quotations[index]; if (!quote) return;
    const cell = row.lastElementChild;
    if (quote.status === 'ร่าง') cell.innerHTML = `<button class="ghost" data-approve="${quote.no}">อนุมัติ</button>`;
    if (quote.status === 'อนุมัติแล้ว') cell.innerHTML = `<button class="ghost" data-billing="${quote.no}">สร้างใบวางบิล</button>`;
  });
  const syncAll = async () => { await loadOrganization(); await Promise.all([syncCustomers(), syncProducts(), syncQuotations(), syncBillingNotes(), syncCompanyProfile()]); render(); renderDocumentActions(); };
  const login = () => { document.querySelector('#modal-content').innerHTML = '<div class="form-content"><h2>เข้าสู่ระบบ CRM</h2><label class="field"><span>อีเมล</span><input name="email" type="email" required></label><label class="field"><span>รหัสผ่าน</span><input name="password" type="password" required></label><p id="loginError" style="color:#c43d50"></p><div class="form-actions"><button value="cancel" class="ghost">ยกเลิก</button><button class="primary" value="login">เข้าสู่ระบบ</button></div></div>'; modal.dataset.type = 'login'; modal.showModal(); };
  // Always allow a fresh sign-in. This also recovers cleanly when a browser
  // restores an expired Supabase session after the page has been reopened.
  button.onclick = login;
  const baseOpenForm = window.openForm;
  window.openForm = async (type) => {
    if (type !== 'quotation') return baseOpenForm(type);
    // A browser can restore its local preview before the database requests
    // finish. Refresh first so option values always carry real database IDs.
    if (session) await syncAll();
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
    await syncAll();
  };
  const approveQuotation = async (number) => {
    await request(`/rest/v1/documents?organization_id=eq.${orgId}&document_number=eq.${number}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'approved' }) });
    await syncAll();
  };
  const createBillingNote = async (number) => {
    const source = (await request(`/rest/v1/documents?organization_id=eq.${orgId}&document_number=eq.${number}&select=*&limit=1`))[0];
    if (!source) throw new Error('ไม่พบใบเสนอราคา');
    const billNumber = `BL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
    const bills = await request('/rest/v1/documents', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, kind: 'billing_note', document_number: billNumber, status: 'draft', customer_id: source.customer_id, customer_name_snapshot: source.customer_name_snapshot, customer_tax_id_snapshot: source.customer_tax_id_snapshot, customer_address_snapshot: source.customer_address_snapshot, issue_date: new Date().toISOString().slice(0, 10), due_date: source.due_date, subtotal: source.subtotal, discount_amount: source.discount_amount, taxable_amount: source.taxable_amount, vat_rate: source.vat_rate, vat_amount: source.vat_amount, grand_total: source.grand_total, source_document_id: source.id, created_by: session.user.id }) });
    const items = await request(`/rest/v1/document_items?document_id=eq.${source.id}&select=position,product_variant_id,sku_snapshot,product_name_snapshot,specification_snapshot,unit_snapshot,quantity,unit_price,discount_amount,line_total`);
    if (items.length) await request('/rest/v1/document_items', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(items.map((item) => ({ ...item, document_id: bills[0].id }))) });
    await syncAll();
  };
  const createTaxInvoice = async (billingId) => {
    const source = (await request(`/rest/v1/documents?id=eq.${billingId}&organization_id=eq.${orgId}&select=*&limit=1`))[0];
    if (!source) throw new Error('ไม่พบใบวางบิล');
    const existing = await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.tax_invoice&source_document_id=eq.${billingId}&select=id&limit=1`);
    if (existing.length) throw new Error('ใบวางบิลนี้ออกใบกำกับภาษีแล้ว');
    const number = `TI-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
    const invoices = await request('/rest/v1/documents', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, kind: 'tax_invoice', document_number: number, status: 'paid', customer_id: source.customer_id, customer_name_snapshot: source.customer_name_snapshot, customer_tax_id_snapshot: source.customer_tax_id_snapshot, customer_address_snapshot: source.customer_address_snapshot, issue_date: new Date().toISOString().slice(0, 10), subtotal: source.subtotal, discount_amount: source.discount_amount, taxable_amount: source.taxable_amount, vat_rate: source.vat_rate, vat_amount: source.vat_amount, grand_total: source.grand_total, source_document_id: source.id, created_by: session.user.id }) });
    const items = await request(`/rest/v1/document_items?document_id=eq.${source.id}&select=position,product_variant_id,sku_snapshot,product_name_snapshot,specification_snapshot,unit_snapshot,quantity,unit_price,discount_amount,line_total`);
    if (items.length) await request('/rest/v1/document_items', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(items.map((item) => ({ ...item, document_id: invoices[0].id }))) });
    await request(`/rest/v1/documents?id=eq.${billingId}&organization_id=eq.${orgId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'paid' }) });
    await syncAll();
    alert(`ออกใบกำกับภาษี ${number} เรียบร้อย`);
  };
  document.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-approve],[data-billing],[data-tax-invoice]'); if (!action || !session || !orgId) return;
    try { if (action.dataset.approve) await approveQuotation(action.dataset.approve); if (action.dataset.billing) await createBillingNote(action.dataset.billing); if (action.dataset.taxInvoice) await createTaxInvoice(action.dataset.taxInvoice); }
    catch (error) { alert(error.message); }
  });
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
  const escapePrint = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const previewDocument = async (number) => {
    const doc = (await request(`/rest/v1/documents?organization_id=eq.${orgId}&document_number=eq.${encodeURIComponent(number)}&select=*&limit=1`))[0];
    if (!doc) throw new Error('ไม่พบเอกสาร กรุณาเข้าสู่ระบบแล้วลองใหม่');
    const [companies, items] = await Promise.all([
      request(`/rest/v1/organizations?id=eq.${orgId}&select=name,tax_id,address&limit=1`),
      request(`/rest/v1/document_items?document_id=eq.${doc.id}&select=*&order=position.asc`)
    ]);
    const company = companies[0] || {};
    const e = escapePrint;
    const money = (value) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH') : '-';
    const title = { quotation: 'ใบเสนอราคา', billing_note: 'ใบวางบิล', tax_invoice: 'ใบกำกับภาษี / ใบเสร็จรับเงิน' }[doc.kind] || 'เอกสาร';
    document.querySelector('#document-preview')?.remove();
    const preview = document.createElement('section');
    preview.id = 'document-preview';
    preview.setAttribute('role', 'dialog');
    preview.setAttribute('aria-label', 'ตัวอย่างเอกสาร');
    preview.innerHTML = `<style>
      #document-preview{position:fixed;inset:0;z-index:10000;overflow:auto;background:#e5e9ef;color:#172033;font:14px Tahoma,Arial,sans-serif}
      #document-preview .print-tools{position:sticky;top:0;background:#fff;padding:12px 20px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #ddd}
      #document-preview button{padding:10px 16px;border:1px solid #ccd3df;border-radius:6px;cursor:pointer}
      #document-preview .paper{box-sizing:border-box;background:white;width:210mm;max-width:100%;min-height:270mm;margin:24px auto;padding:16mm}
      #document-preview h1{font-size:23px;margin:0 0 12px}#document-preview h2{font-size:20px;margin:0 0 10px}
      #document-preview .print-head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #24344e;padding-bottom:20px;margin-bottom:20px}
      #document-preview .address{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}
      #document-preview table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13px;table-layout:fixed}
      #document-preview th,#document-preview td{padding:10px 6px;border-bottom:1px solid #ddd;white-space:normal;overflow-wrap:anywhere;text-align:left}
      #document-preview th{background:#f0f3f8}#document-preview .number{text-align:right}
      #document-preview .totals{margin:24px 0 0 auto;width:280px;max-width:100%}#document-preview .totals p{display:flex;justify-content:space-between;gap:10px;padding:6px 0;margin:0}
      #document-preview .signatures{display:flex;justify-content:space-between;gap:40px;margin-top:65px;text-align:center}#document-preview .signatures p{border-top:1px solid #999;padding-top:10px;flex:1}
      @page{size:A4;margin:12mm}
      @media print{body>*:not(#document-preview){display:none!important}#document-preview{position:static;background:white;overflow:visible}#document-preview .print-tools{display:none}#document-preview .paper{width:auto;max-width:none;min-height:0;margin:0;padding:0}#document-preview tr,#document-preview .totals,#document-preview .signatures{break-inside:avoid}#document-preview thead{display:table-header-group}}
    </style><div class="print-tools"><button type="button" data-print-now>พิมพ์ / บันทึก PDF</button><button type="button" data-print-close>กลับไปยังรายการ</button><span>เลือก Save as PDF หรือ บันทึกเป็น PDF ในหน้าพิมพ์</span></div>
    <article class="paper"><header class="print-head"><div><h2>${e(company.name)}</h2><div class="address">${e(company.address || '-')}</div><p>เลขประจำตัวผู้เสียภาษี ${e(company.tax_id || '-')}</p></div><div><h1>${e(title)}</h1><p>เลขที่ ${e(doc.document_number)}</p><p>วันที่ ${e(date(doc.issue_date))}</p><p>${doc.status === 'draft' ? 'สถานะ: ร่าง' : doc.status === 'paid' ? 'สถานะ: ชำระแล้ว' : ''}</p></div></header>
    <div class="address"><strong>ลูกค้า: ${e(doc.customer_name_snapshot)}</strong><br>${e(doc.customer_address_snapshot || '-')}<br>เลขประจำตัวผู้เสียภาษี ${e(doc.customer_tax_id_snapshot || '-')}</div>
    ${doc.valid_until ? `<p>ยืนราคาถึง ${e(date(doc.valid_until))}</p>` : ''}${doc.due_date ? `<p>กำหนดชำระ ${e(date(doc.due_date))}</p>` : ''}
    <table><thead><tr><th style="width:7%">ลำดับ</th><th style="width:39%">สินค้า / ขนาด</th><th style="width:14%">จำนวน</th><th class="number" style="width:20%">ราคาต่อหน่วย</th><th class="number" style="width:20%">รวม</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${e(item.product_name_snapshot)}<br>${e(item.specification_snapshot)}<br>${e(item.sku_snapshot)}</td><td>${e(item.quantity)} ${e(item.unit_snapshot)}</td><td class="number">${money(item.unit_price)}</td><td class="number">${money(item.line_total)}</td></tr>`).join('')}</tbody></table>
    <div class="totals"><p><span>รวมก่อนส่วนลด</span><span>${money(doc.subtotal)}</span></p><p><span>ส่วนลด</span><span>${money(doc.discount_amount)}</span></p><p><span>มูลค่าก่อน VAT</span><span>${money(doc.taxable_amount)}</span></p><p><span>VAT ${e(doc.vat_rate)}%</span><span>${money(doc.vat_amount)}</span></p><p><strong>ยอดสุทธิ (บาท)</strong><strong>${money(doc.grand_total)}</strong></p></div>
    <div class="signatures"><p>ผู้จัดทำ / ผู้รับเงิน<br><br>วันที่ __________________</p><p>ลูกค้า / ผู้รับเอกสาร<br><br>วันที่ __________________</p></div></article>`;
    document.body.append(preview);
    const previousTitle = document.title;
    preview.querySelector('[data-print-close]').onclick = () => { preview.remove(); document.title = previousTitle; };
    preview.querySelector('[data-print-now]').onclick = () => { document.title = doc.document_number; window.print(); };
    preview.querySelector('[data-print-now]').focus();
  };
  const addPrintButtons = () => {
    document.querySelectorAll('#quotation-body tr, #invoices tbody tr').forEach((row) => {
      const number = row.cells[0]?.textContent.trim();
      if (!/^(QT|BL|TI)-/.test(number || '') || row.querySelector('[data-print-document]')) return;
      const printButton = document.createElement('button');
      printButton.type = 'button'; printButton.className = 'ghost';
      printButton.dataset.printDocument = number; printButton.textContent = 'พิมพ์ / PDF';
      row.lastElementChild.append(printButton);
    });
  };
  new MutationObserver(addPrintButtons).observe(document.querySelector('main'), { childList: true, subtree: true });
  document.addEventListener('click', async (event) => {
    const printButton = event.target.closest('[data-print-document]');
    if (!printButton) return;
    if (!session || !orgId) return login();
    printButton.disabled = true;
    try { await previewDocument(printButton.dataset.printDocument); }
    catch (error) { alert(error.message); }
    finally { printButton.disabled = false; }
  });
  if (session) syncAll().catch(() => { session = null; localStorage.removeItem('flowbill-session'); label(); });
  if (location.hash === '#settings') setTimeout(() => window.go?.('settings'), 0);
})();
