-- Flowbill CRM: Supabase / PostgreSQL schema (MVP)
-- Run once in Supabase: SQL Editor > New query > paste this file > Run

create extension if not exists pgcrypto;

create type public.document_status as enum ('draft', 'sent', 'approved', 'cancelled', 'paid', 'overdue');
create type public.document_kind as enum ('quotation', 'billing_note', 'tax_invoice');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  address text,
  vat_rate numeric(5,2) not null default 7.00,
  currency text not null default 'THB',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'sales', 'finance', 'viewer')),
  primary key (organization_id, user_id)
);

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  contact_name text,
  tax_id text,
  phone text,
  email text,
  billing_address text,
  shipping_address text,
  credit_term_days integer not null default 30 check (credit_term_days >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category text,
  unit text not null default 'ชิ้น',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  label text not null,
  width numeric(12,3),
  length numeric(12,3),
  height numeric(12,3),
  thickness numeric(12,3),
  dimension_unit text default 'cm',
  specification jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, sku)
);

create table public.variant_prices (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price numeric(14,2) not null check (price >= 0),
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.document_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.document_kind not null,
  year integer not null,
  last_number integer not null default 0,
  primary key (organization_id, kind, year)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.document_kind not null,
  document_number text not null,
  status public.document_status not null default 'draft',
  customer_id uuid references public.customers(id) on delete set null,
  customer_name_snapshot text not null,
  customer_tax_id_snapshot text,
  customer_address_snapshot text,
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 7.00,
  vat_amount numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  notes text,
  source_document_id uuid references public.documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kind, document_number)
);

create table public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  position integer not null,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  sku_snapshot text,
  product_name_snapshot text not null,
  specification_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null check (line_total >= 0),
  unique (document_id, position)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  paid_on date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method text,
  reference text,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_prices enable row level security;
alter table public.document_sequences enable row level security;
alter table public.documents enable row level security;
alter table public.document_items enable row level security;
alter table public.payments enable row level security;

create policy "members can read organization" on public.organizations for select using (public.is_org_member(id));
create policy "members can read memberships" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "members manage customers" on public.customers for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage products" on public.products for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage variants" on public.product_variants for all using (exists (select 1 from public.products p where p.id = product_id and public.is_org_member(p.organization_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_org_member(p.organization_id)));
create policy "members manage prices" on public.variant_prices for all using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.id = variant_id and public.is_org_member(p.organization_id))) with check (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.id = variant_id and public.is_org_member(p.organization_id)));
create policy "members manage documents" on public.documents for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage document items" on public.document_items for all using (exists (select 1 from public.documents d where d.id = document_id and public.is_org_member(d.organization_id))) with check (exists (select 1 from public.documents d where d.id = document_id and public.is_org_member(d.organization_id)));
create policy "members manage payments" on public.payments for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage sequences" on public.document_sequences for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
