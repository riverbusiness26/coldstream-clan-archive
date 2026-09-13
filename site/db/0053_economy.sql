-- Coldstream economy foundation. Supabase remains the source of truth, while
-- every client mutation enters through a server-owned transaction.

create table if not exists public.economy_config (
  key text primary key,
  value jsonb not null,
  check (key = btrim(key) and key <> '')
);

create table if not exists public.economy_wallet (
  member_id uuid primary key references public.member(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.economy_catalog_item (
  slug text primary key,
  display_name text not null,
  description text not null default '',
  slot text not null check (slot in ('frame', 'badge', 'backdrop')),
  price integer not null check (price > 0),
  art_key text,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.economy_ledger (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.member(id) on delete restrict,
  delta integer not null check (delta <> 0),
  resulting_balance integer not null check (resulting_balance >= 0),
  action_kind text not null check (action_kind in ('daily', 'purchase')),
  source_ref text not null,
  request_key text not null,
  item_slug text references public.economy_catalog_item(slug) on delete restrict,
  claim_period_start timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (member_id, request_key),
  unique (action_kind, source_ref),
  check (
    (action_kind = 'daily' and delta > 0 and item_slug is null and claim_period_start is not null)
    or
    (action_kind = 'purchase' and delta < 0 and item_slug is not null and claim_period_start is null)
  )
);

create index if not exists economy_ledger_member_page
  on public.economy_ledger(member_id, id desc);

create table if not exists public.economy_claim (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.member(id) on delete restrict,
  claim_kind text not null check (claim_kind = 'daily'),
  period_start timestamptz not null,
  ledger_id bigint unique references public.economy_ledger(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (member_id, claim_kind, period_start)
);

create table if not exists public.economy_inventory (
  member_id uuid not null references public.member(id) on delete cascade,
  item_slug text not null references public.economy_catalog_item(slug) on delete restrict,
  acquisition_ledger_id bigint not null unique references public.economy_ledger(id) on delete restrict,
  acquired_at timestamptz not null default clock_timestamp(),
  primary key (member_id, item_slug)
);

create table if not exists public.economy_equipped (
  member_id uuid not null,
  slot text not null check (slot in ('frame', 'badge', 'backdrop')),
  item_slug text not null,
  equipped_at timestamptz not null default clock_timestamp(),
  primary key (member_id, slot),
  foreign key (member_id, item_slug)
    references public.economy_inventory(member_id, item_slug) on delete cascade
);

insert into public.economy_config(key, value) values
  ('currency_display_name', '"Shillings"'::jsonb),
  ('shop_display_name', '"Quartermaster''s Stores"'::jsonb),
  ('daily_reward', '10'::jsonb),
  ('reward_timezone', '"America/Chicago"'::jsonb)
on conflict (key) do nothing;

insert into public.economy_catalog_item(
  slug, display_name, description, slot, price, art_key, active
) values (
  'engraved-frame',
  'Engraved Frame',
  'A regimental frame for the member profile display case.',
  'frame',
  40,
  'placeholder/engraved-frame',
  true
)
on conflict (slug) do nothing;

alter table public.economy_config enable row level security;
alter table public.economy_wallet enable row level security;
alter table public.economy_catalog_item enable row level security;
alter table public.economy_ledger enable row level security;
alter table public.economy_claim enable row level security;
alter table public.economy_inventory enable row level security;
alter table public.economy_equipped enable row level security;

revoke all on table
  public.economy_config,
  public.economy_wallet,
  public.economy_catalog_item,
  public.economy_ledger,
  public.economy_claim,
  public.economy_inventory,
  public.economy_equipped
from public, anon, authenticated, service_role;

revoke all on sequence
  public.economy_ledger_id_seq,
  public.economy_claim_id_seq
from public, anon, authenticated, service_role;

create or replace function public.economy_ledger_is_append_only()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'economy ledger entries are append-only';
end;
$$;

drop trigger if exists economy_ledger_append_only on public.economy_ledger;
create trigger economy_ledger_append_only
before update or delete on public.economy_ledger
for each row execute function public.economy_ledger_is_append_only();

create or replace function public.economy_reward_period(p_at timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  reward_timezone text;
begin
  select value #>> '{}'
    into reward_timezone
    from public.economy_config
   where key = 'reward_timezone';

  if reward_timezone is null then
    raise exception using
      errcode = 'P0001',
      message = 'ECONOMY_CONFIGURATION_MISSING';
  end if;

  return pg_catalog.date_trunc('day', p_at at time zone reward_timezone)
    at time zone reward_timezone;
end;
$$;

create or replace function public.economy_action_result(
  p_ledger public.economy_ledger,
  p_replayed boolean
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select pg_catalog.jsonb_build_object(
    'request_key', p_ledger.request_key,
    'action_kind', p_ledger.action_kind,
    'balance', p_ledger.resulting_balance,
    'delta', p_ledger.delta,
    'ledger_id', p_ledger.id,
    'item_slug', p_ledger.item_slug,
    'period_start', p_ledger.claim_period_start,
    'created_at', p_ledger.created_at,
    'replayed', p_replayed
  )
$$;

create or replace function public.economy_read_member(
  p_member_id uuid,
  p_ledger_limit integer,
  p_ledger_before bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  page_size integer := least(greatest(coalesce(p_ledger_limit, 20), 1), 100);
  result jsonb;
begin
  if p_member_id is null or not exists (
    select 1 from public.member where id = p_member_id
  ) then
    raise exception using errcode = 'P0001', message = 'ECONOMY_MEMBER_NOT_FOUND';
  end if;

  select pg_catalog.jsonb_build_object(
    'currency_display_name', (
      select value #>> '{}' from public.economy_config where key = 'currency_display_name'
    ),
    'shop_display_name', (
      select value #>> '{}' from public.economy_config where key = 'shop_display_name'
    ),
    'balance', coalesce((
      select balance from public.economy_wallet where member_id = p_member_id
    ), 0),
    'catalogue', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'slug', slug,
          'display_name', display_name,
          'description', description,
          'slot', slot,
          'price', price,
          'art_key', art_key
        ) order by display_name, slug
      )
      from public.economy_catalog_item
      where active
    ), '[]'::jsonb),
    'inventory', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'item_slug', inventory.item_slug,
          'display_name', item.display_name,
          'description', item.description,
          'slot', item.slot,
          'art_key', item.art_key,
          'acquired_at', inventory.acquired_at
        ) order by inventory.acquired_at, inventory.item_slug
      )
      from public.economy_inventory as inventory
      join public.economy_catalog_item as item on item.slug = inventory.item_slug
      where inventory.member_id = p_member_id
    ), '[]'::jsonb),
    'equipped', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'slot', equipped.slot,
          'item_slug', equipped.item_slug,
          'equipped_at', equipped.equipped_at
        ) order by equipped.slot
      )
      from public.economy_equipped as equipped
      where equipped.member_id = p_member_id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', page.id,
          'delta', page.delta,
          'resulting_balance', page.resulting_balance,
          'action_kind', page.action_kind,
          'source_ref', page.source_ref,
          'request_key', page.request_key,
          'item_slug', page.item_slug,
          'period_start', page.claim_period_start,
          'created_at', page.created_at
        ) order by page.id desc
      )
      from (
        select *
        from public.economy_ledger
        where member_id = p_member_id
          and (p_ledger_before is null or id < p_ledger_before)
        order by id desc
        limit page_size
      ) as page
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.economy_claim_daily_member(
  p_member_id uuid,
  p_request_key text,
  p_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  reward_amount integer;
  reward_period timestamptz;
  locked_balance integer;
  next_balance integer;
  existing_entry public.economy_ledger;
  new_entry public.economy_ledger;
  claim_id bigint;
begin
  if p_member_id is null or not exists (
    select 1 from public.member where id = p_member_id
  ) then
    raise exception using errcode = 'P0001', message = 'ECONOMY_MEMBER_NOT_FOUND';
  end if;
  if p_request_key is null
     or pg_catalog.length(p_request_key) not between 8 and 128
     or p_request_key !~ '^[A-Za-z0-9:._-]+$' then
    raise exception using errcode = '22023', message = 'ECONOMY_REQUEST_KEY_INVALID';
  end if;

  insert into public.economy_wallet(member_id)
  values (p_member_id)
  on conflict (member_id) do nothing;

  select balance into locked_balance
  from public.economy_wallet
  where member_id = p_member_id
  for update;

  select * into existing_entry
  from public.economy_ledger
  where member_id = p_member_id and request_key = p_request_key;

  if found then
    if existing_entry.action_kind <> 'daily' then
      raise exception using errcode = 'P0001', message = 'ECONOMY_REQUEST_KEY_CONFLICT';
    end if;
    return public.economy_action_result(existing_entry, true);
  end if;

  select (value #>> '{}')::integer into reward_amount
  from public.economy_config where key = 'daily_reward';
  if reward_amount is null or reward_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'ECONOMY_CONFIGURATION_INVALID';
  end if;

  reward_period := public.economy_reward_period(p_at);
  if exists (
    select 1 from public.economy_claim
    where member_id = p_member_id
      and claim_kind = 'daily'
      and period_start = reward_period
  ) then
    raise exception using errcode = 'P0001', message = 'ECONOMY_DAILY_ALREADY_CLAIMED';
  end if;

  insert into public.economy_claim(member_id, claim_kind, period_start)
  values (p_member_id, 'daily', reward_period)
  returning id into claim_id;

  update public.economy_wallet
     set balance = balance + reward_amount,
         updated_at = clock_timestamp()
   where member_id = p_member_id
   returning balance into next_balance;

  insert into public.economy_ledger(
    member_id, delta, resulting_balance, action_kind, source_ref,
    request_key, claim_period_start
  ) values (
    p_member_id, reward_amount, next_balance, 'daily',
    'daily:' || p_member_id::text || ':' || reward_period::text,
    p_request_key, reward_period
  ) returning * into new_entry;

  update public.economy_claim
     set ledger_id = new_entry.id
   where id = claim_id;

  return public.economy_action_result(new_entry, false);
end;
$$;

create or replace function public.economy_purchase_member(
  p_member_id uuid,
  p_item_slug text,
  p_request_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  item public.economy_catalog_item;
  locked_balance integer;
  next_balance integer;
  existing_entry public.economy_ledger;
  new_entry public.economy_ledger;
begin
  if p_member_id is null or not exists (
    select 1 from public.member where id = p_member_id
  ) then
    raise exception using errcode = 'P0001', message = 'ECONOMY_MEMBER_NOT_FOUND';
  end if;
  if p_request_key is null
     or pg_catalog.length(p_request_key) not between 8 and 128
     or p_request_key !~ '^[A-Za-z0-9:._-]+$' then
    raise exception using errcode = '22023', message = 'ECONOMY_REQUEST_KEY_INVALID';
  end if;

  insert into public.economy_wallet(member_id)
  values (p_member_id)
  on conflict (member_id) do nothing;

  select balance into locked_balance
  from public.economy_wallet
  where member_id = p_member_id
  for update;

  select * into existing_entry
  from public.economy_ledger
  where member_id = p_member_id and request_key = p_request_key;

  if found then
    if existing_entry.action_kind <> 'purchase'
       or existing_entry.item_slug is distinct from p_item_slug then
      raise exception using errcode = 'P0001', message = 'ECONOMY_REQUEST_KEY_CONFLICT';
    end if;
    return public.economy_action_result(existing_entry, true);
  end if;

  select * into item
  from public.economy_catalog_item
  where slug = p_item_slug and active;
  if not found then
    raise exception using errcode = 'P0001', message = 'ECONOMY_ITEM_UNAVAILABLE';
  end if;

  if exists (
    select 1 from public.economy_inventory
    where member_id = p_member_id and item_slug = p_item_slug
  ) then
    raise exception using errcode = 'P0001', message = 'ECONOMY_ITEM_ALREADY_OWNED';
  end if;
  if locked_balance < item.price then
    raise exception using errcode = 'P0001', message = 'ECONOMY_INSUFFICIENT_FUNDS';
  end if;

  update public.economy_wallet
     set balance = balance - item.price,
         updated_at = clock_timestamp()
   where member_id = p_member_id
   returning balance into next_balance;

  insert into public.economy_ledger(
    member_id, delta, resulting_balance, action_kind, source_ref,
    request_key, item_slug
  ) values (
    p_member_id, -item.price, next_balance, 'purchase',
    'purchase:' || p_member_id::text || ':' || p_item_slug,
    p_request_key, p_item_slug
  ) returning * into new_entry;

  insert into public.economy_inventory(member_id, item_slug, acquisition_ledger_id)
  values (p_member_id, p_item_slug, new_entry.id);

  return public.economy_action_result(new_entry, false);
end;
$$;

create or replace function public.economy_equip_member(
  p_member_id uuid,
  p_item_slug text,
  p_slot text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  item_slot text;
begin
  select item.slot into item_slot
  from public.economy_inventory as inventory
  join public.economy_catalog_item as item on item.slug = inventory.item_slug
  where inventory.member_id = p_member_id and inventory.item_slug = p_item_slug;

  if not found then
    raise exception using errcode = 'P0001', message = 'ECONOMY_ITEM_NOT_OWNED';
  end if;
  if p_slot is null or p_slot not in ('frame', 'badge', 'backdrop') or p_slot <> item_slot then
    raise exception using errcode = 'P0001', message = 'ECONOMY_SLOT_MISMATCH';
  end if;

  insert into public.economy_equipped(member_id, slot, item_slug)
  values (p_member_id, p_slot, p_item_slug)
  on conflict (member_id, slot) do update
    set item_slug = excluded.item_slug,
        equipped_at = clock_timestamp();

  return pg_catalog.jsonb_build_object('slot', p_slot, 'item_slug', p_item_slug);
end;
$$;

create or replace function public.economy_read_self(
  p_ledger_limit integer default 20,
  p_ledger_before bigint default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.economy_read_member(
    (
      select id
      from public.member
      where auth_user_id = auth.uid()
    ),
    p_ledger_limit,
    p_ledger_before
  )
$$;

create or replace function public.economy_claim_daily_self(p_request_key text)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select public.economy_claim_daily_member(
    (
      select id
      from public.member
      where auth_user_id = auth.uid()
    ),
    p_request_key,
    pg_catalog.clock_timestamp()
  )
$$;

create or replace function public.economy_purchase_self(
  p_item_slug text,
  p_request_key text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select public.economy_purchase_member(
    (
      select id
      from public.member
      where auth_user_id = auth.uid()
    ),
    p_item_slug,
    p_request_key
  )
$$;

create or replace function public.economy_equip_self(
  p_item_slug text,
  p_slot text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select public.economy_equip_member(
    (
      select id
      from public.member
      where auth_user_id = auth.uid()
    ),
    p_item_slug,
    p_slot
  )
$$;

create or replace function public.economy_member_for_discord(p_discord_id text)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target_member uuid;
begin
  select id into target_member
  from public.member
  where discord_id = p_discord_id;

  if target_member is null then
    raise exception using errcode = 'P0001', message = 'ECONOMY_DISCORD_NOT_LINKED';
  end if;
  return target_member;
end;
$$;

create or replace function public.economy_read_for_discord(
  p_discord_id text,
  p_ledger_limit integer default 20,
  p_ledger_before bigint default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.economy_read_member(
    public.economy_member_for_discord(p_discord_id),
    p_ledger_limit,
    p_ledger_before
  )
$$;

create or replace function public.economy_claim_daily_for_discord(
  p_discord_id text,
  p_request_key text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select public.economy_claim_daily_member(
    public.economy_member_for_discord(p_discord_id),
    p_request_key,
    pg_catalog.clock_timestamp()
  )
$$;

create or replace function public.economy_purchase_for_discord(
  p_discord_id text,
  p_item_slug text,
  p_request_key text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select public.economy_purchase_member(
    public.economy_member_for_discord(p_discord_id),
    p_item_slug,
    p_request_key
  )
$$;

create or replace function public.economy_equip_for_discord(
  p_discord_id text,
  p_item_slug text,
  p_slot text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select public.economy_equip_member(
    public.economy_member_for_discord(p_discord_id),
    p_item_slug,
    p_slot
  )
$$;

revoke all on function public.economy_ledger_is_append_only() from public, anon, authenticated, service_role;
revoke all on function public.economy_reward_period(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.economy_action_result(public.economy_ledger, boolean) from public, anon, authenticated, service_role;
revoke all on function public.economy_read_member(uuid, integer, bigint) from public, anon, authenticated, service_role;
revoke all on function public.economy_claim_daily_member(uuid, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.economy_purchase_member(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.economy_equip_member(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.economy_member_for_discord(text) from public, anon, authenticated, service_role;

revoke all on function public.economy_read_self(integer, bigint) from public, anon, authenticated, service_role;
revoke all on function public.economy_claim_daily_self(text) from public, anon, authenticated, service_role;
revoke all on function public.economy_purchase_self(text, text) from public, anon, authenticated, service_role;
revoke all on function public.economy_equip_self(text, text) from public, anon, authenticated, service_role;
grant execute on function public.economy_read_self(integer, bigint) to authenticated;
grant execute on function public.economy_claim_daily_self(text) to authenticated;
grant execute on function public.economy_purchase_self(text, text) to authenticated;
grant execute on function public.economy_equip_self(text, text) to authenticated;

revoke all on function public.economy_read_for_discord(text, integer, bigint) from public, anon, authenticated, service_role;
revoke all on function public.economy_claim_daily_for_discord(text, text) from public, anon, authenticated, service_role;
revoke all on function public.economy_purchase_for_discord(text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.economy_equip_for_discord(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.economy_read_for_discord(text, integer, bigint) to service_role;
grant execute on function public.economy_claim_daily_for_discord(text, text) to service_role;
grant execute on function public.economy_purchase_for_discord(text, text, text) to service_role;
grant execute on function public.economy_equip_for_discord(text, text, text) to service_role;
