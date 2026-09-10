-- 0046: allow staff to correct round values before a stat submission decision.
drop policy if exists stat_round_staff_update on stat_round;
create policy stat_round_staff_update on stat_round
  for update
  using (current_member_role() in ('moderator','admin'))
  with check (current_member_role() in ('moderator','admin'));

grant update (kills, deaths, is_mvp, is_top5) on stat_round to authenticated;
