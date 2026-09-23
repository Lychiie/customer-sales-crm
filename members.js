(() => {
  const style=document.createElement('style');style.textContent=`
    #member-dialog{font-family:inherit;color:#24324b;max-height:90vh;overflow:auto;box-shadow:0 20px 70px #14213833}
    #member-dialog::backdrop{background:#16233855}
    #member-dialog form{display:grid;gap:16px}
    #member-dialog h2{margin:0 0 4px;font-size:22px}
    #member-dialog .field{display:grid;gap:7px;font-size:14px;font-weight:500}
    #member-dialog input,#member-dialog select{box-sizing:border-box;width:100%;min-width:0;padding:10px 12px;border:1px solid #d7deea;border-radius:8px;font:inherit;background:#fff;color:#24324b}
    #member-dialog input:focus,#member-dialog select:focus{outline:2px solid #8aafd4;outline-offset:1px}
    #member-dialog p{margin:0;font-size:13px;line-height:1.7;color:#63728a}
    #member-dialog p:empty{display:none}
    #member-dialog [role=alert]{color:#b42318}
    #member-dialog [role=status]{color:#16734c}
    #member-dialog details{border:1px solid #e0e5ef;border-radius:10px;padding:14px}
    #member-dialog details .field,#member-dialog details p,#member-dialog details button{margin-top:12px}
    #member-dialog summary{cursor:pointer;font-weight:600}
    #member-dialog .field button{justify-self:start}
    #member-dialog .form-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid #e7ebf2}
  `;document.head.append(style);
  let root,nav,context,version=0;
  const roles={sales:'พนักงานขาย',finance:'พนักงานบัญชี / การเงิน',admin:'ผู้ดูแล'};
  const roleOptions=()=>Object.entries(roles).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const invoke=(request,org,data)=>request('/functions/v1/admin-members',{method:'POST',body:JSON.stringify({...data,organization_id:org})});
  const load=async()=>{
    if(!context)return;const {request,org}=context,current=++version;
    root.innerHTML='<article class="panel settings-card"><p role="status">กำลังโหลดสมาชิก…</p></article>';
    try{
      const data=await invoke(request,org,{action:'list'});if(current!==version)return;
      root.innerHTML='<div class="page-toolbar"><div><h2>สมาชิก</h2><p>เฉพาะผู้ดูแลเท่านั้นที่สร้างสมาชิกได้</p></div><button class="primary" data-add>+ สร้างสมาชิก</button></div><article class="panel table-panel"><table><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อสมาชิก</th><th>วันที่สร้าง</th></tr></thead><tbody>'+data.members.map(m=>`<tr><td>${escape(m.username)}</td><td>${escape(m.display_name)}</td><td>${escape(new Date(m.created_at).toLocaleDateString('th-TH'))}</td></tr>`).join('')+'</tbody></table><p style="padding:20px">รายการนี้แสดงบัญชีที่สร้างผ่านระบบสมาชิกใหม่ บัญชีอีเมลเดิมยังเข้าใช้งานได้ตามปกติ</p></article>';
      root.querySelector('thead tr').insertAdjacentHTML('beforeend','<th>สิทธิ์</th><th>จัดการ</th>');
      root.querySelectorAll('tbody tr').forEach((row,i)=>{
        const roleCell=document.createElement('td');roleCell.textContent=roles[data.members[i].role]||'ไม่ทราบสิทธิ์';row.append(roleCell);
        const cell=document.createElement('td'),button=document.createElement('button');button.className='ghost';button.textContent='แก้ไข';button.setAttribute('aria-label','แก้ไขข้อมูลสมาชิก '+data.members[i].display_name);
        button.onclick=()=>edit(request,org,data.members[i]);cell.append(button);row.append(cell);
      });
      root.querySelector('[data-add]').onclick=()=>open(request,org);
    }catch(e){if(current!==version)return;root.innerHTML='<article class="panel settings-card"><p role="alert">'+escape(e.message)+'</p><button class="ghost">ลองใหม่</button></article>';root.querySelector('button').onclick=load;}
  };
  const edit=(request,org,member)=>{
    if(document.querySelector('#member-dialog'))return;
    const d=document.createElement('dialog');d.id='member-dialog';d.style.cssText='width:min(540px,calc(100% - 32px));border:0;border-radius:16px;padding:28px';
    d.innerHTML='<form><h2>แก้ไขข้อมูลสมาชิก</h2><label class="field">ชื่อผู้ใช้ (User)<input name="username" readonly></label><label class="field">ชื่อสมาชิก<input name="display_name" required maxlength="100" autocomplete="off"></label><p>แก้ไขชื่อสมาชิกได้ โดยไม่เปลี่ยนชื่อผู้ใช้ รหัสผ่าน หรือสิทธิ์การใช้งาน</p><p role="alert"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button class="primary" type="submit">บันทึกการแก้ไข</button></div></form>';
    const f=d.querySelector('form'),submit=f.querySelector('[type=submit]'),cancel=f.querySelector('[data-cancel]'),error=f.querySelector('[role=alert]');let busy=false;
    f.elements.username.value=member.username;f.elements.display_name.value=member.display_name;
    f.querySelector('p').textContent='เลือกสิทธิ์ให้ตรงกับหน้าที่ ผู้ดูแลสามารถจัดการสมาชิกและเข้าถึงไฟล์บริษัทได้ การแก้ไขนี้ไม่เปลี่ยนชื่อผู้ใช้หรือรหัสผ่าน';
    f.querySelector('p').insertAdjacentHTML('beforebegin','<label class="field">สิทธิ์การใช้งาน<select name="role" required><option value="">เลือกสิทธิ์</option>'+roleOptions()+'</select></label>');
    f.elements.role.value=member.role||'';
    f.elements.username.readOnly=false;
    f.elements.username.maxLength=32;
    f.elements.username.insertAdjacentHTML('afterend','<button type="button" class="ghost" data-save-user>บันทึกชื่อผู้ใช้</button>');
    f.querySelector('p').textContent='บันทึกชื่อผู้ใช้และตั้งรหัสผ่านด้วยปุ่มแยกด้านล่าง ส่วนปุ่มบันทึกข้อมูลใช้สำหรับชื่อสมาชิกและสิทธิ์ ผู้ดูแลเข้าถึงการจัดการสมาชิกและไฟล์บริษัทได้';
    error.insertAdjacentHTML('beforebegin','<details style="margin:16px 0"><summary>ตั้งรหัสผ่านใหม่</summary><label class="field">รหัสผ่านใหม่<input name="new_password" type="password" maxlength="128" autocomplete="new-password"></label><label class="field">ยืนยันรหัสผ่านใหม่<input name="new_confirm" type="password" maxlength="128" autocomplete="new-password"></label><p>อย่างน้อย 6 ตัวอักษร ไม่แสดงรหัสเดิม หากไม่กดตั้งรหัสใหม่จะใช้รหัสเดิม</p><button type="button" class="ghost" data-save-password>ตั้งรหัสผ่านใหม่</button></details><p role="status" data-member-status></p>');
    submit.textContent='บันทึกชื่อสมาชิกและสิทธิ์';
    const status=f.querySelector('[data-member-status]');
    const lock=value=>{busy=value;f.querySelectorAll('button').forEach(b=>b.disabled=value);};
    const saveLogin=async action=>{
      if(busy)return;error.textContent='';status.textContent='';
      const payload={action,user_id:member.user_id};
      if(action==='username'){
        payload.username=window.MemberIdentity.username(f.elements.username.value);
        if(!window.MemberIdentity.valid(payload.username)){error.textContent='ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ 3–32 ตัวและขึ้นต้นด้วยตัวอักษร';return;}
      }else{
        payload.password=f.elements.new_password.value;
        if(payload.password.length<6||payload.password.length>128){error.textContent='รหัสผ่านต้องมี 6–128 ตัวอักษร';return;}
        if(payload.password!==f.elements.new_confirm.value){error.textContent='รหัสผ่านสองช่องไม่ตรงกัน';return;}
      }
      lock(true);
      try{
        await invoke(request,org,payload);
        if(action==='username'){member.username=payload.username;f.elements.username.value=payload.username;}
        status.textContent=action==='username'?'บันทึกชื่อผู้ใช้แล้ว ใช้ชื่อใหม่เข้าสู่ระบบครั้งถัดไป':'ตั้งรหัสผ่านใหม่แล้ว';
        await load();
      }catch(e){error.textContent=e.message;}
      finally{delete payload.password;f.elements.new_password.value=f.elements.new_confirm.value='';lock(false);}
    };
    f.querySelector('[data-save-user]').onclick=()=>saveLogin('username');
    f.querySelector('[data-save-password]').onclick=()=>saveLogin('password');
    const close=()=>{d.close();d.remove();};cancel.onclick=close;d.oncancel=e=>{e.preventDefault();if(!busy)close();};
    f.onsubmit=async e=>{
      e.preventDefault();if(busy||!f.reportValidity())return;
      const name=f.elements.display_name.value.trim();if(!name){error.textContent='กรุณาระบุชื่อสมาชิก';return;}
      lock(true);error.textContent='';status.textContent='';
      try{await invoke(request,org,{action:'update',user_id:member.user_id,display_name:name,role:f.elements.role.value});close();await configure(request,org,context.user);if(context)await load();}
      catch(e){error.textContent=e.message;}finally{lock(false);}
    };document.body.append(d);d.showModal();f.elements.display_name.focus();
  };
  const open=(request,org)=>{
    if(document.querySelector('#member-dialog'))return;
    const d=document.createElement('dialog');d.id='member-dialog';d.style.cssText='width:min(540px,calc(100% - 32px));border:0;border-radius:16px;padding:28px';
d.innerHTML='<form><h2>สร้างสมาชิก</h2><label class="field">ชื่อสมาชิก<input name="display_name" required maxlength="100" autocomplete="off"></label><label class="field">ชื่อผู้ใช้ (User)<input name="username" required minlength="3" maxlength="32" pattern="[a-zA-Z][a-zA-Z0-9._\\-]{2,31}" autocomplete="off"></label><p>ใช้ภาษาอังกฤษ ตัวเลข จุด ขีด หรือขีดล่าง 3–32 ตัว ขึ้นต้นด้วยตัวอักษร</p><label class="field">รหัสผ่าน (Password)<input name="password" type="password" required minlength="6" maxlength="128" autocomplete="new-password"></label><label class="field">ยืนยันรหัสผ่าน<input name="confirm" type="password" required autocomplete="new-password"></label><label class="field">สิทธิ์<select name="role"><option value="sales">สมาชิกงานขาย</option><option value="admin">ผู้ดูแล — สร้างสมาชิกและเข้าถึงไฟล์บริษัทได้</option></select></label><p>รหัสผ่านอย่างน้อย 6 ตัวอักษร ระบบไม่แสดงรหัสผ่านย้อนหลัง</p><p role="alert"></p><div class="form-actions"><button type="button" class="ghost" data-cancel>ยกเลิก</button><button class="primary" type="submit">สร้างสมาชิก</button></div></form>';
    const f=d.querySelector('form'),submit=f.querySelector('[type=submit]'),cancel=f.querySelector('[data-cancel]'),error=f.querySelector('[role=alert]');let busy=false;
    f.elements.role.innerHTML=roleOptions();
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
    const allowed=rows[0]?.role==='admin';nav.hidden=!allowed;nav.style.display=allowed?'':'none';context=allowed?{request,org,user}:null;
    if(!allowed){version++;root.innerHTML='<article class="panel settings-card"><p>เฉพาะผู้ดูแลเท่านั้นที่เข้าถึงสมาชิกได้</p></article>';}
    if(location.hash==='#members'){window.go('members');if(allowed)await load();}
  };
  window.Members={configure};
})();
