begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false
);
create table public.accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cash numeric(18,2) not null default 1000000 check (cash >= 0)
);
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contract text not null,
  lots integer not null check (lots between 1 and 100),
  lot_size integer not null check (lot_size > 0),
  entry_price numeric(14,2) not null check (entry_price > 0),
  opened_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','closed')),
  exit_price numeric(14,2),
  closed_at timestamptz,
  check ((status = 'open' and exit_price is null and closed_at is null) or
         (status = 'closed' and exit_price > 0 and closed_at is not null))
);
create table public.fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  position_id uuid not null references public.positions(id),
  contract text not null,
  side text not null check (side in ('BUY','SELL')),
  lots integer not null check (lots > 0),
  lot_size integer not null check (lot_size > 0),
  price numeric(14,2) not null check (price > 0),
  created_at timestamptz not null default now(),
  unique(user_id, request_id)
);
create index positions_user_idx on public.positions(user_id, opened_at desc);
create index fills_user_idx on public.fills(user_id, created_at desc);
create function public.provision_account() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  insert into public.accounts(user_id) values (new.id);
  return new;
end; $$;
create trigger provision_account after insert on auth.users for each row execute function public.provision_account();
-- Also provision any accounts created before running this migration. Owner must activate them.
insert into public.profiles(id) select id from auth.users on conflict do nothing;
insert into public.accounts(user_id) select id from public.profiles on conflict do nothing;
create function public.is_active() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and active);
$$;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.positions enable row level security;
alter table public.fills enable row level security;
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());
create policy own_account on public.accounts for select to authenticated using (user_id = auth.uid() and public.is_active());
create policy own_positions on public.positions for select to authenticated using (user_id = auth.uid() and public.is_active());
create policy own_fills on public.fills for select to authenticated using (user_id = auth.uid() and public.is_active());
revoke all on public.profiles, public.accounts, public.positions, public.fills from anon, authenticated;
grant select on public.profiles, public.accounts, public.positions, public.fills to authenticated;
-- Prices are supplied ONLY by the trusted Next.js route. No browser RPC execution grant.
create function public.execute_order(p_user uuid, p_request uuid, p_contract text, p_lots integer, p_lot_size integer, p_price numeric, p_position uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  balance numeric;
  pos public.positions%rowtype;
  target uuid;
  previous public.fills%rowtype;
begin
  if not exists(select 1 from public.profiles where id = p_user and active) then raise exception 'Account is inactive.'; end if;
  if p_lots is null or p_lots < 1 or p_lots > 100 or p_lot_size is null or p_lot_size <> 25 or p_price is null or p_price <= 0 or p_price > 100000 or p_contract is null or p_contract !~ '^DEMO-(23300|23400|23500|23600|23700)-(CE|PE)$' or p_request is null then raise exception 'Invalid order.'; end if;
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
    insert into public.positions(user_id, contract, lots, lot_size, entry_price)
      values(p_user,p_contract,p_lots,p_lot_size,p_price) returning id into target;
    update public.accounts set cash = cash - p_price * p_lots * p_lot_size where user_id = p_user;
  else
    select * into pos from public.positions where id = p_position and user_id = p_user for update;
    if not found then raise exception 'Position not found.'; end if;
    if pos.status <> 'open' then raise exception 'Position is already closed.'; end if;
    if pos.contract <> p_contract or pos.lots <> p_lots or pos.lot_size <> p_lot_size then raise exception 'Close the full position quantity.'; end if;
    target := pos.id;
    update public.positions set status = 'closed', exit_price = p_price, closed_at = now() where id = target;
    update public.accounts set cash = cash + p_price * p_lots * p_lot_size where user_id = p_user;
  end if;
  insert into public.fills(user_id,request_id,position_id,contract,side,lots,lot_size,price)
    values(p_user,p_request,target,p_contract,case when p_position is null then 'BUY' else 'SELL' end,p_lots,p_lot_size,p_price);
end; $$;
revoke all on function public.provision_account() from public, anon, authenticated;
revoke all on function public.is_active() from public, anon;
grant execute on function public.is_active() to authenticated;
revoke all on function public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid) from public, anon, authenticated;
grant execute on function public.execute_order(uuid,uuid,text,integer,integer,numeric,uuid) to service_role;
commit;
