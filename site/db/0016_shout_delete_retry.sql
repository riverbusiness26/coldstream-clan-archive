-- 0016: shout deletion, again, in a form that cannot half apply.
--
-- 0015 was run and did not take. The site reported "permission denied",
-- which is the missing grant, so nothing from that file reached the
-- database even though the run appeared to succeed.
--
-- The most likely reason is the transaction wrapper. 0015 was one
-- begin ... commit block, and a single failing statement inside such a
-- block rolls back everything in it, so a policy error silently undoes the
-- grant that came before it and the editor still looks like it ran.
--
-- So this file has NO transaction wrapper. Every statement stands alone and
-- succeeds or fails on its own, which means a failure in one cannot undo
-- another. Run the whole thing. Safe to run repeatedly.
--
-- It also grants execute on the two helper functions. Those default to
-- being callable by everyone, so this is probably unnecessary, but a policy
-- that cannot call its own helper raises "permission denied" and produces
-- an error indistinguishable from the missing table grant. Ruling it out
-- costs one line.

grant delete on shout to authenticated;

grant execute on function current_member_id() to authenticated, anon;
grant execute on function current_member_role() to authenticated, anon;

drop policy if exists shout_delete on shout;

create policy shout_delete on shout for delete
  using (
    author_id = current_member_id()
    or current_member_role() in ('moderator', 'admin')
  );

-- Verification, deliberately the last statement so its result is what the
-- editor shows. All four must come back true, true is the count being 1.
--
--   delete_granted   the table grant, the thing that was missing
--   delete_policies  should be 1
--   fn_member_id     the policy can call its own helper
--   fn_member_role   the same for the role helper
select
  has_table_privilege('authenticated', 'shout', 'DELETE')                    as delete_granted,
  (select count(*) from pg_policies
     where tablename = 'shout' and cmd = 'DELETE')                           as delete_policies,
  has_function_privilege('authenticated', 'current_member_id()', 'EXECUTE')  as fn_member_id,
  has_function_privilege('authenticated', 'current_member_role()', 'EXECUTE') as fn_member_role;
