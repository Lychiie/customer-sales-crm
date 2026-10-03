(() => {
 const normalize=value=>{const s=String(value??'').trim();if(!/^\d{1,5}$/.test(s))throw Error('กรุณาระบุเลขสาขา 1–5 หลัก');return s.padStart(5,'0');};
 const label=(code,name)=>code==null||code===''?'ยังไม่ระบุสำนักงาน / สาขา':code==='00000'?'สำนักงานใหญ่':'สาขา '+[String(name??'').trim(),code].filter(Boolean).join(' · ');
 const readName=(data,prefix='office')=>{if(data[prefix+'Type']===undefined)return undefined;if(data[prefix+'Type']!=='branch')return null;const name=String(data[prefix+'Name']??'').trim();if(name.length>120)throw Error('ชื่อสาขาต้องไม่เกิน 120 ตัวอักษร');return name||null;};
 const read=(data,prefix='office')=>{
  const type=data[prefix+'Type'];if(type===undefined)return undefined;
  if(type==='head')return '00000';
  if(type!=='branch')throw Error('กรุณาเลือกสำนักงานใหญ่หรือสาขา');
  const code=normalize(data[prefix+'Number']);if(code==='00000')throw Error('เลข 00000 ให้เลือกสำนักงานใหญ่');return code;
 };
 const mount=(root,code,{prefix='office',title='สำนักงาน / สาขา',before,name=''}={})=>{
  const box=document.createElement('div');box.className='field';box.style.cssText='margin:14px 0;display:grid;gap:8px';
  const select=document.createElement('select');select.name=prefix+'Type';select.required=true;select.setAttribute('aria-label',title);
  for(const [value,text] of [['','กรุณาเลือก'],['head','สำนักงานใหญ่'],['branch','สาขา']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  const heading=document.createElement('label');heading.textContent=title;heading.append(select);
  const number=document.createElement('input');number.name=prefix+'Number';number.inputMode='numeric';number.maxLength=5;number.pattern='[0-9]{1,5}';number.placeholder='เลขสาขา เช่น 00001';number.setAttribute('aria-label',title+' — เลขสาขา');
  const branchName=document.createElement('input');branchName.name=prefix+'Name';branchName.maxLength=120;branchName.placeholder='ชื่อสาขา เช่น บางนา';branchName.setAttribute('aria-label',title+' — ชื่อสาขา');branchName.value=name||'';
  for(const el of [select,number,branchName])el.style.cssText='width:100%;padding:10px;border:1px solid #ccd4dd;border-radius:6px;font:inherit';
  const update=()=>{number.hidden=branchName.hidden=select.value!=='branch';number.required=select.value==='branch';};
  select.value=code==null||code===''?'':code==='00000'?'head':'branch';number.value=code&&code!=='00000'?code:'';select.onchange=update;update();box.append(heading,branchName,number);
  if(before)before.before(box);else root.append(box);
  return box;
 };
 // Legacy invoices predate office snapshots. Resolve missing offices for this
 // preview only; never overwrite a recorded office or write historical data.
 const resolve=async(request,org,doc,company)=>{
  if(doc.kind!=='tax_invoice')return doc;
  const result={...doc};
  if(!result.issuer_office_snapshot&&company?.office_code){result.issuer_office_snapshot=company.office_code;result.issuer_office_name_snapshot=company.office_name||null;}
  if(!result.customer_office_snapshot&&doc.customer_id){
   const rows=await request(`/rest/v1/customers?organization_id=eq.${encodeURIComponent(org)}&id=eq.${encodeURIComponent(doc.customer_id)}&select=id,office_code,office_name&limit=1`);
   const customer=rows?.[0];
   if(customer?.id===doc.customer_id&&customer.office_code){result.customer_office_snapshot=customer.office_code;result.customer_office_name_snapshot=customer.office_name||null;}
  }
  return result;
 };
 window.OfficeBranch={normalize,label,read,readName,mount,resolve};
})();
