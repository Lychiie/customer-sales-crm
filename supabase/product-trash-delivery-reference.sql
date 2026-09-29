-- Preserve delivery-note snapshots when permanently deleting a trashed product.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.delivery_note_items drop constraint delivery_note_items_variant_id_fkey;
alter table public.delivery_note_items add constraint delivery_note_items_variant_id_fkey foreign key (variant_id) references public.product_variants(id) on delete set null;
commit;
select conname, pg_get_constraintdef(oid) as definition, convalidated from pg_constraint where conrelid = 'public.delivery_note_items'::regclass and conname = 'delivery_note_items_variant_id_fkey';
