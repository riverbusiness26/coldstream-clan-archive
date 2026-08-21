-- Coldstream Gaming: run this whole file once in the Supabase SQL editor.
-- Dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run more than once.
--
-- 0000 comes first and must stay first: it renames the officer role to
-- moderator on a database that already has it, and everything after this
-- point names 'moderator'. Then grants, because a policy is only checked
-- after the grant, then the migrations that replace earlier policies.

-- ==============================================================
-- 0000_role_rename
-- ==============================================================
-- Rename the officer role to moderator. This has to run FIRST, before any
-- migration that mentions 'moderator'.
--
-- The other session renamed officer to moderator throughout the migrations,
-- including in 0001 where the enum is declared. That is correct for a database
-- created from scratch today, and broken for the one River is actually running,
-- because his was created from the earlier 0001 and its enum still reads
-- ('member', 'officer', 'admin').
--
-- Verified against the live project: role=eq.officer returns 200, and
-- role=eq.moderator returns
--   400 invalid input value for enum member_role: "moderator"
--
-- So without this, every policy in 0004 through 0010 that names 'moderator'
-- fails and takes the whole script down with it.
--
-- Renaming the value rather than adding a new one keeps every existing row
-- correct automatically: anybody already marked officer becomes a moderator,
-- with no update and no window where a role means nothing.

do $$
declare
  has_officer boolean;
  has_moderator boolean;
begin
  select
    exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
            where t.typname = 'member_role' and e.enumlabel = 'officer'),
    exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
            where t.typname = 'member_role' and e.enumlabel = 'moderator')
  into has_officer, has_moderator;

  if has_officer and not has_moderator then
    execute 'alter type member_role rename value ''officer'' to ''moderator''';
    raise notice 'member_role: officer renamed to moderator';
  elsif has_moderator then
    raise notice 'member_role: already moderator, nothing to do';
  else
    -- member_role does not exist yet, so 0001 has not been run. Nothing to
    -- rename, and 0001 will declare it correctly.
    raise notice 'member_role: type not found, skipping';
  end if;
end
$$;

-- ==============================================================
-- 0004_grants
-- ==============================================================
-- Role grants. Run this once, in the Supabase SQL editor.
--
-- Why this is needed: 0001_init.sql enabled row level security and wrote the
-- policies, but never granted the browser roles access to the tables in the
-- first place. Postgres checks the grant BEFORE it ever looks at a policy, so
-- every request from the site came back 401 "permission denied for table",
-- and the site quietly fell back to its bundled seed data on every page.
--
-- Grants and policies do different jobs and you need both:
--   the GRANT decides whether the role may touch the table at all
--   the POLICY decides which rows it sees and which it may write
-- The policies in 0001 are already correct, so these grants are safe: anon can
-- read only what the read policies expose, and authenticated can only write
-- rows the with-check clauses accept.

grant usage on schema public to anon, authenticated;

-- Reading. The read policies in 0001 do the filtering: the staff board stays
-- hidden, unapproved gallery items stay hidden from everyone but their own
-- uploader and the moderators.
grant select on
  member, roster_entry, board, thread, post,
  gallery_item, shout, server_status, news_item
to anon, authenticated;

-- Writing. Signed-in members only, and the insert policies pin every row to
-- the member doing the writing.
grant insert on thread, post, gallery_item, shout to authenticated;
grant insert on news_item to authenticated;          -- policy limits to moderators and admins

-- Editing. post_edit_own covers your own posts; thread_mod and gallery_mod
-- limit the rest to moderators and admins.
grant update on post, thread, gallery_item to authenticated;

-- A member may keep their own display name and avatar current.
grant update on member to authenticated;

-- Anything added later should inherit the same shape rather than silently
-- repeating this bug.
alter default privileges in schema public
  grant select on tables to anon, authenticated;

-- ==============================================================
-- 0005_forum_privacy
-- ==============================================================
-- Forum privacy and write rules. Run after 0004_grants.sql.
--
-- Three defects in the 0001 policies, all of which only matter once the
-- grants in 0004 make the tables reachable from the browser:
--
--  1. board_read let ANY signed-in member read a restricted board, because it
--     only checked that current_member_role() was not null. The staff board
--     was therefore open to every member who signed in.
--
--  2. thread_read and post_read were both "using (true)". Hiding the board
--     row hid the board from the forum UI, but the threads and posts inside it
--     were still readable straight off the REST API by anyone at all, signed
--     in or not. Hiding the door is not hiding the room.
--
--  3. Nothing enforced min_role_post, and nothing stopped a post landing in a
--     locked thread. The UI hid those controls, which is not the same as the
--     database refusing the write.
--
-- member_role is an enum declared ('member', 'moderator', 'admin'), so Postgres
-- already orders it correctly and a plain >= comparison is the rank test.

-- A board is visible when it is public, or when your role reaches its bar.
create or replace function can_read_board(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from board
    where id = b
      and (min_role_read is null
           or current_member_role() >= min_role_read)
  )
$$;

-- Same board, on the posting side.
create or replace function can_post_board(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from board
    where id = b
      and can_read_board(id)
      and current_member_role() >= min_role_post
  )
$$;

-- 1. Restricted boards need the role, not merely an account.
drop policy if exists board_read on board;
create policy board_read on board for select
  using (min_role_read is null or current_member_role() >= min_role_read);

-- 2. Threads and posts inherit the privacy of the board they sit in.
drop policy if exists thread_read on thread;
create policy thread_read on thread for select
  using (can_read_board(board_id));

drop policy if exists post_read on post;
create policy post_read on post for select
  using (
    deleted_at is null
    and exists (
      select 1 from thread t
      where t.id = post.thread_id and can_read_board(t.board_id)
    )
  );

-- 3. Writes check the board's posting bar, and honour the lock.
drop policy if exists thread_insert on thread;
create policy thread_insert on thread for insert
  with check (
    author_id = current_member_id()
    and can_post_board(board_id)
  );

drop policy if exists post_insert on post;
create policy post_insert on post for insert
  with check (
    author_id = current_member_id()
    and exists (
      select 1 from thread t
      where t.id = post.thread_id
        and not t.locked
        and can_post_board(t.board_id)
    )
  );

-- Editing your own post should not resurrect a deleted one or move it.
drop policy if exists post_edit_own on post;
create policy post_edit_own on post for update
  using (author_id = current_member_id() and deleted_at is null)
  with check (author_id = current_member_id());

-- Moderators need read access to what they moderate, so their update policies
-- are left as they are in 0001: thread_mod and gallery_mod both already test
-- current_member_role() in ('moderator','admin').

-- Bumping last_post_at is what makes the board index meaningful. Doing it in a
-- trigger keeps it honest whether the post came from the site or from SQL.
create or replace function bump_thread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update thread set last_post_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists post_bumps_thread on post;
create trigger post_bumps_thread after insert on post
  for each row execute function bump_thread();

-- ==============================================================
-- 0006_shoutbox
-- ==============================================================
-- Shoutbox: realtime delivery and trimming. Run after 0005.
--
-- 0001 said the shoutbox was "delivered over realtime; old rows trimmed by a
-- scheduled job", but neither existed. Without the table in the realtime
-- publication the browser subscribes to a channel that never fires, so a
-- shout only appears for the person who sent it until someone reloads.

-- Deliver inserts to subscribed browsers.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shout'
  ) then
    execute 'alter publication supabase_realtime add table public.shout';
  end if;
end
$$;

-- The payload needs the author id so the browser can put a name to the line.
alter table shout replica identity full;

-- The shoutbox is a chat room, not a record. Keep the last 200 lines and let
-- the rest go. Doing it on insert means there is no scheduled job to forget
-- about, and at this volume the cost is not worth measuring.
create or replace function trim_shouts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from shout
  where id in (
    select id from shout order by created_at desc offset 200
  );
  return null;
end;
$$;

drop trigger if exists shout_trim on shout;
create trigger shout_trim after insert on shout
  for each statement execute function trim_shouts();

create index if not exists shout_recent on shout(created_at desc);

-- ==============================================================
-- 0003_gallery_storage
-- ==============================================================
-- Storage for member gallery uploads.
--
-- Run this after 0001_init.sql. It creates the public bucket the Gallery page
-- writes to and the policies that decide who may write into it.
--
-- Reads are public because the images are meant to be seen. Writes are
-- restricted: a signed-in member may only write inside a folder named after
-- their own member id, so nobody can overwrite anyone else's uploads. The
-- gallery_item row still starts unapproved, so uploading does not put an image
-- in front of the community until a moderator clears it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery', 'gallery', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_object_read on storage.objects;
create policy gallery_object_read on storage.objects
  for select using (bucket_id = 'gallery');

-- The first path segment must be the uploader's own member id.
drop policy if exists gallery_object_write on storage.objects;
create policy gallery_object_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = current_member_id()::text
  );

drop policy if exists gallery_object_delete on storage.objects;
create policy gallery_object_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gallery'
    and (
      (storage.foldername(name))[1] = current_member_id()::text
      or current_member_role() in ('moderator','admin')
    )
  );

-- ==============================================================
-- 0007_operator
-- ==============================================================
-- A separate back end login, kept apart from the community's Steam accounts.
-- Run after 0006.
--
-- River asked for an admin login that is its own way in, not a role bolted to
-- his Steam account. So an operator is a different thing from a member:
--
--   member   is an identity in the community. It comes from Steam, it sits on
--            the roster, it posts, and its role (member/moderator/admin) governs
--            what it can do as a person in the community.
--   operator is a key to the back door. It signs in with email and password,
--            it is not on the roster, it does not post, and it exists only to
--            run the site.
--
-- Keeping them apart means the roster never has to explain a row that is not a
-- person, and losing one credential does not hand over the other.
--
-- Passwords are handled entirely by Supabase Auth. Nothing in this schema and
-- nothing in the site's code ever sees, stores or hashes a password. Operator
-- accounts are created by hand in the Supabase dashboard, by River, with a
-- password he sets himself.

create table if not exists operator (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table operator enable row level security;

-- Security definer so a policy can call it without the caller needing to read
-- the operator table, which would otherwise be circular.
create or replace function is_operator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from operator where auth_user_id = auth.uid())
$$;

-- An operator can see their own row and nothing else. Nobody else sees the
-- table at all, so the set of back end accounts is not public knowledge.
drop policy if exists operator_self on operator;
create policy operator_self on operator for select
  using (auth_user_id = auth.uid());

-- ---------------------------------------------------------------- powers
-- Everywhere the schema already trusted an moderator or admin, an operator is
-- trusted too. These replace the 0001 policies rather than adding to them,
-- because a table can be reached through any one policy that passes.

drop policy if exists gallery_read on gallery_item;
create policy gallery_read on gallery_item for select
  using (
    approved
    or uploader_id = current_member_id()
    or current_member_role() in ('moderator','admin')
    or is_operator()
  );

drop policy if exists gallery_mod on gallery_item;
create policy gallery_mod on gallery_item for update
  using (current_member_role() in ('moderator','admin') or is_operator());

-- Deleting a gallery item is handled in 0008, not here. An earlier draft of
-- this migration let an uploader delete their own item at any time, which
-- quietly beat the more careful rule in 0008 that they may only withdraw one
-- while it is still pending: permissive policies are OR'd, so the loosest one
-- wins and the stricter one looks like it is working when it is not.
drop policy if exists gallery_remove on gallery_item;

drop policy if exists thread_mod on thread;
create policy thread_mod on thread for update
  using (current_member_role() in ('moderator','admin') or is_operator());

drop policy if exists news_admin on news_item;
create policy news_admin on news_item for insert
  with check (current_member_role() in ('moderator','admin') or is_operator());

drop policy if exists news_edit on news_item;
create policy news_edit on news_item for update
  using (current_member_role() in ('moderator','admin') or is_operator());

-- Boards and servers had no write policies at all, so they could only be
-- changed with raw SQL. The back end is the point where that stops.
drop policy if exists board_admin on board;
create policy board_admin on board for all
  using (is_operator()) with check (is_operator());

drop policy if exists server_admin on server_status;
create policy server_admin on server_status for all
  using (is_operator()) with check (is_operator());

-- An operator may set anyone's role. Members still may not: member_update_self
-- from 0001 only lets someone edit their own row, and the trigger below stops
-- that from being a way to promote yourself.
drop policy if exists member_admin on member;
create policy member_admin on member for update
  using (is_operator()) with check (is_operator());

-- A member editing their own row may change their display name and avatar.
-- Three things they may not touch:
--
--   role         or they promote themselves
--   steam_id64   or they point their account at somebody else's history, which
--                is how you would steal a fourteen year record
--   auth_user_id or they point somebody else's account at their own row
--
-- auth.uid() is null when this runs from the SQL editor or the service role,
-- which is how the Steam function and a hand-run promotion work. That is not a
-- way in from the browser: anon has no update grant on member at all, and an
-- authenticated caller always has a uid.
create or replace function guard_member_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  from_browser boolean := auth.uid() is not null;
begin
  if from_browser and not is_operator() then
    if new.role is distinct from old.role then
      raise exception 'only an operator may change a role';
    end if;
    if new.steam_id64 is distinct from old.steam_id64 then
      raise exception 'steam id cannot be changed';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'account link cannot be changed';
    end if;
  end if;

  if old.role = 'admin' and new.role is distinct from old.role
     and (select count(*) from member where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin';
  end if;

  return new;
end;
$$;

drop trigger if exists member_role_guard on member;
create trigger member_role_guard before update on member
  for each row execute function guard_member_row();

-- ---------------------------------------------------------------- grants
-- Same trap as 0004: a policy is checked only after the grant, so without
-- these the back end gets 401 and looks like a login problem.
grant select on operator to authenticated;
grant update on member, thread, gallery_item, news_item to authenticated;
grant delete on gallery_item to authenticated;
grant insert, update, delete on board, server_status to authenticated;

-- ---------------------------------------------------------------- setup
-- Create the account in the dashboard first: Authentication > Users > Add
-- user, with a real email and a password you choose. Then run this with the
-- id that account was given, which is shown in the same table.
--
-- insert into operator (auth_user_id, label)
-- values ('00000000-0000-0000-0000-000000000000', 'River');

-- ==============================================================
-- 0008_gallery_moderation
-- ==============================================================
-- Gallery moderation. Run after 0007.
--
-- Written by the other session and inlined straight into RUN_ME_next.sql,
-- which meant it was not reproducible from the db/ directory and would be lost
-- the next time the bundle was regenerated. Same content, now a real file, with
-- one thing added: the operator from 0007 can do these too, or the back end
-- cannot moderate the gallery it is supposed to be moderating.
--
-- Approval itself is an update and is already covered by gallery_mod in 0007.
-- What is here is removal.

-- Moderators and admins may remove anything. An uploader may withdraw their own
-- upload only while it is still pending, so an approved picture cannot be
-- pulled out from under the community later.
drop policy if exists gallery_remove on gallery_item;

drop policy if exists gallery_delete_mod on gallery_item;
create policy gallery_delete_mod on gallery_item
  for delete using (
    current_member_role() in ('moderator','admin')
    or is_operator()
  );

drop policy if exists gallery_delete_own_pending on gallery_item;
create policy gallery_delete_own_pending on gallery_item
  for delete using (uploader_id = current_member_id() and not approved);

-- The storage side of a removal. Deleting the row without the object leaves
-- the bucket filling up with files nothing points at.
drop policy if exists gallery_object_delete on storage.objects;
create policy gallery_object_delete on storage.objects
  for delete using (
    bucket_id = 'gallery'
    and (
      current_member_role() in ('moderator','admin')
      or is_operator()
      or (storage.foldername(name))[1] = current_member_id()::text
    )
  );

-- ==============================================================
-- 0009_gallery_categories
-- ==============================================================
-- Gallery categories, and video as a first class item. Run after 0008.
--
-- Modelled on how the big forum platforms actually do this. XenForo Media
-- Gallery, which is what most large gaming communities run, organises media
-- into admin-defined categories with their own permissions, and each category
-- decides what it will hold. That is the shape here, minus the parts that only
-- make sense at their scale.
--
-- Videos are stored as a YouTube id, not as a file. A free Supabase project
-- gets one gigabyte of storage, which is roughly two phone clips, and video
-- hosting is the fastest way to turn a free site into a paid one. Every
-- community of this size already puts its footage on YouTube: the site's job
-- is to gather it, not to host it. Thirty two of our own films are already on
-- the site that way.

create table if not exists gallery_category (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  position int not null default 0,
  -- What the category will take. A category cannot be changed once it has
  -- items in it that the new setting would not allow.
  accepts text not null default 'both' check (accepts in ('image', 'video', 'both')),
  -- Locked categories are readable by everyone and writable by nobody. The
  -- recovered archive lives in one: it is a record, not a noticeboard.
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gallery_category_order on gallery_category(position, name);

alter table gallery_item
  add column if not exists category_id uuid references gallery_category(id),
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video')),
  add column if not exists video_id text,
  add column if not exists title text,
  add column if not exists width int,
  add column if not exists height int;

-- storage_key was mandatory when everything was an uploaded image. A video has
-- no stored file, so the rule becomes: exactly one of the two, and it has to
-- match what the item claims to be.
alter table gallery_item alter column storage_key drop not null;

alter table gallery_item drop constraint if exists gallery_item_media_shape;
alter table gallery_item add constraint gallery_item_media_shape check (
  (media_type = 'image' and storage_key is not null and video_id is null)
  or
  (media_type = 'video' and video_id is not null and storage_key is null)
);

create index if not exists gallery_item_category on gallery_item(category_id, created_at desc);

-- ---------------------------------------------------------------- policies
alter table gallery_category enable row level security;

drop policy if exists gallery_category_read on gallery_category;
create policy gallery_category_read on gallery_category for select using (true);

drop policy if exists gallery_category_admin on gallery_category;
create policy gallery_category_admin on gallery_category for all
  using (current_member_role() in ('moderator','admin') or is_operator())
  with check (current_member_role() in ('moderator','admin') or is_operator());

-- Nobody may add to a locked category, whatever else they are allowed to do.
-- Moderators can still unlock one if they mean to.
drop policy if exists gallery_insert on gallery_item;
create policy gallery_insert on gallery_item for insert
  with check (
    uploader_id = current_member_id()
    and (
      category_id is null
      or exists (select 1 from gallery_category c where c.id = category_id and not c.locked)
    )
  );

-- ---------------------------------------------------------------- grants
grant select on gallery_category to anon, authenticated;
grant insert, update, delete on gallery_category to authenticated;

-- ---------------------------------------------------------------- seeding
-- Categories drawn from what the community actually played, in the order it
-- played them. Everything else is "Other Games" rather than a category per
-- title nobody will fill.
insert into gallery_category (slug, name, description, position, accepts, locked) values
  ('napoleonic-wars', 'Napoleonic Wars', 'Mount & Blade: Warband. The regiment years, linebattles and drills.', 10, 'both', false),
  ('counter-strike',  'Counter-Strike',  'CS:GO and CS:S. Retakes, 10 mans, and the ESEA years.', 20, 'both', false),
  ('battlegrounds',   'Battlegrounds 2', 'Where it started in 2011, before the regiment had a name.', 30, 'both', false),
  ('holdfast',        'Holdfast',        'Nations at War.', 40, 'both', false),
  ('garrys-mod',      'Garry''s Mod',    'TTT and whatever else the server was running that week.', 50, 'both', false),
  ('other-games',     'Other Games',     'Everything else we have played together.', 60, 'both', false),
  ('films',           'Films',           'Videos of the community, ours and other people''s.', 70, 'video', false),
  ('the-archive',     'The Archive',     'Recovered material, pulled off Photobucket and imgur before the links died. Read only: this is a record, not a noticeboard.', 80, 'both', true)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      position = excluded.position,
      accepts = excluded.accepts,
      locked = excluded.locked;

-- ==============================================================
-- 0010_events
-- ==============================================================
-- The events calendar. Run after 0009.
--
-- Two things this has to do that a generic calendar does not.
--
-- Times are stored in UTC and rendered in whoever is looking at it's own zone.
-- Every announcement in the archive reads "7PM Central / 8PM Eastern" and the
-- roster has members in Canada, the UK and Australia. The archive is full of
-- people asking what time an event actually was, and that stops here.
--
-- The past is seeded from the record. There are 627 dated events in the
-- announcement archive. A calendar that only shows an empty future is a dead
-- page on the day it ships; one you can scroll back through 2012 is the thing
-- this whole project exists for. Seeded rows carry their source and are marked
-- historic, so they can never be mistaken for something you can turn up to.

create table if not exists event (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  game text,
  starts_at timestamptz not null,
  duration_minutes int not null default 90,
  server_key text references server_status(server_key),
  created_by uuid references member(id),
  cancelled boolean not null default false,
  -- A historic event is a record of something that happened, pulled from the
  -- archive. Nobody can RSVP to it and nobody should try.
  historic boolean not null default false,
  source_detail text,
  created_at timestamptz not null default now()
);
create index if not exists event_when on event(starts_at desc);
create index if not exists event_upcoming on event(starts_at) where not historic;

create table if not exists event_rsvp (
  event_id uuid not null references event(id) on delete cascade,
  member_id uuid not null references member(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'out')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index if not exists event_rsvp_member on event_rsvp(member_id);

-- ---------------------------------------------------------------- policies
alter table event enable row level security;
alter table event_rsvp enable row level security;

drop policy if exists event_read on event;
create policy event_read on event for select using (true);

drop policy if exists event_write on event;
create policy event_write on event for all
  using (current_member_role() in ('moderator','admin') or is_operator())
  with check (current_member_role() in ('moderator','admin') or is_operator());

drop policy if exists rsvp_read on event_rsvp;
create policy rsvp_read on event_rsvp for select using (true);

-- You may only speak for yourself, and only about something still to happen.
drop policy if exists rsvp_write on event_rsvp;
create policy rsvp_write on event_rsvp for insert
  with check (
    member_id = current_member_id()
    and exists (select 1 from event e where e.id = event_id and not e.historic and not e.cancelled)
  );

drop policy if exists rsvp_change on event_rsvp;
create policy rsvp_change on event_rsvp for update
  using (member_id = current_member_id())
  with check (member_id = current_member_id());

drop policy if exists rsvp_withdraw on event_rsvp;
create policy rsvp_withdraw on event_rsvp for delete
  using (member_id = current_member_id());

-- ---------------------------------------------------------------- grants
grant select on event, event_rsvp to anon, authenticated;
grant insert, update, delete on event to authenticated;
grant insert, update, delete on event_rsvp to authenticated;

-- ---------------------------------------------------------------- counts
-- The board wants "nine going" without pulling every row down to the browser.
create or replace view event_attendance as
  select event_id,
         count(*) filter (where status = 'going') as going,
         count(*) filter (where status = 'maybe') as maybe
  from event_rsvp
  group by event_id;

grant select on event_attendance to anon, authenticated;


-- ------------------------------------------------------------------
-- 0011_enlistment_book
-- The forum was scrapped (River, 21 Aug 2026). Introductions now land in
-- their own table. The board/thread/post tables above are no longer used by
-- the site; skip their sections on a fresh apply, or drop them if applied.
create table if not exists enlistment (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references member(id) default current_member_id(),
  display_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table enlistment enable row level security;
drop policy if exists enlist_read on enlistment;
create policy enlist_read on enlistment for select using (true);
drop policy if exists enlist_write on enlistment;
create policy enlist_write on enlistment for insert
  with check (current_member_id() is not null);


-- ------------------------------------------------------------------
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
