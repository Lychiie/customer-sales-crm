// Internal catalog lookup. SKU stays in the editor, never in printed descriptions.
(() => {
  const normalize=value=>String(value??'').trim().toUpperCase();
  const active=p=>p.isActive!==false&&p.is_active!==false&&p.status!=='ปิดใช้งาน';
  const matches=(products,value)=>{
    const q=normalize(value);if(!q)return [];
    return products.filter(p=>active(p)&&normalize(p.sku).startsWith(q))
      .sort((a,b)=>Number(normalize(b.sku)===q)-Number(normalize(a.sku)===q)||a.sku.localeCompare(b.sku,undefined,{numeric:true})).slice(0,8);
  };
  let provider,sequence=0;
  const mount=(root,products,onSelect,{lookup}={})=>{
    const id='sku-options-'+(++sequence);
    root.innerHTML=`<label class="field"><span>รหัสสินค้า (ใช้ค้นหาเท่านั้น ไม่แสดงในเอกสาร)</span><input data-sku-input type="text" autocomplete="off" spellcheck="false" required role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}" placeholder="พิมพ์รหัสสินค้า เช่น R5I4W" style="width:100%;padding:10px;border:1px solid #ccd4dd;border-radius:6px;font:inherit"></label><div id="${id}" data-sku-options role="listbox" hidden style="border:1px solid #dbe1e8;border-radius:8px;max-height:240px;overflow:auto;background:white"></div><p data-sku-selected aria-live="polite" style="font-size:13px;line-height:1.6;color:#335b55;margin:8px 0"></p>`;
    const input=root.querySelector('[data-sku-input]'),list=root.querySelector('[data-sku-options]'),summary=root.querySelector('[data-sku-selected]');
    let selected=null,results=[],cursor=-1,revision=0,timer=null;
    const hide=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');cursor=-1;};
    const choose=p=>{selected=p;input.value=p.sku;input.setCustomValidity('');summary.textContent=`${p.name} · ${p.size??p.label??''}${p.price!=null?' · '+Number(p.price).toLocaleString('th-TH',{minimumFractionDigits:2})+' บาท':''}`;hide();onSelect(p);};
    const showResults=(items,q)=>{
      const exact=items.filter(p=>active(p)&&normalize(p.sku)===q);
      if(q&&exact.length===1){choose(exact[0]);return;}
      results=matches(items,q);cursor=-1;list.replaceChildren();
      summary.textContent=q?(results.length?'เลือกสินค้าให้ตรงกับรหัสที่ต้องการ':'ไม่พบรหัสสินค้านี้ กรุณาตรวจสอบรหัส'):'พิมพ์รหัสสินค้าเพื่อเติมชื่อ ขนาด และราคา';
      for(const [i,p] of results.entries()){
        const option=document.createElement('button');option.type='button';option.id=id+'-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
        option.style.cssText='display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #edf0f3;padding:10px;background:white;color:#24344e;font:inherit;cursor:pointer';
        option.textContent=`${p.sku} — ${p.name} · ${p.size??p.label??''}`;option.onclick=()=>choose(p);list.append(option);
      }
      list.hidden=!results.length;input.setAttribute('aria-expanded',String(!!results.length));
    };
    const search=()=>{
      const q=normalize(input.value);
      if(selected&&normalize(selected.sku)===q)return;
      const version=++revision;clearTimeout(timer);results=[];list.replaceChildren();hide();
      selected=null;onSelect(null);input.setCustomValidity(q?'กรุณาเลือกรหัสสินค้าที่ถูกต้อง':'กรุณาระบุรหัสสินค้า');
      if(!lookup||!q){showResults(lookup?[]:products,q);return;}
      summary.textContent='กำลังค้นหารหัสสินค้า…';
      timer=setTimeout(async()=>{
        try{
          const items=await lookup(q);
          if(version!==revision||normalize(input.value)!==q||root.isConnected===false)return;
          if(!Array.isArray(items))throw Error('ข้อมูลสินค้าไม่ถูกต้อง');
          showResults(items,q);
        }catch(error){
          if(version!==revision||root.isConnected===false)return;
          summary.textContent='ค้นหาสินค้าไม่สำเร็จ: '+error.message+' — ลองพิมพ์รหัสอีกครั้ง';
        }
      },200);
    };
    input.addEventListener('input',search);
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(!selected&&results.length)choose(results[Math.max(0,cursor)]);return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();return;}
      if((event.key==='ArrowDown'||event.key==='ArrowUp')&&results.length&&!list.hidden){
        event.preventDefault();cursor=(cursor+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;
        [...list.children].forEach((b,i)=>{b.setAttribute('aria-selected',String(i===cursor));b.style.background=i===cursor?'#edf5f3':'white';});input.setAttribute('aria-activedescendant',id+'-'+cursor);
      }
    });
    input.setCustomValidity('กรุณาระบุรหัสสินค้า');summary.textContent='พิมพ์รหัสสินค้าเพื่อเติมชื่อ ขนาด และราคา';
    return {read:()=>selected};
  };
  window.ProductCodePicker={normalize,matches,mount,configure(fn){provider=fn;},async catalog(){if(!provider)throw Error('กรุณารอระบบเชื่อมต่อสินค้าแล้วลองใหม่');return provider();}};
})();
