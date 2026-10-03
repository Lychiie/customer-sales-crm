(() => {
  let api,orgId,onSaved,opening=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const payload=data=>{
    const name=String(data.name||'').trim(),tax=String(data.taxId||'').trim(),days=Number(data.creditDays);
    if(!name)throw Error('กรุณาระบุชื่อบริษัท / ลูกค้า');
    if(tax&&!/^\d{13}$/.test(tax))throw Error('เลขผู้เสียภาษีต้องมี 13 หลัก หรือเว้นว่าง');
    if(String(data.creditDays??'').trim()===''||!Number.isSafeInteger(days)||days<0||days>3650)throw Error('กรุณาระบุเครดิต 0–3650 วัน (0 = เงินสด)');
    const text=key=>String(data[key]??'').trim()||null;
    return {office_code:window.OfficeBranch.read(data),office_name:window.OfficeBranch.readName(data),name,contact_name:text('contact'),tax_id:tax||null,phone:text('phone'),billing_address:text('address'),credit_term_days:days};
  };
  const update=async(request,org,customer,data)=>{
    if(!org||!customer?.id||customer.organization_id!==org||!customer.updated_at)throw Error('ข้อมูลลูกค้าไม่ครบ กรุณาเปิดรายการใหม่');
    const body=payload(data);
    const rows=await request(`/rest/v1/customers?id=eq.${encodeURIComponent(customer.id)}&organization_id=eq.${encodeURIComponent(org)}&updated_at=eq.${encodeURIComponent(customer.updated_at)}&select=id,organization_id`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
    if(rows?.length!==1||rows[0].id!==customer.id||rows[0].organization_id!==org)throw Error('ข้อมูลอาจถูกแก้ไขจากหน้าอื่น หรือไม่มีสิทธิ์บันทึก กรุณาปิดแล้วเปิดใหม่');
    return rows[0];
  };
  const notice=message=>{const page=document.querySelector('#customers');let p=page.querySelector('[data-customer-edit-notice]');if(!p){p=document.createElement('p');p.dataset.customerEditNotice='';p.setAttribute('role','status');page.prepend(p);}p.textContent=message;};
  const open=async id=>{
    if(opening||document.querySelector('#customer-edit-dialog'))return;
    if(!api||!orgId){notice('กรุณาเข้าสู่ระบบและรอโหลดข้อมูลลูกค้า');return;}
    opening=true;const org=orgId;
    try{
      const rows=await api(`/rest/v1/customers?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(org)}&select=*&limit=1`);
      const customer=rows[0];if(!customer||customer.id!==id||customer.organization_id!==org)throw Error('ไม่พบลูกค้าขององค์กรนี้ กรุณาโหลดรายการใหม่');
      const dialog=document.createElement('dialog');dialog.id='customer-edit-dialog';dialog.setAttribute('aria-labelledby','customer-edit-title');
      dialog.style.cssText='width:min(620px,94vw);max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:24px';
      const field=(label,name,value,attrs='')=>`<label class="field" style="display:block;margin:14px 0"><span style="display:block;margin-bottom:6px">${label}</span><input style="width:100%;padding:10px;border:1px solid #dfe3ea;border-radius:8px;font:inherit" name="${name}" value="${esc(value)}" ${attrs}></label>`;
      dialog.innerHTML=`<form><h2 id="customer-edit-title">แก้ไขข้อมูลลูกค้า</h2><p>ใช้กับเอกสารที่สร้างใหม่ เอกสารเดิมจะคงข้อมูล ณ วันที่ออกเอกสาร</p>${field('ชื่อบริษัท / ลูกค้า *','name',customer.name,'required maxlength="300"')}${field('ผู้ติดต่อ','contact',customer.contact_name,'maxlength="200"')}${field('เลขประจำตัวผู้เสียภาษี','taxId',customer.tax_id,'inputmode="numeric" maxlength="13"')}${field('โทรศัพท์','phone',customer.phone,'type="tel" maxlength="60"')}<label class="field" style="display:block;margin:14px 0"><span style="display:block;margin-bottom:6px">ที่อยู่สำหรับออกเอกสาร</span><textarea name="address" rows="3" maxlength="2000" style="width:100%;padding:10px;border:1px solid #dfe3ea;border-radius:8px;font:inherit">${esc(customer.billing_address)}</textarea></label>${field('เงื่อนไขชำระเงิน — เครดิต (วัน), 0 = เงินสด','creditDays',customer.credit_term_days??0,'type="number" min="0" max="3650" step="1" required')}<p role="status" data-error style="color:#b42332"></p><div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button type="submit" class="primary">บันทึกการแก้ไข</button></div></form>`;
      window.OfficeBranch.mount(dialog.querySelector('form'),customer.office_code,{name:customer.office_name,before:dialog.querySelector('[data-error]')});
      let saving=false;const close=()=>{if(!saving)dialog.remove();};dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
      dialog.querySelector('form').onsubmit=async event=>{
        event.preventDefault();if(saving)return;const form=event.currentTarget,error=dialog.querySelector('[data-error]');
        const data=Object.fromEntries(new FormData(form));try{payload(data);}catch(e){error.textContent=e.message;return;}
        saving=true;const controls=[...form.querySelectorAll('input,select,textarea,button')];controls.forEach(c=>c.disabled=true);error.textContent='กำลังบันทึก…';
        try{if(org!==orgId)throw Error('องค์กรเปลี่ยน กรุณาเปิดรายการใหม่');await update(api,org,customer,data);}
        catch(e){saving=false;controls.forEach(c=>c.disabled=false);error.textContent=e.message;return;}
        dialog.remove();notice('บันทึกข้อมูลลูกค้าแล้ว');
        try{await onSaved();}catch{notice('บันทึกข้อมูลลูกค้าแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรช ไม่ต้องบันทึกซ้ำ');}
      };
      document.body.append(dialog);dialog.showModal();dialog.querySelector('input').focus();
    }catch(e){notice(e.message);}finally{opening=false;}
  };
  document.addEventListener('click',event=>{const button=event.target.closest('[data-edit-customer]');if(button)open(button.dataset.editCustomer);});
  window.CustomerEdit={payload,update,open,configure(request,org,refresh){api=request;orgId=org;onSaved=refresh;}};
})();
