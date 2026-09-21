// Shared document family: quotation (teal) and billing note (muted plum).
(() => {
  const W=1240,H=1754,L=83,R=1157,INK='#245b57',LINE='#c5d6d3',MUTED='#526d69',HEADER='#edf5f3';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=s=>s?new Date(s+'T00:00:00').toLocaleDateString('th-TH'):'-';
  const wrap=(value,width,size,bold,measure)=>{
    const lines=[],seg=new Intl.Segmenter('th',{granularity:'word'}),graphemes=new Intl.Segmenter('th',{granularity:'grapheme'});
    for(const paragraph of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
      const tokens=[];for(const part of seg.segment(paragraph)){if(!part.isWordLike&&part.segment.trim()&&tokens.length)tokens[tokens.length-1]+=part.segment;else tokens.push(part.segment);}
      let line='';for(const token of tokens){
        if(line&&measure(line+token,size,bold)>width){lines.push(line.trimEnd());line='';}
        const value=line?token:token.trimStart();
        for(const {segment} of graphemes.segment(value)){if(line&&measure(line+segment,size,bold)>width){lines.push(line);line='';}line+=segment;}
      }lines.push(line.trimEnd());
    }return lines;
  };
  const build=(company,doc,items,measure,logo=null)=>{
    const billing=doc.kind==='billing_note';
    const INK=billing?'#65516f':'#245b57',LINE=billing?'#d8cedd':'#c5d6d3',MUTED=billing?'#776b7f':'#526d69',HEADER=billing?'#f3eef5':'#edf5f3';
    const title=billing?'ใบวางบิล':'ใบเสนอราคา',english=billing?'BILLING NOTE':'QUOTATION';
    if(billing&&items.some(item=>item.kind!=='tax_invoice'||!item.document_number||item.grand_total==null||!Number.isFinite(Number(item.grand_total))||Number(item.grand_total)<0))throw Error('รายการใบวางบิลต้องเชื่อมกับใบกำกับภาษีที่ออกแล้ว');
    const billingTotal=billing?items.reduce((sum,item)=>sum+Math.round(Number(item.grand_total)*100),0)/100:0;
    const details=window.QuotationEditor?.decode(doc.notes)||{paymentTerms:'',deliveryTerms:'',notes:doc.notes||'',rates:[]};
    const pages=[];let page,y,tableTop;
    const text=(s,x,y,size=19,bold=false,align='left',color=INK)=>page.push({type:'text',s:String(s??''),x,y,size,bold,align,color});
    const rect=(x,y,w,h,fill='#ffffff',stroke=LINE)=>page.push({type:'rect',x,y,w,h,fill,stroke});
    const line=(x,y,x2,y2,color=LINE,width=1)=>page.push({type:'line',x,y,x2,y2,color,width});
    const block=(s,x,y,width,size=19,bold=false,color=INK)=>{const lines=wrap(s,width,size,bold,measure);lines.forEach((s,i)=>text(s,x,y+i*size*1.55,size,bold,'left',color));return lines.length*size*1.55;};
    const start=()=>{
      page=[];pages.push(page);
      // Keep the issuer in one aligned block beside a proportionate logo.
      // Its width ends before the document heading, even for long addresses.
      const nameX=logo?L+146:L,nameWidth=641-(nameX-L);
      const logoHeight=logo?Math.min(120,120*logo.height/logo.width):0;
      const logoWidth=logo?logoHeight*logo.width/logo.height:0;
      if(logo)page.push({type:'image',image:logo.image,href:logo.href,x:L+(120-logoWidth)/2,y:78,w:logoWidth,h:logoHeight});
      let cy=78;cy+=block(company.name||'-',nameX,cy,nameWidth,26,true)+14;
      cy+=block(window.DocumentAddress.format(company.address)||'-',nameX,cy,nameWidth,18,false,MUTED)+13;
      cy+=block('เลขประจำตัวผู้เสียภาษี '+(company.tax_id||'-'),nameX,cy,nameWidth,16,false,MUTED);
      cy=Math.max(cy,78+logoHeight);
      text(title,R,76,39,true,'right');text(english,R,128,17,false,'right',MUTED);
      const no=wrap(doc.document_number||'ตัวอย่าง',345,19,true,measure);
      text('เลขที่เอกสาร',R,165,15,false,'right',MUTED);no.forEach((s,i)=>text(s,R,193+i*29,19,true,'right'));
      const dy=193+no.length*29;text('วันที่ '+date(doc.issue_date),R,dy,18,false,'right');
      const headBottom=Math.max(cy,dy+30)+28;line(L,headBottom,R,headBottom,INK,3);
      const customerLines=wrap(doc.customer_name_snapshot||'-',595,21,true,measure);
      const address=wrap(window.DocumentAddress.format(doc.customer_address_snapshot)||'-',595,18,false,measure);
      const tax=wrap('เลขประจำตัวผู้เสียภาษี '+(doc.customer_tax_id_snapshot||'-'),595,16,false,measure);
      const detailRows=(billing?[['เอกสารที่นำมาวางบิล',items.length+' ใบกำกับภาษี'],['ครบกำหนดชำระ', 'ตามวันที่ในแต่ละรายการ'],['เงื่อนไขชำระเงิน / เครดิต',details.paymentTerms||'-']]:[['ยืนราคาถึง',date(doc.valid_until)],['กำหนดส่งสินค้า',details.deliveryTerms||'-'],['เงื่อนไขชำระเงิน / เครดิต',details.paymentTerms||'-']]).map(([label,value])=>({label,lines:wrap(value,365,18,true,measure)}));
      const detailHeight=55+detailRows.reduce((h,row)=>h+25+row.lines.length*27+12,0);
      const boxY=headBottom+30,boxH=Math.max(detailHeight,65+customerLines.length*32+address.length*28+tax.length*25);
      if(boxY+boxH>900)throw Error('ข้อมูลหัวเอกสารหรือที่อยู่ยาวเกินพื้นที่'+title+' กรุณาตรวจข้อมูลก่อนพิมพ์');
      rect(L,boxY,641,boxH);rect(748,boxY,409,boxH);line(748,boxY,748,boxY+boxH,INK,4);
      text('ลูกค้า / CUSTOMER',L+22,boxY+19,16,false,'left',MUTED);let ay=boxY+55;
      customerLines.forEach(s=>{text(s,L+22,ay,21,true);ay+=32;});
      address.forEach(s=>{text(s,L+22,ay,18);ay+=28;});
      tax.forEach(s=>{text(s,L+22,ay+5,16,false,'left',MUTED);ay+=25;});
      text('รายละเอียด / DETAILS',770,boxY+19,16,false,'left',MUTED);
      let detailY=boxY+55;detailRows.forEach(row=>{text(row.label,770,detailY,15,false,'left',MUTED);detailY+=25;row.lines.forEach(s=>{text(s,770,detailY,18,true);detailY+=27;});detailY+=12;});
      y=boxY+boxH+38;tableTop=null;
    };
    const widths=billing?[64,470,170,190,180]:[50,550,100,130,90,154],xs=[L];widths.forEach(w=>xs.push(xs.at(-1)+w));
    const tableHeader=()=>{text(billing?'รายการบิล / เอกสาร':'รายการสินค้า / ขนาด',L,y,20,true);text(items.length+' รายการ',R,y,16,false,'right',MUTED);y+=37;tableTop=y;
      widths.forEach((w,i)=>rect(xs[i],y,w,64,HEADER));line(L,y,R,y,INK,3);
      (billing?[['ลำดับ','NO.'],['ชื่อบิล/เอกสาร','BILL / DOCUMENT'],['วันที่บิล','BILL DATE'],['ครบกำหนดชำระ','DUE DATE'],['จำนวนเงิน','AMOUNT']]:[['ลำดับ','NO.'],['รายการสินค้า / ขนาด','DESCRIPTION / SIZE'],['จำนวน','QTY / UNIT'],['ราคาต่อหน่วย','UNIT PRICE'],['ลด (%)','DISCOUNT'],['จำนวนเงิน','AMOUNT']]).forEach(([th,en],i)=>{const center=xs[i]+widths[i]/2;text(th,center,y+11,16,true,'center');text(en,center,y+36,12,false,'center',MUTED);});y+=64;};
    start();tableHeader();
    items.forEach((item,index)=>{
      const gross=Number(item.quantity)*Number(item.unit_price);
      const rate=window.QuotationEditor?window.QuotationEditor.rateFor(item,index,details):(gross?Number(item.discount_amount||0)/gross*100:0);
      const cells=billing?[String(index+1),'ใบกำกับภาษี เลขที่ '+item.document_number,date(item.issue_date),date(item.due_date||item.issue_date),money(item.grand_total)]:[String(index+1),[item.product_name_snapshot,item.specification_snapshot].filter(v=>v!=null&&String(v).trim()).join(' '),String(item.quantity)+(item.unit_snapshot?' '+item.unit_snapshot:''),money(item.unit_price),Number(rate.toFixed(2))+'%',money(item.line_total)];
      const wrapped=cells.map((s,i)=>wrap(s,widths[i]-28,18,false,measure));let offset=0,total=Math.max(...wrapped.map(a=>a.length));
      while(offset<total){if(y+52>1450){start();tableHeader();}
        const capacity=Math.max(1,Math.floor((1450-y-24)/28)),count=Math.min(capacity,total-offset),h=count*28+24;
        widths.forEach((w,i)=>{rect(xs[i],y,w,h);const center=i===0||(billing&&(i===2||i===3));wrapped[i].slice(offset,offset+count).forEach((s,j)=>text(s,i===1?xs[i]+14:center?xs[i]+w/2:xs[i]+w-14,y+12+j*28,18,false,i===1?'left':center?'center':'right'));});
        y+=h;offset+=count;
      }
    });
    if(!items.length){rect(L,y,R-L,55);text(billing?'ไม่มีใบกำกับภาษีที่เชื่อมอยู่':'ไม่มีรายการสินค้า',L+20,y+17,18,false,'left',MUTED);y+=55;}
    if(pages.length===1){while(y+32<=1040){widths.forEach((w,i)=>rect(xs[i],y,w,32));y+=32;}}
    y+=24;
    const notes=wrap(details.notes||'-',R-L-40,18,false,measure);let at=0;
    while(at<notes.length){if(y+110>1510){start();y+=16;}const capacity=Math.max(1,Math.floor((1510-y-60)/28)),part=notes.slice(at,at+capacity),h=60+part.length*28;
      rect(L,y,R-L,h);text('หมายเหตุ / REMARKS'+(at?' (ต่อ)':''),L+20,y+15,15,true,'left',MUTED);part.forEach((s,i)=>text(s,L+20,y+48+i*28,18));y+=h+24;at+=part.length;
    }
    if(y+(billing?310:448)>1630){start();y+=20;}
    const amounts=billing?[['ยอดวางบิล / TOTAL',billingTotal]]:[['รวมก่อนส่วนลด',doc.subtotal],['ส่วนลด',doc.discount_amount],['มูลค่าก่อน VAT',doc.taxable_amount],['VAT '+(doc.vat_rate??0)+'%',doc.vat_amount],['ยอดสุทธิ / TOTAL',doc.grand_total]];
    amounts.forEach(([label,value],i)=>{const yy=y+i*45,last=i===amounts.length-1;rect(713,yy,444,45,last?INK:'#ffffff');text(label,733,yy+12,18,last,'left',last?'#ffffff':INK);text(money(value),1137,yy+12,19,true,'right',last?'#ffffff':INK);});y+=amounts.length*45+28;
    if(billing){text('ยอดตามใบกำกับภาษี รวมภาษีแล้ว ไม่คิด VAT ซ้ำ',L,y,15,false,'left',MUTED);y+=34;}
    (billing?[['ผู้วางบิล','PREPARED BY'],['ผู้รับวางบิล','RECEIVED BY'],['ผู้อนุมัติ','AUTHORIZED BY']]:[['ผู้เสนอราคา','PREPARED BY'],['ผู้อนุมัติ','AUTHORIZED BY'],['ลูกค้ายืนยันการสั่งซื้อ','ACCEPTED BY']]).forEach(([th,en],i)=>{const x=L+i*366;rect(x,y,342,161);line(x+20,y+76,x+322,y+76);text(th,x+171,y+89,18,true,'center');text(en,x+171,y+116,12,false,'center',MUTED);text('วันที่ ........ / ........ / ........',x+171,y+139,14,false,'center',MUTED);});
    pages.forEach((p,i)=>{page=p;line(L,1670,R,1670);text(title+' / '+english,L,1690,13,false,'left',MUTED);text((doc.document_number||'ตัวอย่าง')+'  |  หน้า '+(i+1)+' / '+pages.length,R,1690,13,false,'right',MUTED);});
    return pages;
  };
  const toSVG=pages=>pages.map((commands,i)=>`<svg xmlns="http://www.w3.org/2000/svg" class="qt-sheet" role="img" aria-label="ใบเสนอราคา หน้า ${i+1}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="white"/>${commands.map(c=>c.type==='image'?`<image x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" href="${escape(c.href)}" preserveAspectRatio="xMidYMid meet" aria-label="โลโก้บริษัท"/>`:c.type==='text'?`<text x="${c.x}" y="${c.y+c.size*.85}" font-family="Tahoma,Arial,sans-serif" font-size="${c.size}" font-weight="${c.bold?700:400}" text-anchor="${c.align==='right'?'end':c.align==='center'?'middle':'start'}" fill="${c.color}" xml:space="preserve">${escape(c.s)}</text>`:c.type==='rect'?`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${c.fill}" stroke="${c.stroke}"/>`:`<line x1="${c.x}" y1="${c.y}" x2="${c.x2}" y2="${c.y2}" stroke="${c.color}" stroke-width="${c.width}"/>`).join('')}</svg>`).join('');
  const draw=(pages,createCanvas)=>pages.map(commands=>{const canvas=createCanvas();canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);commands.forEach(c=>{if(c.type==='image'){ctx.drawImage(c.image,c.x,c.y,c.w,c.h);}else if(c.type==='text'){ctx.font=`${c.bold?'bold ':''}${c.size}px Tahoma,Arial,sans-serif`;ctx.textBaseline='alphabetic';ctx.textAlign=c.align;ctx.fillStyle=c.color;ctx.fillText(c.s,c.x,c.y+c.size*.85);}else if(c.type==='rect'){ctx.fillStyle=c.fill;ctx.fillRect(c.x,c.y,c.w,c.h);ctx.strokeStyle=c.stroke;ctx.lineWidth=1;ctx.strokeRect(c.x,c.y,c.w,c.h);}else{ctx.strokeStyle=c.color;ctx.lineWidth=c.width;ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.x2,c.y2);ctx.stroke();}});return canvas;});
  const prepare=async(company,doc,items)=>{await document.fonts.ready;const image=new Image();image.src=new URL('company-logo.png',document.baseURI).href;try{await image.decode();}catch{throw Error('โหลดโลโก้บริษัทไม่ได้ กรุณาโหลดหน้าเว็บใหม่ก่อนพิมพ์');}const asset=document.createElement('canvas');asset.width=image.naturalWidth;asset.height=image.naturalHeight;asset.getContext('2d').drawImage(image,0,0);const logo={image,href:asset.toDataURL('image/png'),width:image.naturalWidth,height:image.naturalHeight};const ctx=document.createElement('canvas').getContext('2d');return build(company,doc,items,(s,size,bold)=>{ctx.font=`${bold?'bold ':''}${size}px Tahoma,Arial,sans-serif`;return ctx.measureText(s).width;},logo);};
  const styles=`<style>#document-preview .qt-sheet{display:block;width:210mm;height:297mm;max-width:none;margin:24px auto;background:white;box-shadow:0 10px 45px #17203318}#document-preview .print-tools{flex-wrap:wrap}@media print{@page{size:A4;margin:0}#document-preview .qt-sheet{width:210mm;height:297mm;margin:0;box-shadow:none;break-after:page;page-break-after:always;print-color-adjust:exact}#document-preview .qt-sheet:last-child{break-after:auto;page-break-after:auto}}</style>`;
  window.QuotationLayout={build,toSVG,draw,prepare,styles};
  window.BillingLayout={build,draw,prepare,styles,toSVG:pages=>toSVG(pages).replaceAll('aria-label="ใบเสนอราคา หน้า','aria-label="ใบวางบิล หน้า')};
})();
