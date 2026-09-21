(() => {
  const remove = async (request, organizationId, quotationId) => {
    if (!organizationId || !quotationId) throw Error('ไม่พบใบเสนอราคาที่ต้องการลบ กรุณาโหลดรายการใหม่');
    let result;
    try {
      result = await request('/rest/v1/rpc/delete_quotation', {method:'POST',body:JSON.stringify({p_org:organizationId,p_id:quotationId})});
    } catch (error) {
      if (/Could not find the function|function .* does not exist/i.test(error.message)) throw Error('ยังไม่ได้เปิดใช้การลบใบเสนอราคาในฐานข้อมูล กรุณาให้ผู้ดูแลติดตั้งส่วนอัปเดตก่อน');
      throw error;
    }
    if (result?.id !== quotationId || result?.deleted !== true) throw Error('ยังยืนยันการลบไม่ได้ กรุณาโหลดรายการใหม่ก่อนลองอีกครั้ง');
    return result;
  };
  window.QuotationActions={remove};
})();
