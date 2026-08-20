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
