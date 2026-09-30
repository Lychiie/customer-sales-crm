// Shared UI policy. The database remains the authority; this never grants access.
(() => {
  const resources = {
    dashboard:'ภาพรวมบริษัท', customers:'ลูกค้า', products:'สินค้าและราคา',
    quotation:'ใบเสนอราคา', tax_invoice:'ใบกำกับภาษี', delivery_note:'ใบส่งของ',
    billing_note:'ใบวางบิล', cash_bill:'บิลเงินสด'
  };
  const actions = {view:'ดู',create:'สร้าง',edit:'แก้ไข',trash:'ลบ / ถังขยะ',restore:'กู้คืน',purge:'ลบถาวร',payment:'ชำระเงิน'};
  const supported = resource => resource==='dashboard' ? ['view'] :
    resource==='customers' ? ['view','create','edit'] :
    resource==='products' ? ['view','create','edit','trash','restore','purge'] :
    resource==='tax_invoice' ? Object.keys(actions) :
    ['view','create','edit','purge',...(['billing_note','cash_bill'].includes(resource)?['payment']:[])];
  const defaults = role => Object.fromEntries(Object.keys(resources).map(resource=>[
    resource,Object.fromEntries(supported(resource).map(action=>[action,
      role==='admin' || (action==='view' && (role==='employee'||(role==='customer'&&resource==='products')))
    ]))
  ]));
  const normalize = (role, value) => {
    const result=defaults(role);
    if(role!=='employee'||!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const resource of Object.keys(resources))for(const action of supported(resource)){
      if(typeof value[resource]?.[action]==='boolean')result[resource][action]=value[resource][action];
    }
    for(const resource of Object.keys(resources))if(!result[resource].view)
      for(const action of supported(resource))result[resource][action]=false;
    return result;
  };
  const mount=(form,initialRole,initialPermissions)=>{
    const box=document.createElement('fieldset');box.className='member-permissions';
    box.style.cssText='border:1px solid #dde3eb;border-radius:10px;padding:14px;min-width:0';
    form.querySelector('[name=role]').closest('label').after(box);
    let currentRole=initialRole, draft=normalize('employee',initialPermissions);
    const read=()=>{
      if(currentRole!=='employee')return {};
      const result=defaults('employee');
      box.querySelectorAll('input[data-resource]').forEach(input=>result[input.dataset.resource][input.dataset.action]=input.checked);
      return normalize('employee',result);
    };
    const draw=role=>{
      if(currentRole==='employee'&&box.querySelector('input'))draft=read();
      currentRole=role;
      box.innerHTML='';
      const legend=document.createElement('legend');legend.textContent='สิทธิ์แยกตามเมนู';box.append(legend);
      if(role!=='employee'){
        const p=document.createElement('p');p.textContent=role==='admin'?'ผู้ดูแลใช้งานทุกส่วนและจัดการสมาชิกได้':'ลูกค้าดูได้เฉพาะสินค้าและราคา ไม่สามารถสร้าง แก้ไข หรือลบได้';box.append(p);return;
      }
      const hint=document.createElement('p');hint.textContent='เริ่มต้นดูได้อย่างเดียว เลือกสิทธิ์เพิ่มตามหน้าที่ • สมาชิกและไฟล์บริษัทสงวนไว้สำหรับผู้ดูแล';box.append(hint);
      for(const [resource,label] of Object.entries(resources)){
        const row=document.createElement('div');row.style.cssText='padding:10px 0;border-top:1px solid #edf0f4;display:flex;flex-wrap:wrap;gap:10px;align-items:center';
        const title=document.createElement('strong');title.textContent=label;title.style.cssText='flex-basis:100%;font-size:13px';row.append(title);
        for(const action of supported(resource)){
          const labelNode=document.createElement('label');labelNode.style.cssText='display:flex;align-items:center;gap:5px;font-size:12px';
          const input=document.createElement('input');input.type='checkbox';input.dataset.resource=resource;input.dataset.action=action;
          input.style.cssText='width:16px;min-width:16px;padding:0;margin:0';input.checked=draft[resource][action];
          input.disabled=action!=='view'&&!draft[resource].view;
          input.onchange=()=>{
            if(action==='view')row.querySelectorAll('input').forEach(other=>{if(other!==input){other.disabled=!input.checked;if(!input.checked)other.checked=false;}});
          };
          labelNode.append(input,document.createTextNode(actions[action]));row.append(labelNode);
        }
        box.append(row);
      }
    };
    draw(initialRole);form.elements.role.addEventListener('change',()=>draw(form.elements.role.value));
    return {read};
  };
  window.MemberPermissions={resources,actions,supported,defaults,normalize,mount};
})();
