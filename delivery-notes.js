(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => new Date(value + 'T00:00:00').toLocaleDateString('th-TH');
  let api, organizationId, company;
  const style = document.createElement('style');
  style.textContent = `
    #delivery-form {width:min(850px,95vw);max-height:92vh;border:0;border-radius:16px;padding:28px;overflow:auto}
    #delivery-form::backdrop {background:#15203488}
    #delivery-form .dn-line {display:grid;grid-template-columns:1fr 110px 60px;gap:10px;align-items:end;margin:10px 0}
    #delivery-form select,#delivery-form input,#delivery-form textarea {width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}
    #delivery-form textarea {min-height:75px} #delivery-form .field {display:block;margin:14px 0}
    #delivery-form .field span {display:block;margin-bottom:6px} .dn-error {color:#b42318;white-space:pre-wrap}
    #dn-preview {position:fixed;inset:0;background:#e9edf2;z-index:10000;overflow:auto;padding:22px}
    .dn-actions {max-width:190mm;margin:0 auto 16px;display:flex;gap:12px;align-items:center}
    .dn-sheet {background:white;color:#111;width:190mm;min-height:267mm;margin:auto;padding:10mm;box-sizing:content-box;font:13px Tahoma,Arial,sans-serif}
    .dn-head {display:flex;justify-content:space-between;gap:25px;margin-bottom:20px}.dn-head h2 {font-size:20px;margin:0 0 10px}.dn-head p {margin:5px 0}
    .dn-box {border:1px solid #111;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere}
    .dn-sheet table {width:100%;border-collapse:collapse;margin:14px 0 0;table-layout:fixed}
    .dn-sheet th,.dn-sheet td {border:1px solid #111;padding:9px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;color:#111;background:white}
    .dn-sheet th:nth-child(1){width:38px}.dn-sheet th:nth-child(3){width:80px}.dn-sheet th:nth-child(4){width:65px}
    .dn-items {min-height:125mm}.dn-sign {display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #111;border-top:0;text-align:center}
    .dn-sign div {padding:55px 8px 15px;border-right:1px solid #111}.dn-sign div:last-child{border:0}
    .dn-sign small {display:block;margin-top:12px}.dn-sheet footer {break-inside:avoid}
    @media(max-width:650px){#delivery-form .dn-line{grid-template-columns:1fr 75px 45px}.dn-actions{flex-wrap:wrap}}
    @media print {body > *:not(#dn-preview){display:none!important}#dn-preview{position:static;padding:0;overflow:visible;background:white}.dn-actions{display:none!important}.dn-sheet{width:auto;min-height:0;padding:0;margin:0}.dn-sheet tr{break-inside:avoid}.dn-sheet thead{display:table-header-group}@page{size:A4;margin:10mm}}
  `;
  document.head.append(style);
  const preview = (doc, items) => {
    document.querySelector('#dn-preview')?.remove();
    const panel = document.createElement('section'); panel.id = 'dn-preview';
    panel.innerHTML = `<div class="dn-actions"><button class="ghost" data-close>กลับ</button><button class="primary" data-print>พิมพ์ / บันทึก PDF</button><span>${doc.id ? 'เอกสารที่บันทึกแล้ว' : 'ตัวอย่าง — ยังไม่ได้บันทึก'}</span></div><article class="dn-sheet"><header class="dn-head"><div><h2>${escape(company.name)}</h2><p class="dn-address">${escape(company.address)}</p><p>เลขประจำตัวผู้เสียภาษี ${escape(company.tax_id || '-')}</p></div><div><h2>ใบส่งสินค้า</h2><p>Delivery Note</p><p>เลขที่ ${escape(doc.document_number || 'ตัวอย่าง')}</p><p>วันที่ ${date(doc.issue_date)}</p></div></header><div class="dn-box"><b>ลูกค้า</b> ${escape(doc.customer_name)}\nเลขประจำตัวผู้เสียภาษี ${escape(doc.customer_tax_id || '-')}\n<b>ที่อยู่ลูกค้า</b> ${escape(doc.customer_address || '-')}</div><div class="dn-box"><b>สถานที่จัดส่ง</b>\n${escape(doc.shipping_address)}</div><div class="dn-items"><table><thead><tr><th>ลำดับ</th><th>รายการสินค้า / ขนาด</th><th>จำนวน</th><th>หน่วย</th></tr></thead><tbody>${items.map((item,i)=>`<tr><td>${i+1}</td><td>${escape(item.sku)} — ${escape(item.name)}\n${escape(item.specification)}</td><td>${Number(item.quantity).toLocaleString('th-TH',{maximumFractionDigits:3})}</td><td>${escape(item.unit)}</td></tr>`).join('')}</tbody></table></div><footer><div class="dn-box"><b>หมายเหตุ</b>\n${escape(doc.notes || '-')}</div><div class="dn-sign">${['ผู้รับสินค้า / Received by','ผู้ส่งสินค้า / Delivered by','ผู้อนุมัติ / Authorized signature'].map(label=>`<div>....................................<p>${label}</p><small>วันที่ ................................</small></div>`).join('')}</div></footer></article>`;
    panel.querySelector('[data-close]').onclick = () => panel.remove();
    panel.querySelector('[data-print]').onclick = () => window.print();
    document.body.append(panel);
  };
  const openForm = async () => {
    const [customers, products] = await Promise.all([
      api(`/rest/v1/customers?organization_id=eq.${organizationId}&select=id,name,tax_id,billing_address&order=name`),
      api(`/rest/v1/products?organization_id=eq.${organizationId}&is_active=eq.true&select=name,unit,product_variants(id,sku,label,is_active)`)
    ]);
    const variants = products.flatMap(p => p.product_variants.filter(v=>v.is_active).map(v=>({...v,name:p.name,unit:p.unit || 'ชิ้น'})));
    if (!customers.length || !variants.length) throw new Error('กรุณาเพิ่มลูกค้าและสินค้าก่อนสร้างใบส่งสินค้า');
    const dialog = document.createElement('dialog'); dialog.id = 'delivery-form';
    dialog.innerHTML = `<form><h2>สร้างใบส่งสินค้า</h2><label class="field"><span>ลูกค้า</span><select name="customer" required>${customers.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}</select></label><label class="field"><span>วันที่ส่งสินค้า</span><input type="date" name="date" required></label><label class="field"><span>สถานที่จัดส่ง</span><textarea name="shipping" required maxlength="1500" placeholder="ชื่อสถานที่ / ที่อยู่ / จุดรับสินค้า"></textarea></label><button type="button" class="ghost" data-copy>ใช้ที่อยู่ลูกค้าเป็นสถานที่จัดส่ง</button><h3>รายการสินค้า</h3><div data-lines></div><button type="button" class="ghost" data-add>+ เพิ่มรายการสินค้า</button><label class="field"><span>หมายเหตุ</span><textarea name="notes" maxlength="1500"></textarea></label><p class="dn-error" role="status"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button type="button" class="ghost" data-preview>ดูตัวอย่าง</button><button type="submit" class="primary">บันทึกใบส่งสินค้า</button></div></form>`;
    const form=dialog.querySelector('form'); let pendingId=crypto.randomUUID(), saving=false;
    const today=new Date(); form.elements.date.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const addLine=()=>{const line=document.createElement('div');line.className='dn-line';line.innerHTML=`<label>สินค้า / ขนาด<select aria-label="สินค้า / ขนาด" required>${variants.map(v=>`<option value="${escape(v.id)}">${escape(v.sku)} — ${escape(v.name)} (${escape(v.label)}) · ${escape(v.unit)}</option>`).join('')}</select></label><label>จำนวน<input aria-label="จำนวน" type="number" min="0.001" max="99999999999" step="0.001" value="1" required></label><button type="button" class="ghost" aria-label="ลบรายการ">ลบ</button>`;line.querySelector('button').onclick=()=>{line.remove();};dialog.querySelector('[data-lines]').append(line);};
    dialog.querySelector('[data-add]').onclick=addLine;addLine();
    dialog.querySelector('[data-copy]').onclick=()=>{form.elements.shipping.value=customers.find(c=>c.id===form.elements.customer.value)?.billing_address || '';};
    const collect=()=>{
      if(!form.reportValidity()) return null;
      const c=customers.find(c=>c.id===form.elements.customer.value);
      const lines=[...dialog.querySelectorAll('.dn-line')].map(line=>{const v=variants.find(v=>v.id===line.querySelector('select').value);return {variant_id:v.id,sku:v.sku,name:v.name,specification:v.label,unit:v.unit,quantity:Number(line.querySelector('input').value)};});
      if(!lines.length) throw new Error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
      if(!form.elements.shipping.value.trim()) throw new Error('กรุณาระบุสถานที่จัดส่ง');
      return {doc:{customer_id:c.id,customer_name:c.name,customer_tax_id:c.tax_id,customer_address:c.billing_address,issue_date:form.elements.date.value,shipping_address:form.elements.shipping.value.trim(),notes:form.elements.notes.value.trim()},items:lines};
    };
    dialog.querySelector('[data-preview]').onclick=()=>{try{const data=collect();if(data){dialog.close();preview(data.doc,data.items);document.querySelector('#dn-preview [data-close]').onclick=()=>{document.querySelector('#dn-preview').remove();dialog.showModal();};}}catch(e){dialog.querySelector('.dn-error').textContent=e.message;}};
    dialog.querySelector('[data-cancel]').onclick=()=>{dialog.remove();};dialog.addEventListener('cancel',()=>dialog.remove());
    form.onsubmit=async event=>{event.preventDefault();if(saving)return;try{const data=collect();if(!data)return;saving=true;form.querySelector('button[type=submit]').disabled=true;dialog.querySelector('.dn-error').textContent='กำลังบันทึก…';
      const id=await api('/rest/v1/rpc/save_delivery_note',{method:'POST',body:JSON.stringify({p_id:pendingId,p_org:organizationId,p_customer:data.doc.customer_id,p_date:data.doc.issue_date,p_shipping:data.doc.shipping_address,p_notes:data.doc.notes,p_items:data.items.map(i=>({variant_id:i.variant_id,quantity:i.quantity}))})});
      dialog.remove();await load(api,organizationId);await showSaved(id);
    }catch(e){dialog.querySelector('.dn-error').textContent=`บันทึกไม่สำเร็จ: ${e.message}`;}finally{saving=false;const btn=form.querySelector('button[type=submit]');if(btn)btn.disabled=false;}};
    document.body.append(dialog);dialog.showModal();
  };
  const showSaved=async id=>{const rows=await api(`/rest/v1/delivery_notes?id=eq.${encodeURIComponent(id)}&organization_id=eq.${organizationId}&select=*,delivery_note_items(*)`);if(!rows[0])throw new Error('ไม่พบเอกสาร');preview(rows[0],rows[0].delivery_note_items.sort((a,b)=>a.position-b.position));};
  const load=async(request,orgId)=>{
    api=request;organizationId=orgId;const page=document.querySelector('#delivery-notes');
    page.innerHTML='<article class="panel settings-card"><h3>ใบส่งสินค้า</h3><p>กำลังโหลด…</p></article>';
    try{
      const [rows,companies]=await Promise.all([api(`/rest/v1/delivery_notes?organization_id=eq.${orgId}&select=id,document_number,customer_name,issue_date,shipping_address&order=created_at.desc`),api(`/rest/v1/organizations?id=eq.${orgId}&select=name,tax_id,address`)]);company=companies[0] || {};
      page.innerHTML=`<div class="page-toolbar"><h2>ใบส่งสินค้า</h2><button class="primary" data-new>+ สร้างใบส่งสินค้า</button></div><p role="status" class="dn-error"></p><article class="panel table-panel"><table><thead><tr><th>เลขที่เอกสาร</th><th>ลูกค้า</th><th>วันที่</th><th>สถานที่จัดส่ง</th><th>เอกสาร</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${escape(r.document_number)}</td><td>${escape(r.customer_name)}</td><td>${date(r.issue_date)}</td><td>${escape(r.shipping_address)}</td><td><button class="ghost" data-view="${escape(r.id)}">ดู / พิมพ์</button></td></tr>`).join(''):'<tr><td colspan="5">ยังไม่มีใบส่งสินค้า เริ่มสร้างเอกสารได้จากปุ่มด้านบน</td></tr>'}</tbody></table></article>`;
      const run=fn=>async()=>{try{await fn();}catch(e){page.querySelector('[role=status]').textContent=e.message;}};
      page.querySelector('[data-new]').onclick=run(openForm);page.querySelectorAll('[data-view]').forEach(b=>b.onclick=run(()=>showSaved(b.dataset.view)));
    }catch(e){page.innerHTML=`<article class="panel settings-card"><h3>ใบส่งสินค้า</h3><p class="dn-error">ยังโหลดใบส่งสินค้าไม่ได้: ${escape(e.message)}</p><button class="ghost" data-retry>ลองใหม่</button></article>`;page.querySelector('[data-retry]').onclick=()=>load(api,organizationId);}
  };
  window.DeliveryNotes={load};
})();
