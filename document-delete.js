(() => {
  const pages={'invoices':'billing_note','cash-bills':'cash_bill','delivery-notes':'delivery_note','tax-invoices':'tax_invoice'};
  const names={billing_note:'ใบวางบิล',cash_bill:'บิลเงินสด',delivery_note:'ใบส่งของ',tax_invoice:'ใบกำกับภาษี'};
  let api,organizationId,refresh;
  const pending=new Set();
  const remove=async(request,org,kind,number)=>{
    if(!org||!names[kind]||!number)throw Error('ไม่พบเอกสารที่ต้องการลบ');
    const table=kind==='delivery_note'?'delivery_notes':'documents';
    const rows=await request(`/rest/v1/${table}?organization_id=eq.${encodeURIComponent(org)}&document_number=eq.${encodeURIComponent(number)}${table==='documents'?`&kind=eq.${kind}`:''}&select=id,document_number&limit=2`);
    if(rows.length!==1||rows[0].document_number!==number)throw Error('ไม่พบเอกสาร กรุณาโหลดรายการใหม่');
    const doc=rows[0];
    const result=await request(`/rest/v1/rpc/${kind==='tax_invoice'?'delete_tax_invoice':'delete_sales_document'}`,{method:'POST',body:JSON.stringify({p_org:org,p_id:doc.id,p_number:number,...(kind==='tax_invoice'?{}:{p_kind:kind})})});
    if(result?.id!==doc.id||result?.deleted!==true)throw Error('ยังยืนยันการลบไม่ได้ กรุณาโหลดรายการใหม่');
    return result;
  };
  const notice=(page,message)=>{
    let node=page.querySelector('[data-document-delete-status]');
    if(!node){node=document.createElement('p');node.dataset.documentDeleteStatus='';node.setAttribute('role','status');page.prepend(node);}
    node.textContent=message;
  };
  const mount=()=>{
    if(!api||!organizationId)return;
    for(const [id,kind] of Object.entries(pages)){
      const page=document.getElementById(id);if(!page)continue;
      // Only real saved rows have a view/print control. Empty-state rows are skipped.
      page.querySelectorAll(id==='invoices'?'article:first-of-type table tbody tr':'tbody tr').forEach(row=>{
        if(!row.querySelector('[data-print-document],[data-view]')||row.querySelector('[data-delete-sales-document]'))return;
        const number=row.cells[0]?.textContent.trim();if(!number)return;
        const button=document.createElement('button');button.type='button';button.className='ghost';button.style.color='#b42332';button.textContent='ลบ';
        button.dataset.deleteSalesDocument=kind;button.setAttribute('aria-label',`ลบ${names[kind]} ${number}`);
        row.lastElementChild.append(button);
        button.onclick=async()=>{
          const actionOrg=organizationId,key=`${actionOrg}:${kind}:${number}`;
          if(pending.has(key))return;
          const trash=kind==='tax_invoice';
          if(!trash&&!window.confirm(`ลบ${names[kind]} ${number} ถาวรหรือไม่?\nกู้คืนไม่ได้ แต่เอกสารอื่นที่เชื่อมกันจะยังคงอยู่`))return;
          pending.add(key);const controls=[...row.querySelectorAll('button,input')],disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
          notice(page,`กำลัง${trash?'ย้ายไปถังขยะ':'ลบ'} ${number}…`);
          try{await remove(api,actionOrg,kind,number);}
          catch(error){notice(page,error.message);controls.forEach((c,i)=>c.disabled=disabled[i]);pending.delete(key);return;}
          row.remove();const message=`${trash?'ย้ายไปถังขยะ':'ลบ'} ${number} แล้ว`;
          notice(page,message);
          try{if(organizationId===actionOrg)await refresh(kind);notice(page,message);}
          catch{notice(page,`${message} แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรช ไม่ต้องลบซ้ำ`);}
          finally{pending.delete(key);}
        };
      });
    }
  };
  new MutationObserver(mount).observe(document.querySelector('main'),{childList:true,subtree:true});
  window.DocumentDelete={remove,configure(request,org,onDeleted){api=request;organizationId=org;refresh=onDeleted;mount();}};
})();
