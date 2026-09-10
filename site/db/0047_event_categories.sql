-- Event categories shown in the Admin calendar picker.
alter table event drop constraint if exists event_type_known;
alter table event add constraint event_type_known check (
  event_type in ('public_server', 'linebattle', 'competitive', 'training', 'social', 'campaign', 'other')
);

-- Keep the staff RPCs in step with the event category constraint.
create or replace function create_managed_event(
  event_title text, event_body text default null, event_game text default null,
  event_starts_at timestamptz default null, event_duration_minutes int default 90,
  event_kind text default 'linebattle'
) returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := current_member_id(); new_event_id uuid; action_payload jsonb;
begin
  if current_member_role() not in ('moderator', 'admin') then raise exception 'staff role required' using errcode = 'insufficient_privilege'; end if;
  if coalesce(length(trim(event_title)), 0) = 0 then raise exception 'event title required' using errcode = 'check_violation'; end if;
  if event_starts_at is null then raise exception 'event start required' using errcode = 'check_violation'; end if;
  if event_duration_minutes is null or event_duration_minutes < 15 or event_duration_minutes > 1440 then raise exception 'event duration must be between 15 and 1440 minutes' using errcode = 'check_violation'; end if;
  if event_kind not in ('public_server', 'linebattle', 'competitive', 'training', 'social', 'campaign', 'other') then raise exception 'unknown event type' using errcode = 'check_violation'; end if;
  insert into event(title, body, game, starts_at, duration_minutes, created_by, event_type)
    values (trim(event_title), nullif(trim(event_body), ''), nullif(trim(event_game), ''), event_starts_at, event_duration_minutes, actor, event_kind) returning id into new_event_id;
  action_payload := jsonb_build_object('title', trim(event_title), 'body', nullif(trim(event_body), ''), 'game', nullif(trim(event_game), ''), 'starts_at', event_starts_at, 'duration_minutes', event_duration_minutes, 'event_type', event_kind);
  insert into discord_event_action(event_id, operation, payload, requested_by) values (new_event_id, 'create', action_payload, actor);
  insert into personnel_audit(actor_id, action, entity, entity_id, detail) values (actor, 'event.create', 'event', new_event_id::text, jsonb_build_object('after', action_payload));
  return new_event_id;
end; $$;

create or replace function manage_event(
  target_event uuid, operation text, event_title text default null, event_body text default null,
  event_game text default null, event_starts_at timestamptz default null,
  event_duration_minutes int default null, event_kind text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := current_member_id(); existing event%rowtype; action_payload jsonb;
begin
  if current_member_role() not in ('moderator', 'admin') then raise exception 'staff role required' using errcode = 'insufficient_privilege'; end if;
  select * into existing from event where id = target_event for update;
  if not found or existing.historic or existing.deleted_at is not null then raise exception 'current event not found' using errcode = 'no_data_found'; end if;
  if operation = 'edit' then
    if coalesce(length(trim(event_title)), 0) = 0 then raise exception 'event title required' using errcode = 'check_violation'; end if;
    if event_starts_at is null then raise exception 'event start required' using errcode = 'check_violation'; end if;
    if event_duration_minutes is null or event_duration_minutes < 15 or event_duration_minutes > 1440 then raise exception 'event duration must be between 15 and 1440 minutes' using errcode = 'check_violation'; end if;
    if event_kind not in ('public_server', 'linebattle', 'competitive', 'training', 'social', 'campaign', 'other') then raise exception 'unknown event type' using errcode = 'check_violation'; end if;
    update event set title = trim(event_title), body = nullif(trim(event_body), ''), game = nullif(trim(event_game), ''), starts_at = event_starts_at, duration_minutes = event_duration_minutes, event_type = event_kind, updated_at = now() where id = target_event;
    action_payload := jsonb_build_object('title', trim(event_title), 'body', nullif(trim(event_body), ''), 'game', nullif(trim(event_game), ''), 'starts_at', event_starts_at, 'duration_minutes', event_duration_minutes, 'event_type', event_kind);
  elsif operation = 'delete' then
    update event set cancelled = true, deleted_at = now(), updated_at = now() where id = target_event;
    action_payload := jsonb_build_object('title', existing.title);
  else raise exception 'operation must be edit or delete' using errcode = 'check_violation'; end if;
  insert into discord_event_action(event_id, operation, channel_id, message_id, payload, requested_by) values (target_event, operation, existing.channel_id, existing.message_id, action_payload, actor);
  insert into personnel_audit(actor_id, action, entity, entity_id, detail) values (actor, 'event.' || operation, 'event', target_event::text, jsonb_build_object('before', to_jsonb(existing), 'after', action_payload));
  return target_event;
end; $$;
