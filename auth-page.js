(() => {
  const pages=new Set(['dashboard','quotations','invoices','tax-invoices','tax-invoice-control','tax-invoice-trash','delivery-notes','cash-bills','company-profile','customers','products','purchase-tax','sales-tax','settings','members']);
  const safePage=value=>pages.has(value)?value:'dashboard';
  const loginUrl=()=>new URL('login.html?next='+encodeURIComponent(safePage(location.hash.slice(1))),location.href).href;
  window.CRMAuth={safePage,login:()=>location.assign(loginUrl())};
  if(document.documentElement.dataset.loginPage!=='true'){
    let saved;try{saved=JSON.parse(localStorage.getItem('flowbill-session')||'null');}catch{}
    if(!saved?.access_token||!saved?.user?.id){location.replace(loginUrl());return;}
    document.documentElement.classList.remove('auth-pending');
    return;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const form=document.querySelector('form'),submit=form.querySelector('[type=submit]'),error=document.querySelector('[role=alert]'),password=form.elements.password;
    document.querySelector('[data-show-password]').onclick=e=>{const show=password.type==='password';password.type=show?'text':'password';e.currentTarget.textContent=show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน';e.currentTarget.setAttribute('aria-pressed',String(show));};
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled||!form.reportValidity())return;
      submit.disabled=true;submit.textContent='กำลังเข้าสู่ระบบ…';error.textContent='';
      try{
        const config=window.SUPABASE_CONFIG;if(!config?.url||!config?.publishableKey)throw Error('ไม่พบการตั้งค่าการเชื่อมต่อ กรุณาติดต่อผู้ดูแล');
        const email=window.MemberIdentity.email(form.elements.email.value);
        const response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password:password.value})});
        const session=await response.json();
        if(!response.ok||!session.access_token||!session.user?.id)throw Error(response.status===429?'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน');
        const membership=await fetch(config.url+'/rest/v1/organization_members?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=organization_id&limit=1',{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token}});
        if(!membership.ok)throw Error('ตรวจสิทธิ์องค์กรไม่สำเร็จ กรุณาลองใหม่');
        const rows=await membership.json();if(!rows[0]?.organization_id)throw Error('บัญชีนี้ยังไม่มีสิทธิ์เข้าองค์กร กรุณาติดต่อผู้ดูแล');
        localStorage.setItem('flowbill-session',JSON.stringify(session));localStorage.setItem('flowbill-org-id',rows[0].organization_id);password.value='';
        const next=safePage(new URLSearchParams(location.search).get('next'));
        location.replace(new URL('index.html#'+next,location.href).href);
      }catch(e){error.textContent=e instanceof TypeError?'เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่':e.message;}
      finally{submit.disabled=false;submit.textContent='เข้าสู่ระบบ';}
    };
  });
})();
