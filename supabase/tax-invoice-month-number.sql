-- New tax invoices only, across manual, quotation and legacy billing creation.
-- Existing document numbers are never rewritten. Counters are private to the trigger.
begin;
create table if not exists public.tax_invoice_month_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  calendar_year integer not null,
  calendar_month integer not null check(calendar_month between 1 and 12),
  last_number integer not null check(last_number between 1 and 9999),
  primary key(organization_id,calendar_year,calendar_month)
);
alter table public.tax_invoice_month_sequences enable row level security;
revoke all on table public.tax_invoice_month_sequences from public,anon,authenticated;
create or replace function public.assign_tax_invoice_month_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  existing_number text; issue_year integer; issue_month integer;
  prefix text; highest_number integer; next_number integer;
begin
  if new.kind<>'tax_invoice' then return new; end if;
  if auth.uid() is null or not public.is_org_member(new.organization_id) or not exists(
    select 1 from public.organization_members where organization_id=new.organization_id
      and user_id=auth.uid() and role in ('admin','sales','finance')
  ) then raise exception 'ไม่มีสิทธิ์สร้างใบกำกับภาษีขององค์กรนี้'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tax-invoice-number:'||new.id::text,0));
  select document_number into existing_number from public.documents
    where id=new.id and organization_id=new.organization_id and kind='tax_invoice';
  if found then new.document_number:=existing_number; return new; end if;
  new.issue_date:=coalesce(new.issue_date,(now() at time zone 'Asia/Bangkok')::date);
  issue_year:=extract(year from new.issue_date)::integer;
  issue_month:=extract(month from new.issue_date)::integer;
  prefix:='IV'||right((issue_year+543)::text,2)||to_char(new.issue_date,'MM')||'-';
  -- Matching imported numbers continue the series; historical TI- numbers do not.
  -- Lock one organization's month, so concurrent staff cannot receive the same number.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.organization_id::text||':'||prefix,0));
  -- Refresh after taking the lock: another transaction may just have committed.
  select coalesce(max(substring(document_number from 8)::integer),0) into highest_number
    from public.documents where organization_id=new.organization_id and kind='tax_invoice'
    and document_number ~ ('^'||prefix||'[0-9]{4}$');
  select greatest(coalesce(s.last_number,0),highest_number)+1 into next_number
    from (select 1) seed left join public.tax_invoice_month_sequences s
      on s.organization_id=new.organization_id and s.calendar_year=issue_year and s.calendar_month=issue_month;
  if next_number>9999 then raise exception 'เลขใบกำกับภาษีเดือนนี้ครบ 9999 ใบแล้ว กรุณาติดต่อผู้ดูแล'; end if;
  insert into public.tax_invoice_month_sequences(organization_id,calendar_year,calendar_month,last_number)
    values(new.organization_id,issue_year,issue_month,next_number)
    on conflict(organization_id,calendar_year,calendar_month) do update set last_number=excluded.last_number;
  new.document_number:=prefix||lpad(next_number::text,4,'0');
  return new;
end;
$$;
revoke all on function public.assign_tax_invoice_month_number() from public,anon,authenticated;
create or replace trigger tax_invoice_month_number_before_insert
  before insert on public.documents for each row when(new.kind='tax_invoice')
  execute function public.assign_tax_invoice_month_number();
commit;
