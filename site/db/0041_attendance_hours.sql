-- Attendance hours are derived exclusively from Discord voice-presence samples.
-- The bot samples every two minutes; no manual adjustment column is used.
create or replace function member_attendance_hours(target_member uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  target_discord text;
begin
  if current_member_id() is distinct from target_member
     and current_member_role() not in ('moderator', 'admin') then
    raise exception 'member attendance is private' using errcode = 'insufficient_privilege';
  end if;

  select discord_id into target_discord from member where id = target_member;
  if target_discord is null then return 0; end if;

  return coalesce((
    select round(count(*)::numeric * 5 / 60, 1)
    from event_presence_sample
    where discord_id = target_discord
  ), 0);
end;
$$;

revoke all on function member_attendance_hours(uuid) from public;
grant execute on function member_attendance_hours(uuid) to authenticated;
