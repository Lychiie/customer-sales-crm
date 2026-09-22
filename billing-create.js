(() => {
  const create=async(request,org,invoice,date,credit)=>{
    if(!org||invoice?.organization_id!==org||!invoice.id||invoice.kind!=='tax_invoice'||!['sent','approved','paid','overdue'].includes(invoice.status))throw Error('กรุณาเลือกใบกำกับภาษีที่ออกแล้ว');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(credit)||credit<0||credit>3650)throw Error('กรุณาระบุวันที่และเครดิต 0–3650 วัน');
    const result=await request('/rest/v1/rpc/create_invoice_billing_note',{method:'POST',body:JSON.stringify({p_org:org,p_invoice:invoice.id,p_date:date,p_credit:credit})});
    if(!result?.id||result.invoice_id!==invoice.id||!result.document_number)throw Error('ยังยืนยันผลไม่ได้ กรุณาลองตรวจสอบอีกครั้ง ระบบจะใช้ใบวางบิลเดิมโดยไม่สร้างซ้ำ');
    return result;
  };
  const ask=(request,org,invoice,onSaved)=>{
    if(document.querySelector('#billing-create-dialog'))return;
    const dialog=document.createElement('dialog');dialog.id='billing-create-dialog';dialog.style.cssText='width:min(520px,calc(100% - 32px));padding:26px;border:0;border-radius:14px';
    dialog.innerHTML='<form><h2>ออกใบวางบิล</h2><p data-source></p><p>เชื่อมใบกำกับภาษีนี้ 1 ใบ และใช้ยอดเงินจากเอกสารต้นทาง</p><label class="field"><span>วันที่ใบวางบิล</span><input name="date" type="date" required></label><label class="field"><span>เครดิต (วัน) — 0 คือชำระทันที</span><input name="credit" type="number" min="0" max="3650" step="1" required placeholder="ระบุจำนวนวัน"></label><p role="alert" data-error></p><div class="form-actions"><button class="ghost" type="button" data-cancel>ยกเลิก</button><button class="primary" type="submit">ยืนยันออกใบวางบิล</button></div></form>';
    dialog.querySelector('[data-source]').textContent=`${invoice.document_number} • ${invoice.customer_name_snapshot}`;
    const form=dialog.querySelector('form'),cancel=dialog.querySelector('[data-cancel]'),submit=dialog.querySelector('[type=submit]'),error=dialog.querySelector('[data-error]');
    form.elements.date.value=window.QuotationEditor.issueDate();let busy=false;
    const close=()=>{dialog.close();dialog.remove();};cancel.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();if(!busy)close();});
    form.onsubmit=async e=>{
      e.preventDefault();if(busy||!form.reportValidity())return;busy=true;cancel.disabled=submit.disabled=true;error.textContent='';submit.textContent='กำลังออกใบวางบิล…';
      try{
        const result=await create(request,org,invoice,form.elements.date.value,Number(form.elements.credit.value));
        close();try{await onSaved?.();}catch{}
        const button=document.createElement('button');button.dataset.printDocument=result.document_number;document.body.append(button);button.click();button.remove();
        alert(`${result.created?'ออกใบวางบิลแล้ว':'ใบกำกับภาษีนี้มีใบวางบิลอยู่แล้ว'}: ${result.document_number}`);
      }catch(e){error.textContent=e.message;busy=false;cancel.disabled=submit.disabled=false;submit.textContent='ตรวจสอบ / ออกใบวางบิล';}
    };
    document.body.append(dialog);dialog.showModal();
  };
  const mount=(root,rows,request,org,onSaved)=>{
    root.querySelector('[data-billing-column]')?.remove();
    const header=document.createElement('th');header.dataset.billingColumn='';header.textContent='ใบวางบิล';root.querySelector('thead tr').insertBefore(header,root.querySelector('thead tr').children[6]);
    root.querySelectorAll('tbody tr').forEach((row,i)=>{
      const invoice=rows[i];if(!invoice){row.firstElementChild.colSpan=9;return;}
      const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='ghost';button.textContent='ออกใบวางบิล';button.style.whiteSpace='nowrap';
      button.disabled=!['sent','approved','paid','overdue'].includes(invoice.status);if(button.disabled)button.title='ใช้ได้เฉพาะใบกำกับภาษีที่ออกแล้ว';
      button.onclick=()=>ask(request,org,invoice,onSaved);cell.append(button);row.insertBefore(cell,row.children[6]);
    });
  };
  window.BillingCreate={create,mount};
})();
