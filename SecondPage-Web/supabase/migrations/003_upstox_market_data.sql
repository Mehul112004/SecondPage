begin;
alter table public.positions add column quote_source text not null default 'synthetic', add column display_symbol text, add column expiry date;
alter table public.fills add column display_symbol text;
-- Disable the old synthetic monitor. It must never execute against real market contracts.
create or replace function public.monitor_brackets(p_user uuid default null) returns integer language sql security definer set search_path='' as $$ select 0; $$;
revoke execute on function public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid,numeric,numeric,text) from service_role;
-- Remove the previous scheduler if installed. Its replacement calls the provider-backed Next.js endpoint.
do $$ declare job record; begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  for job in execute $query$select jobid from cron.job where jobname in ('secondpage-brackets','secondpage-cron-log-cleanup')$query$ loop
   execute format('select cron.unschedule(%s)',job.jobid);
  end loop;
 end if;
end; $$;

create function public.execute_upstox_order(p_user uuid,p_request uuid,p_quote jsonb,p_lots integer,p_position uuid default null,p_tp numeric default null,p_sl numeric default null,p_reason text default 'manual')
returns boolean language plpgsql security definer set search_path='' as $$
declare
 balance numeric; pos public.positions%rowtype; previous public.fills%rowtype; target uuid;
 instrument text := p_quote->>'id'; symbol text := p_quote->>'symbol'; exp date := (p_quote->>'expiry')::date;
 lot integer := (p_quote->>'lotSize')::integer; price numeric; quantity numeric;
 bid numeric := (p_quote->>'bid')::numeric; ask numeric := (p_quote->>'ask')::numeric;
 observed numeric := (p_quote->>'timestamp')::numeric; traded numeric := (p_quote->>'lastTradeAt')::numeric; received numeric := (p_quote->>'receivedAt')::numeric;
 now_ms numeric;
begin
 if not exists(select 1 from public.profiles where id=p_user and active) then raise exception 'Account is inactive.'; end if;
 if p_lots is null or p_lots not between 1 and 100 or lot is null or lot not between 1 and 100000 or instrument is null or instrument !~ '^NSE_FO\|[0-9]+$' or p_quote->>'source' is distinct from 'upstox' or symbol is null or length(symbol)>200 or exp is null or p_request is null then raise exception 'Invalid provider order.'; end if;
 if p_reason is null or p_reason not in ('manual','take_profit','stop_loss') or (p_position is null and p_reason<>'manual') then raise exception 'Invalid exit reason.'; end if;
 select cash into balance from public.accounts where user_id=p_user for update;
 if not found then raise exception 'Account not provisioned.'; end if;
 select * into previous from public.fills where user_id=p_user and request_id=p_request;
 if found then
  if previous.contract<>instrument or previous.lots<>p_lots or previous.side<>(case when p_position is null then 'BUY' else 'SELL' end) or (p_position is not null and previous.position_id<>p_position) then raise exception 'Request ID already used for another order.'; end if;
  return false;
 end if;
 now_ms := extract(epoch from clock_timestamp())*1000;
 if observed is null or traded is null or received is null or observed<now_ms-15000 or traded<now_ms-60000 or received<now_ms-15000 or greatest(observed,traded,received)>now_ms+5000 then raise exception 'Quote expired before execution. Try again with a fresh quote.'; end if;
 if exp < (clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Contract expired.'; end if;
 if bid is null or ask is null or bid<=0 or ask<=0 or bid>ask or ask>100000 then raise exception 'No executable two-sided quote.'; end if;
 price := case when p_position is null then ask else bid end;
 quantity := case when p_position is null then (p_quote->>'askQty')::numeric else (p_quote->>'bidQty')::numeric end;
 if quantity is null or quantity<p_lots*lot then raise exception 'Insufficient best-price quantity. Reduce order size.'; end if;
 if (p_quote->>'freezeQuantity')::numeric > 0 and p_lots*lot>(p_quote->>'freezeQuantity')::numeric then raise exception 'Quantity exceeds exchange freeze limit.'; end if;
 if p_position is null then
  if (p_tp is not null and (p_tp<=price or p_tp>100000)) or (p_sl is not null and (p_sl<=0 or p_sl>=price)) then raise exception 'TP must be above entry; SL must be positive and below entry.'; end if;
  if balance<price*p_lots*lot then raise exception 'Insufficient virtual funds.'; end if;
  insert into public.positions(user_id,contract,lots,lot_size,entry_price,take_profit,stop_loss,quote_source,display_symbol,expiry)
   values(p_user,instrument,p_lots,lot,price,p_tp,p_sl,'upstox',symbol,exp) returning id into target;
  update public.accounts set cash=cash-price*p_lots*lot where user_id=p_user;
 else
  select * into pos from public.positions where id=p_position and user_id=p_user for update;
  if not found then raise exception 'Position not found.'; end if;
  if pos.status<>'open' then
   if p_reason<>'manual' then return false; end if;
   raise exception 'Position is already closed.';
  end if;
  if pos.quote_source<>'upstox' or pos.contract<>instrument or pos.lots<>p_lots or pos.lot_size<>lot or pos.expiry<>exp then raise exception 'Quote does not match the full open position.'; end if;
  -- Re-check saved levels under the position lock, after any concurrent edit.
  if p_reason='take_profit' and (pos.take_profit is null or bid<pos.take_profit) then return false; end if;
  if p_reason='stop_loss' and (pos.stop_loss is null or bid>pos.stop_loss) then return false; end if;
  target := pos.id;
  update public.positions set status='closed',exit_price=price,closed_at=now(),exit_reason=p_reason where id=target;
  update public.accounts set cash=cash+price*p_lots*lot where user_id=p_user;
 end if;
 insert into public.fills(user_id,request_id,position_id,contract,side,lots,lot_size,price,display_symbol)
 values(p_user,p_request,target,instrument,case when p_position is null then 'BUY' else 'SELL' end,p_lots,lot,price,symbol);
 if p_position is not null and p_reason<>'manual' then
  insert into public.notifications(user_id,position_id,message) values(p_user,target,format('%s: %s closed at ₹%s per unit (%s units).',case when p_reason='take_profit' then 'Take profit triggered' else 'Stop loss triggered' end,symbol,price,p_lots*lot));
 end if;
 return true;
end; $$;
revoke all on function public.execute_upstox_order(uuid,uuid,jsonb,integer,uuid,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.execute_upstox_order(uuid,uuid,jsonb,integer,uuid,numeric,numeric,text) to service_role;
commit;
