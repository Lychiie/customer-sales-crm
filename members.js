(() => {
  let root,nav,context,version=0;
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const invoke=(request,org,data)=>request('/functions/v1/admin-members',{method:'POST',body:JSON.stringify({...data,organization_id:org})});
  const load=async()=>{
    if(!context)return;const {request,org}=context,current=++version;
    root.innerHTML='<article class="panel settings-card"><p role="status">กำลังโหลดสมาชิก…</p></article>';
    try{
      const data=await invoke(request,org,{action:'list'});if(current!==version)return;
      root.innerHTML='<div class="page-toolbar"><div><h2>สมาชิก</h2><p>เฉพาะผู้ดูแลเท่านั้นที่สร้างสมาชิกได้</p></div><button class="primary" data-add>+ สร้างสมาชิก</button></div><article class="panel table-panel"><table><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อสมาชิก</th><th>วันที่สร้าง</th></tr></thead><tbody>'+data.members.map(m=>`<tr><td>${escape(m.username)}</td><td>${escape(m.display_name)}</td><td>${escape(new Date(m.created_at).toLocaleDateString('th-TH'))}</td></tr>`).join('')+'</tbody></table><p style="padding:20px">รายการนี้แสดงบัญชีที่สร้างผ่านระบบสมาชิกใหม่ บัญชีอีเมลเดิมยังเข้าใช้งานได้ตามปกติ</p></article>';
      root.querySelector('[data-add]').onclick=()=>open(request,org);
    }catch(e){if(current!==version)return;root.innerHTML='<article class="panel settings-card"><p role="alert">'+escape(e.message)+'</p><button class="ghost">ลองใหม่</button></article>';root.querySelector('button').onclick=load;}
  };
  const open=(request,org)=>{
    if(document.querySelector('#member-dialog'))return;
    const d=document.createElement('dialog');d.id='member-dialog';d.style.cssText='width:min(540px,calc(100% - 32px));border:0;border-radius:16px;padding:28px';
d.innerHTML='<form><h2>สร้างสมาชิก</h2><label class="field">ชื่อสมาชิก<input name="display_name" required maxlength="100" autocomplete="off"></label><label class="field">ชื่อผู้ใช้ (User)<input name="username" required minlength="3" maxlength="32" pattern="[a-zA-Z][a-zA-Z0-9._\\-]{2,31}" autocomplete="off"></label><p>ใช้ภาษาอังกฤษ ตัวเลข จุด ขีด หรือขีดล่าง 3–32 ตัว ขึ้นต้นด้วยตัวอักษร</p><label class="field">รหัสผ่าน (Password)<input name="password" type="password" required minlength="6" maxlength="128" autocomplete="new-password"></label><label class="field">ยืนยันรหัสผ่าน<input name="confirm" type="password" required autocomplete="new-password"></label><label class="field">สิทธิ์<select name="role"><option value="sales">สมาชิกงานขาย</option><option value="admin">ผู้ดูแล — สร้างสมาชิกและเข้าถึงไฟล์บริษัทได้</option></select></label><p>รหัสผ่านอย่างน้อย 6 ตัวอักษร ระบบไม่แสดงรหัสผ่านย้อนหลัง</p><p role="alert"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button class="primary" type="submit">สร้างสมาชิก</button></div></form>';
    const f=d.querySelector('form'),submit=f.querySelector('[type=submit]'),cancel=f.querySelector('[data-cancel]'),error=f.querySelector('[role=alert]');let busy=false;
    const close=()=>{f.reset();d.close();d.remove();};cancel.onclick=close;d.oncancel=e=>{e.preventDefault();if(!busy)close();};
    f.onsubmit=async e=>{
      e.preventDefault();if(busy||!f.reportValidity())return;error.textContent='';
      if(f.elements.password.value!==f.elements.confirm.value){error.textContent='รหัสผ่านสองช่องไม่ตรงกัน';return;}
      if(!window.MemberIdentity.valid(f.elements.username.value)){error.textContent='รูปแบบชื่อผู้ใช้ไม่ถูกต้อง';return;}
      busy=true;submit.disabled=cancel.disabled=true;
      try{await invoke(request,org,{action:'create',username:window.MemberIdentity.username(f.elements.username.value),display_name:f.elements.display_name.value.trim(),password:f.elements.password.value,role:f.elements.role.value});close();await load();}
      catch(e){error.textContent=e.message;f.elements.password.value=f.elements.confirm.value='';}
      finally{busy=false;submit.disabled=cancel.disabled=false;}
    };document.body.append(d);d.showModal();
  };
  const configure=async(request,org,user)=>{
    if(!root){
      pageMeta.members=['ระบบ','สมาชิก'];root=document.createElement('section');root.id='members';root.className='page';document.querySelector('#settings').before(root);
      nav=document.createElement('button');nav.className='nav-link';nav.dataset.page='members';nav.textContent='♙ สมาชิก';nav.hidden=true;document.querySelector('[data-page="settings"]').before(nav);
      nav.onclick=()=>{window.go('members');history.replaceState(null,'','#members');load();};
    }
    const rows=await request('/rest/v1/organization_members?organization_id=eq.'+encodeURIComponent(org)+'&user_id=eq.'+encodeURIComponent(user)+'&select=role&limit=1');
    const allowed=rows[0]?.role==='admin';nav.hidden=!allowed;nav.style.display=allowed?'':'none';context=allowed?{request,org}:null;
    if(!allowed){version++;root.innerHTML='<article class="panel settings-card"><p>เฉพาะผู้ดูแลเท่านั้นที่เข้าถึงสมาชิกได้</p></article>';}
    if(location.hash==='#members'){window.go('members');if(allowed)await load();}
  };
  window.Members={configure};
})();
