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
