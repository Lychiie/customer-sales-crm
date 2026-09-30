(() => {
  const route=(path,options={},org)=>{
    const method=(options.method||'GET').toUpperCase();
    if(method!=='PATCH')return {path,options};
    const url=new URL(path,'https://crm.invalid');
    const value=key=>{const v=url.searchParams.get(key);return v?.startsWith('eq.')?v.slice(3):null;};
    const body=JSON.parse(options.body||'{}');
    const rpc=(name,payload)=>({path:'/rest/v1/rpc/'+name,options:{method:'POST',body:JSON.stringify(payload)}});
    if(url.pathname==='/rest/v1/documents'&&Object.keys(body).length===1&&typeof body.payment_received==='boolean')
      return rpc('crm_set_payment',{p_org:value('organization_id'),p_id:value('id'),p_kind:value('kind'),p_previous:value('payment_received')==='true',p_paid:body.payment_received});
    if(url.pathname==='/rest/v1/documents'&&Object.keys(body).length===1&&body.status==='approved')
      return rpc('crm_approve_quotation',{p_org:value('organization_id'),p_number:value('document_number')});
    if(url.pathname==='/rest/v1/product_variants'&&Object.keys(body).length===1&&typeof body.is_active==='boolean')
      return rpc('crm_product_active',{p_org:org,p_id:value('id'),p_product:value('product_id'),p_active:body.is_active});
    return {path,options};
  };
  window.PermissionTransport={route};
})();
