(() => {
  let api, orgId, refresh;
  const pending=new Set();
  const remove=async(request,org,id)=>{
    if(!org||!id)throw Error('ข้อมูลลูกค้าไม่ครบ');
    const result=await request('/rest/v1/rpc/crm_delete_customer',{method:'POST',body:JSON.stringify({p_org:org,p_customer:id})});
    if(result?.deleted!==id)throw Error('ยืนยันผลการลบไม่ได้ กรุณาโหลดรายการใหม่ก่อนลองอีกครั้ง');
  };
  const buttons=()=>{
    document.querySelectorAll('[data-edit-customer]').forEach(edit=>{
      let button=edit.parentElement.querySelector('[data-delete-customer]');
      if(!button){button=document.createElement('button');button.type='button';button.className='ghost';button.dataset.deleteCustomer=edit.dataset.editCustomer;button.textContent='ลบ';button.style.cssText='color:#b42332;margin-left:6px';edit.after(button);}
      button.hidden=window.CRMAccess?.role!=='admin';
    });
  };
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-delete-customer]');if(!button)return;
    if(!api||!orgId||window.CRMAccess?.role!=='admin')return;
    const id=button.dataset.deleteCustomer,org=orgId;
    if(pending.has(id))return;
    const name=button.closest('tr')?.querySelector('strong')?.textContent||'';
    if(!confirm(`ลบลูกค้า “${name}” ถาวรหรือไม่?\nหากมีเอกสารอ้างอิง ระบบจะไม่อนุญาตให้ลบ`))return;
    pending.add(id);button.disabled=true;
    const page=document.querySelector('#customers');
    let notice=page.querySelector('[data-customer-delete-notice]');
    if(!notice){notice=document.createElement('p');notice.dataset.customerDeleteNotice='';notice.setAttribute('role','status');page.prepend(notice);}
    notice.textContent='กำลังลบลูกค้า…';
    try{
      await remove(api,org,id);notice.textContent='ลบลูกค้าแล้ว';
      try{await refresh();}catch{notice.textContent='ลบแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรช';}
    }catch(error){notice.textContent=error.message;}
    finally{pending.delete(id);button.disabled=false;}
  });
  new MutationObserver(buttons).observe(document.querySelector('#customer-body'),{childList:true,subtree:true});
  window.CustomerDelete={remove,configure(request,org,onSaved){api=request;orgId=org;refresh=onSaved;buttons();}};
})();
