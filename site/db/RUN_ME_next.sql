-- Coldstream Gaming: run this whole file once in the Supabase SQL editor.
-- Dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run more than once.

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

