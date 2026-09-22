-- Adds one atomic creation function. Does not rewrite documents or change RLS.
begin;
create or replace function public.create_standalone_tax_invoice(
  p_org uuid,p_id uuid,p_customer uuid,p_issue date,p_due date,
  p_terms text,p_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  customer public.customers%rowtype;
  invoice public.documents%rowtype;
  item jsonb;
  product record;
  qty numeric; price numeric; rate numeric; gross numeric; discount numeric;
  sub numeric := 0; discounts numeric := 0; taxable numeric; vat numeric; vat_rate numeric;
  next_number integer; position integer := 0;
  item_rows jsonb := '[]'::jsonb;
  rates jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_org_member(p_org) or not exists(
    select 1 from public.organization_members where organization_id=p_org
      and user_id=auth.uid() and role in ('admin','sales','finance')
  ) then raise exception 'ไม่มีสิทธิ์สร้างใบกำกับภาษีขององค์กรนี้'; end if;
  if p_id is null then raise exception using errcode='22023',message='ไม่พบรหัสป้องกันเอกสารซ้ำ'; end if;
  -- The same request ID always returns the same invoice, even after a lost response.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  select * into invoice from public.documents where id=p_id;
  if found then
    if invoice.organization_id<>p_org or invoice.kind<>'tax_invoice'
      or invoice.source_document_id is not null or invoice.created_by is distinct from auth.uid()
    then raise exception 'รหัสเอกสารนี้ไม่สามารถใช้ซ้ำได้'; end if;
    return jsonb_build_object('id',invoice.id,'document_number',invoice.document_number,'created',false);
  end if;
  if p_issue is null or p_issue<'2000-01-01'::date or p_issue>'2199-12-31'::date
    or coalesce(p_due,p_issue)<p_issue or coalesce(p_due,p_issue)>'2199-12-31'::date
    or length(coalesce(p_terms,''))>120 or length(coalesce(p_notes,''))>4000
  then raise exception using errcode='22023',message='ตรวจวันที่เอกสาร วันครบกำหนด และความยาวหมายเหตุ'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode='22023',message='รายการสินค้าไม่ถูกต้อง'; end if;
  if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then
    raise exception using errcode='22023',message='กรุณาระบุสินค้า 1–200 รายการ'; end if;
  select * into customer from public.customers where id=p_customer and organization_id=p_org and is_active for share;
  if not found then raise exception using errcode='22023',message='ไม่พบลูกค้าที่ใช้งานในองค์กรนี้'; end if;
  select o.vat_rate into vat_rate from public.organizations o where id=p_org for share;
  if vat_rate is null or vat_rate<0 or vat_rate>100 then
    raise exception using errcode='22023',message='อัตรา VAT ของบริษัทไม่ถูกต้อง'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'quantity') is distinct from 'number'
      or jsonb_typeof(item->'unit_price') is distinct from 'number'
      or jsonb_typeof(item->'discount_rate') is distinct from 'number'
      or jsonb_typeof(item->'variant_id') is distinct from 'string'
      or jsonb_typeof(item->'specification') is distinct from 'string'
      or length(item->>'specification')>2000
    then raise exception using errcode='22023',message='รูปแบบรายการสินค้าไม่ถูกต้อง'; end if;
    qty:=(item->>'quantity')::numeric; price:=(item->>'unit_price')::numeric; rate:=(item->>'discount_rate')::numeric;
    if qty<=0 or qty>=1e11 or qty<>round(qty,3) or price<0 or price>=1e12 or price<>round(price,2)
      or rate<0 or rate>100 or rate<>round(rate,2)
    then raise exception using errcode='22023',message='ตรวจจำนวน ราคา และส่วนลด 0–100%'; end if;
    select p.name,p.code,p.unit,v.sku,v.label,v.id into product
      from public.product_variants v join public.products p on p.id=v.product_id
      where v.id=(item->>'variant_id')::uuid and p.organization_id=p_org and p.is_active and v.is_active
      for share of p,v;
    if not found then raise exception using errcode='22023',message='สินค้าไม่มีอยู่หรือปิดใช้งานในองค์กรนี้'; end if;
    gross:=round(qty*price,2);discount:=round(gross*rate/100,2);
    sub:=sub+gross;discounts:=discounts+discount;position:=position+1;
    item_rows:=item_rows||jsonb_build_array(jsonb_build_object('position',position,
      'product_variant_id',product.id,'sku_snapshot',product.sku,'product_name_snapshot',product.name,
      'specification_snapshot',item->>'specification','unit_snapshot',product.unit,
      'quantity',qty,'unit_price',price,'discount_amount',discount,'line_total',gross-discount));
    rates:=rates||jsonb_build_array(rate);
  end loop;
  taxable:=sub-discounts;vat:=round(taxable*vat_rate/100,2);
  if sub>=1e12 or taxable+vat>=1e12 then
    raise exception using errcode='22023',message='ยอดเงินเกินขอบเขตที่รองรับ'; end if;
  insert into public.document_sequences(organization_id,kind,year,last_number)
    values(p_org,'tax_invoice',extract(year from p_issue)::integer,1)
    on conflict(organization_id,kind,year) do update set last_number=public.document_sequences.last_number+1
    returning last_number into next_number;
  insert into public.documents(id,organization_id,kind,document_number,status,payment_received,customer_id,
    customer_name_snapshot,customer_tax_id_snapshot,customer_address_snapshot,issue_date,due_date,
    subtotal,discount_amount,taxable_amount,vat_rate,vat_amount,grand_total,notes,created_by)
  values(p_id,p_org,'tax_invoice','TI-'||to_char(p_issue,'YYYYMMDD')||'-'||lpad(next_number::text,greatest(6,length(next_number::text)),'0'),
    'approved',false,customer.id,customer.name,customer.tax_id,customer.billing_address,p_issue,coalesce(p_due,p_issue),
    sub,discounts,taxable,vat_rate,vat,taxable+vat,
    E'[รายละเอียดใบเสนอราคา v1]\n'||jsonb_build_object('paymentTerms',coalesce(p_terms,''),'deliveryTerms','',
      'notes',coalesce(p_notes,''),'rates',rates)::text,auth.uid()) returning * into invoice;
  insert into public.document_items(document_id,position,product_variant_id,sku_snapshot,product_name_snapshot,
    specification_snapshot,unit_snapshot,quantity,unit_price,discount_amount,line_total)
  select p_id,r.position,r.product_variant_id,r.sku_snapshot,r.product_name_snapshot,r.specification_snapshot,
    r.unit_snapshot,r.quantity,r.unit_price,r.discount_amount,r.line_total
    from jsonb_to_recordset(item_rows) as r(position integer,product_variant_id uuid,sku_snapshot text,
      product_name_snapshot text,specification_snapshot text,unit_snapshot text,quantity numeric,
      unit_price numeric,discount_amount numeric,line_total numeric);
  return jsonb_build_object('id',invoice.id,'document_number',invoice.document_number,'created',true);
end;
$$;
revoke all on function public.create_standalone_tax_invoice(uuid,uuid,uuid,date,date,text,text,jsonb) from public,anon;
grant execute on function public.create_standalone_tax_invoice(uuid,uuid,uuid,date,date,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
