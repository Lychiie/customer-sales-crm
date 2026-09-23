(() => {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => Number(value || 0).toLocaleString('th-TH', {minimumFractionDigits:2,maximumFractionDigits:2});
  for (const [id,title,message] of [
    ['purchase-tax','ภาษีซื้อ','หน้านี้สำหรับใบกำกับภาษีจากผู้ขาย ยังไม่ได้เปิดระบบบันทึกภาษีซื้อ และไม่ดึงข้อมูลจากเอกสารขาย'],
    ['sales-tax','ภาษีขาย','เข้าสู่ระบบเพื่อดูข้อมูลที่เชื่อมจากใบกำกับภาษี']
  ]) {
    pageMeta[id]=['คลังข้อมูล',title];
    const page=document.createElement('section');page.id=id;page.className='page';
    page.innerHTML=`<article class="panel settings-card"><h3>${title}</h3><p>${message}</p></article>`;
    document.querySelector('#settings').before(page);
  }
  let month='', search='', generation=0;
  const selectRows=(rows,month,search)=>rows.filter(r=>r.kind==='tax_invoice' && !r.deleted_at && !['draft','cancelled'].includes(r.status) && (!month || String(r.issue_date).startsWith(month)) && [r.document_number,r.customer_name_snapshot,r.customer_tax_id_snapshot].join(' ').toLowerCase().includes(search.toLowerCase()));
  const totals=rows=>rows.reduce((t,r)=>({base:t.base+Math.round(Number(r.taxable_amount||0)*100),vat:t.vat+Math.round(Number(r.vat_amount||0)*100),total:t.total+Math.round(Number(r.grand_total||0)*100)}),{base:0,vat:0,total:0});
  const load=async(request,orgId)=>{
    const current=++generation,page=document.querySelector('#sales-tax');
    page.innerHTML='<article class="panel settings-card"><h3>ภาษีขาย</h3><p role="status">กำลังโหลดใบกำกับภาษี…</p></article>';
    try{
      // Read the source invoices, never maintain a duplicate tax ledger.
      const rows=await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.tax_invoice&select=id,kind,document_number,customer_name_snapshot,customer_tax_id_snapshot,issue_date,taxable_amount,vat_amount,grand_total,status,deleted_at&order=issue_date.desc,document_number.desc`);
      if(current!==generation)return;
      page.innerHTML=`<div class="page-toolbar"><h2>ภาษีขาย</h2><button class="ghost" data-refresh>รีเฟรชข้อมูล</button></div><article class="panel settings-card"><p>เชื่อมจากใบกำกับภาษีโดยตรง ไม่ต้องบันทึกซ้ำ • ไม่รวมเอกสารร่างและยกเลิก</p><div style="display:flex;gap:16px;flex-wrap:wrap;align-items:end"><label class="field"><span>เดือนตามวันที่ใบกำกับภาษี</span><input type="month" data-month value="${e(month)}"></label><label class="field"><span>ค้นหาเลขที่เอกสาร / ลูกค้า / เลขผู้เสียภาษี</span><input type="search" data-search value="${e(search)}"></label><button class="ghost" data-all>แสดงทุกเดือน</button></div><p data-summary role="status"></p></article><article class="panel table-panel" style="overflow-x:auto;margin-top:16px"><table><thead><tr><th>วันที่</th><th>เลขที่ใบกำกับภาษี</th><th>ลูกค้า</th><th>เลขผู้เสียภาษี</th><th>มูลค่าก่อน VAT</th><th>ภาษีขาย (VAT)</th><th>ยอดรวม</th><th>เอกสารต้นทาง</th></tr></thead><tbody></tbody><tfoot></tfoot></table></article>`;
      const render=()=>{
        const filtered=selectRows(rows,month,search),sum=totals(filtered);
        page.querySelector('[data-summary]').textContent=`${month ? 'เดือน '+month : 'ทุกเดือน'} · ${filtered.length} เอกสาร · ภาษีขาย ${money(sum.vat/100)} บาท`;
        page.querySelector('tbody').innerHTML=filtered.length?filtered.map(r=>`<tr><td>${e(r.issue_date ? new Date(r.issue_date+'T00:00:00').toLocaleDateString('th-TH') : '-')}</td><td>${e(r.document_number)}</td><td>${e(r.customer_name_snapshot)}</td><td>${e(r.customer_tax_id_snapshot || '-')}</td><td>${money(r.taxable_amount)}</td><td>${money(r.vat_amount)}</td><td>${money(r.grand_total)}</td><td><button class="ghost" data-print-document="${e(r.document_number)}">ดูใบกำกับภาษี</button></td></tr>`).join(''):'<tr><td colspan="8">ไม่พบใบกำกับภาษีตามเงื่อนไขที่เลือก</td></tr>';
        page.querySelector('tfoot').innerHTML=`<tr><th colspan="4">รวมรายการที่แสดง</th><th>${money(sum.base/100)}</th><th>${money(sum.vat/100)}</th><th>${money(sum.total/100)}</th><th></th></tr>`;
      };
      page.querySelector('[data-month]').onchange=event=>{month=event.target.value;render();};
      page.querySelector('[data-search]').oninput=event=>{search=event.target.value;render();};
      page.querySelector('[data-all]').onclick=()=>{month='';page.querySelector('[data-month]').value='';render();};
      page.querySelector('[data-refresh]').onclick=()=>load(request,orgId);render();
    }catch(error){if(current!==generation)return;page.innerHTML=`<article class="panel settings-card"><h3>ภาษีขาย</h3><p role="alert">โหลดข้อมูลไม่สำเร็จ: ${e(error.message)}</p><button class="ghost">ลองใหม่</button></article>`;page.querySelector('button').onclick=()=>load(request,orgId);}
  };
  window.TaxRegisters={load,selectRows,totals};
})();
