-- Run in Supabase SQL editor after the migration. Rolls back all test data.
begin;
do $$
begin
  if has_function_privilege('authenticated','public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid,numeric,numeric,text)','EXECUTE') then raise exception 'Browser can execute fills'; end if;
  if has_table_privilege('authenticated','public.accounts','UPDATE') then raise exception 'Browser can edit cash'; end if;
  if exists(select 1 from pg_class where oid in ('public.accounts'::regclass,'public.positions'::regclass,'public.fills'::regclass) and not relrowsecurity) then raise exception 'RLS missing'; end if;
end; $$;
rollback;
