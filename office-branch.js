(() => {
 const normalize=value=>{const s=String(value??'').trim();if(!/^\d{1,5}$/.test(s))throw Error('กรุณาระบุเลขสาขา 1–5 หลัก');return s.padStart(5,'0');};
 const label=code=>code==null||code===''?'ยังไม่ระบุสำนักงาน / สาขา':code==='00000'?'สำนักงานใหญ่':'สาขา '+code;
 const read=(data,prefix='office')=>{
  const type=data[prefix+'Type'];if(type===undefined)return undefined;
  if(type==='head')return '00000';
  if(type!=='branch')throw Error('กรุณาเลือกสำนักงานใหญ่หรือสาขา');
  const code=normalize(data[prefix+'Number']);if(code==='00000')throw Error('เลข 00000 ให้เลือกสำนักงานใหญ่');return code;
 };
 const mount=(root,code,{prefix='office',title='สำนักงาน / สาขา',before}={})=>{
  const box=document.createElement('div');box.className='field';box.style.cssText='margin:14px 0;display:grid;gap:8px';
  const select=document.createElement('select');select.name=prefix+'Type';select.required=true;select.setAttribute('aria-label',title);
  for(const [value,text] of [['','กรุณาเลือก'],['head','สำนักงานใหญ่'],['branch','สาขา']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  const heading=document.createElement('label');heading.textContent=title;heading.append(select);
  const number=document.createElement('input');number.name=prefix+'Number';number.inputMode='numeric';number.maxLength=5;number.pattern='[0-9]{1,5}';number.placeholder='เลขสาขา เช่น 00001';number.setAttribute('aria-label',title+' — เลขสาขา');
  for(const el of [select,number])el.style.cssText='width:100%;padding:10px;border:1px solid #ccd4dd;border-radius:6px;font:inherit';
  const update=()=>{number.hidden=select.value!=='branch';number.required=select.value==='branch';};
  select.value=code==null||code===''?'':code==='00000'?'head':'branch';number.value=code&&code!=='00000'?code:'';select.onchange=update;update();box.append(heading,number);
  if(before)before.before(box);else root.append(box);
  return box;
 };
 window.OfficeBranch={normalize,label,read,mount};
})();
