(() => {
  const style=document.createElement('style');style.textContent='[data-access-hidden="true"]{display:none!important}';document.head.append(style);
  const pages={dashboard:'dashboard',customers:'customers',products:'products',quotations:'quotation',invoices:'billing_note',billing:'billing_note','tax-invoices':'tax_invoice','tax-invoice-control':'tax_invoice','tax-invoice-trash':'tax_invoice','delivery-notes':'delivery_note','cash-bills':'cash_bill','company-profile':'company',members:'members',settings:'settings'};
  let role=null,permissions={},observer;
  const can=(resource,action='view')=>role==='admin'||permissions[resource]?.[action]===true;
  const pageAllowed=page=>can(pages[page]||page);
  const fallback=()=>Object.keys(pages).find(p=>pageAllowed(p)&&document.getElementById(p))||'products';
  const baseGo=window.go;
  window.go=page=>baseGo(pageAllowed(page)?page:fallback());
  const actionFor=node=>{
    const resource=pages[node.closest('.page')?.id];
    if(node.matches('[data-payment-id]'))return [node.dataset.paymentKind,'payment'];
    if(node.matches('[data-delete-product]'))return ['products','trash'];
    if(node.matches('[data-restore-product],[data-undo-product-delete]'))return ['products','restore'];
    if(node.matches('[data-purge-product]'))return ['products','purge'];
    if(node.matches('[data-edit-customer]'))return ['customers','edit'];
    if(node.id==='add-product')return ['products','create'];
    if(node.id==='add-customer')return ['customers','create'];
    if(node.id==='new-action')return ['quotation','create'];
    if(!resource)return null;
    const text=node.textContent.trim();
    if(/ถังขยะ/.test(text))return [resource,'restore'];
    if(/ลบถาวร/.test(text))return [resource,'purge'];
    if(/กู้คืน/.test(text))return [resource,'restore'];
    if(/^ลบ$/.test(text))return [resource,['products','tax_invoice'].includes(resource)?'trash':'purge'];
    if(/แก้ไข/.test(text))return [resource,'edit'];
    if(/ออกใบวางบิล/.test(text))return ['billing_note','create'];
    if(/ออกใบกำกับภาษี/.test(text))return ['tax_invoice','create'];
    if(/ออกใบส่ง/.test(text))return ['delivery_note','create'];
    if(/สร้าง|เพิ่ม|^\+|อนุมัติ/.test(text))return [resource,/อนุมัติ/.test(text)?'edit':'create'];
    return null;
  };
  const refresh=()=>{
    document.querySelectorAll('[data-page],[data-page-go]').forEach(node=>{
      const denied=!pageAllowed(node.dataset.page||node.dataset.pageGo);
      if(denied){node.hidden=true;node.dataset.accessHidden='true';}
      else if(node.dataset.accessHidden){node.hidden=false;delete node.dataset.accessHidden;}
    });
    document.querySelectorAll('button,input[type=checkbox]').forEach(node=>{
      const action=actionFor(node);if(!action)return;
      const denied=!can(...action);
      if(denied){node.hidden=true;node.dataset.accessHidden='true';}
      else if(node.dataset.accessHidden){node.hidden=false;delete node.dataset.accessHidden;}
    });
  };
  document.addEventListener('click',e=>{
    const node=e.target.closest('button,input[type=checkbox]');if(!node)return;
    const action=actionFor(node);
    if(action&&!can(...action)){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.CRMAccess={can,get role(){return role;},async configure(request,org){
    role=null;permissions={};
    const access=await request('/rest/v1/rpc/crm_my_access',{method:'POST',body:JSON.stringify({p_org:org})});
    if(!access||!['admin','employee','customer'].includes(access.role))throw Error('ไม่พบสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแล');
    role=access.role;permissions=window.MemberPermissions.normalize(role,access.permissions);
    refresh();
    if(!observer){observer=new MutationObserver(()=>refresh());observer.observe(document.body,{childList:true,subtree:true});}
    const requested=location.hash.slice(1)||document.querySelector('.active-page')?.id;
    const page=pageAllowed(requested)&&document.getElementById(requested)?requested:fallback();
    window.go(page);history.replaceState(null,'','#'+page);
  }};
})();
