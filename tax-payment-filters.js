(() => {
  const labels={all:'ทั้งหมด',paid:'ชำระเงินแล้ว',unpaid:'ค้างจ่าย'};
  const matches=(doc,key)=>key==='all'||(doc.status!=='cancelled'&&(key==='paid'?doc.payment_received===true:key==='unpaid'&&doc.payment_received===false));
  const select=(documents,selected='all')=>({
    counts:Object.fromEntries(Object.keys(labels).map(k=>[k,documents.filter(doc=>matches(doc,k)).length])),
    rows:documents.filter(doc=>matches(doc,selected))
  });
  let active='all',organization,controller;
  const mount=(root,org)=>{
    if(organization!==org){organization=org;active='all';}
    root.querySelector('[data-tax-payment-toolbar]')?.remove();
    const body=root.querySelector('tbody');if(!body)return;
    const rows=[...body.querySelectorAll('tr')].filter(row=>row.cells.length>1);
    [...body.querySelectorAll('tr')].filter(row=>row.cells.length===1).forEach(row=>row.remove());
    const toolbar=document.createElement('div');toolbar.dataset.taxPaymentToolbar='true';
    toolbar.style.cssText='padding:0 24px 18px';
    const tabs=document.createElement('div');tabs.className='tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','จำแนกใบกำกับภาษีตามการชำระเงิน');tabs.style.cssText='flex-wrap:wrap;gap:8px';
    const notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='margin:12px 0 0;color:#687587;font-size:13px';
    toolbar.append(tabs,notice);root.querySelector('table').before(toolbar);
    const choices=Object.keys(labels).map(key=>{
      const button=document.createElement('button');button.type='button';button.className='tab';button.dataset.taxPaymentFilter=key;
      tabs.append(button);return {key,button};
    });
    const empty=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=5;cell.style.cssText='text-align:center;padding:32px;color:#687587';empty.append(cell);body.append(empty);
    const apply=(updated=false)=>{
      // Use the last confirmed saved value, not an optimistic checkbox click.
      const records=rows.map(row=>{const input=row.querySelector('[data-payment-id]');return {row,status:input?.dataset.paymentStatus||'cancelled',payment_received:input?.dataset.paymentValue==='true'};});
      const result=select(records,active),visible=new Set(result.rows.map(doc=>doc.row));
      rows.forEach(row=>{row.hidden=!visible.has(row);});
      choices.forEach(({key,button})=>{const text=`${labels[key]} (${result.counts[key]})`;if(button.textContent!==text)button.textContent=text;button.classList.toggle('active',key===active);button.setAttribute('aria-current',String(key===active));});
      empty.hidden=result.rows.length>0;
      const message=active==='all'?'ยังไม่มีใบกำกับภาษี':`ไม่มีใบกำกับภาษีในหมวด “${labels[active]}”`;
      if(cell.textContent!==message)cell.textContent=message;
      const caption=`${updated?'อัปเดตสถานะแล้ว · ':''}แสดง ${result.rows.length} ใบ · แถบด้านบนใช้จำแนกข้อมูลเท่านั้น · เอกสารยกเลิกอยู่ในหมวดทั้งหมด`;
      if(notice.textContent!==caption)notice.textContent=caption;
    };
    choices.forEach(({key,button})=>button.addEventListener('click',()=>{active=key;apply();}));
    controller={apply};apply();return controller;
  };
  window.TaxPaymentFilters={select,mount,refresh:()=>controller?.apply(true)};
})();
