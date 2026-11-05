begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','upstox@example.test'),('22222222-2222-4222-8222-222222222222','other@example.test');
update public.profiles set active=true;
do $$
declare q jsonb; target uuid; req uuid:=gen_random_uuid(); balance numeric;
begin
 q:=jsonb_build_object('id','NSE_FO|123','symbol','NIFTY test CE','expiry',current_date+1,'source','upstox','lotSize',65,'bid',49,'ask',50,'bidQty',650,'askQty',650,'timestamp',extract(epoch from now())*1000,'receivedAt',extract(epoch from now())*1000,'lastTradeAt',extract(epoch from now())*1000);
 perform public.execute_upstox_order('11111111-1111-4111-8111-111111111111',req,q,1,null,60,40);
 perform public.execute_upstox_order('11111111-1111-4111-8111-111111111111',req,q,1,null,60,40);
 if (select cash from public.accounts where user_id='11111111-1111-4111-8111-111111111111')<>46750 then raise exception 'Wallet/lot size mismatch'; end if;
 if (select count(*) from public.fills)<>1 then raise exception 'Duplicate buy'; end if;
 select id into target from public.positions where user_id='11111111-1111-4111-8111-111111111111';
 if public.monitor_brackets()<>0 then raise exception 'Legacy synthetic monitor is still active'; end if;
 -- An untriggered TP must not execute, even if an earlier observation crossed it.
 if public.execute_upstox_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),q,1,target,null,null,'take_profit') then raise exception 'Untriggered TP filled'; end if;
 begin
  perform public.execute_upstox_order('22222222-2222-4222-8222-222222222222',gen_random_uuid(),q,1,target);
  raise exception 'Foreign position accepted' using errcode='XX000';
 exception when raise_exception then null; end;
 begin
  perform public.execute_upstox_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),q||jsonb_build_object('timestamp',0),1,target);
  raise exception 'Stale execution accepted' using errcode='XX000';
 exception when raise_exception then null; end;
 q:=q||jsonb_build_object('bid',35,'ask',36);
 if not public.execute_upstox_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),q,1,target,null,null,'stop_loss') then raise exception 'SL did not execute'; end if;
 if public.execute_upstox_order('11111111-1111-4111-8111-111111111111',gen_random_uuid(),q,1,target,null,null,'stop_loss') then raise exception 'SL executed twice'; end if;
 if (select cash from public.accounts where user_id='11111111-1111-4111-8111-111111111111')<>49025 then raise exception 'Wrong close credit'; end if;
 if (select count(*) from public.notifications)<>1 then raise exception 'Missing/duplicate notification'; end if;
 if has_function_privilege('authenticated','public.execute_upstox_order(uuid,uuid,jsonb,integer,uuid,numeric,numeric,text)','EXECUTE') then raise exception 'Browser can set fill quotes'; end if;
 if has_function_privilege('service_role','public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid,numeric,numeric,text)','EXECUTE') then raise exception 'Legacy fill route not revoked'; end if;
end; $$;
rollback;
