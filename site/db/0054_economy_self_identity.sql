-- Keep member-facing economy RPCs independent of the caller's search_path.
-- The production current_member_id() helper uses an unqualified member table,
-- while these security-definer functions intentionally pin search_path.

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

revoke all on function public.economy_read_self(integer, bigint) from public, anon, authenticated, service_role;
revoke all on function public.economy_claim_daily_self(text) from public, anon, authenticated, service_role;
revoke all on function public.economy_purchase_self(text, text) from public, anon, authenticated, service_role;
revoke all on function public.economy_equip_self(text, text) from public, anon, authenticated, service_role;

grant execute on function public.economy_read_self(integer, bigint) to authenticated;
grant execute on function public.economy_claim_daily_self(text) to authenticated;
grant execute on function public.economy_purchase_self(text, text) to authenticated;
grant execute on function public.economy_equip_self(text, text) to authenticated;
