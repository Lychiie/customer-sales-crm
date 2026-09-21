-- Payment checkboxes are independent of document issuance and accounting entries.
begin;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='payment_received'
  ) then
    alter table public.documents add column payment_received boolean not null default false;
    -- Preserve the existing paid indication only on initial installation.
    update public.documents set payment_received=true
    where kind in ('billing_note','tax_invoice') and status='paid';
  end if;
end $$;
comment on column public.documents.payment_received is 'Manual paid checkbox; independent of document status. Does not create a payment or issue a receipt.';
notify pgrst,'reload schema';
commit;
