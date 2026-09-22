(() => {
  const labels={paid:'ชำระเงินแล้ว',unpaid:'ค้างจ่าย'};
  const matches=(doc,key)=>doc.status!=='cancelled'&&(key==='paid'?doc.payment_received===true:key==='unpaid'&&doc.payment_received===false);
  const select=(documents,selected=['paid','unpaid'])=>({
    counts:Object.fromEntries(Object.keys(labels).map(k=>[k,documents.filter(doc=>matches(doc,k)).length])),
    rows:documents.filter(doc=>selected.some(key=>matches(doc,key)))
  });
  let active=['paid','unpaid'],organization,controller;
  const mount=(root,org)=>{
    if(organization!==org){organization=org;active=['paid','unpaid'];}
    root.querySelector('[data-tax-payment-toolbar]')?.remove();
    const body=root.querySelector('tbody');if(!body)return;
    const rows=[...body.querySelectorAll('tr')].filter(row=>row.cells.length>1);
    [...body.querySelectorAll('tr')].filter(row=>row.cells.length===1).forEach(row=>row.remove());
    const toolbar=document.createElement('div');toolbar.dataset.taxPaymentToolbar='true';
    toolbar.style.cssText='padding:0 24px 18px';
    const tabs=document.createElement('div');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','เลือกหมวดใบกำกับภาษีที่ต้องการแสดง');tabs.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
    const notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='margin:12px 0 0;color:#687587;font-size:13px';
    toolbar.append(tabs,notice);root.querySelector('table').before(toolbar);
    const choices=Object.keys(labels).map(key=>{
      const label=document.createElement('label');label.style.cssText='display:inline-flex;gap:9px;align-items:center;padding:10px 16px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;background:#fff';
      const input=document.createElement('input');input.type='checkbox';input.dataset.taxPaymentFilter=key;input.setAttribute('aria-label',`แสดง${labels[key]}`);input.style.cssText='width:18px;height:18px;accent-color:#334564;margin:0';
      const caption=document.createElement('span');label.append(input,caption);tabs.append(label);return {key,input,caption};
    });
    const empty=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=5;cell.style.cssText='text-align:center;padding:32px;color:#687587';empty.append(cell);body.append(empty);
    const apply=(updated=false)=>{
      // Use the last confirmed saved value, not an optimistic checkbox click.
      const records=rows.map(row=>{const input=row.querySelector('[data-payment-id]');return {row,status:input?.dataset.paymentStatus||'cancelled',payment_received:input?.dataset.paymentValue==='true'};});
      const result=select(records,active),visible=new Set(result.rows.map(doc=>doc.row));
      rows.forEach(row=>{row.hidden=!visible.has(row);});
      choices.forEach(({key,input,caption})=>{const text=`${labels[key]} (${result.counts[key]})`;if(caption.textContent!==text)caption.textContent=text;input.checked=active.includes(key);});
      empty.hidden=result.rows.length>0;
      const message=!active.length?'กรุณาติ๊กหมวดที่ต้องการแสดง':active.length===2?'ยังไม่มีใบกำกับภาษีในสองหมวดนี้':`ไม่มีใบกำกับภาษีในหมวด “${labels[active[0]]}”`;
      if(cell.textContent!==message)cell.textContent=message;
      const caption=`${updated?'อัปเดตสถานะแล้ว · ':''}แสดง ${result.rows.length} ใบ · ติ๊กได้ทั้งสองหมวด · ไม่รวมเอกสารยกเลิก`;
      if(notice.textContent!==caption)notice.textContent=caption;
    };
    choices.forEach(({input})=>input.addEventListener('change',()=>{active=choices.filter(choice=>choice.input.checked).map(choice=>choice.key);apply();}));
    controller={apply};apply();return controller;
  };
  window.TaxPaymentFilters={select,mount,refresh:()=>controller?.apply(true)};
})();
