-- Let the Discord bot record a staff enlistment decision through the same
-- durable action queue used by the website. Discord itself verifies the
-- reviewer has the Admin or Moderator role before this service-role-only RPC
-- is called; this function preserves their Discord identity in the audit log.

begin;

create or replace function review_regiment_enlistment_for_discord(
  target_application uuid,
  decision text,
  staff_reason text,
  reviewer_member uuid,
  reviewer_discord_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  existing enlistment%rowtype;
  normalized_reason text := nullif(trim(staff_reason), '');
  holdfast_name text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = 'insufficient_privilege';
  end if;
  if decision not in ('accepted', 'denied') then
    raise exception 'decision must be accepted or denied' using errcode = 'check_violation';
  end if;
  if decision = 'denied' and normalized_reason is null then
    raise exception 'a denial reason is required' using errcode = 'check_violation';
  end if;
  if length(coalesce(normalized_reason, '')) > 1000 then
    raise exception 'review reason must be 1000 characters or fewer' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from member
    where id = reviewer_member
      and discord_id = reviewer_discord_id
  ) then
    raise exception 'reviewer identity does not match Discord' using errcode = 'insufficient_privilege';
  end if;

  select * into existing from enlistment where id = target_application for update;
  if not found then raise exception 'application not found' using errcode = 'no_data_found'; end if;
  if existing.status <> 'pending' then
    raise exception 'application has already been reviewed' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if existing.discord_id is null or existing.guild_id is null then
    raise exception 'application is not linked to Discord' using errcode = 'check_violation';
  end if;

  holdfast_name := coalesce(nullif(trim(existing.answers ->> 'holdfast_name'), ''), existing.display_name);
  update enlistment set
    status = decision::application_status,
    reviewed_by = reviewer_member,
    review_note = normalized_reason,
    reviewed_at = now(),
    discord_status = 'queued',
    discord_last_error = null,
    discord_processed_at = null
  where id = target_application;

  insert into discord_enlistment_action(application_id, operation, guild_id, discord_id, holdfast_name, review_note, requested_by)
  values (target_application, decision, existing.guild_id, existing.discord_id, holdfast_name, normalized_reason, reviewer_member);

  insert into personnel_audit(actor_id, action, entity, entity_id, member_id, detail)
  values (
    reviewer_member,
    'enlistment.' || decision,
    'enlistment',
    target_application::text,
    existing.member_id,
    jsonb_build_object('status', decision, 'discord_id', existing.discord_id, 'source', 'discord')
  );

  return target_application;
end;
$$;

revoke all on function review_regiment_enlistment_for_discord(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function review_regiment_enlistment_for_discord(uuid, text, text, uuid, text) to service_role;

commit;
