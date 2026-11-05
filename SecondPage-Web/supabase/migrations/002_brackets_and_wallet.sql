begin;
alter table public.accounts alter column cash set default 50000;
-- Convert the old starting allocation while preserving existing executions and P&L.
-- If a traded wallet has less than the adjustment available, leave it for manual review.
update public.accounts set cash = cash - 950000 where cash >= 950000;
alter table public.positions add column take_profit numeric(14,2), add column stop_loss numeric(14,2), add column exit_reason text;
alter table public.positions add constraint valid_brackets check ((take_profit is null or take_profit > entry_price) and (stop_loss is null or (stop_loss > 0 and stop_loss < entry_price)));
create index positions_brackets_idx on public.positions(user_id) where status='open' and (take_profit is not null or stop_loss is not null);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 position_id uuid not null references public.positions(id),
 message text not null,
 created_at timestamptz not null default now(),
 unique(position_id)
);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
create policy own_notifications on public.notifications for select to authenticated using (user_id=auth.uid() and public.is_active());
drop function public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid);
create function public.execute_order(p_user uuid, p_request uuid, p_contract text, p_lots integer, p_lot_size integer, p_price numeric, p_position uuid default null, p_tp numeric default null, p_sl numeric default null, p_reason text default 'manual')
returns void language plpgsql security definer set search_path = '' as $$
declare
  balance numeric;
  pos public.positions%rowtype;
  target uuid;
  previous public.fills%rowtype;
begin
  if not exists(select 1 from public.profiles where id = p_user and active) then raise exception 'Account is inactive.'; end if;
  if p_lots is null or p_lots < 1 or p_lots > 100 or p_lot_size is null or p_lot_size <> 25 or p_price is null or p_price <= 0 or p_price > 100000 or p_contract is null or p_contract !~ '^DEMO-(23300|23400|23500|23600|23700)-(CE|PE)$' or p_request is null then raise exception 'Invalid order.'; end if;
  if p_reason is null or p_reason not in ('manual','take_profit','stop_loss') then raise exception 'Invalid exit reason.'; end if;
  if p_position is null and ((p_tp is not null and (p_tp <= p_price or p_tp > 100000)) or (p_sl is not null and (p_sl <= 0 or p_sl >= p_price))) then raise exception 'TP must be above the entry price; SL must be positive and below entry.'; end if;
  -- Serialize each wallet's orders; wallet, position and fill commit together.
  select cash into balance from public.accounts where user_id = p_user for update;
  if not found then raise exception 'Account not provisioned.'; end if;
  select * into previous from public.fills where user_id = p_user and request_id = p_request;
  if found then
    if previous.contract <> p_contract or previous.lots <> p_lots or previous.side <> (case when p_position is null then 'BUY' else 'SELL' end) or (p_position is not null and previous.position_id <> p_position) then raise exception 'Request ID already used for another order.'; end if;
    return;
  end if;
  if p_position is null then
    if balance < p_price * p_lots * p_lot_size then raise exception 'Insufficient virtual funds.'; end if;
    insert into public.positions(user_id, contract, lots, lot_size, entry_price, take_profit, stop_loss)
      values(p_user,p_contract,p_lots,p_lot_size,p_price,p_tp,p_sl) returning id into target;
    update public.accounts set cash = cash - p_price * p_lots * p_lot_size where user_id = p_user;
  else
    select * into pos from public.positions where id = p_position and user_id = p_user for update;
    if not found then raise exception 'Position not found.'; end if;
    if pos.status <> 'open' then raise exception 'Position is already closed.'; end if;
    if pos.contract <> p_contract or pos.lots <> p_lots or pos.lot_size <> p_lot_size then raise exception 'Close the full position quantity.'; end if;
    target := pos.id;
    update public.positions set status = 'closed', exit_price = p_price, closed_at = now(), exit_reason = p_reason where id = target;
    update public.accounts set cash = cash + p_price * p_lots * p_lot_size where user_id = p_user;
  end if;
  insert into public.fills(user_id,request_id,position_id,contract,side,lots,lot_size,price)
    values(p_user,p_request,target,p_contract,case when p_position is null then 'BUY' else 'SELL' end,p_lots,p_lot_size,p_price);
  if p_position is not null and p_reason <> 'manual' then
    insert into public.notifications(user_id,position_id,message)
    values(p_user,target,format('%s: %s closed at ₹%s per unit (%s units).', case when p_reason='take_profit' then 'Take profit triggered' else 'Stop loss triggered' end, p_contract, p_price, p_lots * p_lot_size));
  end if;
end; $$;

revoke all on function public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid,numeric,numeric,text) to service_role;

create function public.set_brackets(p_position uuid,p_tp numeric,p_sl numeric) returns void language plpgsql security definer set search_path='' as $$
declare pos public.positions%rowtype;
begin
 if not public.is_active() then raise exception 'Account is inactive.'; end if;
 -- Same lock order as executions and the monitor.
 perform 1 from public.accounts where user_id=auth.uid() for update;
 select * into pos from public.positions where id=p_position and user_id=auth.uid() for update;
 if not found or pos.status <> 'open' then raise exception 'Open position not found.'; end if;
 if (p_tp is not null and (p_tp <= pos.entry_price or p_tp > 100000)) or (p_sl is not null and (p_sl <= 0 or p_sl >= pos.entry_price)) then raise exception 'TP must be above entry; SL must be positive and below entry.'; end if;
 update public.positions set take_profit=p_tp,stop_loss=p_sl where id=pos.id;
end; $$;
revoke all on function public.set_brackets(uuid,numeric,numeric) from public,anon;
grant execute on function public.set_brackets(uuid,numeric,numeric) to authenticated;

-- Identical synthetic fixture calculation to src/lib/market.ts. NOT a live-data monitor.
create function public.synthetic_bid(p_contract text,p_at timestamptz default now()) returns numeric language plpgsql immutable set search_path='' as $$
declare strike double precision; typ text; tick double precision; intrinsic double precision; premium double precision;
begin
 if p_contract !~ '^DEMO-(23300|23400|23500|23600|23700)-(CE|PE)$' then return null; end if;
 strike := split_part(p_contract,'-',2)::double precision;
 typ := split_part(p_contract,'-',3);
 tick := floor(extract(epoch from p_at)/5)::double precision;
 intrinsic := greatest(0,(case when typ='CE' then 23500-strike else strike-23500 end)*0.6);
 premium := greatest(8,50+intrinsic+sin(tick/5+strike/100)*8+sin(tick/17)*(case when typ='CE' then 10 else -10 end));
 return floor(premium*20+0.5)/20-0.5;
end; $$;
revoke all on function public.synthetic_bid(text,timestamptz) from public,anon,authenticated;

create function public.monitor_brackets(p_user uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare candidate record; pos public.positions%rowtype; bid numeric; reason text; total integer := 0;
begin
 -- Ordered wallets prevent deadlocks between overlapping monitor invocations.
 for candidate in select p.id,p.user_id from public.positions p join public.profiles u on u.id=p.user_id where p.status='open' and u.active and (p.take_profit is not null or p.stop_loss is not null) and (p_user is null or p.user_id=p_user) order by p.user_id,p.id loop
  perform 1 from public.accounts where user_id=candidate.user_id for update;
  select * into pos from public.positions where id=candidate.id for update;
  if pos.status <> 'open' then continue; end if;
  bid := public.synthetic_bid(pos.contract,clock_timestamp());
  reason := case when bid <= pos.stop_loss then 'stop_loss' when bid >= pos.take_profit then 'take_profit' else null end;
  if reason is not null then
   perform public.execute_order(pos.user_id,gen_random_uuid(),pos.contract,pos.lots,pos.lot_size,bid,pos.id,null,null,reason);
   total := total+1;
  end if;
 end loop;
 return total;
end; $$;
revoke all on function public.monitor_brackets(uuid) from public,anon,authenticated;
grant execute on function public.monitor_brackets(uuid) to service_role;
commit;
