-- Preserve all original records. Stop old wallet writers before the new service
-- imports opening balances, so an old browser or Discord command cannot double spend.
begin;
lock table public.economy_wallet, public.economy_ledger in share row exclusive mode;
create or replace function public.economy_wallet_moved() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = 'P0001', message = 'Shillings has moved to the full economy. Open coldstreamgaming.com/stores/.';
end;
$$;
create trigger economy_wallet_moved before update of balance on public.economy_wallet
for each row execute function public.economy_wallet_moved();
create trigger economy_ledger_moved before insert on public.economy_ledger
for each row execute function public.economy_wallet_moved();
revoke all on function public.economy_wallet_moved() from public, anon, authenticated, service_role;

create or replace function public.quartermaster_legacy_account(p_discord_id text)
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'memberId', m.id, 'displayName', coalesce(m.display_name, 'Member'),
    'balance', coalesce(w.balance, 0),
    'lifetimeEarned', coalesce((select sum(greatest(l.delta, 0)) from public.economy_ledger l where l.member_id = m.id), 0),
    'lastDailyAt', (select max(l.created_at) from public.economy_ledger l where l.member_id = m.id and l.action_kind = 'daily')
  ) from (select 1) singleton
  left join public.member m on m.discord_id = p_discord_id
  left join public.economy_wallet w on w.member_id = m.id;
$$;
revoke all on function public.quartermaster_legacy_account(text) from public, anon, authenticated;
grant execute on function public.quartermaster_legacy_account(text) to service_role;
commit;
