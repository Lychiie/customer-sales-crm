// Read-only linkage: invoices issued from this bill, or an invoice explicitly
// referenced by the bill. Never guess matches from customer names or amounts.
(() => {
  const issued = invoice => invoice.kind === 'tax_invoice' && ['sent','approved','paid','overdue'].includes(invoice.status);
  const totalCents = invoices => invoices.reduce((sum, invoice) => {
    const amount = Number(invoice.grand_total);
    if (invoice.grand_total == null || !Number.isFinite(amount) || amount < 0) throw Error('ยอดใบกำกับภาษีไม่ถูกต้อง กรุณาตรวจเอกสารต้นทาง');
    return sum + Math.round(amount * 100);
  }, 0);
  const resolve = async (request, orgId, bill) => {
    if (!orgId || bill?.kind !== 'billing_note' || bill.organization_id !== orgId || !bill.id) throw Error('ไม่พบใบวางบิลขององค์กรนี้');
    const fields='id,organization_id,kind,status,document_number,source_document_id,customer_id,issue_date,due_date,grand_total';
    const children = await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.tax_invoice&source_document_id=eq.${bill.id}&select=${fields}&order=issue_date.asc,document_number.asc`);
    let referenced=[];
    if (bill.source_document_id) referenced=await request(`/rest/v1/documents?organization_id=eq.${orgId}&kind=eq.tax_invoice&id=eq.${bill.source_document_id}&select=${fields}&limit=1`);
    const invoices=[...new Map([...children,...referenced].filter(invoice=>issued(invoice)&&invoice.organization_id===orgId&&(invoice.source_document_id===bill.id||invoice.id===bill.source_document_id)).map(invoice=>[invoice.id,invoice])).values()];
    invoices.sort((a,b)=>String(a.issue_date).localeCompare(String(b.issue_date))||a.document_number.localeCompare(b.document_number));
    if (!invoices.length) throw Error('ใบวางบิลนี้ยังไม่มีใบกำกับภาษีที่ออกแล้วเชื่อมอยู่ จึงยังพิมพ์ตารางใบกำกับภาษีไม่ได้');
    if (invoices.some(invoice=>invoice.customer_id!==bill.customer_id)) throw Error('ลูกค้าในใบกำกับภาษีไม่ตรงกับใบวางบิล กรุณาตรวจเอกสารต้นทาง');
    if (bill.grand_total == null || !Number.isFinite(Number(bill.grand_total)) || totalCents(invoices)!==Math.round(Number(bill.grand_total)*100)) throw Error('ยอดรวมใบกำกับภาษีที่เชื่อมอยู่ไม่ตรงกับยอดใบวางบิล กรุณาตรวจเอกสารก่อนพิมพ์');
    return invoices;
  };
  window.BillingDocuments={issued,totalCents,resolve};
})();
