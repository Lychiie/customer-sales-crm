(() => {
  const pending=new Set();
  const remove=async(request,org,doc,confirmation)=>{
    if(!org||!doc?.id||doc.organization_id!==org||doc.kind!=='tax_invoice')throw Error('ไม่พบใบกำกับภาษีขององค์กรนี้');
    if(confirmation!==doc.document_number)throw Error('กรุณาพิมพ์เลขที่เอกสารให้ตรงกัน');
    if(doc.payment_received===true)throw Error('ลบไม่ได้: เอกสารนี้ชำระเงินแล้ว');
    if(pending.has(doc.id))throw Error('กำลังดำเนินการลบ กรุณารอสักครู่');
    pending.add(doc.id);
    try{
      const result=await request('/rest/v1/rpc/delete_tax_invoice',{method:'POST',body:JSON.stringify({p_org:org,p_id:doc.id,p_number:confirmation})});
      if(result?.id!==doc.id||result?.document_number!==doc.document_number||result?.deleted!==true)throw Error('ยังยืนยันผลการลบไม่ได้ กรุณารีเฟรชรายการก่อนลองใหม่');
      return result;
    }catch(error){
      if(/Could not find the function|function .* does not exist/i.test(error.message))throw Error('ยังไม่ได้ติดตั้งระบบตรวจสอบการลบในฐานข้อมูล');
      throw error;
    }finally{pending.delete(doc.id);}
  };
  const ask=(request,org,doc,onDeleted)=>{
    if(document.querySelector('#tax-delete-dialog'))return;
    const dialog=document.createElement('dialog');dialog.id='tax-delete-dialog';dialog.style.cssText='width:min(520px,calc(100% - 32px));padding:26px;border:0;border-radius:14px';
    dialog.innerHTML='<h2>ยืนยันลบใบกำกับภาษี</h2><p data-number></p><p>ลบเอกสารและรายการสินค้าถาวร ไม่มีปุ่มกู้คืนในระบบ เลขเอกสารที่ลบจะไม่ถูกนำกลับมาใช้ใหม่</p><p>ไม่อนุญาตให้ลบเอกสารที่ชำระแล้ว มีรายการรับเงิน หรือเชื่อมกับใบวางบิล</p><label class="field"><span>พิมพ์เลขที่เอกสารเพื่อยืนยัน</span><input autocomplete="off" aria-label="เลขที่เอกสารยืนยันการลบ"></label><p role="alert" style="color:#b42332" data-error></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button type="button" class="primary" style="background:#b42332" data-confirm disabled>ลบถาวร</button></div>';
    dialog.querySelector('[data-number]').textContent=`${doc.document_number} • ${doc.customer_name_snapshot}`;
    const input=dialog.querySelector('input'),confirm=dialog.querySelector('[data-confirm]'),cancel=dialog.querySelector('[data-cancel]'),error=dialog.querySelector('[data-error]');let busy=false;
    const close=()=>{dialog.close();dialog.remove();};
    cancel.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)close();});
    input.oninput=()=>{confirm.disabled=input.value!==doc.document_number;};
    confirm.onclick=async()=>{
      if(busy||input.value!==doc.document_number)return;
      busy=true;input.disabled=confirm.disabled=cancel.disabled=true;error.textContent='';confirm.textContent='กำลังลบ…';
      try{await remove(request,org,doc,input.value);}catch(e){error.textContent=`${e.message} หากการเชื่อมต่อขัดข้อง ให้ปิดหน้าต่างและรีเฟรชเพื่อตรวจผลก่อนลองใหม่`;busy=false;input.disabled=cancel.disabled=false;confirm.textContent='ลบถาวร';confirm.disabled=true;input.value='';return;}
      close();
      try{await onDeleted();alert(`ลบใบกำกับภาษี ${doc.document_number} แล้ว (ลบถาวร ไม่สามารถกู้คืนจากระบบ)`);}catch(e){alert(`ลบ ${doc.document_number} สำเร็จ แต่รีเฟรชข้อมูลไม่สำเร็จ กรุณาโหลดหน้าใหม่`);}
    };
    document.body.append(dialog);dialog.showModal();input.focus();
  };
  const mount=(root,rows,request,org,onDeleted)=>{
    root.querySelectorAll('tbody tr').forEach((row,index)=>{
      const doc=rows[index];if(!doc)return;
      const button=document.createElement('button');button.type='button';button.className='ghost';button.textContent='ลบ';button.style.cssText='color:#b42332;margin-left:8px';button.setAttribute('aria-label',`ลบใบกำกับภาษี ${doc.document_number}`);
      button.disabled=doc.payment_received===true;if(button.disabled)button.title='ชำระเงินแล้ว ไม่สามารถลบได้';
      button.onclick=()=>ask(request,org,doc,onDeleted);row.children[1].append(button);
    });
  };
  window.TaxInvoiceDelete={remove,mount};
})();
