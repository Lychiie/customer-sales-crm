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
  const notify=(root,message)=>{
    let notice=root.querySelector('[data-tax-delete-status]');
    if(!notice){notice=document.createElement('p');notice.dataset.taxDeleteStatus='';notice.setAttribute('role','status');notice.style.cssText='padding:12px 0;color:#526173';root.prepend(notice);}
    notice.textContent=message;
  };
  const mount=(root,rows,request,org,onDeleted,{trash=false}={})=>{
    root.querySelectorAll('tbody tr').forEach((row,index)=>{
      const doc=rows[index];if(!doc||!row.lastElementChild)return;
      const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
      let busy=false;
      const run=async(name,label,confirm=false)=>{
        if(busy||pending.has(doc.id))return;
        if(confirm&&!window.confirm(`ลบ ${doc.document_number} ออกจากถังขยะถาวรหรือไม่? การลบนี้กู้คืนไม่ได้`))return;
        busy=true;actions.querySelectorAll('button').forEach(button=>button.disabled=true);
        notify(root,`กำลัง${label} ${doc.document_number}…`);
        let result;
        try{result=await rpc(request,name,org,doc);}
        catch(error){busy=false;actions.querySelectorAll('button').forEach(button=>button.disabled=false);notify(root,error.message);return;}
        // The write is confirmed. Never leave the old row available for a second deletion.
        row.remove();
        notify(root,`${label} ${doc.document_number} สำเร็จแล้ว`);
        try{await onDeleted(result);notify(root,`${label} ${doc.document_number} สำเร็จแล้ว`);}
        catch{notify(root,`${label} ${doc.document_number} สำเร็จแล้ว แต่รีเฟรชรายการไม่สำเร็จ กรุณากดรีเฟรชข้อมูล ไม่ต้องทำรายการซ้ำ`);}
      };
      if(trash){
        const restore=document.createElement('button');restore.type='button';restore.className='ghost';restore.textContent='กู้คืน';restore.setAttribute('aria-label',`กู้คืนใบกำกับภาษี ${doc.document_number}`);
        restore.onclick=()=>run('restore_tax_invoice','กู้คืน');
        const purge=document.createElement('button');purge.type='button';purge.className='ghost';purge.textContent='ลบถาวร';purge.style.color='#b42332';purge.onclick=()=>run('purge_tax_invoice','ลบถาวร',true);actions.append(restore,purge);
      }else{
        const button=document.createElement('button');button.type='button';button.className='ghost';button.textContent='ลบ';button.style.color='#b42332';button.setAttribute('aria-label',`ย้ายใบกำกับภาษี ${doc.document_number} ไปถังขยะ`);
        button.disabled=false;
        button.onclick=()=>run('delete_tax_invoice','ย้ายไปถังขยะ');actions.append(button);
      }
      row.lastElementChild.replaceChildren(actions);
    });
  };
  window.TaxInvoiceDelete={remove,mount};
})();
