begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','tp@example.test'),('22222222-2222-4222-8222-222222222222','sl@example.test');
update public.profiles set active=true;
do $$
declare target uuid; bid numeric; closed integer;
begin
 if exists(select 1 from public.accounts where cash <> 50000) then raise exception 'Wallet default is not 50k'; end if;
 -- Synthetic 23500 CE bid is always below 100, so SL=100 will trigger.
 perform public.execute_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'DEMO-23500-CE',1,25,200,null,250,100);
 select id into target from public.positions where user_id='11111111-1111-4111-8111-111111111111';
 closed := public.monitor_brackets();
 if closed <> 1 then raise exception 'SL did not close'; end if;
 if not exists(select 1 from public.positions where id=target and status='closed' and exit_reason='stop_loss') then raise exception 'SL reason not recorded'; end if;
 if (select count(*) from public.notifications) <> 1 then raise exception 'Notification missing'; end if;
 if public.monitor_brackets() <> 0 then raise exception 'Monitor closed twice'; end if;
 if (select count(*) from public.fills) <> 2 then raise exception 'Duplicate fills'; end if;
 -- The second synthetic position's target is always below its bid.
 perform public.execute_order('22222222-2222-4222-8222-222222222222',gen_random_uuid(),'DEMO-23500-CE',1,25,1,null,2,null);
 if public.monitor_brackets() <> 1 then raise exception 'TP did not close'; end if;
 if not exists(select 1 from public.positions where user_id='22222222-2222-4222-8222-222222222222' and exit_reason='take_profit') then raise exception 'TP reason missing'; end if;
 if has_function_privilege('authenticated','public.monitor_brackets(uuid)','EXECUTE') then raise exception 'Browser can run global monitor'; end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if (select count(*) from public.notifications) <> 1 then raise exception 'Notification RLS isolation failed'; end if;
end; $$;
reset role;
rollback;
