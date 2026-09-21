(() => {
  const pending = new Map();
  const canIssue = quote => Boolean(quote?.id && quote.statusCode === 'approved');
  const issue = (request, organizationId, quote) => {
    if (!organizationId || !canIssue(quote)) return Promise.reject(Error('ออกใบกำกับภาษีได้เฉพาะใบเสนอราคาที่อนุมัติแล้ว'));
    const key = `${organizationId}:${quote.id}`;
    if (pending.has(key)) return pending.get(key);
    const operation = (async () => {
      let result;
      try {
        result = await request('/rest/v1/rpc/issue_quotation_tax_invoice', {
          method: 'POST', body: JSON.stringify({p_org: organizationId, p_id: quote.id})
        });
      } catch (error) {
        if (/Could not find the function|function .* does not exist/i.test(error.message)) throw Error('ยังไม่ได้เปิดใช้การออกใบกำกับภาษีจากใบเสนอราคาในฐานข้อมูล');
        throw error;
      }
      if (!result?.id || !result.document_number || result.quotation_id !== quote.id || typeof result.created !== 'boolean') {
        throw Error('ยังยืนยันผลไม่ได้ กรุณาโหลดรายการใหม่ก่อนลองอีกครั้ง ระบบจะตรวจเอกสารเดิมเพื่อป้องกันการออกซ้ำ');
      }
      return result;
    })();
    pending.set(key, operation);
    operation.then(() => pending.delete(key), () => pending.delete(key));
    return operation;
  };
  // Recognize both direct invoices and legacy invoices issued via billing notes.
  const linkedInvoices = documents => {
    const byId = new Map(documents.map(doc => [doc.id, doc]));
    const linked = new Map();
    for (const invoice of documents) {
      if (invoice.kind !== 'tax_invoice' || !invoice.source_document_id) continue;
      let source = byId.get(invoice.source_document_id);
      if (source?.kind === 'billing_note') source = byId.get(source.source_document_id);
      if (source?.kind === 'quotation' && !linked.has(source.id)) linked.set(source.id, invoice);
    }
    return linked;
  };
  window.QuotationTax = {canIssue, issue, linkedInvoices};
})();
