(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canIssue = quote => Boolean(quote?.id && quote.statusCode === 'approved');
  const pending = new Map();
  const prepare = async (request, org, quote) => {
    if (!org || !canIssue(quote)) throw Error('ออกใบส่งสินค้าได้เฉพาะใบเสนอราคาที่อนุมัติแล้ว');
    const source = (await request(`/rest/v1/documents?organization_id=eq.${encodeURIComponent(org)}&id=eq.${encodeURIComponent(quote.id)}&kind=eq.quotation&select=*&limit=1`))[0];
    if (!source || source.id !== quote.id || source.organization_id !== org || source.kind !== 'quotation' || source.status !== 'approved') throw Error('ใบเสนอราคานี้ไม่พร้อมออกใบส่งสินค้า กรุณาโหลดรายการใหม่');
    const items = await request(`/rest/v1/document_items?document_id=eq.${encodeURIComponent(source.id)}&select=*&order=position.asc`);
    if (!items.length || items.some(i => i.document_id !== source.id || !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0)) throw Error('ไม่พบรายการสินค้าที่ถูกต้องในใบเสนอราคา');
    return {source, items};
  };
  const issue = (request, org, quote, data) => {
    if (!org || !canIssue(quote)) return Promise.reject(Error('ออกใบส่งสินค้าได้เฉพาะใบเสนอราคาที่อนุมัติแล้ว'));
    const key = `${org}:${quote.id}`;
    if (pending.has(key)) return pending.get(key);
    const operation = (async () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '') || !data.shipping?.trim()) throw Error('กรุณาระบุวันที่และสถานที่จัดส่ง');
      if (data.shipping.trim().length > 1500 || (data.notes || '').length > 1500) throw Error('สถานที่จัดส่งและหมายเหตุต้องไม่เกิน 1500 ตัวอักษร');
      let result;
      try {
        result = await request('/rest/v1/rpc/issue_quotation_delivery_note', {method:'POST', body:JSON.stringify({p_org:org,p_quote:quote.id,p_date:data.date,p_shipping:data.shipping.trim(),p_notes:(data.notes || '').trim()})});
      } catch (error) {
        if (/Could not find the function|function .* does not exist/i.test(error.message)) throw Error('ยังไม่ได้เปิดใช้การออกใบส่งสินค้าจากใบเสนอราคาในฐานข้อมูล');
        throw error;
      }
      if (!result?.id || !result.document_number || result.quotation_id !== quote.id || typeof result.created !== 'boolean') throw Error('ยังยืนยันผลบันทึกไม่ได้ กรุณาลองอีกครั้ง ระบบจะตรวจเอกสารเดิมเพื่อป้องกันออกซ้ำ');
      return result;
    })();
    pending.set(key, operation);
    operation.then(() => pending.delete(key), () => pending.delete(key));
    return operation;
  };
  const open = async (request, org, quote, onSaved) => {
    if (document.querySelector('#quotation-delivery-form')) return;
    const {source, items} = await prepare(request, org, quote);
    if (document.querySelector('#quotation-delivery-form')) return;
    const dialog = document.createElement('dialog');dialog.id='quotation-delivery-form';
    dialog.innerHTML=`<style>#quotation-delivery-form{width:min(820px,95vw);max-height:92vh;overflow:auto;border:0;border-radius:16px;padding:28px}#quotation-delivery-form::backdrop{background:#15203488}#quotation-delivery-form label{display:block;margin:16px 0}#quotation-delivery-form label span{display:block;margin-bottom:6px}#quotation-delivery-form input,#quotation-delivery-form textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}#quotation-delivery-form table{width:100%;min-width:0;border-collapse:collapse}#quotation-delivery-form th,#quotation-delivery-form td{padding:10px;border-bottom:1px solid #ddd;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}#quotation-delivery-form [role=status]{color:#b42318;white-space:pre-wrap}</style>
      <form><h2>ออกใบส่งสินค้า</h2><p>จากใบเสนอราคา <strong>${escape(source.document_number)}</strong></p><p>ลูกค้า: ${escape(source.customer_name_snapshot)}</p><p style="white-space:pre-wrap">${escape(window.DocumentAddress.format(source.customer_address_snapshot))}</p>
      <label><span>วันที่ส่งสินค้า</span><input name="date" type="date" required></label><label><span>สถานที่จัดส่ง</span><textarea name="shipping" rows="3" maxlength="1500" required placeholder="ชื่อสถานที่ / ที่อยู่ / จุดรับสินค้า"></textarea></label><button type="button" class="ghost" data-copy>ใช้ที่อยู่ลูกค้าเป็นสถานที่จัดส่ง</button>
      <h3>รายการจากใบเสนอราคา (${items.length} รายการ)</h3><p>คัดลอกรายการและจำนวนตามใบเสนอราคา ไม่แสดงราคาในใบส่งสินค้า หากเคยออกจากใบเสนอราคานี้แล้ว ระบบจะเปิดใบเดิม</p><table><thead><tr><th>ลำดับ</th><th>รายการสินค้า / ขนาด</th><th>จำนวน</th><th>หน่วย</th></tr></thead><tbody>${items.map((i,n)=>`<tr><td>${n+1}</td><td>${escape([i.product_name_snapshot,i.specification_snapshot].filter(Boolean).join(' '))}</td><td>${escape(i.quantity)}</td><td>${escape(i.unit_snapshot)}</td></tr>`).join('')}</tbody></table>
      <label><span>หมายเหตุใบส่งสินค้า</span><textarea name="notes" rows="2" maxlength="1500"></textarea></label><p role="status"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button type="submit" class="primary">บันทึกใบส่งสินค้า</button></div></form>`;
    const form=dialog.querySelector('form');let saving=false;
    form.elements.date.value=window.QuotationEditor.issueDate();
    dialog.querySelector('[data-copy]').onclick=()=>{form.elements.shipping.value=source.customer_address_snapshot || '';};
    dialog.querySelector('[data-cancel]').onclick=()=>{if(!saving)dialog.remove();};
    dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();else dialog.remove();});
    form.onsubmit=async event=>{
      event.preventDefault();if(saving || !form.reportValidity())return;
      saving=true;dialog.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);dialog.querySelector('[role=status]').textContent='กำลังบันทึก…';
      try{
        const result=await issue(request,org,quote,{date:form.elements.date.value,shipping:form.elements.shipping.value,notes:form.elements.notes.value});
        dialog.remove();
        try{await onSaved(result);}catch{alert(`บันทึกใบส่งสินค้า ${result.document_number} แล้ว แต่เปิดตัวอย่างไม่ได้ กรุณาเปิดจากเมนูใบส่งสินค้า`);}
      }catch(error){dialog.querySelector('[role=status]').textContent=error.message;}
      finally{saving=false;dialog.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false);}
    };
    document.body.append(dialog);dialog.showModal();
  };
  window.QuotationDelivery={canIssue,prepare,issue,open};
})();
