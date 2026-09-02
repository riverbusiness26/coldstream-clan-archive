-- 0024: first-party Holdfast session statistics.
--
-- Data comes from a Coldstream-controlled server, either from Holdfast's
-- round-end scoreboard CSV or from a server-only script mod. Both sources
-- identify players by Steam ID64, so names can change without splitting a
-- member's record.

create table if not exists holdfast_session (
  id            uuid primary key default gen_random_uuid(),
  external_key  text not null unique,
  source        text not null check (source in ('scoreboard_csv', 'server_mod')),
  server_key    text references server_status(server_key),
  event_id      uuid references event(id) on delete set null,
  server_name   text,
  map_name      text,
  game_mode     text,
  started_at    timestamptz,
  ended_at      timestamptz,
  imported_at   timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb
);

create index if not exists holdfast_session_recent
  on holdfast_session(ended_at desc nulls last, imported_at desc);

create table if not exists holdfast_player_session (
  session_id    uuid not null references holdfast_session(id) on delete cascade,
  steam_id64    text not null check (steam_id64 ~ '^[0-9]{17}$'),
  player_name   text,
  regiment      text,
  kills         integer not null default 0 check (kills >= 0),
  deaths        integer not null default 0 check (deaths >= 0),
  assists       integer not null default 0 check (assists >= 0),
  team_kills    integer not null default 0 check (team_kills >= 0),
  score         integer not null default 0,
  shots_fired   integer check (shots_fired is null or shots_fired >= 0),
  shots_hit     integer check (shots_hit is null or shots_hit >= 0),
  seconds_played integer check (seconds_played is null or seconds_played >= 0),
  raw_record    jsonb not null default '{}'::jsonb,
  primary key (session_id, steam_id64)
);

create index if not exists holdfast_player_by_steam
  on holdfast_player_session(steam_id64, session_id);

alter table holdfast_session enable row level security;
alter table holdfast_player_session enable row level security;

drop policy if exists holdfast_session_read on holdfast_session;
create policy holdfast_session_read on holdfast_session for select using (true);

drop policy if exists holdfast_player_session_read on holdfast_player_session;
create policy holdfast_player_session_read on holdfast_player_session for select using (true);

grant select on holdfast_session, holdfast_player_session to anon, authenticated;
grant all on holdfast_session, holdfast_player_session to service_role;

create or replace view holdfast_member_totals
with (security_invoker = true) as
select
  steam_id64,
  max(player_name) as latest_name,
  count(*)::integer as sessions,
  coalesce(sum(kills), 0)::integer as kills,
  coalesce(sum(deaths), 0)::integer as deaths,
  coalesce(sum(assists), 0)::integer as assists,
  coalesce(sum(team_kills), 0)::integer as team_kills,
  coalesce(sum(score), 0)::integer as score,
  case when sum(deaths) = 0 then sum(kills)::numeric
       else round(sum(kills)::numeric / sum(deaths), 2)
  end as kdr,
  coalesce(sum(seconds_played), 0)::integer as seconds_played
from holdfast_player_session
group by steam_id64;

grant select on holdfast_member_totals to anon, authenticated;

select
  to_regclass('public.holdfast_session') is not null as session_table,
  to_regclass('public.holdfast_player_session') is not null as player_table,
  to_regclass('public.holdfast_member_totals') is not null as totals_view;
