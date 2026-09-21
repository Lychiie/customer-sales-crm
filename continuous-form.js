// Letter print profile measured from the user's calibrated PDF (612.08 x 792.07 pt).
// Coordinates are millimetres from the Letter page origin; Y is a text baseline.
// Physical stock is 9 x 11 including tractor strips. Do not stretch this layout to 9 inches.
(() => {
  const WIDTH=215.9, HEIGHT=279.4, FONT='CordiaUPC, "Cordia New", Tahoma, sans-serif';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=value=>value?new Date(value+'T00:00:00').toLocaleDateString('th-TH'):'';
  const fields={
    company:['ชื่อบริษัท',31.36,14.51,174,9],companyAddress:['ที่อยู่บริษัท',31.40,19.89,174,6],companyTax:['เลขผู้เสียภาษีบริษัท',31.55,26.76,174,6],
    customer:['ชื่อลูกค้า',34.66,40.25,101,10],branch:['สาขาลูกค้า',30.76,51.58,104,6],tax:['เลขผู้เสียภาษีลูกค้า',50.61,56.07,84,6],address:['ที่อยู่ลูกค้า',22.82,61.87,112,13],
    number:['เลขที่เอกสาร',176.60,40.76,31,6],date:['วันที่',176.41,46.44,31,6],due:['กำหนดชำระ',176.60,53.44,31,6],terms:['เครดิต (ช่องเสริม)',176.60,60.47,31,6],reference:['อ้างอิง (ช่องเสริม)',176.60,67.50,31,6],employee:['พนักงานขาย (ช่องเสริม)',176.60,74.53,31,6],po:['เลขที่ใบสั่งซื้อ (ช่องเสริม)',176.60,81.56,31,6],
    notes:['หมายเหตุ',6.67,206.69,124,21],amountWords:['จำนวนเงินตัวอักษร',6.67,234.11,124,7],vatRate:['อัตรา VAT',164.53,227.52,10,6],
    subtotal:['รวมจำนวนเงิน',177.47,206.69,26,6],discount:['ส่วนลด',177.47,213.81,26,6],base:['จำนวนเงินก่อนภาษี',177.47,220.93,26,6],vat:['ภาษีมูลค่าเพิ่ม',177.47,228.31,26,6],total:['จำนวนเงินรวมทั้งสิ้น',177.47,235.17,26,6]
  };
  const defaults=()=>({x:0,y:0,font:13,line:7.03,start:94.95,end:198,fieldPositions:{}});
  const validate=cfg=>{
    for(const [key,min,max] of [['x',-15,15],['y',-15,15],['font',10,16],['line',4,10],['start',85,110],['end',160,200]])if(!Number.isFinite(cfg[key])||cfg[key]<min||cfg[key]>max)throw Error('ค่าปรับระยะอยู่นอกช่วงที่กำหนด');
    if(cfg.end-cfg.start<cfg.line)throw Error('พื้นที่รายการสินค้าไม่เพียงพอ');
    if(cfg.line<cfg.font*25.4/72)throw Error('ระยะบรรทัดน้อยกว่าขนาดตัวอักษร กรุณาเพิ่มระยะบรรทัด');
    for(const [key,p] of Object.entries(cfg.fieldPositions||{}))if(!fields[key]||!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<4||p.x+fields[key][3]>WIDTH-4||p.y<7||p.y+fields[key][4]>HEIGHT-4)throw Error('ตำแหน่งช่องข้อมูลอยู่นอกพื้นที่พิมพ์');
    return cfg;
  };
  const bahtText=value=>{
    const n=Number(value);if(!Number.isFinite(n)||n<0||n>999999999999)return '';
    const digits=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const integer=v=>{if(v>=1000000)return integer(Math.floor(v/1000000))+'ล้าน'+(v%1000000?integer(v%1000000):'');let out='';const s=String(v);for(let i=0;i<s.length;i++){const d=Number(s[i]),p=s.length-i-1;if(!d)continue;out+=(p===0&&d===1&&s.length>1?'เอ็ด':p===1&&d===1?'':p===1&&d===2?'ยี่':digits[d])+['','สิบ','ร้อย','พัน','หมื่น','แสน'][p];}return out||'ศูนย์';};
    const cents=Math.round(n*100),whole=Math.floor(cents/100),fraction=cents%100;return integer(whole)+'บาท'+(fraction?integer(fraction)+'สตางค์':'ถ้วน');
  };
  // Preserve explicit newlines while wrapping descriptions to the actual column width.
  const wrap=(value,width,measure)=>{
    const lines=[];
    const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('th',{granularity:'grapheme'}):null;
    for(const paragraph of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
      const chars=segmenter?[...segmenter.segment(paragraph)].map(s=>s.segment):Array.from(paragraph);
      let line='';for(const char of chars){if(line&&measure(line+char)>width){lines.push(line);line='';}line+=char;}lines.push(line);
    }
    return lines;
  };
  // Format only the printed snapshot; never change the saved address.
  const addressLines=(value,width,measure)=>{
    const original=String(value??'').trim();if(!original)return [];
    const explicit=original.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const fits=lines=>lines.every(s=>measure(s)<=width);
    if(explicit.length===2&&fits(explicit))return explicit;
    const text=original.replace(/\s+/g,' ');
    const split=i=>[text.slice(0,i).trim(),text.slice(i).trim()];
    // Prefer a meaningful second line starting with subdistrict/locality.
    for(const match of text.matchAll(/(?:ตำบล|แขวง|ต\.|อำเภอ|เขต|อ\.)/g)){
      const lines=split(match.index);if(lines.every(Boolean)&&fits(lines))return lines;
    }
    const breaks=new Set([...text.matchAll(/\s+/g)].map(m=>m.index));
    if(typeof Intl.Segmenter==='function')for(const part of new Intl.Segmenter('th',{granularity:'word'}).segment(text))breaks.add(part.index);
    const choices=[...breaks].map(split).filter(lines=>lines.every(Boolean));
    choices.sort((a,b)=>Math.max(...a.map(measure))-Math.max(...b.map(measure)));
    return choices.find(fits)||choices[0]||[text];
  };
  const paginate=(items,cfg,measure)=>{
    validate(cfg);
    const capacity=Math.floor((cfg.end-cfg.start)/cfg.line),pages=[[]];let used=0;
    items.forEach((item,index)=>{
      const text=[item.product_name_snapshot,item.specification_snapshot].filter(v=>v!=null&&String(v).trim()).join(' ');
      const lines=wrap(text,88.5*96/25.4,measure);
      let offset=0;
      while(offset<lines.length){if(used===capacity){pages.push([]);used=0;}const chunk=lines.slice(offset,offset+capacity-used);pages.at(-1).push({item,index,lines:chunk,row:used,first:offset===0});used+=chunk.length;offset+=chunk.length;}
    });return pages;
  };
  const open=async(company,doc,items,organizationId)=>{
    if(doc.kind!=='tax_invoice')throw Error('แบบกระดาษต่อเนื่องนี้สำหรับใบกำกับภาษี');
    await document.fonts.ready;
    // Decode before showing the preview so a fast print cannot omit the logo.
    const logo=new Image();logo.src=new URL('company-logo.png',document.baseURI).href;
    try{await logo.decode();}catch{throw Error('โหลดโลโก้บริษัทไม่ได้ กรุณาโหลดหน้าเว็บใหม่ก่อนพิมพ์');}
    document.querySelector('#continuous-preview')?.remove();
    const storageKey=`flowbill-continuous-letter-pdf-v2-${organizationId}`;
    let cfg=defaults(),savedMessage='';
    try{const saved=localStorage.getItem(storageKey);if(saved)cfg=validate({...defaults(),...JSON.parse(saved)});}catch{cfg=defaults();savedMessage='อ่านค่าที่เคยตั้งไม่ได้ ใช้ค่าตาม PDF เริ่มต้น';}
    const overlay=document.createElement('section');overlay.id='continuous-preview';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','พิมพ์ฟอร์มต่อเนื่อง Letter');
    overlay.innerHTML=`<style>
      #continuous-preview{position:fixed;inset:0;z-index:11000;background:#e9edf2;overflow:auto;color:#172033;font:14px Tahoma,Arial,sans-serif;padding:18px}
      #continuous-preview .cf-tools{max-width:1000px;margin:0 auto 18px;background:white;border-radius:10px;padding:18px}
      #continuous-preview h2{font-size:20px;margin:0 0 10px}#continuous-preview p{margin:8px 0;line-height:1.6}
      #continuous-preview .cf-controls{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}#continuous-preview label{font-size:12px}#continuous-preview input[type=number]{display:block;width:95px;padding:7px;border:1px solid #b7c2cf;border-radius:4px}
      #continuous-preview button{padding:9px 13px;margin:4px;border:1px solid #b7c2cf;border-radius:5px;cursor:pointer}#continuous-preview button:disabled{opacity:.5;cursor:not-allowed}
      #continuous-preview .cf-error{color:#aa271a;white-space:pre-wrap}#continuous-preview .cf-notice{background:#fff6d9;padding:10px}
      #continuous-preview .cf-coordinates{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:12px 0}#continuous-preview .cf-coordinate{display:flex;align-items:center;gap:8px}#continuous-preview .cf-coordinate span{width:130px}#continuous-preview .cf-coordinate input{width:65px}
      #continuous-preview .cf-sheet{position:relative;width:215.9mm;height:279.4mm;margin:16px auto;background:white;color:black;box-sizing:border-box;box-shadow:0 4px 18px #0002;overflow:hidden;font-family:${FONT}}
      #continuous-preview .cf-field{position:absolute;margin:0;padding:0;white-space:pre-wrap;overflow-wrap:anywhere;font-weight:400;box-sizing:border-box}
      #continuous-preview .cf-company-logo{position:absolute;width:24.10mm;height:22.78mm;max-width:none;object-fit:contain;object-position:center;print-color-adjust:exact}
      #continuous-preview .cf-guide{position:absolute;border:1px dashed #8b9aa9;box-sizing:border-box;pointer-events:none;font:8pt Tahoma;color:#607589;padding:1mm}
      #continuous-preview .cf-guide.line{border:0;border-top:1px dotted #bdc7cf;padding:0}#continuous-preview .cf-guides.hidden{display:none}
      @media print{
        @page{size:215.9mm 279.4mm;margin:0}
        html,body{margin:0!important;padding:0!important;background:white!important}
        body>*:not(#continuous-preview){display:none!important}
        body>#continuous-preview{display:block!important;position:static!important;padding:0!important;overflow:visible!important;background:white!important}
        #continuous-preview .cf-tools{display:none!important}#continuous-preview .cf-sheet{margin:0;box-shadow:none;break-after:page;page-break-after:always}
        #continuous-preview .cf-sheet:last-child{break-after:auto;page-break-after:auto}#continuous-preview .cf-guides{display:none!important}
        #continuous-preview.cf-test .cf-guides{display:block!important}#continuous-preview.cf-test .cf-sheet{print-color-adjust:exact}
        #continuous-preview.cf-blocked .cf-sheet{display:none!important}
      }
    </style><div class="cf-tools"><h2>ฟอร์มต่อเนื่อง Letter · EPSON LQ-630</h2><p class="cf-notice">ตำแหน่งข้อมูลอ้างอิง PDF ของคุณ • หน้า Letter 8.5 × 11 นิ้ว แม้กระดาษรวมรูหนามเตยกว้าง 9 นิ้ว • ไม่พิมพ์เส้นตารางซ้ำ • ต้องทดสอบกับเครื่องจริงก่อนใช้งาน</p><p>เลือก Paper Size: Letter (215.9 × 279.4 มม.) / ขนาดจริง 100% / ปิดหัว–ท้ายกระดาษ / จำนวนสำเนา 1 • ใช้ Chrome หรือ Edge ภายนอกแอปเพื่อเปิดหน้าต่างพิมพ์</p><div class="cf-controls">${[['x','เลื่อนขวา (+) มม.',-15,15,.1],['y','เลื่อนลง (+) มม.',-15,15,.1],['font','ตัวอักษร Cordia (pt)',10,16,.5],['line','ระยะบรรทัด (มม.)',4,10,.01],['start','เส้นฐานรายการ Y (มม.)',85,110,.1],['end','สิ้นสุดรายการ Y (มม.)',160,200,.1]].map(([key,label,min,max,step])=>`<label>${label}<input type="number" data-setting="${key}" value="${cfg[key]}" min="${min}" max="${max}" step="${step}"></label>`).join('')}</div><details><summary>ปรับตำแหน่งแต่ละช่อง (X จากขอบซ้ายหน้า Letter / Y ถึงเส้นฐานตัวอักษรจากขอบบน ไม่ใช่ขอบรูหนามเตย)</summary><div class="cf-coordinates">${Object.entries(fields).map(([key,[label,x,y]])=>`<div class="cf-coordinate"><span>${label}</span><label>X<input aria-label="${label} X" type="number" data-field="${key}" data-axis="x" step="0.1" value="${cfg.fieldPositions[key]?.x??x}"></label><label>Y<input aria-label="${label} Y" type="number" data-field="${key}" data-axis="y" step="0.1" value="${cfg.fieldPositions[key]?.y??y}"></label></div>`).join('')}</div></details><p>ใช้ CordiaUPC ตาม PDF (เครื่องที่ไม่มีแบบอักษรนี้อาจมีระยะต่างกัน) • พิมพ์โลโก้บริษัทที่มุมซ้ายบนทุกหน้า</p><p>ช่องสาขา เครดิต อ้างอิง พนักงานขาย และ PO จะว่างหากเอกสารไม่มีข้อมูล ไม่เติมข้อมูลแทนโดยอัตโนมัติ</p><label><input type="checkbox" data-guides checked> แสดงแนวช่องบนจอ (ไม่ออกในพิมพ์จริง)</label><p data-status role="status">${escape(savedMessage)}</p><p class="cf-error" data-error role="alert"></p><div><button data-back>กลับเอกสาร A4</button><button data-apply>ปรับตัวอย่าง</button><button data-reset>คืนค่าตาม PDF</button><button data-save>จำค่าระยะในเบราว์เซอร์นี้</button><button data-test>พิมพ์ทดสอบพร้อมแนวช่อง</button><button class="primary" data-print>พิมพ์ลงฟอร์มจริง</button></div><p>ทดสอบกับกระดาษเปล่าขนาดเดียวกันก่อน แล้วลองป้อนต่อเนื่อง 3 ชุดเพื่อตรวจระยะสะสม • เอกสารหลายหน้าแสดงยอดรวมเฉพาะหน้าสุดท้าย</p></div><div class="cf-pages"></div>`;
    document.body.append(overlay);
    const context=document.createElement('canvas').getContext('2d');
    const read=()=>{
      const candidate=defaults();overlay.querySelectorAll('[data-setting]').forEach(i=>candidate[i.dataset.setting]=i.value===''?NaN:Number(i.value));
      overlay.querySelectorAll('[data-field]').forEach(i=>{candidate.fieldPositions[i.dataset.field]??={};candidate.fieldPositions[i.dataset.field][i.dataset.axis]=i.value===''?NaN:Number(i.value);});return validate(candidate);
    };
    const render=()=>{
      const warnings=[];overlay.classList.add('cf-blocked');overlay.querySelectorAll('[data-print],[data-test]').forEach(b=>b.disabled=true);
      try{
        cfg=read();context.font=`${cfg.font*96/72}px ${FONT}`;
        const pages=paginate(items,cfg,s=>context.measureText(s).width);
        if(5.93+cfg.x<0||6.80+cfg.y<0)warnings.push('โลโก้เลยขอบหน้า Letter กรุณาลดระยะเลื่อน');
        const mm=value=>Number(value).toFixed(3)+'mm';
        const make=(text,x,y,w,h,align='left',font=cfg.font,family=FONT,bold=false,spacing=4.5)=>{
          if(!String(text??'').length)return '';
          const em=font*25.4/72;
          if(x+cfg.x<4||x+w+cfg.x>WIDTH-4||y-em+cfg.y<0||y+h+cfg.y>HEIGHT-4)warnings.push('มีข้อความเลยพื้นที่หน้า Letter กรุณาลดระยะเลื่อน');
          context.font=`${bold?'bold ':''}${font*96/72}px ${family}`;
          const lines=wrap(text,w*96/25.4,s=>context.measureText(s).width);
          // A number must never wrap into a second line of a neighbouring row.
          if((align==='right'&&lines.length>1)||(lines.length-1)*spacing+em>h+.15)warnings.push('ข้อความยาวเกินช่อง: '+String(text).slice(0,35)+' — ลดตัวอักษรหรือปรับข้อมูลก่อนพิมพ์');
          const anchor=align==='right'?'end':align==='center'?'middle':'start',tx=align==='right'?w:align==='center'?w/2:0;
          // SVG baselines avoid CSS line-box/font ascent differences shifting the PDF coordinates.
          return `<svg class="cf-field" xmlns="http://www.w3.org/2000/svg" aria-label="${escape(text)}" style="left:${mm(x+cfg.x)};top:${mm(y-em+cfg.y)};width:${mm(w)};height:${mm(h+em)};overflow:visible" viewBox="0 0 ${w} ${h+em}"><text font-family="${escape(family)}" font-size="${em}" font-weight="${bold?'700':'400'}" text-anchor="${anchor}" xml:space="preserve">${lines.map((line,i)=>`<tspan x="${tx}" y="${em+i*spacing}">${escape(line)}</tspan>`).join('')}</text></svg>`;
        };
        const field=(key,text,align='left')=>{
          const [,x,y,w,h]=fields[key],p=cfg.fieldPositions[key]||{x,y};
          if(key==='address'){
            let font=cfg.font,lines=[];
            for(;font>=10;font-=.5){context.font=`${font*96/72}px ${FONT}`;lines=addressLines(text,w*96/25.4,s=>context.measureText(s).width);if(lines.every(s=>context.measureText(s).width<=w*96/25.4))break;}
            if(font<10){font=10;warnings.push('ที่อยู่ยาวเกิน 2 บรรทัด กรุณาย่อที่อยู่ก่อนพิมพ์');}
            return make(lines.join('\n'),p.x,p.y,w,h,align,font,FONT,false,6.33);
          }
          const heading=key.startsWith('company');return make(text,p.x,p.y,w,h,align,heading?(key==='company'?24:12):cfg.font,heading?'Browallia New, Tahoma, sans-serif':FONT,heading);
        };
        const header={company:company.name||'',companyAddress:company.address||'',companyTax:company.tax_id?'เลขประจำตัวผู้เสียภาษี '+company.tax_id:'',customer:doc.customer_name_snapshot||'',branch:doc.customer_branch_snapshot||'',tax:doc.customer_tax_id_snapshot||'',address:doc.customer_address_snapshot||'',number:doc.document_number,date:date(doc.issue_date),due:date(doc.due_date),terms:doc.credit_term_snapshot||'',reference:doc.reference||'',employee:doc.employee_name_snapshot||'',po:doc.po_number||''};
        overlay.querySelector('.cf-pages').innerHTML=pages.map((rows,pageIndex)=>{
          const last=pageIndex===pages.length-1;
          let html=`<img class="cf-company-logo" alt="โลโก้บริษัท" src="${escape(logo.src)}" style="left:${mm(5.93+cfg.x)};top:${mm(6.80+cfg.y)}">`+Object.entries(header).map(([k,v])=>field(k,v)).join('');
          html+=make(`Page ${pageIndex+1} of ${pages.length}`,178.47,34.82,25,5,'right',8,'Arial, sans-serif');
          for(const row of rows){const y=cfg.start+row.row*cfg.line,h=row.lines.length*cfg.line;html+=make(row.lines.join('\n'),15.30,y,88.5,h,'left',cfg.font,FONT,false,cfg.line);if(row.first){html+=make(String(row.index+1),6.36,y,4,cfg.line,'right');html+=make(money(row.item.quantity),105.3,y,13,cfg.line,'right');html+=make(money(row.item.unit_price),125.4,y,23,cfg.line,'right');html+=make(money(row.item.discount_amount),150.95,y,17,cfg.line,'right');html+=make(money(row.item.line_total),176.2,y,27,cfg.line,'right');}}
          if(last){html+=field('notes',doc.notes||'');html+=field('amountWords',bahtText(doc.grand_total));html+=field('vatRate',doc.vat_rate==null?'':`${doc.vat_rate}%`);for(const [key,value] of [['subtotal',doc.subtotal],['discount',doc.discount_amount],['base',doc.taxable_amount],['vat',doc.vat_amount],['total',doc.grand_total]])html+=field(key,money(value),'right');}
          else html+=make('รายการต่อหน้าถัดไป / ยอดรวมแสดงหน้าสุดท้าย',132,213.81,71,10);
          const boxes=Object.entries(fields).map(([key,[label,x,y,w,h]])=>{const p=cfg.fieldPositions[key]||{x,y};return `<div class="cf-guide" style="left:${mm(p.x+cfg.x)};top:${mm(p.y+cfg.y)};width:${mm(w)};height:${mm(h)}">${escape(label)}</div>`;}).join('');
          const table=`<div class="cf-guide" style="left:${mm(6.36+cfg.x)};top:${mm(cfg.start+cfg.y-4.6)};width:197.11mm;height:${mm(cfg.end-cfg.start+4.6)}"></div>`+Array.from({length:Math.floor((cfg.end-cfg.start)/cfg.line)},(_,i)=>`<div class="cf-guide line" style="left:${mm(6.36+cfg.x)};top:${mm(cfg.start+cfg.y+i*cfg.line)};width:197.11mm"></div>`).join('');
          return `<article class="cf-sheet" aria-label="ฟอร์มหน้า ${pageIndex+1}"><div class="cf-guides">${boxes}${table}</div>${html}</article>`;
        }).join('');
        const unique=[...new Set(warnings)];overlay.querySelector('[data-error]').textContent=unique.join('\n');overlay.querySelector('[data-status]').textContent=`${pages.length} หน้า · ${items.length} รายการ · ตำแหน่งอ้างอิง PDF · ต้องทดสอบกับเครื่องจริง`;
        overlay.querySelectorAll('.cf-guides').forEach(g=>g.classList.toggle('hidden',!overlay.querySelector('[data-guides]').checked));
        if(!unique.length){overlay.classList.remove('cf-blocked');overlay.querySelectorAll('[data-print],[data-test]').forEach(b=>b.disabled=false);}
        return !unique.length;
      }catch(error){overlay.querySelector('[data-error]').textContent=error.message;return false;}
    };
    overlay.querySelector('[data-apply]').onclick=render;
    overlay.querySelector('[data-reset]').onclick=()=>{const d=defaults();overlay.querySelectorAll('[data-setting]').forEach(i=>i.value=d[i.dataset.setting]);overlay.querySelectorAll('[data-field]').forEach(i=>i.value=fields[i.dataset.field][i.dataset.axis==='x'?1:2]);render();};
    overlay.querySelectorAll('input[type=number]').forEach(i=>i.oninput=()=>{overlay.classList.add('cf-blocked');overlay.querySelectorAll('[data-print],[data-test]').forEach(b=>b.disabled=true);overlay.querySelector('[data-status]').textContent='มีการเปลี่ยนค่า กดปรับตัวอย่างก่อนพิมพ์';});
    overlay.querySelector('[data-guides]').onchange=()=>overlay.querySelectorAll('.cf-guides').forEach(g=>g.classList.toggle('hidden',!overlay.querySelector('[data-guides]').checked));
    overlay.querySelector('[data-save]').onclick=()=>{if(render()){try{localStorage.setItem(storageKey,JSON.stringify(cfg));overlay.querySelector('[data-status]').textContent='จำค่าระยะแล้วในเบราว์เซอร์นี้เท่านั้น (ยังต้องทดสอบเครื่องจริง)';}catch{overlay.querySelector('[data-error]').textContent='บันทึกค่าระยะไม่ได้ เบราว์เซอร์ปิดการเก็บข้อมูล';}}};
    overlay.querySelector('[data-back]').onclick=()=>{window.removeEventListener('afterprint',afterPrint);overlay.remove();};
    const afterPrint=()=>overlay.classList.remove('cf-test');window.addEventListener('afterprint',afterPrint);
    const print=test=>{if(!render())return;overlay.classList.toggle('cf-test',test);window.print();};
    overlay.querySelector('[data-test]').onclick=()=>print(true);overlay.querySelector('[data-print]').onclick=()=>print(false);render();
  };
  window.ContinuousForm={open,wrap,addressLines,paginate,defaults,validate,bahtText};
})();
