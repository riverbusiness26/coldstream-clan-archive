-- Staff may remove a reviewed stat submission and its cascaded rounds/proof.
drop policy if exists stat_submission_staff_delete on stat_submission;
create policy stat_submission_staff_delete on stat_submission
  for delete using (current_member_role() in ('moderator','admin'));

grant delete on stat_submission to authenticated;
