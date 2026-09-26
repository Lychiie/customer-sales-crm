-- Additive migration: assign yearly Buddhist-year numbers to new delivery notes.
-- Existing delivery note numbers are never rewritten.
begin;
create table if not exists public.delivery_note_year_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  calendar_year integer not null,
  last_number integer not null check(last_number between 1 and 9999),
  primary key(organization_id,calendar_year)
);
alter table public.delivery_note_year_sequences enable row level security;
revoke all on table public.delivery_note_year_sequences from public,anon,authenticated;

create or replace function public.assign_delivery_note_year_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  issue_year integer;
  prefix text;
  highest_number integer;
  next_number integer;
begin
  if auth.uid() is null or not public.is_org_member(new.organization_id) or not exists(
    select 1 from public.organization_members
    where organization_id=new.organization_id and user_id=auth.uid()
      and role in ('admin','sales','finance')
  ) then raise exception 'ไม่มีสิทธิ์สร้างใบส่งสินค้าขององค์กรนี้'; end if;

  new.issue_date:=coalesce(new.issue_date,(now() at time zone 'Asia/Bangkok')::date);
  issue_year:=extract(year from new.issue_date)::integer;
  prefix:='DN'||right((issue_year+543)::text,2)||'-';

  -- Serialize allocations per organization and year; existing DN-YYYYMMDD numbers
  -- are ignored, while any already matching DNyy-#### numbers continue safely.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('delivery-number:'||new.organization_id::text||':'||prefix,0)
  );
  select coalesce(max(substring(document_number from 6)::integer),0)
    into highest_number
    from public.delivery_notes
    where organization_id=new.organization_id
      and document_number ~ ('^'||prefix||'[0-9]{4}$');

  select greatest(coalesce(s.last_number,0),highest_number)+1 into next_number
    from (select 1) seed left join public.delivery_note_year_sequences s
      on s.organization_id=new.organization_id and s.calendar_year=issue_year;
  if next_number>9999 then raise exception 'เลขใบส่งสินค้าปีนี้ครบ 9999 ใบแล้ว กรุณาติดต่อผู้ดูแล'; end if;

  insert into public.delivery_note_year_sequences(organization_id,calendar_year,last_number)
    values(new.organization_id,issue_year,next_number)
    on conflict(organization_id,calendar_year) do update set last_number=excluded.last_number;
  new.document_number:=prefix||lpad(next_number::text,4,'0');
  return new;
end;
$$;
revoke all on function public.assign_delivery_note_year_number() from public,anon,authenticated;
drop trigger if exists delivery_note_year_number_before_insert on public.delivery_notes;
create trigger delivery_note_year_number_before_insert
  before insert on public.delivery_notes for each row
  execute function public.assign_delivery_note_year_number();
commit;
