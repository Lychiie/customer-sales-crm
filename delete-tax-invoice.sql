-- Soft-delete migration: normal lists hide deleted invoices and the trash page can restore them.
begin;
alter table public.documents add column if not exists deleted_at timestamptz;
alter table public.documents add column if not exists deleted_by uuid references auth.users(id) on delete set null;
create index if not exists documents_tax_invoice_trash_idx on public.documents(organization_id,kind,deleted_at);

create or replace function public.delete_tax_invoice(p_org uuid,p_id uuid,p_number text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.documents%rowtype;
begin
  if auth.uid() is null or not public.is_org_member(p_org) or not exists(
    select 1 from public.organization_members where organization_id=p_org
      and user_id=auth.uid() and role in ('admin','finance')
  ) then raise exception 'เฉพาะผู้ดูแลหรือฝ่ายการเงินเท่านั้นที่ลบใบกำกับภาษีได้'; end if;
  select * into target from public.documents
    where id=p_id and organization_id=p_org and kind='tax_invoice' for update;
  if not found then raise exception 'ไม่พบใบกำกับภาษี กรุณารีเฟรชรายการก่อนลองใหม่'; end if;
  if p_number is distinct from target.document_number then
    raise exception 'เลขที่เอกสารยืนยันไม่ตรงกัน';
  end if;
  if target.deleted_at is not null then
    raise exception 'เอกสารนี้อยู่ในถังขยะแล้ว';
  end if;
  if target.payment_received or exists(select 1 from public.payments where document_id=p_id) then
    raise exception 'ลบไม่ได้: เอกสารนี้ชำระแล้วหรือมีรายการรับชำระเงิน';
  end if;
  -- FOR UPDATE also blocks concurrent FK inserts while dependency checks run.
  if exists(select 1 from public.documents where source_document_id=p_id)
    or exists(select 1 from public.documents where id=target.source_document_id and kind='billing_note') then
    raise exception 'ลบไม่ได้: เอกสารนี้เชื่อมกับใบวางบิลหรือมีเอกสารอื่นอ้างอิง';
  end if;
  update public.documents set deleted_at=now(), deleted_by=auth.uid(), updated_at=now()
    where id=p_id and organization_id=p_org and kind='tax_invoice' and deleted_at is null;
  return jsonb_build_object('id',p_id,'document_number',target.document_number,'deleted',true,'trashed',true);
end;
$$;
revoke all on function public.delete_tax_invoice(uuid,uuid,text) from public,anon;
grant execute on function public.delete_tax_invoice(uuid,uuid,text) to authenticated;

create or replace function public.restore_tax_invoice(p_org uuid,p_id uuid,p_number text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.documents%rowtype;
begin
  if auth.uid() is null or not public.is_org_member(p_org) or not exists(
    select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid()
      and role in ('admin','finance')
  ) then raise exception 'เฉพาะผู้ดูแลหรือฝ่ายการเงินเท่านั้นที่กู้คืนใบกำกับภาษีได้'; end if;
  select * into target from public.documents where id=p_id and organization_id=p_org and kind='tax_invoice' for update;
  if not found then raise exception 'ไม่พบใบกำกับภาษีในถังขยะ'; end if;
  if p_number is distinct from target.document_number then raise exception 'เลขที่เอกสารไม่ตรงกัน'; end if;
  if target.deleted_at is null then raise exception 'เอกสารนี้ยังไม่ได้อยู่ในถังขยะ'; end if;
  update public.documents set deleted_at=null, deleted_by=null, updated_at=now()
    where id=p_id and organization_id=p_org and kind='tax_invoice';
  return jsonb_build_object('id',p_id,'document_number',target.document_number,'restored',true);
end;
$$;
revoke all on function public.restore_tax_invoice(uuid,uuid,text) from public,anon;
grant execute on function public.restore_tax_invoice(uuid,uuid,text) to authenticated;

create or replace function public.purge_tax_invoice(p_org uuid,p_id uuid,p_number text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.documents%rowtype;
begin
  if auth.uid() is null or not public.is_org_member(p_org) or not exists(
    select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='admin'
  ) then raise exception 'เฉพาะผู้ดูแลเท่านั้นที่ลบเอกสารถาวรได้'; end if;
  select * into target from public.documents where id=p_id and organization_id=p_org and kind='tax_invoice' for update;
  if not found or target.deleted_at is null then raise exception 'ไม่พบเอกสารในถังขยะ'; end if;
  if p_number is distinct from target.document_number then raise exception 'เลขที่เอกสารไม่ตรงกัน'; end if;
  delete from public.documents where id=p_id and organization_id=p_org and kind='tax_invoice' and deleted_at is not null;
  return jsonb_build_object('id',p_id,'document_number',target.document_number,'purged',true);
end;
$$;
revoke all on function public.purge_tax_invoice(uuid,uuid,text) from public,anon;
grant execute on function public.purge_tax_invoice(uuid,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
