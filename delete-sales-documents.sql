-- Install only; this migration does not delete any document.
begin;
create or replace function public.delete_quotation(p_org uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.documents%rowtype;
begin
  if auth.uid() is null or not public.is_org_member(p_org) then
    raise exception 'ไม่มีสิทธิ์ลบใบเสนอราคาขององค์กรนี้';
  end if;
  -- Lock the exact parent through reference checks and deletion; FK inserts wait.
  select * into target from public.documents
    where id=p_id and organization_id=p_org and kind='quotation' for update;
  if not found then raise exception 'ไม่พบใบเสนอราคา อาจถูกลบไปแล้ว กรุณาโหลดรายการใหม่'; end if;
  if exists(select 1 from public.documents where source_document_id=p_id and organization_id<>p_org)
    or exists(select 1 from public.delivery_notes where source_quotation_id=p_id and organization_id<>p_org) then
    raise exception 'พบเอกสารอ้างอิงต่างองค์กร กรุณาติดต่อผู้ดูแล';
  end if;
  if exists(select 1 from public.payments where document_id=p_id) then
    raise exception 'ลบไม่ได้: ใบเสนอราคานี้มีรายการรับชำระเงิน';
  end if;
  -- Preserve each linked document and its own customer/item snapshots.
  update public.documents set source_document_id=null where source_document_id=p_id and organization_id=p_org;
  update public.delivery_notes set source_quotation_id=null where source_quotation_id=p_id and organization_id=p_org;
  -- Only this quotation's items follow the existing ON DELETE CASCADE constraint.
  delete from public.documents where id=p_id and organization_id=p_org and kind='quotation';
  return jsonb_build_object('id',p_id,'document_number',target.document_number,'deleted',true);
end;
$$;
revoke all on function public.delete_quotation(uuid,uuid) from public,anon;
grant execute on function public.delete_quotation(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

-- Install only. No existing document is deleted by this migration.
begin;
create or replace function public.delete_sales_document(p_org uuid,p_id uuid,p_kind text,p_number text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actual_number text;
begin
  if auth.uid() is null or not public.is_org_member(p_org) or not exists(
    select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='admin'
  ) then raise exception 'เฉพาะผู้ดูแลเท่านั้นที่ลบเอกสารนี้ได้'; end if;
  if p_kind is null or p_kind not in ('billing_note','cash_bill','delivery_note') then
    raise exception 'ประเภทเอกสารไม่ถูกต้อง';
  end if;
  if p_kind='delivery_note' then
    select document_number into actual_number from public.delivery_notes
      where id=p_id and organization_id=p_org for update;
  else
    select document_number into actual_number from public.documents
      where id=p_id and organization_id=p_org and kind::text=p_kind for update;
  end if;
  if actual_number is null then raise exception 'ไม่พบเอกสาร กรุณาโหลดรายการใหม่'; end if;
  if p_number is distinct from actual_number then raise exception 'เลขที่เอกสารไม่ตรงกัน'; end if;
  if p_kind='delivery_note' then
    delete from public.delivery_notes where id=p_id and organization_id=p_org;
  else
    -- Never silently erase receipt/payment history or another tenant's links.
    if exists(select 1 from public.payments where document_id=p_id) then
      raise exception 'เอกสารนี้มีประวัติรับชำระเงินจริง กรุณาจัดการรายการรับชำระก่อนลบ';
    end if;
    if exists(select 1 from public.documents where source_document_id=p_id and organization_id<>p_org)
      or exists(select 1 from public.delivery_notes where source_quotation_id=p_id and organization_id<>p_org) then
      raise exception 'พบเอกสารอ้างอิงต่างองค์กร กรุณาติดต่อผู้ดูแล';
    end if;
    update public.documents set source_document_id=null where source_document_id=p_id and organization_id=p_org;
    update public.delivery_notes set source_quotation_id=null where source_quotation_id=p_id and organization_id=p_org;
    delete from public.documents where id=p_id and organization_id=p_org and kind::text=p_kind;
  end if;
  return jsonb_build_object('id',p_id,'document_number',actual_number,'deleted',true);
end;
$$;
revoke all on function public.delete_sales_document(uuid,uuid,text,text) from public,anon;
grant execute on function public.delete_sales_document(uuid,uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
