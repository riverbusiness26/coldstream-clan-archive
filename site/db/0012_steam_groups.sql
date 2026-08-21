-- The Steam groups, and who is in them. Run after 0011.
--
-- Eight groups carry fifteen years of this community, and every one of them
-- is a page on somebody else's website. Steam groups get deleted, go private,
-- or lose the one person who could still administer them. The archive already
-- treats the announcement feed that way, as something to copy down rather
-- than link to, and the member lists deserve the same treatment.
--
-- So this is not a live view of Steam. It is a record of what Steam said,
-- with the date it said it. The site reads these tables and never calls Steam
-- from the browser, which it could not do anyway: the Steam Web API sends no
-- CORS headers, and the key must never reach a browser in the first place.
--
-- Where the numbers come from.
--
-- The group member list XML is public and needs no key. It gives the group
-- details and the full list of member IDs. Turning those IDs into names and
-- avatars needs the Web API key, one call per hundred members.
--
-- The two member counts.
--
-- Steam's XML reports memberCount twice, in two places, and they disagree.
-- Nox Viator returns 83 inside groupDetails and 87 at the list level, and the
-- list really does contain 87 IDs. The 83 is what Steam shows on the group
-- page. Rather than pick one and quietly lose the other, both are kept, named
-- for what they are. The existing era statistics in the site's seed data were
-- built from the groupDetails number, so that is the one that reconciles with
-- what is already published.

create table if not exists steam_group (
  -- Steam's own identifier is the key. The vanity URL can be changed by an
  -- admin, the ID64 cannot, and it is what survives a rename.
  group_id64 text primary key,
  url_slug text unique not null,
  name text not null,
  headline text,
  summary text,
  avatar_url text,
  -- Mirrors the order in src/seed/eras.json, which is by founding date.
  sort_order int not null default 0,

  -- What Steam displays on the group page.
  member_count_shown int,
  -- How many IDs the member list actually contained.
  member_count_listed int,
  members_online int,
  members_in_game int,
  members_in_chat int,

  -- Null until the first sync. A group that has never been fetched and a
  -- group that came back empty are different things and must look different.
  fetched_at timestamptz,
  -- Set when Steam stops returning the group at all. The row stays, because
  -- a group we lost is a fact about this community, not an absence of one.
  gone_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists steam_group_member (
  group_id64 text not null references steam_group(group_id64) on delete cascade,
  steam_id64 text not null,
  persona_name text,
  avatar_url text,
  profile_url text,
  -- 3 is a public profile, anything less is private or friends only. A
  -- private profile still counts as a member; it just has no name to show.
  visibility int,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  -- Set when a sync no longer finds them in the group. Nothing is deleted,
  -- so the record can still answer who was here in 2013.
  left_at timestamptz,
  primary key (group_id64, steam_id64)
);
create index if not exists sgm_by_person on steam_group_member(steam_id64);
create index if not exists sgm_current on steam_group_member(group_id64) where left_at is null;

-- One row per group per sync. Counts drift over fifteen years and that drift
-- is the interesting part. It cannot be reconstructed later, so it is
-- recorded from the first sync onwards even though nothing reads it yet.
create table if not exists steam_group_snapshot (
  id bigint generated always as identity primary key,
  group_id64 text not null references steam_group(group_id64) on delete cascade,
  taken_at timestamptz not null default now(),
  member_count_shown int,
  member_count_listed int,
  members_online int,
  members_in_game int
);
create index if not exists sgs_by_group on steam_group_snapshot(group_id64, taken_at desc);

-- ---------------------------------------------------------------- policies
-- Everything here is public information copied from a public page, so anyone
-- may read it. Nobody may write it from a browser: the sync function uses the
-- service role, which bypasses row level security entirely, so there is
-- deliberately no write policy for anyone else to find.
alter table steam_group enable row level security;
alter table steam_group_member enable row level security;
alter table steam_group_snapshot enable row level security;

drop policy if exists sg_read on steam_group;
create policy sg_read on steam_group for select using (true);

drop policy if exists sgm_read on steam_group_member;
create policy sgm_read on steam_group_member for select using (true);

drop policy if exists sgs_read on steam_group_snapshot;
create policy sgs_read on steam_group_snapshot for select using (true);

-- ---------------------------------------------------------------- grants
-- The trap from 0004, again: a policy is only consulted after the grant, so
-- without these the site gets 401 and it reads like a login problem.
grant select on steam_group, steam_group_member, steam_group_snapshot
  to anon, authenticated;

-- ---------------------------------------------------------------- the groups
-- Slugs and ordering come from src/seed/eras.json, which is ordered by
-- founding date, so the two cannot drift apart. The ID64s and the names were
-- read from each group's own member list XML on 21 Aug 2026.
--
-- These are Steam's names, not ours. Steam calls the seventh one "2nd
-- Coldstream Guard" while the archive calls that era "2nd Coldstream
-- Official", and both are true: one is what the group is called, the other is
-- what the community called the era. The site keeps using the era labels from
-- eras.json for headings and shows this name as the group's own.
--
-- Counts are left null on purpose. They arrive with the first sync, and null
-- has to read as "not fetched yet" rather than as a group with no members.
insert into steam_group (group_id64, url_slug, name, sort_order) values
  ('103582791431943279', '21stPApubliclinebattlegroup', '21stPA Public Linebattle Group',              1),
  ('103582791432181880', 'Midnightmercs',               'Midnight Mercenarys',                         2),
  ('103582791432815256', '2ndColdstream',               '2nd Coldstream Regiment of Footguards',       3),
  ('103582791433260433', 'MidnightMercss',              'Midnight Mercenaries Multi-Gaming Community', 4),
  ('103582791434767459', 'NoxViator',                   'Nox Viator Gaming',                           5),
  ('103582791460433590', 'GoRoaRgg',                    'RoaR Gaming Community',                       6),
  ('103582791466885702', '2ndColdstreamOfficial',       '2nd Coldstream Guard',                        7),
  ('103582791468706823', 'coldstreamgaming',            'Coldstream Gaming',                           8)
on conflict (group_id64) do update
  set url_slug   = excluded.url_slug,
      sort_order = excluded.sort_order;

-- ------------------------------------------------------- fix for 0011
-- 0011 created the enlistment table with row level security and policies but
-- no grants, which is the same trap as above. Left alone it means the Join
-- page gets 401 on read and on post, and it looks like sign in is broken when
-- it is not. Harmless to run if 0011 has not been applied yet, because it is
-- guarded on the table existing.
do $$
begin
  if to_regclass('public.enlistment') is not null then
    execute 'grant select on enlistment to anon, authenticated';
    execute 'grant insert on enlistment to authenticated';
  end if;
end $$;
