-- Staff review of Discord stat submissions from the browser Admin panel.
-- Reading and deletion were granted in 0035/0038, but UPDATE was omitted.
drop policy if exists stat_submission_staff_update on stat_submission;
create policy stat_submission_staff_update on stat_submission
  for update
  using (current_member_role() in ('moderator','admin'))
  with check (current_member_role() in ('moderator','admin'));

grant update (status, reviewed_by, reviewed_at, review_note, updated_at)
  on stat_submission to authenticated;
