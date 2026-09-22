(() => {
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const supported=kind=>['billing_note','tax_invoice'].includes(kind);
  const render=doc=>{
    if(doc.status==='cancelled')return '<span class="payment-cancelled">ยกเลิก</span>';
    const paid=doc.payment_received===true;
    return `<label class="payment-control" style="display:inline-flex;gap:8px;align-items:center;white-space:nowrap;cursor:pointer"><input type="checkbox" data-payment-id="${escape(doc.id)}" data-payment-kind="${escape(doc.kind)}" data-payment-status="${escape(doc.status)}" data-payment-value="${paid}" aria-label="ชำระเงินแล้ว ${escape(doc.document_number)}" ${paid?'checked':''} style="width:18px;height:18px;accent-color:#287864"><span data-payment-label style="color:${paid?'#287864':'#b45309'}">${paid?'ชำระเงินแล้ว':'ค้างจ่าย'}</span></label><small data-payment-message role="status" style="display:block;max-width:240px;white-space:normal"></small>`;
  };
  const pathFor=(org,id,kind)=>`/rest/v1/documents?organization_id=eq.${encodeURIComponent(org)}&id=eq.${encodeURIComponent(id)}&kind=eq.${encodeURIComponent(kind)}`;
  const valid=(rows,org,id,kind)=>Array.isArray(rows)&&rows.length===1&&rows[0].id===id&&rows[0].organization_id===org&&rows[0].kind===kind&&typeof rows[0].payment_received==='boolean';
  const save=async(request,org,id,kind,previous,paid)=>{
    if(!org||!id||!supported(kind)||typeof previous!=='boolean'||typeof paid!=='boolean')throw Error('ไม่พบเอกสารที่บันทึกสถานะได้');
    const path=pathFor(org,id,kind),select='id,organization_id,kind,status,payment_received';
    try{
      const rows=await request(`${path}&status=neq.cancelled&payment_received=eq.${previous}&select=${select}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payment_received:paid})});
      if(!valid(rows,org,id,kind)||rows[0].payment_received!==paid)throw Error('ข้อมูลอาจเปลี่ยนไป หรือบัญชีนี้ไม่มีสิทธิ์แก้ไข');
      return rows[0];
    }catch(error){
      // A response can be lost after saving. Read the authoritative value before restoring the checkbox.
      try{
        const rows=await request(`${path}&select=${select}&limit=1`);
        if(valid(rows,org,id,kind)){
          if(rows[0].payment_received===paid&&rows[0].status!=='cancelled')return rows[0];
          error.current=rows[0];
        }
      }catch{}
      throw error;
    }
  };
  const bind=(request,getOrg,isLoggedIn,login,onUpdated=()=>{})=>{
    const pending=new Set();
    document.addEventListener('change',async event=>{
      const control=event.target.closest('[data-payment-id]');if(!control)return;
      const previous=control.dataset.paymentValue==='true',paid=control.checked;
      if(!isLoggedIn()){control.checked=previous;login();return;}
      const org=getOrg(),id=control.dataset.paymentId,kind=control.dataset.paymentKind,key=`${org}:${id}`;
      if(pending.has(key)){control.checked=previous;return;}
      const cell=control.closest('td'),label=cell.querySelector('[data-payment-label]'),message=cell.querySelector('[data-payment-message]');
      pending.add(key);control.disabled=true;message.textContent='กำลังบันทึก…';
      const show=value=>{control.checked=value;control.dataset.paymentValue=String(value);label.textContent=value?'ชำระเงินแล้ว':'ค้างจ่าย';label.style.color=value?'#287864':'#b45309';};
      try{
        const saved=await save(request,org,id,kind,previous,paid);show(saved.payment_received);control.dataset.paymentStatus=saved.status;message.textContent='บันทึกแล้ว';control.disabled=false;onUpdated();
      }catch(error){
        if(error.current){show(error.current.payment_received);control.dataset.paymentStatus=error.current.status;control.disabled=error.current.status==='cancelled';if(control.disabled)label.textContent='ยกเลิก';message.textContent=`บันทึกไม่สำเร็จ: ${error.message}`;onUpdated();}
        else{control.checked=previous;label.textContent='ยังยืนยันสถานะไม่ได้';message.textContent='กรุณารีเฟรชหน้าเว็บเพื่อตรวจสถานะล่าสุด';}
      }finally{pending.delete(key);}
    });
  };
  window.DocumentPayment={render,save,bind};
})();
