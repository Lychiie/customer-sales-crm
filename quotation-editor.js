// Quotation fields use a versioned, readable envelope in the existing notes column.
// Older notes remain plain text. No schema change or historical data rewrite is needed.
(() => {
  const prefix = '[รายละเอียดใบเสนอราคา v1]\n';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = n => Number(n).toLocaleString('th-TH', {minimumFractionDigits:2,maximumFractionDigits:2});
  const issueDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const numberExample = date => `QT${String(Number(date.slice(0,4))+543).slice(-2)}-0001`;
  const encode = ({paymentTerms='',deliveryTerms='',notes='',rates=[]}) => prefix + JSON.stringify({paymentTerms,deliveryTerms,notes,rates});
  const decode = value => {
    const raw = String(value ?? '');
    if (raw.startsWith(prefix)) try {
      const v = JSON.parse(raw.slice(prefix.length));
      if (typeof v.paymentTerms==='string' && typeof v.deliveryTerms==='string' && typeof v.notes==='string' && Array.isArray(v.rates)) return v;
    } catch {}
    return {paymentTerms:'',deliveryTerms:'',notes:raw,rates:[]};
  };
  const calculate = (rows, products, vatRate=7) => {
    if (!rows.length) throw Error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
    const items = rows.map((row,index) => {
      const product = products.find(p => p.id === row.variantId);
      if (!product) throw Error(`กรุณาเลือกสินค้าในรายการที่ ${index+1}`);
      const quantity=Number(row.quantity), price=Number(row.unitPrice), rate=Number(row.discountRate);
      if ([row.quantity,row.unitPrice,row.discountRate].some(v=>String(v??'').trim()==='') || ![quantity,price,rate].every(Number.isFinite) || quantity<=0 || price<0 || rate<0 || rate>100) throw Error(`ตรวจจำนวน ราคา และส่วนลด 0–100% ในรายการที่ ${index+1}`);
      const gross=round(quantity*price), discount=round(gross*rate/100);
      if (!Number.isFinite(gross) || gross>=1e12) throw Error('ยอดรายการสินค้าเกินขอบเขตที่รองรับ');
      return {position:index+1,product_variant_id:product.id,sku_snapshot:product.sku,product_name_snapshot:product.name,specification_snapshot:String(row.specification??product.size??''),unit_snapshot:product.unit||'ชิ้น',quantity,unit_price:price,discount_amount:discount,line_total:round(gross-discount)};
    });
    const subtotal=round(items.reduce((s,i)=>s+round(i.quantity*i.unit_price),0));
    const discount_amount=round(items.reduce((s,i)=>s+i.discount_amount,0));
    const taxable_amount=round(subtotal-discount_amount), vat_amount=round(taxable_amount*vatRate/100);
    return {items,subtotal,discount_amount,taxable_amount,vat_rate:vatRate,vat_amount,grand_total:round(taxable_amount+vat_amount)};
  };
  const rateFor = (item, index, details) => {
    const rate=details.rates[index];
    if (typeof rate==='number' && Number.isFinite(rate) && rate>=0 && rate<=100) return rate;
    const gross=Number(item.quantity)*Number(item.unit_price);
    return gross>0 ? Number(item.discount_amount||0)/gross*100 : 0;
  };
  const persist = async (request,draft) => {
    await request('/rest/v1/documents?on_conflict=id', {method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(draft.document)});
    await request('/rest/v1/document_items?on_conflict=document_id,position', {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(draft.items.map(item=>({...item,document_id:draft.id})))});
  };
  const mount = (root, customers, products, {vatRate=7}={}) => {
    root.innerHTML=`<style>#modal[data-type="quotation"]{width:min(1160px,96vw);max-width:96vw}#modal[data-type="quotation"] .form-content{padding:30px}.qe-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.qe-items{display:grid;gap:14px}.qe-row{border:1px solid #dbe1e8;padding:16px;border-radius:10px;background:#f8fafc}.qe-top{display:flex;justify-content:space-between;align-items:center}.qe-row .field{margin:8px 0}.qe-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.qe-row select,.qe-row textarea,.qe-grid input,.qe-grid select{width:100%;padding:10px;border:1px solid #ccd4dd;border-radius:6px;font:inherit}.qe-row textarea{resize:vertical;min-height:65px}.qe-bottom{display:flex;justify-content:space-between;gap:12px;align-items:center;position:sticky;bottom:0;background:white;padding:14px 0}.qe-total{white-space:pre-line;line-height:1.8}@media(max-width:650px){.qe-grid,.qe-numbers{grid-template-columns:1fr}.qe-bottom{position:static;flex-wrap:wrap}}</style>
      <div class="form-content"><h2>สร้างใบเสนอราคา</h2><div class="qe-grid"><label class="field"><span>ลูกค้า</span><select name="customerId" required>${customers.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}</select></label><label class="field"><span>ยืนราคาถึง</span><input name="expires" required type="date"></label><label class="field"><span>เงื่อนไขชำระเงิน / เครดิต</span><input name="paymentTerms" maxlength="120" placeholder="เช่น เครดิต 30 วัน หรือ มัดจำ 50%"></label><label class="field"><span>กำหนดส่งสินค้า</span><input name="deliveryTerms" maxlength="120" placeholder="เช่น ภายใน 15 วันหลังยืนยันคำสั่งซื้อ"></label></div><h3>รายการสินค้า</h3><p>เพิ่มได้หลายรายการ ข้อความต่อเนื่องจนเต็มบรรทัด หรือกด Enter เพื่อขึ้นบรรทัดใหม่</p><div class="qe-items"></div><div class="qe-bottom"><button type="button" class="ghost" data-qe-add>+ เพิ่มรายการสินค้า</button><strong data-qe-count></strong></div><label class="field"><span>หมายเหตุ</span><textarea name="notes" rows="2"></textarea></label><p class="qe-total" aria-live="polite"></p><div class="form-actions"><button value="cancel" formnovalidate class="ghost">ยกเลิก</button><button class="primary" value="default">บันทึกร่าง</button></div></div>`;
    const numberingNotice=document.createElement('p');
    numberingNotice.textContent=`เลขที่อัตโนมัติรูปแบบ ${numberExample(issueDate())} • เรียงตามปี พ.ศ. • ระบบกำหนดเลขจริงเมื่อบันทึก`;
    root.querySelector('h2').after(numberingNotice);
    const container=root.querySelector('.qe-items');
    const read=()=>[...container.children].map(row=>({variantId:row.querySelector('[data-variant]').value,specification:row.querySelector('[data-spec]').value,quantity:row.querySelector('[data-qty]').value,unitPrice:row.querySelector('[data-price]').value,discountRate:row.querySelector('[data-discount]').value}));
    const update=()=>{
      [...container.children].forEach((row,i)=>row.querySelector('strong').textContent=`รายการที่ ${i+1}`);
      root.querySelector('[data-qe-count]').textContent=`${container.children.length} รายการ`;
      try {const t=calculate(read(),products,vatRate);root.querySelector('.qe-total').textContent=`รวม ${money(t.subtotal)} บาท • ส่วนลด ${money(t.discount_amount)} บาท\nก่อน VAT ${money(t.taxable_amount)} บาท • VAT ${vatRate}% ${money(t.vat_amount)} บาท • ยอดสุทธิ ${money(t.grand_total)} บาท`;}catch(e){root.querySelector('.qe-total').textContent=e.message;}
    };
    const add=()=>{
      const row=document.createElement('div');row.className='qe-row';
      row.innerHTML=`<div class="qe-top"><strong></strong><button type="button" class="ghost" data-remove>นำรายการนี้ออก</button></div><label class="field"><span>สินค้า / ขนาด</span><select data-variant required><option value="">เลือกสินค้า</option>${products.filter(p=>p.status!=='ปิดใช้งาน').map(p=>`<option value="${escape(p.id)}">${escape(p.name)} (${escape(p.size)})</option>`).join('')}</select></label><label class="field"><span>รายละเอียด / ขนาดที่แสดงในเอกสาร</span><textarea data-spec rows="2"></textarea></label><div class="qe-numbers"><label class="field"><span>จำนวน</span><input data-qty type="number" min="0.001" step="0.001" value="1" required></label><label class="field"><span>ราคาต่อหน่วย (บาท)</span><input data-price type="number" min="0" step="0.01" value="0" required></label><label class="field"><span>ส่วนลด (%)</span><input data-discount type="number" min="0" max="100" step="0.01" value="0" required></label></div>`;
      row.querySelector('[data-variant]').onchange=()=>{const p=products.find(p=>p.id===row.querySelector('[data-variant]').value);row.querySelector('[data-price]').value=p?.price??0;row.querySelector('[data-spec]').value=p?.size??'';update();};
      row.querySelector('[data-remove]').onclick=()=>{row.remove();update();};
      row.addEventListener('input',update);container.append(row);update();
    };
    root.querySelector('[data-qe-add]').onclick=add;
    const customerSelect=root.querySelector('[name=customerId]');
    customerSelect.onchange=()=>{root.querySelector('[name=paymentTerms]').value=customers.find(c=>c.id===customerSelect.value)?.terms||'';};
    customerSelect.onchange();add();
    return {read};
  };
  window.QuotationEditor={encode,decode,calculate,rateFor,persist,mount,issueDate,numberExample};
})();
