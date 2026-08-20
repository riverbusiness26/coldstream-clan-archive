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
