(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const discountRate=item=>{
  const gross=round(Number(item?.quantity||0)*Number(item?.unit_price||0));
  return gross>0?Number((Number(item.discount_amount||0)/gross*100).toFixed(6)):0;
 };
 const discountAmount=(quantity,price,rate,original)=>{
  if(String(rate??'').trim()===''||!Number.isFinite(Number(rate))||Number(rate)<0||Number(rate)>100)throw Error('ส่วนลดต้องอยู่ระหว่าง 0–100%');
  if(original&&Number(quantity)===Number(original.quantity)&&Number(price)===Number(original.unit_price)&&Number(rate)===discountRate(original))return Number(original.discount_amount||0);
  return round(round(Number(quantity)*Number(price))*Number(rate)/100);
 };
 const money=n=>Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const dateOK=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const totals=(items,vatRate)=>{
  if(!items.length||items.length>200)throw Error('กรุณาระบุสินค้า 1–200 รายการ');
  let subtotal=0,discount=0;
  for(const [i,item] of items.entries()){
   if(!item.existing_item_id&&!item.variant_id)throw Error(`เลือกรหัสสินค้าในรายการที่ ${i+1}`);
   const q=Number(item.quantity),p=Number(item.unit_price),d=Number(item.discount_amount);
   if([item.quantity,item.unit_price,item.discount_amount].some(v=>String(v??'').trim()==='')||![q,p,d].every(Number.isFinite)||q<=0||q>=1e11||!Number.isSafeInteger(q)||p<0||p>=1e12||p!==round(p)||d<0||d!==round(d)||d>round(q*p))throw Error(`ตรวจจำนวน ราคา และส่วนลดในรายการที่ ${i+1}`);
   if(String(item.specification||'').length>2000)throw Error('รายละเอียดสินค้ายาวเกิน 2,000 ตัวอักษร');
   subtotal=round(subtotal+round(q*p));discount=round(discount+d);
  }
  const taxable=round(subtotal-discount),vat=round(taxable*Number(vatRate)/100),total=round(taxable+vat);
  if(!Number.isFinite(total)||subtotal>=1e12||total>=1e12)throw Error('ยอดเงินเกินขอบเขต');
  return {subtotal,discount,taxable,vat,total};
 };
 const payload=(doc,data,items)=>{
  if(!dateOK(data.issueDate)||!dateOK(data.dueDate)||data.issueDate<'2000-01-01'||data.dueDate>'2199-12-31'||data.dueDate<data.issueDate)throw Error('วันครบกำหนดต้องไม่ก่อนวันที่เอกสาร');
  if(String(data.paymentTerms||'').length>120||String(data.notes||'').length>4000)throw Error('ข้อความเงื่อนไขหรือหมายเหตุยาวเกินกำหนด');
  totals(items,doc.vat_rate);
  return {p_org:doc.organization_id,p_id:doc.id,p_number:doc.document_number,p_expected_updated_at:doc.updated_at,p_customer:data.customerId||null,p_issue:data.issueDate,p_due:data.dueDate,p_terms:data.paymentTerms||'',p_notes:data.notes||'',p_items:items.map(i=>({...i,quantity:Number(i.quantity),unit_price:Number(i.unit_price),discount_amount:Number(i.discount_amount)}))};
 };
 const save=async(request,p)=>{
  const result=await request('/rest/v1/rpc/edit_tax_invoice_office_names',{method:'POST',body:JSON.stringify(p)});
  if(result?.id!==p.p_id||result.document_number!==(p.p_new_number||p.p_number)||result.updated!==true||!result.updated_at)throw Error('ยังยืนยันผลบันทึกไม่ได้ กรุณาปิดแล้วเปิดเอกสารตรวจสอบก่อนลองใหม่');
  return result;
 };
 let context;
 const open=async number=>{
  if(!context||document.querySelector('#tax-edit-dialog'))return;
  const ctx=context,dialog=document.createElement('dialog');dialog.id='tax-edit-dialog';dialog.style.cssText='width:min(1100px,96vw);max-width:96vw;max-height:92vh;padding:26px;border:0;border-radius:14px;overflow:auto';
  dialog.innerHTML='<h2>แก้ไขใบกำกับภาษี</h2><p role="status">กำลังโหลดข้อมูลล่าสุด…</p><button type="button" class="ghost" data-close>ปิด</button>';
  let busy=false;dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  try{
   const [docs,catalog]=await Promise.all([ctx.request(`/rest/v1/documents?organization_id=eq.${encodeURIComponent(ctx.org)}&kind=eq.tax_invoice&document_number=eq.${encodeURIComponent(number)}&select=*&limit=2`),ctx.catalog()]);
   if(!dialog.isConnected)return;if(ctx!==context)throw Error('องค์กรเปลี่ยนแล้ว กรุณาเปิดเอกสารใหม่');
   const doc=docs[0];if(docs.length!==1||doc.organization_id!==ctx.org||doc.kind!=='tax_invoice'||doc.deleted_at||doc.document_number!==number)throw Error('ไม่พบใบกำกับภาษีที่แก้ไขได้');
   if(doc.payment_received||doc.status==='cancelled')throw Error('ไม่สามารถแก้ใบที่ชำระแล้วหรือยกเลิกแล้ว');
   const items=await ctx.request(`/rest/v1/document_items?document_id=eq.${encodeURIComponent(doc.id)}&select=*&order=position&limit=201`);
   if(items.length>200)throw Error('เอกสารมีมากกว่า 200 รายการ กรุณาติดต่อผู้ดูแล');if(!dialog.isConnected)return;
   const details=window.QuotationEditor.decode(doc.notes),customers=catalog.customers.filter(c=>c.id!==doc.customer_id);
   customers.unshift({id:doc.customer_id||'',name:doc.customer_name_snapshot});
   dialog.innerHTML=`<style>#tax-edit-dialog .te-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#tax-edit-dialog .te-line{padding:16px;background:#f7faf9;border:1px solid #dce5e3;border-radius:10px;margin:12px 0}#tax-edit-dialog textarea,#tax-edit-dialog input,#tax-edit-dialog select{width:100%;padding:10px;border:1px solid #ccd4dd;border-radius:6px;font:inherit;box-sizing:border-box}#tax-edit-dialog .te-numbers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}#tax-edit-dialog .te-top{display:flex;justify-content:space-between;gap:10px;align-items:center}#tax-edit-dialog [data-error]{color:#b42318;white-space:pre-wrap}@media(max-width:650px){#tax-edit-dialog .te-grid,#tax-edit-dialog .te-numbers{grid-template-columns:1fr}}</style><form><h2>แก้ไขใบกำกับภาษี ${esc(number)}</h2><p>คงเลขเอกสารและอัตรา VAT เดิม • ไม่เปลี่ยนเอกสารต้นทาง • รหัสสินค้าไม่แสดงในแบบพิมพ์</p><div class="te-grid"><label class="field"><span>ลูกค้า</span><select name="customerId">${customers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label class="field"><span>วันที่เอกสาร</span><input name="issueDate" type="date" required min="2000-01-01" max="2199-12-31" value="${esc(doc.issue_date)}"></label><label class="field"><span>วันที่ครบกำหนดชำระเงิน</span><input name="dueDate" type="date" required min="2000-01-01" max="2199-12-31" value="${esc(doc.due_date||doc.issue_date)}"></label><label class="field"><span>เงื่อนไขชำระเงิน</span><input name="paymentTerms" maxlength="120" value="${esc(details.paymentTerms)}"></label></div><h3>รายการสินค้า</h3><div data-lines></div><button type="button" class="ghost" data-add>+ เพิ่มรายการสินค้า</button><label class="field"><span>หมายเหตุ</span><textarea name="notes" rows="3" maxlength="4000">${esc(details.notes)}</textarea></label><p data-total aria-live="polite"></p><p data-error role="alert"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button type="submit" class="primary">บันทึกการแก้ไข</button></div></form>`;
   const form=dialog.querySelector('form'),lines=form.querySelector('[data-lines]');
   const numberLabel=document.createElement('label');numberLabel.className='field';
   numberLabel.innerHTML='<span>เลขที่เอกสาร</span><input name="documentNumber" required maxlength="80" autocomplete="off"><small>ห้ามซ้ำกับเลขที่มีอยู่ รวมถึงในถังขยะ</small>';
   numberLabel.querySelector('input').value=doc.document_number;form.querySelector('.te-grid').prepend(numberLabel);
   form.querySelector('h2').nextElementSibling.textContent='แก้ไขเลขที่เอกสารได้ • คงอัตรา VAT เดิม • รหัสสินค้าไม่แสดงในแบบพิมพ์';
   window.OfficeBranch.mount(form.querySelector('.te-grid'),doc.issuer_office_snapshot,{name:doc.issuer_office_name_snapshot,prefix:'issuerOffice',title:'สำนักงาน / สาขาของผู้ออกเอกสาร'});
   window.OfficeBranch.mount(form.querySelector('.te-grid'),doc.customer_office_snapshot,{name:doc.customer_office_name_snapshot,prefix:'customerOffice',title:'สำนักงาน / สาขาของลูกค้า'});
   const customerSelect=form.querySelector('[name=customerId]');
   customerSelect.onchange=()=>{const selected=catalog.customers.find(c=>c.id===customerSelect.value);const code=customerSelect.value===doc.customer_id?doc.customer_office_snapshot:selected?.officeCode;form.querySelector('[name=customerOfficeType]').value=code==null?'':code==='00000'?'head':'branch';form.querySelector('[name=customerOfficeNumber]').value=code&&code!=='00000'?code:'';form.querySelector('[name=customerOfficeName]').value=(customerSelect.value===doc.customer_id?doc.customer_office_name_snapshot:selected?.officeName)||'';form.querySelector('[name=customerOfficeType]').onchange();};
   const read=()=>[...lines.children].map(row=>({existing_item_id:row.dataset.existing||null,variant_id:row.dataset.variant||null,specification:row.querySelector('[data-spec]').value,quantity:row.querySelector('[data-qty]').value,unit_price:row.querySelector('[data-price]').value,discount_amount:discountAmount(row.querySelector('[data-qty]').value,row.querySelector('[data-price]').value,row.querySelector('[data-discount]').value,row.originalDiscount)}));
   const update=()=>{try{const t=totals(read(),doc.vat_rate);form.querySelector('[data-total]').textContent=`รวม ${money(t.subtotal)} · ส่วนลด ${money(t.discount)} · VAT ${doc.vat_rate}% ${money(t.vat)} · ยอดสุทธิ ${money(t.total)} บาท`;}catch(e){form.querySelector('[data-total]').textContent=e.message;}};
   const add=item=>{
    const row=document.createElement('div');row.className='te-line';row.dataset.existing=item?.id||'';row.originalDiscount=item||null;
    row.innerHTML=`<div class="te-top"><strong data-name>${esc(item?.product_name_snapshot||'สินค้าใหม่')}</strong><button type="button" class="ghost" data-remove>นำรายการออก</button></div><div data-picker></div>${item?'<button type="button" class="ghost" data-change>เปลี่ยนสินค้า</button>':''}<label class="field"><span>รายละเอียด / ขนาดในเอกสาร</span><textarea data-spec maxlength="2000">${esc(item?.specification_snapshot||'')}</textarea></label><div class="te-numbers"><label class="field"><span>จำนวน</span><input data-qty type="number" required min="1" step="1" value="${esc(item?.quantity??1)}"></label><label class="field"><span>ราคาต่อหน่วย (บาท)</span><input data-price type="number" required min="0" step="0.01" value="${esc(item?.unit_price??0)}"></label><label class="field"><span>ส่วนลด (%)</span><input data-discount type="number" required min="0" max="100" step="any" value="${esc(discountRate(item))}"></label></div>`;
    const picker=()=>{row.originalDiscount=null;row.dataset.existing='';row.querySelector('[data-name]').textContent='เลือกสินค้า';window.ProductCodePicker.mount(row.querySelector('[data-picker]'),catalog.products,p=>{row.dataset.variant=p?.id||'';row.querySelector('[data-name]').textContent=p?.name||'เลือกสินค้า';row.querySelector('[data-price]').value=p?.price??0;row.querySelector('[data-spec]').value=p?.size||'';row.querySelector('[data-discount]').value=0;update();},{lookup:catalog.lookupProducts});row.querySelector('[data-change]')?.remove();update();};
    row.querySelector('[data-remove]').onclick=()=>{row.remove();update();};row.addEventListener('input',update);lines.append(row);
    if(item)row.querySelector('[data-change]').onclick=picker;else picker();update();
   };
   items.forEach(add);form.querySelector('[data-add]').onclick=()=>add();form.querySelector('[data-cancel]').onclick=()=>{if(!busy)dialog.close();};
   form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;const error=form.querySelector('[data-error]');error.textContent='';
    try{
     if(ctx!==context)throw Error('องค์กรเปลี่ยนแล้ว กรุณาเปิดเอกสารใหม่');
     const data=Object.fromEntries(new FormData(form)),p=payload(doc,data,read());p.p_issuer_office=window.OfficeBranch.read(data,'issuerOffice');p.p_customer_office=window.OfficeBranch.read(data,'customerOffice');p.p_issuer_office_name=window.OfficeBranch.readName(data,'issuerOffice');p.p_customer_office_name=window.OfficeBranch.readName(data,'customerOffice');p.p_new_number=window.DocumentNumber.normalize(data.documentNumber);if(!p.p_new_number)throw Error('กรุณาระบุเลขที่เอกสาร');busy=true;
     const fields=[...form.querySelectorAll('button,input,select,textarea')];fields.forEach(e=>e.disabled=true);
     try{await save(ctx.request,p);}catch(e){fields.forEach(el=>el.disabled=false);throw e;}
     dialog.close();try{await ctx.refresh();}catch{alert('บันทึกการแก้ไขแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ');}
    }catch(e){error.textContent=e.message;}finally{busy=false;}
   };
  }catch(e){if(dialog.isConnected){const error=dialog.querySelector('[data-error]')||dialog.querySelector('[role=status]');if(error)error.textContent=e.message;}}
 };
 const mount=()=>{
  if(!context)return;
  document.querySelectorAll('#tax-invoices tbody tr,#tax-invoice-control tbody tr').forEach(row=>{
   const print=row.querySelector('[data-print-document]');if(!print||row.querySelector('[data-edit-tax-invoice],[aria-label^="กู้คืนใบกำกับภาษี"]'))return;
   const number=print.dataset.printDocument,cell=row.lastElementChild;if(!number||!cell)return;
   const button=document.createElement('button');button.type='button';button.className='ghost';button.dataset.editTaxInvoice=number;button.textContent='แก้ไข';button.setAttribute('aria-label','แก้ไขใบกำกับภาษี '+number);button.style.marginRight='8px';button.onclick=()=>open(number);cell.prepend(button);
  });
 };
 new MutationObserver(mount).observe(document.querySelector('main'),{childList:true,subtree:true});
 window.TaxInvoiceEdit={discountRate,discountAmount,totals,payload,save,open,configure(request,org,catalog,refresh){if(!context||context.org!==org)context={request,org,catalog,refresh};else Object.assign(context,{request,catalog,refresh});mount();}};
})();
