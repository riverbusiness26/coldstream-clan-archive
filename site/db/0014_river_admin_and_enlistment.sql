-- 0014: make River an admin, and apply the enlistment book.
--
-- Two things that are both one line of consequence and were both blocking
-- something real.
--
-- 1. River owns the community and his member row came out of Steam sign in
--    as role 'member', which is what the upsert writes for everybody. Every
--    admin gated action on his own site refuses him: approving gallery
--    uploads, removing them, posting an event to the board.
--
-- 2. The enlistment table was never applied to production, even though the
--    section for it sits in RUN_ME_next.sql. The proof it was applied
--    selectively is that 0012, which comes after it in the same file, does
--    exist. So the Join page's post button has been failing for every
--    signed in member with a PGRST205, and the enlistment book has been
--    permanently empty for a reason that has nothing to do with anybody
--    being shy.
--
-- Run this in the Supabase SQL editor. Safe to run more than once.

begin;

-- ---------------------------------------------------------------- 1. admin
--
-- Targeted by steam_id64 rather than by name, because a display name comes
-- from Steam and changes whenever River changes it there.
--
-- The member_role_guard trigger does not block this. Its role check only
-- applies when auth.uid() is not null, which is to say when the update comes
-- from a browser carrying a session. The SQL editor has no session, so the
-- guard passes. Its other rule, the one that refuses to remove the last
-- admin, is about demotions and does not apply to a promotion.
update member
   set role = 'admin'
 where steam_id64 = '76561198044997257'
   and role is distinct from 'admin';

-- ---------------------------------------------------------- 2. enlistment
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

-- The grant, which is the part that is easy to leave out and hard to
-- diagnose. A grant is checked before the policy, so a table with perfect
-- policies and no grant returns 401 and reads exactly like a broken login.
-- 0004 set default privileges for SELECT only, so the insert has to be
-- granted here by hand or the Join page fails in a way that looks like an
-- auth problem rather than a permissions one.
grant select on enlistment to anon, authenticated;
grant insert on enlistment to authenticated;
grant all on enlistment to service_role;

commit;

-- ------------------------------------------------------------- post checks
--
-- Expect one row back, with role 'admin':
--
--   select display_name, role from member where steam_id64 = '76561198044997257';
--
-- Expect true, true:
--
--   select
--     has_table_privilege('authenticated','enlistment','INSERT') as can_post,
--     has_table_privilege('anon','enlistment','SELECT')          as can_read;
--
-- Or from the repo root, which checks the live site as a whole:
--
--   node scripts/status.mjs
