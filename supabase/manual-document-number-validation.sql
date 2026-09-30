-- Upgrade installations of the initial numbering migration; no data changes.
begin;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.crm_create_numbered_document(text,jsonb,text)'::regprocedure) into definition;
 if position('number ~ ''[[:cntrl:]]''' in definition)>0 then
   definition:=replace(definition,'length(number) not between 1 and 80 or number ~ ''[[:cntrl:]]''','number !~ ''^[A-Z0-9][A-Z0-9._/-]{0,79}$''');
   execute definition;
 elsif position('number !~ ''^[A-Z0-9][A-Z0-9._/-]{0,79}$''' in definition)=0 then
   raise exception 'Unexpected numbering function version';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
