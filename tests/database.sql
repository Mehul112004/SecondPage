-- Integration assertions. Run ONLY on a disposable test database with the migration applied.
begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','first@example.test'),('22222222-2222-4222-8222-222222222222','second@example.test');
update public.profiles set active=true;
select public.execute_order('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DEMO-23500-CE',2,25,50);
-- Same request must not buy twice.
select public.execute_order('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DEMO-23500-CE',2,25,50);
do $$
declare target uuid;
begin
  if (select cash from public.accounts where user_id='11111111-1111-4111-8111-111111111111') <> 47500 then raise exception 'Incorrect buy cash'; end if;
  if (select count(*) from public.fills) <> 1 then raise exception 'Duplicate execution'; end if;
  select id into target from public.positions where user_id='11111111-1111-4111-8111-111111111111';
  begin
    perform public.execute_order('22222222-2222-4222-8222-222222222222',gen_random_uuid(),'DEMO-23500-CE',2,25,60,target);
    raise exception 'Cross-user close was accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  begin
    perform public.execute_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'DEMO-23500-CE',100,25,100000);
    raise exception 'Overspend was accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  perform public.execute_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'DEMO-23500-CE',2,25,60,target);
  if (select cash from public.accounts where user_id='11111111-1111-4111-8111-111111111111') <> 50500 then raise exception 'Incorrect close cash'; end if;
  begin
    perform public.execute_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'DEMO-23500-CE',2,25,60,target);
    raise exception 'Double close was accepted' using errcode='XX000';
  exception when raise_exception then null; end;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  if (select count(*) from public.fills) <> 0 then raise exception 'RLS leaked another user fills'; end if;
  if (select count(*) from public.accounts) <> 1 then raise exception 'RLS wallet isolation failed'; end if;
end; $$;
reset role;
update public.profiles set active=false where id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
do $$ begin
  if (select count(*) from public.accounts) <> 0 then raise exception 'Disabled account still has access'; end if;
end; $$;
reset role;
rollback;
