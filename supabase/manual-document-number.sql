-- Preserve history; reserve numbers across all document types, including trash.
begin;
create table if not exists public.crm_document_numbers(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 number_key text not null,
 source_table text not null check(source_table in ('documents','delivery_notes')),
 document_id uuid not null,
 primary key(organization_id,number_key),
 unique(source_table,document_id)
);
alter table public.crm_document_numbers enable row level security;
revoke all on public.crm_document_numbers from public,anon,authenticated;
lock table public.documents,public.delivery_notes in share row exclusive mode;
-- Fail rather than silently changing historical numbers if collisions exist.
insert into public.crm_document_numbers
select organization_id,upper(btrim(document_number)),'documents',id from public.documents
union all
select organization_id,upper(btrim(document_number)),'delivery_notes',id from public.delivery_notes;

create or replace function public.crm_manual_number_before_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare context jsonb;
begin
 context:=nullif(current_setting('crm.manual_number',true),'')::jsonb;
 if context is not null and context->>'org'=new.organization_id::text and context->>'table'=tg_table_name then
   new.document_number:=context->>'number';
 end if;
 return new;
end $$;
create trigger zzz_manual_number_before_insert before insert on public.documents
 for each row execute function public.crm_manual_number_before_insert();
create trigger zzz_manual_number_before_insert before insert on public.delivery_notes
 for each row execute function public.crm_manual_number_before_insert();

create or replace function public.crm_reserve_document_number()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
   delete from public.crm_document_numbers where source_table=tg_table_name and document_id=old.id;
   return old;
 end if;
 if tg_op='UPDATE' then
   if new.document_number is not distinct from old.document_number and new.organization_id=old.organization_id then return new; end if;
   delete from public.crm_document_numbers where source_table=tg_table_name and document_id=old.id;
 end if;
 insert into public.crm_document_numbers values(new.organization_id,upper(btrim(new.document_number)),tg_table_name,new.id);
 return new;
end $$;
create trigger crm_reserve_document_number after insert or update or delete on public.documents
 for each row execute function public.crm_reserve_document_number();
create trigger crm_reserve_document_number after insert or update or delete on public.delivery_notes
 for each row execute function public.crm_reserve_document_number();
revoke all on function public.crm_manual_number_before_insert(),public.crm_reserve_document_number() from public,anon,authenticated;

create or replace function public.crm_create_numbered_document(p_action text,p_payload jsonb,p_number text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare org uuid; resource text; target text:='documents'; result jsonb; number text:=upper(btrim(p_number)); prior text:=current_setting('crm.manual_number',true);
begin
 if number is null or number !~ '^[A-Z0-9][A-Z0-9._/-]{0,79}$' then raise exception 'เลขที่เอกสารใช้ A–Z, 0–9 และ . _ / - ได้ ไม่เกิน 80 ตัวอักษร' using errcode='22023'; end if;
 org:=coalesce((p_payload->>'p_org')::uuid,(p_payload->'p_document'->>'organization_id')::uuid);
 case p_action
 when 'crm_create_sales_document' then resource:=p_payload->'p_document'->>'kind'; if resource not in ('quotation','cash_bill') then raise exception 'Invalid document kind'; end if;
 when 'create_standalone_tax_invoice','issue_quotation_tax_invoice' then resource:='tax_invoice';
 when 'create_invoice_billing_note' then resource:='billing_note';
 when 'save_delivery_note','issue_quotation_delivery_note' then resource:='delivery_note';target:='delivery_notes';
 else raise exception 'Invalid document action';
 end case;
 if auth.uid() is null or not public.crm_permission(org,resource,'create') then raise exception 'Permission denied' using errcode='42501'; end if;
 perform set_config('crm.manual_number',jsonb_build_object('org',org,'table',target,'number',number)::text,true);
 case p_action
 when 'crm_create_sales_document' then result:=to_jsonb(public.crm_create_sales_document(p_payload->'p_document',p_payload->'p_items'));
 when 'create_standalone_tax_invoice' then result:=public.create_standalone_tax_invoice(org,(p_payload->>'p_id')::uuid,(p_payload->>'p_customer')::uuid,(p_payload->>'p_issue')::date,(p_payload->>'p_due')::date,p_payload->>'p_terms',p_payload->>'p_notes',p_payload->'p_items');
 when 'issue_quotation_tax_invoice' then result:=public.issue_quotation_tax_invoice(org,(p_payload->>'p_id')::uuid);
 when 'create_invoice_billing_note' then result:=public.create_invoice_billing_note(org,(p_payload->>'p_invoice')::uuid,(p_payload->>'p_date')::date,(p_payload->>'p_credit')::integer);
 when 'save_delivery_note' then result:=to_jsonb(public.save_delivery_note((p_payload->>'p_id')::uuid,org,(p_payload->>'p_customer')::uuid,(p_payload->>'p_date')::date,p_payload->>'p_shipping',p_payload->>'p_notes',p_payload->'p_items'));
 when 'issue_quotation_delivery_note' then result:=public.issue_quotation_delivery_note(org,(p_payload->>'p_quote')::uuid,(p_payload->>'p_date')::date,p_payload->>'p_shipping',p_payload->>'p_notes');
 end case;
 perform set_config('crm.manual_number',coalesce(prior,''),true);
 return result;
exception when unique_violation then
 raise exception 'เลขที่เอกสารซ้ำกับเอกสารที่มีอยู่ (รวมถังขยะ) กรุณาใช้เลขอื่น' using errcode='22023';
end $$;
revoke all on function public.crm_create_numbered_document(text,jsonb,text) from public,anon;
grant execute on function public.crm_create_numbered_document(text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
