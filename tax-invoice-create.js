(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
  const numberExample = date => validDate(date)?`IV${String(Number(date.slice(0,4))+543).slice(-2)}${date.slice(5,7)}-0001`:'IVปีเดือน-0001';
  const candidates = (quotes,links) => quotes.filter(q=>window.QuotationTax.canIssue(q)&&!links.has(q.id));
  const prepare = (data,rows,customers,products,org,id) => {
    if(!org||!id)throw Error('กรุณาเข้าสู่ระบบใหม่');
    if(!customers.some(c=>c.id===data.customerId))throw Error('กรุณาเลือกลูกค้า');
    if(!validDate(data.issueDate)||Number(data.issueDate.slice(0,4))<2000||Number(data.issueDate.slice(0,4))>2199)throw Error('กรุณาระบุวันที่เอกสารให้ถูกต้อง');
    const due=data.dueDate||data.issueDate;
    if(!validDate(due)||due<data.issueDate||due>'2199-12-31')throw Error('วันครบกำหนดชำระต้องไม่ก่อนวันที่เอกสาร และไม่เกินปี 2199');
    if(String(data.paymentTerms||'').length>120||String(data.notes||'').length>4000)throw Error('เงื่อนไขชำระเงินไม่เกิน 120 ตัวอักษร และหมายเหตุไม่เกิน 4,000 ตัวอักษร');
    if(rows.length>200)throw Error('รองรับไม่เกิน 200 รายการต่อเอกสาร');
    window.QuotationEditor.calculate(rows,products);
    for(const row of rows){
      if(Number(row.quantity)!==Number(Number(row.quantity).toFixed(3))||Number(row.unitPrice)!==Number(Number(row.unitPrice).toFixed(2))||Number(row.discountRate)!==Number(Number(row.discountRate).toFixed(2)))throw Error('จำนวนใช้ทศนิยมไม่เกิน 3 ตำแหน่ง ราคาและส่วนลดไม่เกิน 2 ตำแหน่ง');
      if(String(row.specification||'').length>2000)throw Error('รายละเอียดสินค้าไม่เกิน 2,000 ตัวอักษร');
    }
    return {p_org:org,p_id:id,p_customer:data.customerId,p_issue:data.issueDate,p_due:due,p_terms:String(data.paymentTerms||'').trim(),p_notes:String(data.notes||''),p_items:rows.map(r=>({variant_id:r.variantId,quantity:Number(r.quantity),unit_price:Number(r.unitPrice),discount_rate:Number(r.discountRate),specification:String(r.specification||'')}))};
  };
  const pending=new Map();
  const issue = (request,payload) => {
    const key=`${payload.p_org}:${payload.p_id}`;
    if(pending.has(key))return pending.get(key);
    const operation=(async()=>{
      const result=await request('/rest/v1/rpc/create_standalone_tax_invoice',{method:'POST',body:JSON.stringify(payload)});
      if(result?.id!==payload.p_id||!result.document_number||typeof result.created!=='boolean')throw Error('ยังยืนยันผลการบันทึกไม่ได้ กรุณาลองยืนยันรายการเดิมอีกครั้ง');
      return result;
    })();
    pending.set(key,operation);operation.then(()=>pending.delete(key),()=>pending.delete(key));return operation;
  };
  const open = context => {
    const {request,org,user,customers,products,quotes,links,vatRate,onSaved}=context;
    if(document.querySelector('#tax-create-dialog'))return;
    const storageKey=`flowbill-pending-tax:${org}:${user}`;
    let recovery;
    try{recovery=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{throw Error('อ่านข้อมูลการบันทึกค้างไม่ได้ กรุณาติดต่อผู้ดูแลก่อนสร้างใบใหม่');}
    if(recovery&&(recovery.p_org!==org||!recovery.p_id||!Array.isArray(recovery.p_items)))throw Error('ข้อมูลการบันทึกค้างไม่ถูกต้อง กรุณาติดต่อผู้ดูแลก่อนสร้างใบใหม่');
    const dialog=document.createElement('dialog');dialog.id='tax-create-dialog';dialog.style.cssText='width:min(1160px,96vw);max-width:96vw;max-height:92vh;border:0;border-radius:16px;padding:0';
    const style=document.createElement('style');style.textContent=`#tax-create-dialog{color:#24344e;background:#fff;overflow:auto}#tax-create-dialog::backdrop{background:rgba(15,23,42,.45)}#tax-create-dialog *{box-sizing:border-box}#tax-create-dialog h2{font-size:22px;margin:0 0 12px}#tax-create-dialog .field{display:block;margin:12px 0;min-width:0}#tax-create-dialog .field span{display:block;font-size:13px;font-weight:600;margin-bottom:6px}#tax-create-dialog input,#tax-create-dialog select,#tax-create-dialog textarea{display:block;width:100%;min-width:0;max-width:100%;border:1px solid #ccd4dd;border-radius:7px;padding:10px;font:inherit;background:#fff;color:inherit}#tax-create-dialog textarea{resize:vertical}#tax-create-dialog .qe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#tax-create-dialog .qe-numbers{grid-template-columns:repeat(3,minmax(0,1fr))}#tax-create-dialog .form-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}#tax-create-dialog .qe-total{padding:14px;background:#f0f5fa;border-radius:8px}#tax-create-dialog button{white-space:normal}@media(max-width:650px){#tax-create-dialog .qe-grid,#tax-create-dialog .qe-numbers{grid-template-columns:1fr}#tax-create-dialog .form-content{padding:20px!important}}`;dialog.append(style);
    const form=document.createElement('form');form.method='dialog';const root=document.createElement('div');form.append(root);dialog.append(form);document.body.append(dialog);
    let busy=false,editor,mode='choice',savedPayload=recovery;
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    dialog.addEventListener('close',()=>dialog.remove());
    const close=()=>{if(!busy)dialog.close();};
    const status=message=>{root.querySelector('[data-tax-error]').textContent=message;};
    const lock=value=>{busy=value;form.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=value);};
    const finish=async result=>{dialog.close();await onSaved(result);};
    const retryView=()=>{
      mode='retry';root.innerHTML=`<div class="form-content" style="padding:30px"><h2>ตรวจสอบการสร้างใบกำกับภาษี</h2><p>ยังยืนยันผลครั้งก่อนไม่ได้ กดตรวจสอบอีกครั้งเพื่อรับเอกสารเดิมหรือบันทึกรายการเดิม โดยไม่สร้างซ้ำ</p><p>วันที่ ${escape(savedPayload.p_issue)} · ${savedPayload.p_items.length} รายการ</p><p data-tax-error role="alert" style="color:#b42318"></p><div class="form-actions"><button type="button" class="ghost" data-close>ปิดไว้ก่อน</button><button class="primary" type="submit">ตรวจสอบ / บันทึกรายการเดิม</button></div></div>`;
      root.querySelector('[data-close]').onclick=close;
    };
    const manual=()=>{
      mode='manual';editor=window.QuotationEditor.mount(root,customers,products,{vatRate});
      root.querySelector('.form-content').style.padding='30px';
      root.querySelector('h2').textContent='สร้างใบกำกับภาษีใหม่';
      const numberingNotice=root.querySelector('h2').nextElementSibling;
      const due=root.querySelector('[name=expires]');due.name='dueDate';due.required=false;due.previousElementSibling.textContent='ครบกำหนดชำระ (ว่าง = วันที่เอกสาร)';
      const date=document.createElement('label');date.className='field';date.innerHTML=`<span>วันที่เอกสาร</span><input name="issueDate" type="date" min="2000-01-01" max="2199-12-31" required value="${window.QuotationEditor.issueDate()}">`;root.querySelector('.qe-grid').prepend(date);
      const updateNumber=()=>{numberingNotice.textContent=`ตัวอย่างเลขที่ ${numberExample(date.querySelector('input').value)} • รันลำดับแยกแต่ละเดือนตามวันที่เอกสาร • กำหนดเลขจริงเมื่อบันทึก • เริ่มต้นค้างจ่าย`;};date.querySelector('input').addEventListener('input',updateNumber);updateNumber();
      root.querySelector('[name=deliveryTerms]').closest('label').remove();root.querySelector('[name=notes]').maxLength=4000;
      const submit=root.querySelector('button[value=default]');submit.textContent='บันทึกใบกำกับภาษี';
      const cancel=root.querySelector('button[value=cancel]');cancel.type='button';cancel.onclick=close;
      const error=document.createElement('p');error.dataset.taxError='';error.setAttribute('role','alert');error.style.color='#b42318';root.querySelector('.form-actions').before(error);
      if(!customers.length||!products.some(p=>p.status!=='ปิดใช้งาน')){status('กรุณาเพิ่มลูกค้าและสินค้าในคลังข้อมูลก่อน');submit.disabled=true;}
    };
    const fromQuote=()=>{
      mode='quote';const available=candidates(quotes,links);
      root.innerHTML=`<div class="form-content" style="padding:30px"><h2>สร้างจากใบเสนอราคาที่อนุมัติแล้ว</h2><p>คัดลอกลูกค้า รายการสินค้า ส่วนลด และยอดเงินเดิม • ไม่บันทึกรับชำระเงิน</p><label class="field"><span>ใบเสนอราคาที่ยังไม่ออกใบกำกับภาษี</span><select name="quotationId" required style="width:100%;padding:12px;font:inherit"><option value="">เลือกใบเสนอราคา</option>${available.map(q=>`<option value="${escape(q.id)}">${escape(q.no)} — ${escape(q.customer)} — ${escape(q.total)}</option>`).join('')}</select></label><p>${available.length?'ตรวจสอบเอกสารต้นทางให้ถูกต้องก่อนยืนยัน':'ไม่มีใบเสนอราคาที่อนุมัติแล้วและยังไม่ออกใบกำกับภาษี'}</p><p data-tax-error role="alert" style="color:#b42318"></p><div class="form-actions"><button type="button" class="ghost" data-close>ยกเลิก</button><button class="primary" type="submit" ${available.length?'':'disabled'}>สร้างใบกำกับภาษี</button></div></div>`;
      root.querySelector('[data-close]').onclick=close;
    };
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||mode==='choice')return;
      try{
        status('');let quote;
        if(mode==='quote'){
          quote=candidates(quotes,links).find(q=>q.id===new FormData(form).get('quotationId'));
          if(!quote)throw Error('กรุณาเลือกใบเสนอราคาที่อนุมัติแล้ว');
          if(!confirm(`สร้างใบกำกับภาษีจาก ${quote.no} โดยใช้ลูกค้า รายการสินค้า และยอดเงินเดิม?`))return;
        }else if(!savedPayload){
          savedPayload=prepare(Object.fromEntries(new FormData(form)),editor.read(),customers,products,org,crypto.randomUUID());
          // Save the operation before sending: reopening/reloading this tab can safely retry.
          try{sessionStorage.setItem(storageKey,JSON.stringify(savedPayload));}catch{savedPayload=null;throw Error('ไม่สามารถเก็บรหัสป้องกันเอกสารซ้ำในเบราว์เซอร์ได้ จึงยังไม่ส่งบันทึก');}
        }
        lock(true);
        let result;
        try{result=quote?await window.QuotationTax.issue(request,org,quote):await issue(request,savedPayload);}
        catch(error){
          // A failed HTTP request can still have committed. Keep the same ID and payload.
          if(!quote){
            if(error.code==='22023'){
              sessionStorage.removeItem(storageKey);savedPayload=null;
              if(mode==='retry')manual();
            }else retryView();
          }
          throw error;
        }
        if(!quote){sessionStorage.removeItem(storageKey);savedPayload=null;}
        await finish(result);
      }catch(error){if(dialog.open)status(error.message);else alert(error.message);}
      finally{lock(false);}
    });
    if(recovery)retryView();else{
      root.innerHTML='<div class="form-content" style="padding:30px"><h2>สร้างใบกำกับภาษี</h2><p>เลือกวิธีสร้างเอกสาร</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin:24px 0"><button type="button" class="primary" data-manual>สร้างใหม่ — เลือกลูกค้าและสินค้าเอง</button><button type="button" class="ghost" data-quote>สร้างจากใบเสนอราคาที่อนุมัติแล้ว</button></div><p>การสร้างเอกสารไม่เปลี่ยนสถานะเป็นชำระเงินแล้ว</p><button type="button" class="ghost" data-close>ยกเลิก</button></div>';
      root.querySelector('[data-manual]').onclick=manual;root.querySelector('[data-quote]').onclick=fromQuote;root.querySelector('[data-close]').onclick=close;
    }
    dialog.showModal();
  };
  window.TaxInvoiceCreate={prepare,candidates,issue,open,numberExample};
})();
