(() => {
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=v=>v?new Date(`${v}T00:00:00`).toLocaleDateString('th-TH'):'—';
  const issued=d=>!['draft','cancelled'].includes(d.status);
  const category=d=>d.status==='cancelled'?'cancelled':d.status==='draft'?'draft':d.payment_received===true?'paid':'unpaid';
  const labels={all:'ทั้งหมด',paid:'ชำระเงินแล้ว',unpaid:'ค้างจ่าย',cancelled:'ยกเลิก',draft:'ร่าง'};
  const select=(documents,{month='',search='',tab='all'}={})=>{
    const query=search.trim().toLocaleLowerCase('th-TH');
    const base=documents.filter(d=>d.kind==='tax_invoice'&&(!month||String(d.issue_date).startsWith(month))&&[d.document_number,d.customer_name_snapshot,d.customer_tax_id_snapshot].join(' ').toLocaleLowerCase('th-TH').includes(query));
    const counts={all:base.length,paid:0,unpaid:0,cancelled:0,draft:0},sum={total:0,paid:0,unpaid:0};
    for(const d of base){const key=category(d);counts[key]++;if(issued(d)){const cents=Math.round(Number(d.grand_total||0)*100);sum.total+=cents;sum[key]+=cents;}}
    const rows=base.filter(d=>tab==='all'||category(d)===tab).sort((a,b)=>String(b.issue_date).localeCompare(String(a.issue_date))||String(b.document_number).localeCompare(String(a.document_number))||String(b.id).localeCompare(String(a.id)));
    return {rows,counts,sum};
  };
  const fetchAll=async(request,org)=>{
    if(!org)throw Error('กรุณาเข้าสู่ระบบก่อน');
    const rows=[];let cursor='';
    for(;;){
      const batch=await request(`/rest/v1/documents?organization_id=eq.${encodeURIComponent(org)}&kind=eq.tax_invoice&select=id,organization_id,kind,document_number,customer_name_snapshot,customer_tax_id_snapshot,issue_date,due_date,grand_total,status,payment_received&order=id.asc&limit=500${cursor?`&id=gt.${encodeURIComponent(cursor)}`:''}`);
      if(!Array.isArray(batch))throw Error('ข้อมูลที่ได้รับไม่ถูกต้อง กรุณารีเฟรชอีกครั้ง');
      if(!batch.length)return rows;
      for(const row of batch){
        if(row.organization_id!==org||row.kind!=='tax_invoice'||!row.id||(cursor&&row.id<=cursor))throw Error('ไม่สามารถยืนยันรายการเอกสารทั้งหมดได้ กรุณาลองโหลดใหม่');
        rows.push(row);cursor=row.id;
      }
    }
  };
  let context,organization,generation=0,filters={month:'',search:'',tab:'all'},pageIndex=0;
  const pageSize=25;
  const page=()=>document.querySelector('#tax-invoice-control');
  const goBack=()=>{window.go('tax-invoices');history.replaceState(null,'','#tax-invoices');};
  const configure=async(request,org)=>{
    if(organization!==org){organization=org;generation++;filters={month:'',search:'',tab:'all'};pageIndex=0;page().innerHTML='<article class="panel settings-card"><p>กดรวมข้อมูลเพื่อโหลดรายการล่าสุด</p></article>';}
    context={request,org};if(page().classList.contains('active-page'))await load();
  };
  const load=async()=>{
    if(!context)return;
    const {request,org}=context,current=++generation,root=page();
    root.innerHTML='<article class="panel settings-card"><h3>ศูนย์ควบคุมใบกำกับภาษี</h3><p role="status">กำลังรวบรวมเอกสารทั้งหมด…</p><button class="ghost" data-back>กลับใบกำกับภาษี</button></article>';root.querySelector('[data-back]').onclick=goBack;
    try{
      const documents=await fetchAll(request,org);if(current!==generation)return;
      root.innerHTML=`<style>#tax-invoice-control .tic-tools{display:flex;gap:12px;flex-wrap:wrap;align-items:end}#tax-invoice-control .tic-field{display:grid;gap:6px;font-size:13px}#tax-invoice-control .tic-field input{font:inherit;padding:10px;border:1px solid #dbe2ec;border-radius:8px;min-width:190px}#tax-invoice-control .tic-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:20px 0}#tax-invoice-control .tic-card{padding:18px;border:1px solid #e1e7ee;border-radius:12px;background:white}#tax-invoice-control .tic-card small{display:block;color:#66758a;margin-bottom:8px}#tax-invoice-control .tic-card strong{display:block;font-size:23px;font-family:Manrope,'IBM Plex Sans Thai',sans-serif}#tax-invoice-control .tic-paid{background:#f0faf7;color:#15745c}#tax-invoice-control .tic-unpaid{background:#fff8ef;color:#a26612}#tax-invoice-control .tic-table{overflow-x:auto}#tax-invoice-control table{min-width:920px}#tax-invoice-control .tic-right{text-align:right;white-space:nowrap}#tax-invoice-control .tic-number{font-weight:600;white-space:nowrap}#tax-invoice-control .tic-footer{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}#tax-invoice-control .tabs{flex-wrap:wrap}#tax-invoice-control .tic-note{font-size:12px;color:#718096;margin:10px 0}@media(max-width:850px){#tax-invoice-control .tic-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){#tax-invoice-control .tic-cards{grid-template-columns:1fr}}</style>
        <div class="page-toolbar"><div><h2>ศูนย์ควบคุมใบกำกับภาษี</h2><p>รายการเอกสารทั้งหมด เชื่อมจากใบกำกับภาษีโดยตรง</p></div><div class="tic-tools"><button class="ghost" data-back>กลับใบกำกับภาษี</button><button class="primary" data-refresh>รีเฟรชข้อมูล</button></div></div>
        <article class="panel settings-card"><div class="tic-tools"><label class="tic-field"><span>เดือนตามวันที่เอกสาร</span><input type="month" data-month value="${escape(filters.month)}"></label><label class="tic-field"><span>ค้นหาเลขเอกสาร / ลูกค้า / เลขผู้เสียภาษี</span><input type="search" data-search value="${escape(filters.search)}" placeholder="ค้นหาใบกำกับภาษี"></label><button class="ghost" data-clear>ล้างตัวกรอง</button></div><div class="tic-cards" data-cards></div><p class="tic-note">ยอดรวมตามเดือนและคำค้น รวม VAT • ไม่รวมยอดเอกสารร่างและยกเลิก • ชำระแล้ว/ค้างจ่ายอิงช่องติ๊กสถานะ ไม่ใช่ยอดรับชำระบางส่วน</p><div class="tabs" role="group" aria-label="จำแนกเอกสารในหน้าควบคุม">${Object.entries(labels).map(([key,label])=>`<button type="button" class="tab" data-category="${key}">${label}</button>`).join('')}</div></article>
        <article class="panel table-panel" style="margin-top:16px"><div class="panel-title"><div><h3>ทะเบียนใบกำกับภาษี</h3><p data-summary role="status"></p></div></div><div class="tic-table"><table><thead><tr><th>ลำดับ</th><th>เลขที่เอกสาร</th><th>วันที่เอกสาร</th><th>ลูกค้า</th><th>ครบกำหนดชำระ</th><th class="tic-right">ยอดรวม (บาท)</th><th>สถานะ</th><th>เปิดเอกสาร</th></tr></thead><tbody></tbody></table></div><div class="tic-footer"><span data-paging></span><div class="tic-tools"><button class="ghost" data-prev>ก่อนหน้า</button><button class="ghost" data-next>ถัดไป</button></div></div></article><p class="tic-note">โหลดข้อมูลล่าสุด ${escape(new Date().toLocaleString('th-TH'))} • กดเลขเอกสารเพื่อดูฉบับเต็มหรือพิมพ์</p>`;
      const render=()=>{
        const result=select(documents,filters),pages=Math.max(1,Math.ceil(result.rows.length/pageSize));pageIndex=Math.min(pageIndex,pages-1);
        root.querySelector('[data-cards]').innerHTML=`<div class="tic-card"><small>เอกสารทั้งหมดตามตัวกรอง</small><strong>${result.counts.all} ใบ</strong></div><div class="tic-card"><small>ยอดรวมเอกสารที่ออก</small><strong>${money(result.sum.total/100)}</strong></div><div class="tic-card tic-paid"><small>ชำระเงินแล้ว ${result.counts.paid} ใบ</small><strong>${money(result.sum.paid/100)}</strong></div><div class="tic-card tic-unpaid"><small>ค้างจ่าย ${result.counts.unpaid} ใบ</small><strong>${money(result.sum.unpaid/100)}</strong></div>`;
        root.querySelectorAll('[data-category]').forEach(button=>{const key=button.dataset.category;button.textContent=`${labels[key]} (${result.counts[key]})`;button.classList.toggle('active',key===filters.tab);button.setAttribute('aria-current',String(key===filters.tab));});
        const rows=result.rows.slice(pageIndex*pageSize,(pageIndex+1)*pageSize);
        root.querySelector('tbody').innerHTML=rows.length?rows.map((d,i)=>`<tr><td>${pageIndex*pageSize+i+1}</td><td><button type="button" class="text-button tic-number" data-print-document="${escape(d.document_number)}" aria-label="เปิดใบกำกับภาษี ${escape(d.document_number)}">${escape(d.document_number)}</button></td><td>${escape(date(d.issue_date))}</td><td>${escape(d.customer_name_snapshot)}<small>${escape(d.customer_tax_id_snapshot||'')}</small></td><td>${escape(date(d.due_date||d.issue_date))}</td><td class="tic-right">${money(d.grand_total)}</td><td>${labels[category(d)]}</td><td><button type="button" class="ghost" data-print-document="${escape(d.document_number)}">ดู / พิมพ์ PDF</button></td></tr>`).join(''):'<tr><td colspan="8" style="text-align:center;padding:32px">ไม่พบเอกสารตามตัวกรองนี้</td></tr>';
        root.querySelector('[data-summary]').textContent=`${labels[filters.tab]} · ${result.rows.length} ใบที่ตรงตัวกรอง จากเอกสารทั้งหมด ${documents.length} ใบ`;
        root.querySelector('[data-paging]').textContent=`หน้า ${pageIndex+1} / ${pages} · แสดง ${rows.length} ใบต่อหน้านี้`;
        root.querySelector('[data-prev]').disabled=pageIndex===0;root.querySelector('[data-next]').disabled=pageIndex>=pages-1;
      };
      root.querySelector('[data-back]').onclick=goBack;root.querySelector('[data-refresh]').onclick=load;
      root.querySelector('[data-month]').onchange=e=>{filters.month=e.target.value;pageIndex=0;render();};
      root.querySelector('[data-search]').oninput=e=>{filters.search=e.target.value;pageIndex=0;render();};
      root.querySelector('[data-clear]').onclick=()=>{filters={month:'',search:'',tab:'all'};pageIndex=0;root.querySelector('[data-month]').value='';root.querySelector('[data-search]').value='';render();};
      root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{filters.tab=b.dataset.category;pageIndex=0;render();});
      root.querySelector('[data-prev]').onclick=()=>{pageIndex=Math.max(0,pageIndex-1);render();};root.querySelector('[data-next]').onclick=()=>{pageIndex++;render();};render();
    }catch(error){if(current!==generation)return;root.innerHTML=`<article class="panel settings-card"><h3>ศูนย์ควบคุมใบกำกับภาษี</h3><p role="alert">โหลดข้อมูลไม่สำเร็จ: ${escape(error.message)}</p><button class="ghost" data-retry>ลองใหม่</button> <button class="ghost" data-back>กลับใบกำกับภาษี</button></article>`;root.querySelector('[data-retry]').onclick=load;root.querySelector('[data-back]').onclick=goBack;}
  };
  const open=async(request,org)=>{const active=page().classList.contains('active-page');await configure(request,org);window.go('tax-invoice-control');history.replaceState(null,'','#tax-invoice-control');if(!active)await load();};
  const invalidate=()=>{if(context&&page()?.classList.contains('active-page'))return load();};
  window.TaxInvoiceControl={select,fetchAll,configure,open,invalidate};
})();
