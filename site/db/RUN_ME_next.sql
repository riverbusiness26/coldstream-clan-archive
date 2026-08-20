-- Coldstream Gaming: run this whole file once in the Supabase SQL editor.
-- Dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run more than once.
--
-- Order matters: grants first, then the policies that depend on them.
-- 0007 replaces several policies from 0001, so it has to come after them.

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
-- uploader and the officers.
grant select on
  member, roster_entry, board, thread, post,
  gallery_item, shout, server_status, news_item
to anon, authenticated;

-- Writing. Signed-in members only, and the insert policies pin every row to
-- the member doing the writing.
grant insert on thread, post, gallery_item, shout to authenticated;
grant insert on news_item to authenticated;          -- policy limits to officers and admins

-- Editing. post_edit_own covers your own posts; thread_mod and gallery_mod
-- limit the rest to officers and admins.
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
-- member_role is an enum declared ('member', 'officer', 'admin'), so Postgres
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
-- current_member_role() in ('officer','admin').

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
-- 0007_operator
-- ==============================================================
-- A separate back end login, kept apart from the community's Steam accounts.
-- Run after 0006.
--
-- River asked for an admin login that is its own way in, not a role bolted to
-- his Steam account. So an operator is a different thing from a member:
--
--   member   is an identity in the community. It comes from Steam, it sits on
--            the roster, it posts, and its role (member/officer/admin) governs
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
-- Everywhere the schema already trusted an officer or admin, an operator is
-- trusted too. These replace the 0001 policies rather than adding to them,
-- because a table can be reached through any one policy that passes.

drop policy if exists gallery_read on gallery_item;
create policy gallery_read on gallery_item for select
  using (
    approved
    or uploader_id = current_member_id()
    or current_member_role() in ('officer','admin')
    or is_operator()
  );

drop policy if exists gallery_mod on gallery_item;
create policy gallery_mod on gallery_item for update
  using (current_member_role() in ('officer','admin') or is_operator());

drop policy if exists gallery_remove on gallery_item;
create policy gallery_remove on gallery_item for delete
  using (
    uploader_id = current_member_id()
    or current_member_role() in ('officer','admin')
    or is_operator()
  );

drop policy if exists thread_mod on thread;
create policy thread_mod on thread for update
  using (current_member_role() in ('officer','admin') or is_operator());

drop policy if exists news_admin on news_item;
create policy news_admin on news_item for insert
  with check (current_member_role() in ('officer','admin') or is_operator());

drop policy if exists news_edit on news_item;
create policy news_edit on news_item for update
  using (current_member_role() in ('officer','admin') or is_operator());

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
-- in front of the community until an officer clears it.

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
      or current_member_role() in ('officer','admin')
    )
  );


-- ------------------------------------------------------------------
-- 0004_gallery_moderation
-- Officers approve or remove pending uploads. Approval was already covered
-- by gallery_mod (update); removal needs delete policies: officers can
-- delete any item, an uploader can withdraw their own while it is pending.
drop policy if exists gallery_delete_mod on gallery_item;
create policy gallery_delete_mod on gallery_item
  for delete using (current_member_role() in ('officer','admin'));

drop policy if exists gallery_delete_own_pending on gallery_item;
create policy gallery_delete_own_pending on gallery_item
  for delete using (uploader_id = current_member_id() and not approved);

-- Storage side of a removal: officers may delete gallery objects, and an
-- uploader may delete objects in their own folder.
drop policy if exists gallery_object_delete on storage.objects;
create policy gallery_object_delete on storage.objects
  for delete using (
    bucket_id = 'gallery'
    and (
      current_member_role() in ('officer','admin')
      or (storage.foldername(name))[1] = current_member_id()::text
    )
  );
