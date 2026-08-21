-- Give service_role the privileges it never had. Run after 0012.
--
-- What was wrong.
--
-- Every edge function connects as service_role. That role bypasses row level
-- security, and it is easy to read that as "service_role can do anything",
-- which is what 0004 through 0012 all quietly assumed. It is not what it
-- means. Bypassing the policy is not the same as being allowed near the
-- table, and grants still apply to service_role exactly like anybody else.
--
-- This project had no grants to service_role at all. Not on the new Steam
-- tables, and not on member or roster_entry either, which have been there
-- since 0001.
--
-- Why nobody noticed.
--
-- Nothing had ever actually exercised a service_role write. steam-auth looks
-- fine right up to the moment somebody signs in for real: the redirect to
-- Steam works, the assertion check works, creating the auth user works,
-- because that goes through GoTrue rather than the tables. Then it reaches
-- the member upsert and hits "permission denied for table member", and the
-- member is bounced to /?login=failed with nothing to explain it.
--
-- It surfaced only because steam-sync writes on every run and therefore fails
-- immediately and loudly. The same bug was sitting underneath sign in the
-- whole time, waiting for the first person to try.
--
-- The fix, and why it is blanket rather than per table.
--
-- These four statements are what Supabase itself sets up on a new project.
-- Doing it per table is how this happened: 0012 granted anon and
-- authenticated, remembered the 0004 trap in a comment, and still missed
-- service_role. The default privileges lines are the important half, because
-- they mean the next table anyone adds is covered without having to remember
-- any of this.
--
-- This does not widen what the site can do. service_role is server side only:
-- it exists in the edge function environment and nowhere else, and it is
-- never shipped to a browser.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Check rather than assume. information_schema.role_table_grants is no good
-- here: it only shows grants for roles the current session belongs to, so it
-- reports nothing for service_role and reads as though the grant failed.
-- has_table_privilege asks the question directly.
--
--   select
--     has_table_privilege('service_role','member','INSERT')       as member_ins,
--     has_table_privilege('service_role','steam_group','UPDATE')  as group_upd;
--
-- Both true means it took.
