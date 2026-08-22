-- 0019: profiles. A member's own page, as opposed to an archive entry.
--
-- The two are deliberately different things and were being served by one
-- page. An archive entry is a record: fixed, sourced, and not yours to edit,
-- because the whole point of it is that it can be checked. A member page is
-- yours: you write it, people post on it, and it changes.
--
-- Somebody can have both. River has a record going back to 2011 and a
-- profile he can write today, and the page shows them stacked rather than
-- merged, so it stays obvious which half is evidence and which half is a
-- member talking about themselves.
--
-- No transaction wrapper, after 0015. Run the whole file, safe to repeat.

-- ------------------------------------------------------------ the page
create table if not exists member_profile (
  member_id   uuid primary key references member(id) on delete cascade,
  -- Short on purpose. A motto is a line under a name, not an essay, and a
  -- length limit is a kinder design than a scrollbar.
  motto       text check (motto is null or char_length(motto) <= 90),
  bio         text check (bio is null or char_length(bio) <= 600),
  -- Free text rather than a foreign key to a games table. People play things
  -- we have never heard of, and a dropdown of eight titles would be a worse
  -- answer than letting them type Deep Rock Galactic.
  games       text[],
  updated_at  timestamptz not null default now()
);

alter table member_profile enable row level security;

drop policy if exists profile_read on member_profile;
create policy profile_read on member_profile for select using (true);

-- Yours and only yours. Not even a moderator edits somebody's own words:
-- removing something offensive is a delete, which is a different act from
-- quietly rewriting what a person said about themselves.
drop policy if exists profile_write on member_profile;
create policy profile_write on member_profile for insert
  with check (member_id = current_member_id());

drop policy if exists profile_update on member_profile;
create policy profile_update on member_profile for update
  using (member_id = current_member_id());

drop policy if exists profile_clear on member_profile;
create policy profile_clear on member_profile for delete
  using (member_id = current_member_id() or current_member_role() in ('moderator','admin'));

grant select on member_profile to anon, authenticated;
grant insert, update, delete on member_profile to authenticated;

-- --------------------------------------------------------------- the wall
-- The bit that makes a page worth visiting twice. Old community sites all
-- had one and it is the single feature people remember.
create table if not exists member_wall (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references member(id) on delete cascade,
  author_id   uuid not null references member(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 400),
  created_at  timestamptz not null default now()
);

create index if not exists wall_subject on member_wall(subject_id, created_at desc);

alter table member_wall enable row level security;

drop policy if exists wall_read on member_wall;
create policy wall_read on member_wall for select using (true);

drop policy if exists wall_post on member_wall;
create policy wall_post on member_wall for insert
  with check (author_id = current_member_id());

-- Three people may remove a wall post: whoever wrote it, whoever owns the
-- wall, and a moderator. Owning your own wall matters. Without it, the only
-- way to deal with something unpleasant on your page is to ask someone else.
drop policy if exists wall_delete on member_wall;
create policy wall_delete on member_wall for delete
  using (
    author_id = current_member_id()
    or subject_id = current_member_id()
    or current_member_role() in ('moderator','admin')
  );

grant select on member_wall to anon, authenticated;
grant insert, delete on member_wall to authenticated;

-- Same reasoning as the shoutbox: one post per member per ten seconds,
-- enforced here rather than in the interface.
create or replace function wall_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_at timestamptz;
begin
  select max(created_at) into last_at from member_wall where author_id = new.author_id;
  if last_at is not null and now() - last_at < interval '10 seconds' then
    raise exception 'Give it a moment before posting again.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists wall_rate on member_wall;
create trigger wall_rate before insert on member_wall
  for each row execute function wall_throttle();

-- ------------------------------------------------------- what they play
-- Filled by the steam-presence job. Kept apart from steam_presence because
-- presence changes every few minutes and this changes every few days, and
-- because it is a cache of somebody else's data either way.
create table if not exists steam_recent (
  steam_id64 text primary key,
  games      jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now()
);

alter table steam_recent enable row level security;

drop policy if exists recent_read on steam_recent;
create policy recent_read on steam_recent for select using (true);

grant select on steam_recent to anon, authenticated;
grant all on steam_recent to service_role;

-- --------------------------------------------------------- game stats
-- Per member, per game, straight from Steam.
--
-- Holdfast publishes 38 achievements, leaderboards and a stats schema, so
-- this needs no third party and no permission: the same Web API key that
-- already fetches presence can ask for a member's own numbers. Other games
-- we play expose the same thing, which is why this is keyed by appid rather
-- than being a Holdfast table.
--
-- Stats are stored as jsonb because every game publishes a different set,
-- and a column per stat would mean a migration every time we add a game.
create table if not exists game_stats (
  steam_id64   text not null,
  appid        integer not null,
  game_name    text,
  stats        jsonb not null default '{}'::jsonb,
  achieved     integer not null default 0,
  achievements integer not null default 0,
  checked_at   timestamptz not null default now(),
  primary key (steam_id64, appid)
);

create index if not exists game_stats_app on game_stats(appid, checked_at desc);

alter table game_stats enable row level security;

drop policy if exists gamestats_read on game_stats;
create policy gamestats_read on game_stats for select using (true);

grant select on game_stats to anon, authenticated;
grant all on game_stats to service_role;

-- --------------------------------------------------------------- checks
select
  (select count(*) from pg_tables where tablename in ('member_profile','member_wall','steam_recent')) as tables_created,
  (select count(*) from pg_policies where tablename in ('member_profile','member_wall','steam_recent')) as policies,
  has_table_privilege('authenticated','member_wall','INSERT')  as can_post_on_walls,
  has_table_privilege('authenticated','member_profile','UPDATE') as can_edit_own_profile,
  has_table_privilege('anon','member_wall','INSERT')           as anon_can_post_should_be_false,
  (select count(*) from pg_tables where tablename = 'game_stats') as game_stats_table;
