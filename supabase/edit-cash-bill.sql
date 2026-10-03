-- Atomic, tenant-scoped edits. Installation never changes existing invoices.
begin;
create or replace function public.edit_cash_bill(
 p_org uuid,p_id uuid,p_number text,p_expected_updated_at timestamptz,
 p_customer uuid,p_issue date,p_due date,p_terms text,p_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 invoice public.documents%rowtype; customer public.customers%rowtype;
 old_item public.document_items%rowtype; product record; item jsonb;
 qty numeric; price numeric; discount numeric; gross numeric;
 sub numeric:=0; discounts numeric:=0; taxable numeric; vat numeric;
 pos integer:=0; entries jsonb:='[]'::jsonb; previous_ids uuid[]:='{}';
 variant uuid; sku text; item_name text; unit text; saved_at timestamptz; old_details jsonb:='{}'::jsonb;
begin
 if auth.uid() is null or not public.crm_permission(p_org,'cash_bill','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขบิลเงินสดขององค์กรนี้' using errcode='42501'; end if;
 select * into invoice from public.documents where id=p_id and organization_id=p_org and kind='cash_bill' for update;
 if not found or invoice.deleted_at is not null then raise exception 'ไม่พบบิลเงินสดที่แก้ไขได้'; end if;
 if invoice.document_number is distinct from p_number then raise exception 'เลขที่เอกสารไม่ตรงกัน'; end if;
 if p_expected_updated_at is null or invoice.updated_at is distinct from p_expected_updated_at then
  raise exception 'เอกสารถูกแก้ไขแล้ว กรุณาปิดแล้วเปิดฟอร์มใหม่'; end if;
 if invoice.payment_received or invoice.status='cancelled' or exists(select 1 from public.payments where document_id=p_id) then
  raise exception 'ไม่สามารถแก้ใบที่ชำระแล้ว ยกเลิกแล้ว หรือมีประวัติรับชำระ'; end if;
 if exists(select 1 from public.documents d where d.id<>p_id and (d.source_document_id=p_id or (d.id=invoice.source_document_id and d.kind='billing_note'))) then
  raise exception 'ใบนี้เชื่อมกับเอกสารอื่นแล้ว กรุณาจัดการเอกสารที่เชื่อมก่อนแก้ไข'; end if;
 if p_issue is null or p_issue<'2000-01-01'::date or p_issue>'2199-12-31'::date
  or p_due is null or p_due<p_issue or p_due>'2199-12-31'::date
  or length(coalesce(p_terms,''))>120 or length(coalesce(p_notes,''))>4000 then
  raise exception 'ตรวจวันที่เอกสาร วันครบกำหนด และความยาวหมายเหตุ'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'รายการสินค้าไม่ถูกต้อง'; end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then raise exception 'ระบุสินค้า 1–200 รายการ'; end if;
 -- Retain historical customer snapshots unless a different customer is selected.
 if p_customer is distinct from invoice.customer_id then
  select * into customer from public.customers where id=p_customer and organization_id=p_org and is_active for share;
  if not found then raise exception 'ไม่พบลูกค้าที่ใช้งานขององค์กรนี้'; end if;
 else
  customer.id:=invoice.customer_id;customer.name:=invoice.customer_name_snapshot;
  customer.tax_id:=invoice.customer_tax_id_snapshot;customer.billing_address:=invoice.customer_address_snapshot;
 end if;
 if invoice.vat_rate is null or invoice.vat_rate<0 or invoice.vat_rate>100 then raise exception 'อัตรา VAT เดิมไม่ถูกต้อง'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item) is distinct from 'object'
   or jsonb_typeof(item->'quantity') is distinct from 'number'
   or jsonb_typeof(item->'unit_price') is distinct from 'number'
   or jsonb_typeof(item->'discount_amount') is distinct from 'number'
   or jsonb_typeof(item->'specification') is distinct from 'string'
   or length(item->>'specification')>2000 then raise exception 'รูปแบบรายการสินค้าไม่ถูกต้อง'; end if;
  qty:=(item->>'quantity')::numeric;price:=(item->>'unit_price')::numeric;discount:=(item->>'discount_amount')::numeric;
  if qty<=0 or qty>=1e11 or qty<>round(qty,3) or price<0 or price>=1e12 or price<>round(price,2)
   or discount<0 or discount<>round(discount,2) then raise exception 'ตรวจจำนวน ราคา และส่วนลด'; end if;
  gross:=round(qty*price,2);
  if discount>gross then raise exception 'ส่วนลดต้องไม่เกินยอดรายการ'; end if;
  if nullif(item->>'existing_item_id','') is not null then
   select * into old_item from public.document_items where id=(item->>'existing_item_id')::uuid and document_id=p_id for update;
   if not found or old_item.id=any(previous_ids) then raise exception 'รายการสินค้าเดิมไม่ถูกต้องหรือซ้ำ'; end if;
   previous_ids:=array_append(previous_ids,old_item.id);
   variant:=old_item.product_variant_id;sku:=old_item.sku_snapshot;item_name:=old_item.product_name_snapshot;unit:=old_item.unit_snapshot;
  else
   select v.id,v.sku,p.name,p.unit into product from public.product_variants v join public.products p on p.id=v.product_id
    where v.id=(item->>'variant_id')::uuid and p.organization_id=p_org and p.is_active and v.is_active for share of p,v;
   if not found then raise exception 'ไม่พบสินค้าที่ใช้งานขององค์กรนี้'; end if;
   variant:=product.id;sku:=product.sku;item_name:=product.name;unit:=product.unit;
  end if;
  pos:=pos+1;sub:=sub+gross;discounts:=discounts+discount;
  entries:=entries||jsonb_build_array(jsonb_build_object('position',pos,'product_variant_id',variant,'sku_snapshot',sku,
   'product_name_snapshot',item_name,'specification_snapshot',item->>'specification','unit_snapshot',unit,
   'quantity',qty,'unit_price',price,'discount_amount',discount,'line_total',gross-discount));
 end loop;
 taxable:=sub-discounts;vat:=0;
 if sub>=1e12 or taxable+vat>=1e12 then raise exception 'ยอดเงินเกินขอบเขตที่รองรับ'; end if;
 if left(coalesce(invoice.notes,''),length(E'[รายละเอียดใบเสนอราคา v1]\n'))=E'[รายละเอียดใบเสนอราคา v1]\n' then
  begin old_details:=substring(invoice.notes from length(E'[รายละเอียดใบเสนอราคา v1]\n')+1)::jsonb;
  exception when invalid_text_representation then old_details:='{}'::jsonb; end;
 end if;
 if jsonb_typeof(old_details) is distinct from 'object' then old_details:='{}'::jsonb; end if;
 update public.documents set customer_id=customer.id,customer_name_snapshot=customer.name,
  customer_tax_id_snapshot=customer.tax_id,customer_address_snapshot=customer.billing_address,
  issue_date=p_issue,due_date=p_due,subtotal=sub,discount_amount=discounts,taxable_amount=taxable,
  vat_rate=0,vat_amount=0,grand_total=taxable,
  notes=E'[รายละเอียดใบเสนอราคา v1]\n'||(old_details||jsonb_build_object('paymentTerms',coalesce(p_terms,''),'deliveryTerms',coalesce(old_details->>'deliveryTerms',''),'notes',coalesce(p_notes,''),'rates','[]'::jsonb))::text
 where id=p_id and organization_id=p_org and kind='cash_bill' returning updated_at into saved_at;
 delete from public.document_items where document_id=p_id;
 insert into public.document_items(document_id,position,product_variant_id,sku_snapshot,product_name_snapshot,specification_snapshot,unit_snapshot,quantity,unit_price,discount_amount,line_total)
 select p_id,r.position,r.product_variant_id,r.sku_snapshot,r.product_name_snapshot,r.specification_snapshot,r.unit_snapshot,r.quantity,r.unit_price,r.discount_amount,r.line_total
 from jsonb_to_recordset(entries) r(position integer,product_variant_id uuid,sku_snapshot text,product_name_snapshot text,specification_snapshot text,unit_snapshot text,quantity numeric,unit_price numeric,discount_amount numeric,line_total numeric);
 return jsonb_build_object('id',p_id,'document_number',invoice.document_number,'updated',true,'updated_at',saved_at,'grand_total',taxable+vat);
end;$$;
revoke all on function public.edit_cash_bill(uuid,uuid,text,timestamptz,uuid,date,date,text,text,jsonb) from public,anon;
grant execute on function public.edit_cash_bill(uuid,uuid,text,timestamptz,uuid,date,date,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
