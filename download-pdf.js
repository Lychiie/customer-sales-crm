// Render Thai text using the browser's fonts, then embed each A4 page in a PDF.
window.buildSalesPDF = async (company, doc, items) => {
  await document.fonts.ready;
  const pages = [];
  let canvas, ctx, y;
  const width = 1240, height = 1754, margin = 90;
  const money = value => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const titles = { quotation: 'ใบเสนอราคา', billing_note: 'ใบวางบิล', tax_invoice: 'ใบกำกับภาษี / ใบเสร็จรับเงิน' };
  const newPage = () => {
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#172033'; ctx.textBaseline = 'top'; y = margin; pages.push(canvas);
  };
  const text = (value, size = 24, bold = false, x = margin, maxWidth = width - margin * 2) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px Tahoma, Arial, sans-serif`;
    const lines = [];
    for (const paragraph of String(value ?? '-').split('\n')) {
      let line = '';
      for (const char of Array.from(paragraph)) {
        if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
        line += char;
      }
      lines.push(line);
    }
    for (const line of lines) {
      if (y + size * 1.6 > height - margin) { newPage(); ctx.font = `${bold ? 'bold ' : ''}${size}px Tahoma, Arial, sans-serif`; }
      ctx.fillText(line, x, y); y += size * 1.6;
    }
  };
  const rule = () => { ctx.strokeStyle = '#cbd2db'; ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width-margin, y); ctx.stroke(); y += 20; };
  const documentLayout=doc.kind==='quotation'?window.QuotationLayout:doc.kind==='billing_note'?window.BillingLayout:null;
  if(documentLayout){
    const layout=await documentLayout.prepare(company,doc,items);
    pages.push(...documentLayout.draw(layout,()=>document.createElement('canvas')));
  } else {
  newPage();
  text(company.name || '-', 32, true);
  text(company.address || '-'); text(`เลขประจำตัวผู้เสียภาษี ${company.tax_id || '-'}`);
  y += 16; rule(); text(titles[doc.kind] || 'เอกสาร', 32, true);
  text(`เลขที่ ${doc.document_number}`);
  text(`วันที่ ${doc.issue_date ? new Date(doc.issue_date + 'T00:00:00').toLocaleDateString('th-TH') : '-'}`);
  if (doc.status === 'draft') text('สถานะ: ร่าง');
  if (doc.status === 'paid') text('สถานะ: ชำระแล้ว');
  y += 14; text(`ลูกค้า: ${doc.customer_name_snapshot}`, 26, true);
  text(doc.customer_address_snapshot || '-'); text(`เลขประจำตัวผู้เสียภาษี ${doc.customer_tax_id_snapshot || '-'}`);
  if (doc.valid_until) text(`ยืนราคาถึง ${doc.valid_until}`);
  if (doc.due_date) text(`กำหนดชำระ ${doc.due_date}`);
  y += 14; rule();
  items.forEach((item, index) => {
    if (y > height - 320) newPage();
    text(`${index + 1}. ${[item.product_name_snapshot,item.specification_snapshot,item.sku_snapshot].filter(value => value != null && String(value).trim()).join(' ')}`, 25, true);
    text(`${item.quantity} ${item.unit_snapshot || ''} × ${money(item.unit_price)} บาท   ส่วนลด ${money(item.discount_amount)} บาท`);
    text(`รวม ${money(item.line_total)} บาท`, 24, true); rule();
  });
  if (y > height - 500) newPage();
  text(`รวมก่อนส่วนลด: ${money(doc.subtotal)} บาท`);
  text(`ส่วนลด: ${money(doc.discount_amount)} บาท`);
  text(`มูลค่าก่อน VAT: ${money(doc.taxable_amount)} บาท`);
  text(`VAT ${doc.vat_rate}%: ${money(doc.vat_amount)} บาท`);
  text(`ยอดสุทธิ: ${money(doc.grand_total)} บาท`, 30, true);
  y += 55; text('ผู้จัดทำ / ผู้รับเงิน ____________________    ผู้รับเอกสาร ____________________', 22);
  }
  const encoder = new TextEncoder(), chunks = [], offsets = [0]; let length = 0;
  const append = data => { const bytes = typeof data === 'string' ? encoder.encode(data) : data; chunks.push(bytes); length += bytes.length; };
  const object = (id, content) => { offsets[id] = length; append(`${id} 0 obj\n${content}\nendobj\n`); };
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3+i*3} 0 R`).join(' ')}] >>`);
  for (let i = 0; i < pages.length; i++) {
    const pageId = 3+i*3, imageId = pageId+1, contentId = pageId+2;
    const jpeg = Uint8Array.from(atob(pages[i].toDataURL('image/jpeg', 0.94).split(',')[1]), c => c.charCodeAt(0));
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    offsets[imageId] = length;
    append(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    append(jpeg); append('\nendstream\nendobj\n');
    const drawing = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
    object(contentId, `<< /Length ${encoder.encode(drawing).length} >>\nstream\n${drawing}endstream`);
  }
  const xref = length, count = 3+pages.length*3;
  append(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const blob = new Blob(chunks, { type: 'application/pdf' });
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ไม่สามารถเตรียมไฟล์ PDF')); reader.readAsDataURL(blob);
  });
  return { blob, dataUrl, filename: `${doc.document_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
};
