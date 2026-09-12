begin;
create or replace function member_profile_activity(target_member uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_member_id(); identity text; event_count bigint; slots bigint;
begin
  if actor is null or (actor is distinct from target_member and coalesce(current_member_role()::text,'') not in ('admin','moderator')) then raise exception 'member activity is private' using errcode='insufficient_privilege'; end if;
  select discord_id into identity from member where id=target_member;
  if not found then raise exception 'member not found' using errcode='no_data_found'; end if;
  select count(distinct s.event_id),count(distinct floor(extract(epoch from s.sampled_at)/120)) into event_count,slots
  from event_presence_sample s join event e on e.id=s.event_id
  where s.discord_id=identity and not e.cancelled and e.deleted_at is null and not e.historic
    and s.sampled_at between e.starts_at-interval '15 minutes' and e.starts_at+make_interval(mins=>coalesce(e.duration_minutes,90)+30)
    and s.sampled_at<=now();
  return jsonb_build_object('events_attended',event_count,'attendance_hours',slots::numeric/30,
    'weekly_features',(select count(*) from weekly_content_submission where submitter_id=target_member and deployed_at<=now() and status in ('approved','archived')),
    'weekly_submissions',(select count(*) from weekly_content_submission where submitter_id=target_member),
    'gallery_uploads',(select count(*) from gallery_item where uploader_id=target_member));
end; $$;
revoke all on function member_profile_activity(uuid) from public,anon;
grant execute on function member_profile_activity(uuid) to authenticated;
commit;
