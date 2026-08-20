-- Coldstream Gaming community site: initial schema.
-- Postgres on Supabase. Every table gets row level security; public reads
-- where the content is public, writes gated by role.

create type member_role as enum ('member', 'moderator', 'admin');
create type roster_source as enum ('enjin', 'forum', 'steam', 'screenshot', 'manual');

-- Accounts. One row per signed-in person, keyed to their Steam ID.
create table member (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  steam_id64 text unique not null,
  display_name text not null,
  avatar_url text,
  joined_year int,
  discord_id text,
  role member_role not null default 'member',
  created_at timestamptz not null default now()
);

-- The roster: every person in the record since 2011, whether or not they
-- ever log in. member_id links when a signed-in account matches.
create table roster_entry (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references member(id) on delete set null,
  person_name text not null,
  person_key text not null,           -- normalized name for grouping
  steam_id64 text,                    -- when the source recorded it
  game text not null default 'GEN',
  rank_or_class text,
  year int,
  source roster_source not null,
  source_detail text,                 -- provenance label, always shown
  active boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index roster_entry_person_key on roster_entry(person_key);
create index roster_entry_year on roster_entry(year);
create index roster_entry_steam on roster_entry(steam_id64);

-- Forum.
create table board (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  position int not null default 0,
  min_role_read member_role,          -- null means public
  min_role_post member_role not null default 'member'
);
create table thread (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references board(id),
  author_id uuid not null references member(id),
  title text not null,
  pinned boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now()
);
create table post (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references thread(id),
  author_id uuid not null references member(id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index post_thread on post(thread_id, created_at);

-- Gallery.
create table gallery_item (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references member(id),
  storage_key text not null,
  caption text,
  game text,
  year int,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Shoutbox. Delivered over realtime; old rows trimmed by a scheduled job.
create table shout (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references member(id),
  body varchar(200) not null,
  created_at timestamptz not null default now()
);

-- Live server status, written by the poller on the game server box.
create table server_status (
  server_key text primary key,
  game text not null,
  name text not null,
  address text,
  map text,
  players int not null default 0,
  max_players int not null default 0,
  online boolean not null default false,
  updated_at timestamptz not null default now()
);

-- News: genuine posts from the community's old sites, plus new admin posts.
create table news_item (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author text,
  original_date date,
  source_site text,                   -- provenance label, always shown
  source_url text,
  posted_by uuid references member(id),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- helpers
create or replace function current_member_id() returns uuid
language sql stable as $$
  select id from member where auth_user_id = auth.uid()
$$;

create or replace function current_member_role() returns member_role
language sql stable as $$
  select role from member where auth_user_id = auth.uid()
$$;

-- --------------------------------------------------------------- RLS
alter table member enable row level security;
alter table roster_entry enable row level security;
alter table board enable row level security;
alter table thread enable row level security;
alter table post enable row level security;
alter table gallery_item enable row level security;
alter table shout enable row level security;
alter table server_status enable row level security;
alter table news_item enable row level security;

-- Public content is readable by anyone.
create policy member_read on member for select using (true);
create policy roster_read on roster_entry for select using (true);
create policy board_read on board for select using (min_role_read is null or current_member_role() is not null);
create policy thread_read on thread for select using (true);
create policy post_read on post for select using (deleted_at is null);
create policy gallery_read on gallery_item for select using (approved or uploader_id = current_member_id() or current_member_role() in ('moderator','admin'));
create policy shout_read on shout for select using (true);
create policy server_read on server_status for select using (true);
create policy news_read on news_item for select using (true);

-- Members write their own things.
create policy member_update_self on member for update
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy thread_insert on thread for insert
  with check (author_id = current_member_id());
create policy post_insert on post for insert
  with check (author_id = current_member_id());
create policy post_edit_own on post for update
  using (author_id = current_member_id());
create policy gallery_insert on gallery_item for insert
  with check (uploader_id = current_member_id());
create policy shout_insert on shout for insert
  with check (author_id = current_member_id());

-- Moderators and admins moderate.
create policy thread_mod on thread for update
  using (current_member_role() in ('moderator','admin'));
create policy gallery_mod on gallery_item for update
  using (current_member_role() in ('moderator','admin'));
create policy news_admin on news_item for insert
  with check (current_member_role() in ('moderator','admin'));
