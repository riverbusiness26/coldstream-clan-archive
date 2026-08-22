-- 0015: let a shout be deleted.
--
-- The shoutbox has only ever had read and insert policies, and no delete
-- grant at all, so nothing said in it could be taken back. Everyone has
-- posted something they wanted to unsay, and with the site now public and
-- busier than expected, an admin needs to be able to remove somebody else's
-- as well.
--
-- Two people may delete a shout: whoever wrote it, and a moderator or admin.
-- Nobody else, which the policy enforces rather than the interface: hiding a
-- button is a courtesy, a policy is the actual rule.
--
-- Run this in the Supabase SQL editor. Safe to run more than once.

begin;

-- The grant first. A policy is only consulted after the grant, so without
-- this the delete returns 401 and reads exactly like a broken login. That
-- trap has cost this project time twice already.
grant delete on shout to authenticated;

drop policy if exists shout_delete on shout;
create policy shout_delete on shout for delete
  using (
    author_id = current_member_id()
    or current_member_role() in ('moderator', 'admin')
  );

commit;

-- ------------------------------------------------------------- post checks
--
-- Expect true:
--
--   select has_table_privilege('authenticated', 'shout', 'DELETE');
--
-- Expect one row, shout_delete:
--
--   select policyname from pg_policies
--    where tablename = 'shout' and cmd = 'DELETE';
