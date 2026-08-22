-- 0018: who is online, and what they are playing.
--
-- The Steam Web API cannot be called from a browser. It sends no CORS
-- headers, and the key must never reach a browser in the first place. So
-- presence is fetched server side on a schedule, written here, and the site
-- reads this table instead. That also means one Steam call serves every
-- visitor at once rather than one call per person looking at the page,
-- which is the difference between a tracker and a rate limit incident.
--
-- The table is a cache, not a record. Nothing here is history worth keeping:
-- if it were emptied tomorrow the next sync would refill it. That is why it
-- has no created_at and no soft delete, and why the archive does not care
-- about it.
--
-- No transaction wrapper, after 0015. Run the whole file, safe to repeat.

create table if not exists steam_presence (
  steam_id64    text primary key,
  persona_name  text,
  avatar_url    text,
  -- Steam's own numbering: 0 offline, 1 online, 2 busy, 3 away, 4 snooze,
  -- 5 looking to trade, 6 looking to play. Stored raw rather than collapsed
  -- to a label, so the meaning stays Steam's and the wording stays ours.
  persona_state smallint not null default 0,
  game          text,
  game_id       text,
  -- Whether the profile is public. A private profile always reports offline,
  -- which would otherwise look like a member who never plays.
  visible       boolean not null default true,
  checked_at    timestamptz not null default now()
);

create index if not exists steam_presence_state on steam_presence(persona_state desc, checked_at desc);

alter table steam_presence enable row level security;

-- Anyone may see who is online. It is a community page, and every value here
-- is already public on the member's own Steam profile.
drop policy if exists presence_read on steam_presence;
create policy presence_read on steam_presence for select using (true);

-- Only the sync writes. No browser policy at all, so an insert or update
-- from the site is refused whatever the interface thinks it is doing. The
-- edge function uses the service role, which bypasses this by design.
grant select on steam_presence to anon, authenticated;
grant all on steam_presence to service_role;

-- --------------------------------------------------------------- checks
select
  (select count(*) from pg_tables where tablename = 'steam_presence')        as table_exists,
  (select count(*) from pg_policies where tablename = 'steam_presence')      as policies,
  has_table_privilege('anon', 'steam_presence', 'SELECT')                    as anon_can_read,
  has_table_privilege('anon', 'steam_presence', 'INSERT')                    as anon_can_write_should_be_false;
