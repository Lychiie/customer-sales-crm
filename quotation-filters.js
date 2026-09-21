(() => {
  const labels={all:'ทั้งหมด',sent:'รออนุมัติ',approved:'อนุมัติแล้ว'};
  const statusOf=quote=>{const status=quote.statusCode||({'ร่าง':'draft','รออนุมัติ':'sent','อนุมัติแล้ว':'approved','ยกเลิก':'cancelled'}[quote.status])||quote.status;return status==='draft'?'sent':status;};
  const select=(quotes,status='all',query='')=>{
    const term=String(query).trim().toLocaleLowerCase('th-TH');
    const counts={all:quotes.length,sent:0,approved:0};
    quotes.forEach(q=>{const key=statusOf(q);if(key!=='all'&&Object.hasOwn(counts,key))counts[key]++;});
    const rows=quotes.filter(q=>(status==='all'||statusOf(q)===status)&&(!term||[q.no,q.customer].some(value=>String(value??'').toLocaleLowerCase('th-TH').includes(term))));
    return {counts,rows};
  };
  const mount=(root,getQuotes)=>{
    let current='all';
    const tabs=[...root.querySelectorAll('.tabs .tab')],search=root.querySelector('.search input'),body=root.querySelector('#quotation-body');
    // Rebuild the existing toolbar, including when older HTML still has a draft tab.
    tabs.forEach(tab=>tab.remove());
    tabs.length=0;
    const toolbar=root.querySelector('.tabs');
    Object.keys(labels).forEach(key=>{const tab=document.createElement('button');tab.className='tab';tab.dataset.quotationFilter=key;tab.type='button';toolbar.append(tab);tabs.push(tab);});
    search.setAttribute('aria-label','ค้นหาใบเสนอราคาด้วยเลขที่เอกสารหรือชื่อลูกค้า');
    search.placeholder='ค้นหาเลขที่เอกสาร / ลูกค้า';
    const apply=()=>{
      const {counts,rows}=select(getQuotes(),current,search.value);
      tabs.forEach(tab=>{
        const key=tab.dataset.quotationFilter;
        const caption=`${labels[key]} (${counts[key]})`;
        if(tab.textContent!==caption)tab.textContent=caption;
        tab.classList.toggle('active',key===current);
        tab.setAttribute('aria-pressed',String(key===current));
      });
      const visible=new Set(rows.map(q=>q.no));
      [...body.querySelectorAll('tr')].forEach(row=>{
        if(row.dataset.quotationEmpty)return;
        row.hidden=!visible.has(row.cells[0]?.textContent.trim());
      });
      let empty=body.querySelector('[data-quotation-empty]');
      if(!rows.length){
        if(!empty){empty=document.createElement('tr');empty.dataset.quotationEmpty='true';const cell=document.createElement('td');cell.colSpan=7;cell.style.cssText='text-align:center;padding:32px;color:#687587';cell.setAttribute('role','status');empty.append(cell);body.append(empty);}
        empty.cells[0].textContent=search.value.trim()?'ไม่พบใบเสนอราคาที่ตรงกับคำค้นในกลุ่มนี้':current==='all'?'ยังไม่มีใบเสนอราคา':`ไม่มีใบเสนอราคาสถานะ “${labels[current]}”`;
      }else empty?.remove();
    };
    tabs.forEach(tab=>tab.addEventListener('click',()=>{current=tab.dataset.quotationFilter;apply();}));
    search.addEventListener('input',apply);
    return {apply};
  };
  window.QuotationFilters={select,statusOf,mount};
  const root=document.querySelector('#quotations');
  if(root){
    const controller=mount(root,()=>state.quotations);
    const originalRender=window.render;
    window.render=function(...args){const result=originalRender.apply(this,args);controller.apply();return result;};
    controller.apply();
  }
})();
