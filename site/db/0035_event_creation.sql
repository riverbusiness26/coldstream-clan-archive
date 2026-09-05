-- Website event creation uses the same durable queue as edits and removals.
-- The bot owns Discord credentials, so staff create the record here and the
-- bot turns the queued request into the Discord post.

alter table discord_event_action drop constraint if exists discord_event_action_operation_check;
alter table discord_event_action add constraint discord_event_action_operation_check
  check (operation in ('create', 'edit', 'delete'));

create or replace function create_managed_event(
  event_title text,
  event_body text default null,
  event_game text default null,
  event_starts_at timestamptz default null,
  event_duration_minutes int default 90,
  event_kind text default 'other'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  new_event_id uuid;
  action_payload jsonb;
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(length(trim(event_title)), 0) = 0 then
    raise exception 'event title required' using errcode = 'check_violation';
  end if;
  if event_starts_at is null then
    raise exception 'event start required' using errcode = 'check_violation';
  end if;
  if event_duration_minutes is null or event_duration_minutes < 15 or event_duration_minutes > 1440 then
    raise exception 'event duration must be between 15 and 1440 minutes' using errcode = 'check_violation';
  end if;
  if event_kind not in ('linebattle', 'training', 'social', 'campaign', 'other') then
    raise exception 'unknown event type' using errcode = 'check_violation';
  end if;

  insert into event(title, body, game, starts_at, duration_minutes, created_by, event_type)
  values (trim(event_title), nullif(trim(event_body), ''), nullif(trim(event_game), ''),
    event_starts_at, event_duration_minutes, actor, event_kind)
  returning id into new_event_id;

  action_payload := jsonb_build_object(
    'title', trim(event_title), 'body', nullif(trim(event_body), ''),
    'game', nullif(trim(event_game), ''), 'starts_at', event_starts_at,
    'duration_minutes', event_duration_minutes, 'event_type', event_kind
  );

  insert into discord_event_action(event_id, operation, payload, requested_by)
  values (new_event_id, 'create', action_payload, actor);

  insert into personnel_audit(actor_id, action, entity, entity_id, detail)
  values (actor, 'event.create', 'event', new_event_id::text,
    jsonb_build_object('after', action_payload));

  return new_event_id;
end;
$$;

revoke all on function create_managed_event(text, text, text, timestamptz, int, text) from public;
grant execute on function create_managed_event(text, text, text, timestamptz, int, text) to authenticated;
