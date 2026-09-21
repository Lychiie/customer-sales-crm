(() => {
  const c = window.SUPABASE_CONFIG;
  let session = JSON.parse(localStorage.getItem('flowbill-session') || 'null');
  let orgId = localStorage.getItem('flowbill-org-id');
  const headers = () => ({ apikey: c.publishableKey, Authorization: `Bearer ${session?.access_token || c.publishableKey}`, 'Content-Type':'application/json' });
  const request = async (path, options={}) => { const r=await fetch(c.url+path,{...options,headers:{...headers(),...(options.headers||{})}}); if(!r.ok) throw new Error((await r.json().catch(()=>({}))).message||'เชื่อมต่อไม่สำเร็จ'); return r.status===204?null:r.json(); };
  const button=document.createElement('button');button.className='ghost';document.querySelector('.header-actions').prepend(button);
  const label=()=>button.textContent=session?'● ฐานข้อมูลเชื่อมแล้ว':'เข้าสู่ระบบ';label();
  const syncCustomers = async () => {
    const memberships = await request(`/rest/v1/organization_members?user_id=eq.${session.user.id}&select=organization_id`);
    if (!memberships.length) throw new Error('บัญชีนี้ยังไม่มีสิทธิ์องค์กร CRM');
    orgId = memberships[0].organization_id; localStorage.setItem('flowbill-org-id', orgId);
    const rows = await request(`/rest/v1/customers?organization_id=eq.${orgId}&select=*&order=created_at.desc`);
    state.customers = rows.map(x => ({name:x.name,contact:x.contact_name||'-',taxId:x.tax_id||'-',phone:x.phone||'-',terms:`${x.credit_term_days} วัน`,sales:'฿ 0'})); render();
  };
  const login=()=>{document.querySelector('#modal-content').innerHTML='<div class="form-content"><h2>เข้าสู่ระบบ CRM</h2><label class="field"><span>อีเมล</span><input name="email" type="email" required></label><label class="field"><span>รหัสผ่าน</span><input name="password" type="password" required></label><p id="loginError" style="color:#c43d50"></p><div class="form-actions"><button value="cancel" class="ghost">ยกเลิก</button><button class="primary" value="login">เข้าสู่ระบบ</button></div></div>';modal.dataset.type='login';modal.showModal();};
  button.onclick=()=>session?alert('เชื่อมต่อฐานข้อมูลแล้ว'):login();
  document.querySelector('#modal-form').addEventListener('submit',async e=>{if(modal.dataset.type==='login'&&e.submitter.value==='login'){e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify(d)});localStorage.setItem('flowbill-session',JSON.stringify(session));await syncCustomers();modal.close();label();}catch(x){document.querySelector('#loginError').textContent=x.message;}}else if(modal.dataset.type==='customer'&&e.submitter.value!=='cancel'&&session&&orgId){const d=Object.fromEntries(new FormData(e.currentTarget));request('/rest/v1/customers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({organization_id:orgId,name:d.name,contact_name:d.contact||null,tax_id:d.taxId||null,phone:d.phone||null,credit_term_days:parseInt(d.terms)||30})}).then(syncCustomers).catch(x=>alert(x.message));}});
  if(session) syncCustomers().catch(()=>{session=null;localStorage.removeItem('flowbill-session');label();});
})();
