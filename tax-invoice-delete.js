(() => {
  const pending=new Set();
  const rpc=async(request,name,org,doc)=>{
    if(!org||!doc?.id||doc.organization_id!==org||doc.kind!=='tax_invoice')throw Error('ไม่พบใบกำกับภาษีขององค์กรนี้');
    if(pending.has(doc.id))throw Error('กำลังดำเนินการ กรุณารอสักครู่');
    pending.add(doc.id);
    try{
      const result=await request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify({p_org:org,p_id:doc.id,p_number:doc.document_number})});
      if(!result?.id||result.id!==doc.id)throw Error('ยังยืนยันผลการทำรายการไม่ได้ กรุณารีเฟรชรายการก่อนลองใหม่');
      return result;
    }catch(error){
      if(/Could not find the function|function .* does not exist/i.test(error.message))throw Error('ยังไม่ได้ติดตั้งระบบถังขยะในฐานข้อมูล');
      throw error;
    }finally{pending.delete(doc.id);}
  };
  const remove=async(request,org,doc)=>rpc(request,'delete_tax_invoice',org,doc);
  const confirmPurge=(request,org,doc,onDone)=>{if(!window.confirm(`ลบ ${doc.document_number} ออกจากถังขยะถาวรหรือไม่? การลบนี้กู้คืนไม่ได้`))return;rpc(request,'purge_tax_invoice',org,doc).then(onDone).catch(error=>alert(error.message));};
  const mount=(root,rows,request,org,onDeleted,{trash=false}={})=>{
    root.querySelectorAll('tbody tr').forEach((row,index)=>{
      const doc=rows[index];if(!doc||!row.lastElementChild)return;
      const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
      if(trash){
        const restore=document.createElement('button');restore.type='button';restore.className='ghost';restore.textContent='กู้คืน';restore.setAttribute('aria-label',`กู้คืนใบกำกับภาษี ${doc.document_number}`);
        restore.onclick=async()=>{restore.disabled=true;try{await rpc(request,'restore_tax_invoice',org,doc);await onDeleted();}catch(error){restore.disabled=false;alert(error.message);}};
        const purge=document.createElement('button');purge.type='button';purge.className='ghost';purge.textContent='ลบถาวร';purge.style.color='#b42332';purge.onclick=()=>confirmPurge(request,org,doc,onDeleted);actions.append(restore,purge);
      }else{
        const button=document.createElement('button');button.type='button';button.className='ghost';button.textContent='ลบ';button.style.color='#b42332';button.setAttribute('aria-label',`ย้ายใบกำกับภาษี ${doc.document_number} ไปถังขยะ`);
        button.disabled=false;
        button.onclick=async()=>{if(button.disabled)return;button.disabled=true;button.textContent='กำลังย้าย…';try{await remove(request,org,doc);await onDeleted();alert(`ย้ายใบกำกับภาษี ${doc.document_number} ไปถังขยะแล้ว`);}catch(error){button.disabled=false;button.textContent='ลบ';alert(error.message);}};actions.append(button);
      }
      row.lastElementChild.replaceChildren(actions);
    });
  };
  window.TaxInvoiceDelete={remove,mount};
})();
