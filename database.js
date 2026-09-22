(() => {
  pageMeta['tax-invoices'] = ['งานขาย', 'ใบกำกับภาษี'];
  const taxPage = document.createElement('section');
  taxPage.id = 'tax-invoices'; taxPage.className = 'page';
  taxPage.innerHTML = '<article class="panel settings-card"><h3>ใบกำกับภาษี</h3><p>เข้าสู่ระบบเพื่อดูรายการใบกำกับภาษี</p></article>';
  document.querySelector('#invoices').after(taxPage);
  for (const [id, title, description] of [
    ['delivery-notes', 'ใบส่งสินค้า', 'เอกสารสำหรับแสดงรายการสินค้าและการรับมอบสินค้า'],
    ['cash-bills', 'บิลเงินสด', 'เอกสารสำหรับรายการขายที่รับชำระเงินทันที']
  ]) {
    pageMeta[id] = ['งานขาย', title];
    const page = document.createElement('section');
    page.id = id; page.className = 'page';
    page.innerHTML = `<article class="panel table-panel"><div class="panel-title"><div><h3>${title}</h3><p>${description}</p></div></div><div class="empty-state"><h2>ยังไม่มี${title}</h2><p>เตรียมหน้าเมนูแล้ว ระบบสร้างและบันทึกเอกสารประเภทนี้ยังไม่เปิดใช้งาน</p></div></article>`;
    document.querySelector('#settings').before(page);
  }
  document.querySelector('#delivery-notes').innerHTML = '<article class="panel settings-card"><h3>ใบส่งสินค้า</h3><p>กรุณาเข้าสู่ระบบเพื่อสร้างใบส่งสินค้า ระบุสถานที่จัดส่ง และพิมพ์เอกสาร</p></article>';
  const config = window.SUPABASE_CONFIG;
  let session = JSON.parse(localStorage.getItem('flowbill-session') || 'null');
  let orgId = localStorage.getItem('flowbill-org-id');
  let quotationTaxInvoices = new Map();
  let quotationDeliveryNotes = new Map();
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
    state.customers = rows.map((customer) => ({ id: customer.id, name: customer.name, address: customer.billing_address || customer.address || '', contact: customer.contact_name || '-', taxId: customer.tax_id || '-', phone: customer.phone || '-', terms: customer.credit_term_days ? `เครดิต ${customer.credit_term_days} วัน` : 'เงินสด', sales: '฿ 0' }));
  };
  const syncProducts = async () => {
    const rows = await request(`/rest/v1/products?organization_id=eq.${orgId}&select=code,name,unit,is_active,product_variants(id,sku,label,is_active,variant_prices(price,starts_on))&order=created_at.desc`);
    state.products = rows.flatMap((product) => (product.product_variants || []).filter((variant) => variant.is_active).map((variant) => {
      const price = (variant.variant_prices || []).sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)))[0]?.price ?? 0;
      return { id: variant.id, sku: variant.sku || product.code, name: product.name, unit: product.unit || 'ชิ้น', size: variant.label, price: Number(price).toFixed(2), status: product.is_active ? 'ใช้งาน' : 'ปิดใช้งาน' };
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
        const saved = await request(`/rest/v1/organizations?id=eq.${orgId}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name: data.name.trim(), tax_id: data.taxId.trim() || null, address: data.address.trim() || null, vat_rate: Number(data.vatRate) || 0 }) });
        if (!Array.isArray(saved) || saved.length !== 1) throw new Error('ยังไม่ได้บันทึก: บัญชีนี้ไม่มีสิทธิ์แก้ข้อมูลบริษัท กรุณาใช้บัญชีผู้ดูแล');
        await syncCompanyProfile();
        alert('บันทึกข้อมูลบริษัทแล้ว');
      } catch (error) { alert(error.message); }
    });
  };
  const syncQuotations = async () => {
    const rows = await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.quotation&select=id,document_number,customer_name_snapshot,issue_date,valid_until,grand_total,status&order=created_at.desc`);
    const status = { draft: 'รออนุมัติ', sent: 'รออนุมัติ', approved: 'อนุมัติแล้ว', cancelled: 'ยกเลิก' };
    const thaiDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    state.quotations = rows.map((quote) => ({ id: quote.id, no: quote.document_number, customer: quote.customer_name_snapshot, date: thaiDate(quote.issue_date), expires: thaiDate(quote.valid_until), total: `฿ ${Number(quote.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, statusCode: quote.status, status: status[quote.status] || quote.status }));
  };
  const syncBillingNotes = async () => {
    const documents = await request(`/rest/v1/documents?organization_id=eq.${orgId}&select=id,document_number,customer_name_snapshot,grand_total,status,payment_received,kind,source_document_id&order=created_at.desc`);
    quotationTaxInvoices = window.QuotationTax.linkedInvoices(documents);
    const rows = documents.filter((document) => document.kind === 'billing_note');
    const taxInvoices = documents.filter((document) => document.kind === 'tax_invoice');
    document.querySelector('#invoices').innerHTML = `<div class="page-toolbar"><h2>ใบวางบิล</h2></div><p>ติ๊กเมื่อชำระเงินแล้ว • ไม่ได้ติ๊ก = ค้างจ่าย • บันทึกแยกแต่ละเอกสาร</p><article class="panel table-panel"><table><thead><tr><th>เลขที่เอกสาร</th><th>ลูกค้า</th><th>ยอดรวม</th><th>สถานะชำระเงิน</th><th></th></tr></thead><tbody>${rows.map((bill) => `<tr><td><strong>${bill.document_number}</strong></td><td>${bill.customer_name_snapshot}</td><td>฿ ${Number(bill.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td><td>${window.DocumentPayment.render(bill)}</td><td>${bill.status === 'paid' ? 'ออกใบกำกับแล้ว' : `<button class="ghost" data-tax-invoice="${bill.id}">ออกใบกำกับภาษี</button>`}</td></tr>`).join('')}</tbody></table></article><article class="panel table-panel" style="margin-top:16px"><div class="panel-title"><div><h3>ใบกำกับภาษี / ใบเสร็จ</h3><p>เอกสารที่ออกหลังได้รับชำระเงิน</p></div></div><table><thead><tr><th>เลขที่เอกสาร</th><th>ลูกค้า</th><th>ยอดรวม</th><th>สถานะชำระเงิน</th></tr></thead><tbody>${taxInvoices.length ? taxInvoices.map((invoice) => `<tr><td><strong>${invoice.document_number}</strong></td><td>${invoice.customer_name_snapshot}</td><td>฿ ${Number(invoice.grand_total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td><td>${window.DocumentPayment.render(invoice)}</td></tr>`).join('') : '<tr><td colspan="4">ยังไม่มีใบกำกับภาษี</td></tr>'}</tbody></table></article>`;
  };
  const separateTaxInvoices = () => {
    const taxPanel = document.querySelector('#invoices > article:last-child');
    if (!taxPanel || !taxPanel.querySelector('h3')) return;
    taxPage.replaceChildren(taxPanel);
    taxPanel.style.marginTop = '0';
    taxPanel.querySelector('h3').textContent = 'ใบกำกับภาษี';
    taxPanel.querySelector('.panel-title p').textContent = 'ติ๊กเมื่อชำระเงินแล้ว • ไม่ได้ติ๊ก = ค้างจ่าย • บันทึกแยกแต่ละเอกสาร';
    const actionHeading = document.createElement('th'); actionHeading.textContent = 'เอกสาร';
    taxPanel.querySelector('thead tr').append(actionHeading);
    taxPanel.querySelectorAll('tbody tr').forEach((row) => {
      if (row.cells.length === 1) row.cells[0].colSpan = 5;
      else {
        const cell = document.createElement('td');
        const printButton = row.querySelector('[data-print-document]');
        if (printButton) cell.append(printButton);
        row.append(cell);
      }
    });
    const billingLink = document.createElement('button'); billingLink.className = 'ghost';
    billingLink.textContent = 'ไปใบเสนอราคาที่อนุมัติแล้ว'; billingLink.onclick = () => go('quotations');
    taxPanel.querySelector('.panel-title').append(billingLink);
  };
  const renderDocumentActions = () => document.querySelectorAll('#quotation-body tr').forEach((row) => {
    const quote = state.quotations.find(q=>q.no===row.cells[0]?.textContent.trim()); if (!quote) return;
    const cell = row.lastElementChild;
    if (['ร่าง','รออนุมัติ'].includes(quote.status)) cell.innerHTML = `<button class="ghost" data-approve="${quote.no}">อนุมัติ</button>`;
    // Billing creation is intentionally not offered in the quotation list.
  });
  const syncAll = async () => {
    await loadOrganization();
    await Promise.all([syncCustomers(), syncProducts(), syncQuotations(), syncBillingNotes(), syncCompanyProfile(),
      window.QuotationDelivery.loadLinked(request, orgId).then(links => { quotationDeliveryNotes = links; })]);
    state.quotations.forEach(quote => {
      quote.taxInvoiceNumber = quotationTaxInvoices.get(quote.id)?.document_number || null;
      if (quote.statusCode === 'approved') quote.status = quote.taxInvoiceNumber ? 'ออกใบกำกับภาษีแล้ว' : 'รอออกใบกำกับภาษี';
    });
    separateTaxInvoices(); render(); renderDocumentActions();
    await Promise.all([window.DeliveryNotes.load(request, orgId), window.TaxRegisters.load(request, orgId)]);
  };
  const login = () => { document.querySelector('#modal-content').innerHTML = '<div class="form-content"><h2>เข้าสู่ระบบ CRM</h2><label class="field"><span>อีเมล</span><input name="email" type="email" required></label><label class="field"><span>รหัสผ่าน</span><input name="password" type="password" required></label><p id="loginError" style="color:#c43d50"></p><div class="form-actions"><button value="cancel" class="ghost">ยกเลิก</button><button class="primary" value="login">เข้าสู่ระบบ</button></div></div>'; modal.dataset.type = 'login'; modal.showModal(); };
  // Always allow a fresh sign-in. This also recovers cleanly when a browser
  // restores an expired Supabase session after the page has been reopened.
  button.onclick = login;
  const baseOpenForm = window.openForm;
  let quotationEditor, pendingQuotation, savingQuotation = false;
  modal.addEventListener('cancel', event => { if (savingQuotation) event.preventDefault(); });
  window.openForm = async (type) => {
    if (type !== 'quotation') return baseOpenForm(type);
    // A browser can restore its local preview before the database requests
    // finish. Refresh first so option values always carry real database IDs.
    if (session) await syncAll();
    if (!session || !orgId) return login();
    pendingQuotation = null;
    quotationEditor = window.QuotationEditor.mount(document.querySelector('#modal-content'), state.customers, state.products);
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
    if (!customer) throw new Error('กรุณาเลือกลูกค้า');
    const rows = quotationEditor.read();
    const {items,...totals} = window.QuotationEditor.calculate(rows,state.products);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.expires||'')) throw new Error('กรุณาระบุวันยืนราคา');
    const inputKey = JSON.stringify({data,rows});
    if (pendingQuotation && pendingQuotation.inputKey !== inputKey) throw new Error('การบันทึกก่อนหน้ายังไม่สมบูรณ์ กรุณากลับเป็นข้อมูลเดิมแล้วกดบันทึกซ้ำเพื่อไม่ให้เกิดเอกสารซ้ำ');
    const today = window.QuotationEditor.issueDate();
    if (!pendingQuotation) {
      const id=crypto.randomUUID();
      // Compatibility placeholder only: the database assigns the annual number on insert.
      // Keeping the UUID stable lets retries reuse the original document and number.
      const number = `QT-${today.replaceAll('-', '')}-${id.slice(0,8).toUpperCase()}`;
      pendingQuotation={inputKey,id,document:{id,organization_id:orgId,kind:'quotation',document_number:number,status:'draft',customer_id:customer.id,customer_name_snapshot:customer.name,customer_tax_id_snapshot:customer.taxId==='-'?null:customer.taxId,customer_address_snapshot:customer.address||null,issue_date:today,valid_until:data.expires,...totals,notes:window.QuotationEditor.encode({paymentTerms:data.paymentTerms.trim(),deliveryTerms:data.deliveryTerms.trim(),notes:data.notes,rates:rows.map(r=>Number(r.discountRate))}),created_by:session.user.id},items};
    }
    // Both requests can be retried after a lost response without creating duplicate rows.
    await window.QuotationEditor.persist(request,pendingQuotation);
    pendingQuotation=null;
    modal.close();
    try { await syncAll(); } catch { alert('บันทึกใบเสนอราคาแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ'); }
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
  const deletingQuotations = new Set();
  const issuingQuotationTax = new Set();
  document.addEventListener('click', async event => {
    const action = event.target.closest('[data-quotation-tax]');
    if (!action) return;
    if (!session || !orgId) return login();
    const id = action.dataset.quotationTax;
    const quote = state.quotations.find(q => q.id === id);
    if (!window.QuotationTax.canIssue(quote) || issuingQuotationTax.has(id)) return;
    if (!confirm(`ออกใบกำกับภาษีจาก ${quote.no} โดยคัดลอกลูกค้า รายการสินค้า และยอดเงินทั้งหมด? การออกเอกสารนี้ไม่ใช่การบันทึกรับชำระเงิน`)) return;
    issuingQuotationTax.add(id);
    action.disabled = true; action.textContent = 'กำลังออกใบกำกับภาษี…';
    try {
      const result = await window.QuotationTax.issue(request, orgId, quote);
      quotationTaxInvoices.set(id, result);
      try { await syncAll(); }
      catch { alert(`ใบกำกับภาษี ${result.document_number} บันทึกแล้ว แต่โหลดรายการไม่สำเร็จ กรุณารีเฟรช ไม่ต้องออกใหม่`); return; }
      go('tax-invoices');
      alert(`${result.created ? 'ออกใบกำกับภาษีแล้ว' : 'เปิดใบกำกับภาษีเดิม ไม่ได้ออกซ้ำ'}: ${result.document_number}`);
    } catch (error) { alert(error.message); }
    finally {
      issuingQuotationTax.delete(id);
      action.disabled = false; action.textContent = 'ออกใบกำกับภาษี';
      addPrintButtons();
    }
  });
  document.addEventListener('click', async event => {
    const action=event.target.closest('[data-delete-quotation]');
    if (!action) return;
    if (!session || !orgId) return login();
    const id=action.dataset.deleteQuotation;
    if (deletingQuotations.has(id)) return;
    const quote=state.quotations.find(q=>q.id===id);
    if (!quote) return;
    deletingQuotations.add(id);
    const controls=[...action.closest('tr').querySelectorAll('button')];
    controls.forEach(control=>control.disabled=true);action.textContent='กำลังลบ…';
    try {
      await window.QuotationActions.remove(request,orgId,id);
      state.quotations=state.quotations.filter(q=>q.id!==id);
      save();render();renderDocumentActions();
      let notice=document.querySelector('#quotation-action-notice');
      if (!notice) {notice=document.createElement('p');notice.id='quotation-action-notice';notice.setAttribute('role','status');document.querySelector('#quotations').prepend(notice);}
      notice.textContent=`ลบใบเสนอราคา ${quote.no} แล้ว (ลบถาวร ไม่มีปุ่มกู้คืนในระบบ)`;
    } catch(error) {alert(error.message);}
    finally {deletingQuotations.delete(id);controls.forEach(control=>control.disabled=false);action.textContent='ลบ';}
  });
  document.querySelector('#modal-form').addEventListener('submit', async (event) => {
    if (event.submitter?.value === 'cancel' || !['login', 'customer', 'product', 'quotation'].includes(modal.dataset.type)) return;
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
      else if (modal.dataset.type === 'quotation' && session && orgId) {
        if (savingQuotation) return;
        savingQuotation=true;
        const controls=[...event.currentTarget.querySelectorAll('input,textarea,select,button')];
        controls.forEach(c=>c.disabled=true);
        try {await addQuotation(data);} finally {savingQuotation=false;controls.forEach(c=>c.disabled=false);}
      }
    } catch (error) { if (modal.dataset.type === 'login') document.querySelector('#loginError').textContent = error.message; else alert(error.message); }
  }, true);
  const escapePrint = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const previewDocument = async (number) => {
    const doc = (await request(`/rest/v1/documents?organization_id=eq.${orgId}&document_number=eq.${encodeURIComponent(number)}&select=*&limit=1`))[0];
    if (!doc) throw new Error('ไม่พบเอกสาร กรุณาเข้าสู่ระบบแล้วลองใหม่');
    const [companies, items] = await Promise.all([
      request(`/rest/v1/organizations?id=eq.${orgId}&select=name,tax_id,address&limit=1`),
      doc.kind === 'billing_note'
        ? window.BillingDocuments.resolve(request,orgId,doc)
        : request(`/rest/v1/document_items?document_id=eq.${doc.id}&select=*&order=position.asc`)
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
      #document-preview .print-brand{display:flex;gap:12px;align-items:center;margin-bottom:12px}#document-preview .print-brand h2{margin:0}#document-preview .print-company-logo{width:68px;height:68px;object-fit:contain;flex:none;print-color-adjust:exact}#document-preview .print-head>div{min-width:0}#document-preview .print-head{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:24px;border-bottom:2px solid #24344e;padding-bottom:20px;margin-bottom:20px}
      #document-preview td.item-description{white-space:pre-wrap;overflow-wrap:anywhere}
      #document-preview .address{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}
      #document-preview table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13px;table-layout:fixed}
      #document-preview th,#document-preview td{padding:10px 6px;border-bottom:1px solid #ddd;white-space:normal;overflow-wrap:anywhere;text-align:left}
      #document-preview th{background:#f0f3f8}#document-preview .number{text-align:right}
      #document-preview .totals{margin:24px 0 0 auto;width:280px;max-width:100%}#document-preview .totals p{display:flex;justify-content:space-between;gap:10px;padding:6px 0;margin:0}
      #document-preview .signatures{display:flex;justify-content:space-between;gap:40px;margin-top:65px;text-align:center}#document-preview .signatures p{border-top:1px solid #999;padding-top:10px;flex:1}
      @page{size:A4;margin:12mm}
      @media print{body>*:not(#document-preview){display:none!important}#document-preview{position:static;background:white;overflow:visible}#document-preview .print-tools{display:none}#document-preview .paper{width:auto;max-width:none;min-height:0;margin:0;padding:0}#document-preview tr,#document-preview .totals,#document-preview .signatures{break-inside:avoid}#document-preview thead{display:table-header-group}}
    </style><div class="print-tools"><button type="button" data-print-now>พิมพ์ / บันทึก PDF</button><button type="button" data-print-close>กลับไปยังรายการ</button><span>เลือก Save as PDF หรือ บันทึกเป็น PDF ในหน้าพิมพ์</span></div>
    <article class="paper"><header class="print-head"><div><div class="print-brand"><img class="print-company-logo" src="company-logo.png" alt="โลโก้บริษัท"><h2>${e(company.name)}</h2></div><div class="address">${e(window.DocumentAddress.format(company.address) || '-')}</div><p>เลขประจำตัวผู้เสียภาษี ${e(company.tax_id || '-')}</p></div><div><h1>${e(title)}</h1><p>เลขที่ ${e(doc.document_number)}</p><p>วันที่ ${e(date(doc.issue_date))}</p><p>${doc.status === 'draft' ? 'สถานะ: ร่าง' : doc.status === 'paid' ? 'สถานะ: ชำระแล้ว' : ''}</p></div></header>
    <div class="address"><strong>ลูกค้า: ${e(doc.customer_name_snapshot)}</strong><br>${e(window.DocumentAddress.format(doc.customer_address_snapshot) || '-')}<br>เลขประจำตัวผู้เสียภาษี ${e(doc.customer_tax_id_snapshot || '-')}</div>
    ${doc.valid_until ? `<p>ยืนราคาถึง ${e(date(doc.valid_until))}</p>` : ''}${doc.due_date ? `<p>กำหนดชำระ ${e(date(doc.due_date))}</p>` : ''}
    <table><thead><tr><th style="width:7%">ลำดับ</th><th style="width:39%">สินค้า / ขนาด</th><th style="width:14%">จำนวน</th><th class="number" style="width:20%">ราคาต่อหน่วย</th><th class="number" style="width:20%">รวม</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td class="item-description">${e([item.product_name_snapshot,item.specification_snapshot,item.sku_snapshot].filter(value => value != null && String(value).trim()).join(' '))}</td><td>${e(item.quantity)} ${e(item.unit_snapshot)}</td><td class="number">${money(item.unit_price)}</td><td class="number">${money(item.line_total)}</td></tr>`).join('')}</tbody></table>
    <div class="totals"><p><span>รวมก่อนส่วนลด</span><span>${money(doc.subtotal)}</span></p><p><span>ส่วนลด</span><span>${money(doc.discount_amount)}</span></p><p><span>มูลค่าก่อน VAT</span><span>${money(doc.taxable_amount)}</span></p><p><span>VAT ${e(doc.vat_rate)}%</span><span>${money(doc.vat_amount)}</span></p><p><strong>ยอดสุทธิ (บาท)</strong><strong>${money(doc.grand_total)}</strong></p></div>
    <div class="signatures"><p>ผู้จัดทำ / ผู้รับเงิน<br><br>วันที่ __________________</p><p>ลูกค้า / ผู้รับเอกสาร<br><br>วันที่ __________________</p></div></article>`;
    const documentLayout = doc.kind === 'quotation' ? window.QuotationLayout : doc.kind === 'billing_note' ? window.BillingLayout : null;
    if (documentLayout) {
      const layout = await documentLayout.prepare(company, doc, items);
      preview.querySelector('.paper').remove();
      preview.insertAdjacentHTML('beforeend', documentLayout.styles + documentLayout.toSVG(layout));
    }
    if(!documentLayout){try{await preview.querySelector('.print-company-logo').decode();}catch{throw new Error('โหลดโลโก้บริษัทไม่ได้ กรุณาเปิดเอกสารใหม่');}}
    document.body.append(preview);
    if (doc.kind === 'tax_invoice' && window.ContinuousForm) {
      const formButton = document.createElement('button'); formButton.type = 'button';
      formButton.textContent = 'พิมพ์ลงฟอร์มต่อเนื่อง (Letter)';
      formButton.onclick = async () => { try { await window.ContinuousForm.open(company, doc, items, orgId); } catch (error) { alert(error.message); } };
      preview.querySelector('.print-tools').append(formButton);
    }
    const downloadLink = document.createElement('a');
    downloadLink.textContent = 'กำลังเตรียม PDF…';
    downloadLink.style.cssText = 'display:inline-block;padding:10px 16px;background:#24344e;color:white;border-radius:6px;text-decoration:none';
    preview.querySelector('.print-tools').prepend(downloadLink);
    const downloadStatus = preview.querySelector('.print-tools span');
    downloadStatus.setAttribute('role', 'status');
    downloadStatus.textContent = 'กำลังเตรียมไฟล์สำหรับดาวน์โหลด';
    try {
      const pdf = await window.buildSalesPDF(company, doc, items);
      if (!preview.isConnected) return;
      downloadLink.href = pdf.dataUrl;
      downloadLink.download = pdf.filename;
      downloadLink.textContent = 'ดาวน์โหลด PDF';
      downloadStatus.textContent = 'ไฟล์พร้อมแล้ว กดดาวน์โหลด PDF เพื่อบันทึก';
      downloadLink.onclick = () => { downloadStatus.textContent = 'ส่งคำขอดาวน์โหลดแล้ว หากไม่มีไฟล์ ให้เลือกเปิดไฟล์ PDF'; };
      const openLink = document.createElement('a');
      const pdfUrl = URL.createObjectURL(pdf.blob);
      openLink.href = pdfUrl; openLink.target = '_blank'; openLink.rel = 'noopener'; openLink.textContent = 'เปิดไฟล์ PDF';
      openLink.style.cssText = downloadLink.style.cssText;
      downloadLink.after(openLink);
      preview.addEventListener('pdf-close', () => setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000), { once: true });
    } catch (error) { downloadLink.textContent = 'เตรียม PDF ไม่สำเร็จ'; downloadStatus.textContent = error.message; }
    const previousTitle = document.title;
    preview.querySelector('[data-print-close]').onclick = () => { preview.dispatchEvent(new Event('pdf-close')); preview.remove(); document.title = previousTitle; };
    preview.querySelector('[data-print-now]').onclick = () => { document.title = doc.document_number; window.print(); };
    preview.querySelector('[data-print-now]').focus();
  };
  window.DocumentPayment.bind(request, () => orgId, () => Boolean(session), login);
  const openingDelivery = new Set();
  const addPrintButtons = () => {
    document.querySelectorAll('#quotation-body tr').forEach(row=>{
      const quote=state.quotations.find(q=>q.no===row.cells[0]?.textContent.trim());
      const existing=row.querySelector('[data-quotation-delivery]');
      const linked=quotationDeliveryNotes.get(quote?.id);
      if(!linked && !window.QuotationDelivery.canIssue(quote)){existing?.remove();return;}
      const action=existing || document.createElement('button');action.type='button';action.className='ghost';
      action.dataset.quotationDelivery=quote.id;
      const text=linked ? 'ดูใบส่งสินค้า' : 'ออกใบส่งสินค้า';
      if(action.textContent!==text)action.textContent=text;
      action.disabled=openingDelivery.has(quote.id);
      if(!existing)row.lastElementChild.prepend(action);
    });
    document.querySelectorAll('#quotation-body tr').forEach(row => {
      const quote = state.quotations.find(q => q.no === row.cells[0]?.textContent.trim());
      const previous = row.querySelector('[data-quotation-tax-action]');
      if (!window.QuotationTax.canIssue(quote)) { previous?.remove(); return; }
      const linked = quotationTaxInvoices.get(quote.id);
      const mode = linked ? `view:${linked.document_number}` : 'issue';
      if (previous?.dataset.quotationTaxAction === mode) return;
      previous?.remove();
      const taxAction = document.createElement('button'); taxAction.type = 'button'; taxAction.className = 'ghost';
      taxAction.dataset.quotationTaxAction = mode;
      if (linked) { taxAction.dataset.printDocument = linked.document_number; taxAction.textContent = 'ดูใบกำกับภาษี'; }
      else { taxAction.dataset.quotationTax = quote.id; taxAction.textContent = 'ออกใบกำกับภาษี'; taxAction.disabled = issuingQuotationTax.has(quote.id); }
      row.lastElementChild.prepend(taxAction);
    });
    document.querySelectorAll('#quotation-body tr').forEach(row=>{
      const number=row.cells[0]?.textContent.trim();
      const quote=state.quotations.find(q=>q.no===number);
      if (!quote?.id || row.querySelector('[data-delete-quotation]')) return;
      const remove=document.createElement('button');remove.type='button';remove.className='ghost';
      remove.dataset.deleteQuotation=quote.id;remove.textContent='ลบ';remove.style.color='#b42332';
      remove.title=`ลบใบเสนอราคา ${quote.no} ถาวรทันที`;remove.setAttribute('aria-label',`ลบใบเสนอราคา ${quote.no}`);
      row.lastElementChild.append(remove);
    });
    document.querySelectorAll('#quotation-body tr, #invoices tbody tr, #tax-invoices tbody tr').forEach((row) => {
      const number = row.cells[0]?.textContent.trim();
      if (!/^(?:(?:QT|BL|TI)-|QT\d{2}-\d{4}$)/.test(number || '') || [...row.querySelectorAll('[data-print-document]')].some(button => button.dataset.printDocument === number)) return;
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
  document.addEventListener('click',async event=>{
    const action=event.target.closest('[data-quotation-delivery]');if(!action)return;
    if(!session||!orgId)return login();
    const id=action.dataset.quotationDelivery;if(openingDelivery.has(id))return;
    const quote=state.quotations.find(q=>q.id===id);openingDelivery.add(id);action.disabled=true;
    try{
      // Refresh the exact link so another tab's newly issued note opens directly too.
      const linked=(await window.QuotationDelivery.loadLinked(request,orgId,id)).get(id);
      if(linked){
        quotationDeliveryNotes.set(id,linked);addPrintButtons();
        window.go?.('delivery-notes');await window.DeliveryNotes.openSaved(request,orgId,linked.id);
        return;
      }
      quotationDeliveryNotes.delete(id);
      await window.QuotationDelivery.open(request,orgId,quote,async result=>{
        quotationDeliveryNotes.set(id,result);addPrintButtons();
        window.go?.('delivery-notes');await window.DeliveryNotes.openSaved(request,orgId,result.id);
      });
    }catch(error){alert(error.message);}finally{openingDelivery.delete(id);addPrintButtons();}
  });
  if (session) syncAll().catch(() => { session = null; localStorage.removeItem('flowbill-session'); label(); });
  if (['#quotations', '#settings', '#tax-invoices', '#delivery-notes', '#cash-bills', '#purchase-tax', '#sales-tax'].includes(location.hash)) setTimeout(() => window.go?.(location.hash.slice(1)), 0);
})();
