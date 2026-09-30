(() => {
  const normalize=value=>{
    const number=String(value??'').trim().toUpperCase();
    if(number&&!/^[A-Z0-9][A-Z0-9._/-]{0,79}$/.test(number))throw Error('เลขที่เอกสารใช้ A–Z, 0–9 และ . _ / - ได้ ไม่เกิน 80 ตัวอักษร');
    return number;
  };
  const mount=root=>{
    if(root.querySelector('[name=manualDocumentNumber]'))return;
    const label=document.createElement('label');label.className='field';
    label.innerHTML='<span>เลขที่เอกสาร (กรอกเองได้)</span><input name="manualDocumentNumber" maxlength="80" placeholder="เว้นว่างเพื่อรันเลขอัตโนมัติ" autocomplete="off" style="width:100%;padding:10px;border:1px solid #ccd4dd;border-radius:6px;font:inherit"><small>ใช้ A–Z, 0–9 และ . _ / - • ห้ามซ้ำรวมถังขยะ • ใช้เลขเดิมได้หลังลบถาวร</small>';
    const grid=root.querySelector('.qe-grid');if(grid)grid.prepend(label);else root.querySelector('h2').after(label);
  };
  const read=root=>normalize(root.querySelector('[name=manualDocumentNumber]')?.value);
  const call=(request,action,payload,number)=>{
    number=normalize(number);
    return number?request('/rest/v1/rpc/crm_create_numbered_document',{method:'POST',body:JSON.stringify({p_action:action,p_payload:payload,p_number:number})}):request(`/rest/v1/rpc/${action}`,{method:'POST',body:JSON.stringify(payload)});
  };
  window.DocumentNumber={normalize,mount,read,call};
})();
