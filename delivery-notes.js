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
    #dn-preview {position:fixed;inset:0;background:#e7ebef;z-index:10000;overflow:auto;padding:24px}
    .dn-actions {max-width:210mm;margin:0 auto 18px;display:flex;gap:12px;align-items:center}.dn-actions span{font-size:12px;color:#536174}
    .dn-sheet {--dn-ink:#19334a;--dn-line:#c5cdd4;background:white;color:#1b2935;width:210mm;min-height:297mm;margin:auto;padding:14mm;box-sizing:border-box;font:12px/1.65 'IBM Plex Sans Thai',Tahoma,Arial,sans-serif;box-shadow:0 10px 45px #17203318}
    .dn-sheet *{box-sizing:border-box}.dn-sheet p{margin:0}.dn-sheet small{display:block;color:#536174;font-size:10px}.dn-sheet h2{margin:0;color:var(--dn-ink)}
    .dn-head {display:grid;grid-template-columns:minmax(0,1fr) 60mm;align-items:center;gap:6mm;margin:0 0 6mm;padding-bottom:5mm;border-bottom:2px solid var(--dn-ink);break-inside:avoid}
    .dn-brand{display:flex;align-items:center;gap:4mm}.dn-company-logo{width:20mm;height:20mm;object-fit:contain;flex:none;print-color-adjust:exact}.dn-brand>div{min-width:0;flex:1}.dn-company h2{font-size:16px;font-weight:600;line-height:1.5;margin:0 0 2mm}.dn-company .dn-address{font-size:11px;line-height:1.65;margin:0}.dn-company small{font-size:10px;line-height:1.6;margin-top:1.5mm;color:#536174}.dn-address{white-space:pre-wrap;overflow-wrap:anywhere}.dn-kicker{font:600 10px/1.6 Arial,sans-serif;letter-spacing:2px;color:#536174}
    .dn-title{text-align:right}.dn-title h2{font-size:26px;letter-spacing:.2px;line-height:1.3}.dn-title .dn-kicker{margin:1mm 0 3mm}
    .dn-meta{border-top:1px solid var(--dn-line);padding-top:2mm}.dn-meta p{display:flex;justify-content:space-between;gap:3mm;font-size:10.5px;margin-top:1mm}.dn-meta strong{overflow-wrap:anywhere}
    .dn-parties{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:6mm;break-inside:avoid}
    .dn-party{border:1px solid var(--dn-line);border-radius:3px;padding:4mm;overflow-wrap:anywhere}.dn-party h3{font-size:11px;color:#536174;margin:0 0 3mm;letter-spacing:.3px}.dn-party strong{display:block;font-size:13px;margin-bottom:2mm}.dn-party p{white-space:pre-wrap}.dn-shipping{border-left:3px solid var(--dn-ink)}
    .dn-section-label{display:flex;justify-content:space-between;align-items:center;margin:0 0 2mm;font-size:12px}.dn-section-label span{color:#536174;font-size:10px}
    .dn-sheet table {width:100%;min-width:0;border-collapse:collapse;margin:0;table-layout:fixed}
    .dn-sheet th,.dn-sheet td {border:1px solid var(--dn-line);padding:3mm 2.5mm;text-align:left;white-space:normal;overflow-wrap:anywhere;font-size:12px;color:#1b2935;background:white;vertical-align:top}
    .dn-sheet th{background:#f0f3f5;font-size:11px;border-top:2px solid var(--dn-ink);font-weight:600;text-align:center}.dn-sheet th small{font:9px/1.5 Arial,sans-serif;margin-top:1mm;text-align:center}
    .dn-sheet td:nth-child(1),.dn-sheet td:nth-child(3),.dn-sheet td:nth-child(4){text-align:center}.dn-sheet td:nth-child(3){font-variant-numeric:tabular-nums;font-weight:600}
    .dn-sheet td.dn-description{white-space:pre-wrap;overflow-wrap:anywhere}.dn-sheet td small{white-space:pre-wrap;margin-top:1mm}.dn-empty td{height:5mm;padding:0}.dn-sheet footer{margin-top:6mm}
    .dn-note{border:1px solid var(--dn-line);padding:3mm 4mm;min-height:19mm;white-space:pre-wrap;overflow-wrap:anywhere}.dn-note b{display:block;font-size:10px;color:#536174;margin-bottom:1mm}
    .dn-sign {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5mm;margin-top:6mm;break-inside:avoid;text-align:center}.dn-sign>div{border:1px solid var(--dn-line);padding:4mm 3mm}.dn-sign-line{height:12mm;border-bottom:1px dotted #7c8994;margin-bottom:2mm}.dn-sign p{font-weight:600}.dn-sign small{font-family:Arial,sans-serif;font-size:9px;margin-bottom:3mm}.dn-sign .dn-sign-date{font-size:10px;font-weight:400;color:#536174}
    .dn-end{margin-top:5mm;padding-top:2mm;border-top:1px solid var(--dn-line);display:flex;justify-content:space-between;gap:4mm;font-size:9px;color:#647380}
    @media(max-width:650px){#delivery-form .dn-line{grid-template-columns:1fr 75px 45px}.dn-actions{flex-wrap:wrap}}
    @media print {body > *:not(#dn-preview){display:none!important}#dn-preview{position:static;padding:0;overflow:visible;background:white}.dn-actions{display:none!important}.dn-sheet{width:100%;min-height:0;padding:0;margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.dn-sheet tr{break-inside:avoid}.dn-sheet thead{display:table-header-group}.dn-note{break-inside:avoid}@page{size:A4;margin:12mm}}
  `;
  document.head.append(style);
  const buildSheet = (issuer, doc, items) => `<article class="dn-sheet" aria-label="ใบส่งของ"><header class="dn-head"><div class="dn-company"><div class="dn-brand"><img class="dn-company-logo" src="company-logo.png" alt="โลโก้บริษัท"><div><h2>${escape(issuer.name || '-')}</h2><p class="dn-address">${escape(window.DocumentAddress.format(issuer.address) || '-')}</p><small>เลขประจำตัวผู้เสียภาษี ${escape(issuer.tax_id || '-')}</small></div></div></div><div class="dn-title"><h2>ใบส่งของ</h2><p class="dn-kicker">DELIVERY NOTE</p><div class="dn-meta"><p><span>เลขที่เอกสาร</span><strong>${escape(doc.document_number || 'ตัวอย่าง')}</strong></p><p><span>วันที่ส่งสินค้า</span><strong>${date(doc.issue_date)}</strong></p></div></div></header><section class="dn-parties"><div class="dn-party"><h3>ลูกค้า / CUSTOMER</h3><strong>${escape(doc.customer_name)}</strong><p>${escape(window.DocumentAddress.format(doc.customer_address) || '-')}</p><small>เลขประจำตัวผู้เสียภาษี ${escape(doc.customer_tax_id || '-')}</small></div><div class="dn-party dn-shipping"><h3>สถานที่จัดส่ง / SHIP TO</h3><p>${escape(doc.shipping_address)}</p></div></section><div class="dn-section-label"><b>รายการสินค้าที่จัดส่ง</b><span>${items.length} รายการ</span></div><table><colgroup><col style="width:8%"><col style="width:66%"><col style="width:14%"><col style="width:12%"></colgroup><thead><tr><th>ลำดับ<small>NO.</small></th><th>รายการสินค้า / ขนาด<small>DESCRIPTION / SIZE</small></th><th>จำนวน<small>QUANTITY</small></th><th>หน่วย<small>UNIT</small></th></tr></thead><tbody>${items.map((item,i)=>`<tr><td>${i+1}</td><td class="dn-description">${escape([item.name,item.specification].filter(value => value != null && String(value).trim()).join(' '))}</td><td>${Number(item.quantity).toLocaleString('th-TH',{maximumFractionDigits:3})}</td><td>${escape(item.unit)}</td></tr>`).join('')}${Array.from({length:Math.max(0,12-items.length)},()=>'<tr class="dn-empty" aria-hidden="true"><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table><footer><div class="dn-note"><b>หมายเหตุ / REMARKS</b>${escape(doc.notes || '-')}</div><div class="dn-sign">${[['ผู้รับสินค้า','RECEIVED BY'],['ผู้ส่งสินค้า','DELIVERED BY'],['ผู้อนุมัติ','AUTHORIZED BY']].map(([th,en])=>`<div><div class="dn-sign-line"></div><p>${th}</p><small>${en}</small><p class="dn-sign-date">วันที่ ........ / ........ / ........</p></div>`).join('')}</div><div class="dn-end"><span>ใบส่งของ / DELIVERY NOTE</span><span>${escape(doc.document_number || 'ตัวอย่าง — ยังไม่ได้บันทึก')}</span></div></footer></article>`;
  const preview = (doc, items) => {
    document.querySelector('#dn-preview')?.remove();
    const panel = document.createElement('section'); panel.id = 'dn-preview';
    panel.innerHTML = `<div class="dn-actions"><button class="ghost" data-close>กลับ</button><button class="primary" data-print>พิมพ์ / บันทึก PDF</button><span>${doc.id ? 'เอกสารที่บันทึกแล้ว' : 'ตัวอย่าง — ยังไม่ได้บันทึก'}</span></div>` + buildSheet(company, doc, items);
    panel.querySelector('[data-close]').onclick = () => panel.remove();
    const printButton=panel.querySelector('[data-print]');
    printButton.disabled=true;
    const logo=panel.querySelector('.dn-company-logo');
    logo.decode().then(()=>{if(panel.isConnected)printButton.disabled=false;}).catch(()=>{panel.querySelector('.dn-actions span').textContent='โหลดโลโก้บริษัทไม่ได้ กรุณาเปิดเอกสารใหม่';});
    printButton.onclick = () => window.print();
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
    dialog.innerHTML = `<form><h2>สร้างใบส่งสินค้า</h2><label class="field"><span>ลูกค้า</span><select name="customer" required>${customers.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}</select></label><label class="field"><span>วันที่ส่งสินค้า</span><input type="date" name="date" required></label><label class="field"><span>สถานที่จัดส่ง</span><textarea name="shipping" required maxlength="1500" placeholder="ชื่อสถานที่ / ที่อยู่ / จุดรับสินค้า"></textarea></label><button type="button" class="ghost" data-copy>ใช้ที่อยู่ลูกค้าเป็นสถานที่จัดส่ง</button><h3>รายการสินค้า <span data-line-count></span></h3><p>กดเพิ่มรายการเพื่อเลือกสินค้าและจำนวนแยกแต่ละแถว เพิ่มได้มากกว่า 12 รายการ โดยเอกสารยาวจะพิมพ์ต่อหน้า</p><div data-lines></div><button type="button" class="primary" style="width:100%;margin:12px 0" data-add>+ เพิ่มรายการสินค้าอีกแถว</button><label class="field"><span>หมายเหตุ</span><textarea name="notes" maxlength="1500"></textarea></label><p class="dn-error" role="status"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button type="button" class="ghost" data-preview>ดูตัวอย่าง</button><button type="submit" class="primary">บันทึกใบส่งสินค้า</button></div></form>`;
    const form=dialog.querySelector('form'); let pendingId=crypto.randomUUID(), saving=false;
    const today=new Date(); form.elements.date.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const updateLines=()=>{const lines=[...dialog.querySelectorAll('.dn-line')];dialog.querySelector('[data-line-count]').textContent=`(${lines.length} รายการ)`;lines.forEach((line,i)=>{line.querySelector('[data-line-title]').textContent=`รายการที่ ${i+1} — สินค้า / ขนาด`;});};
    const addLine=()=>{const line=document.createElement('div');line.className='dn-line';line.innerHTML=`<label><span data-line-title>สินค้า / ขนาด</span><select aria-label="สินค้า / ขนาด" required>${variants.map(v=>`<option value="${escape(v.id)}">${escape(v.name)} (${escape(v.label)}) · ${escape(v.unit)}</option>`).join('')}</select></label><label>จำนวน<input aria-label="จำนวน" type="number" min="0.001" max="99999999999" step="0.001" value="1" required></label><button type="button" class="ghost" aria-label="ลบรายการ">ลบ</button>`;line.querySelector('button').onclick=()=>{line.remove();updateLines();};dialog.querySelector('[data-lines]').append(line);updateLines();};
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
  const openSaved=async(request,orgId,id)=>{await load(request,orgId);await showSaved(id);};
  window.DeliveryNotes={load,buildSheet,openSaved};
})();
