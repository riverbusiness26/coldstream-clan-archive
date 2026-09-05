-- Staff edit and removal for current events, with a durable handoff to the
-- Discord bot. The website cannot hold a bot token, so the database records
-- the requested Discord action and the running bot performs it.

alter table event add column if not exists updated_at timestamptz not null default now();
alter table event add column if not exists deleted_at timestamptz;

create table if not exists discord_event_action (
  id bigint generated always as identity primary key,
  event_id uuid not null references event(id) on delete cascade,
  operation text not null check (operation in ('edit', 'delete')),
  channel_id text,
  message_id text,
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid not null references member(id),
  requested_at timestamptz not null default now(),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists discord_event_action_pending
  on discord_event_action(next_attempt_at, requested_at, id) where processed_at is null;

alter table discord_event_action enable row level security;

-- The bot uses service_role and is the only reader/writer. Staff requests go
-- through manage_event so an authenticated caller cannot forge queue work.
revoke all on discord_event_action from anon, authenticated;
grant all on discord_event_action to service_role;
grant usage, select on sequence discord_event_action_id_seq to service_role;

create or replace function manage_event(
  target_event uuid,
  operation text,
  event_title text default null,
  event_body text default null,
  event_game text default null,
  event_starts_at timestamptz default null,
  event_duration_minutes int default null,
  event_kind text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  existing event%rowtype;
  action_payload jsonb;
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;

  select * into existing from event where id = target_event for update;
  if not found or existing.historic or existing.deleted_at is not null then
    raise exception 'current event not found' using errcode = 'no_data_found';
  end if;

  if operation = 'edit' then
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

    update event set
      title = trim(event_title),
      body = nullif(trim(event_body), ''),
      game = nullif(trim(event_game), ''),
      starts_at = event_starts_at,
      duration_minutes = event_duration_minutes,
      event_type = event_kind,
      updated_at = now()
    where id = target_event;

    action_payload := jsonb_build_object(
      'title', trim(event_title),
      'body', nullif(trim(event_body), ''),
      'game', nullif(trim(event_game), ''),
      'starts_at', event_starts_at,
      'duration_minutes', event_duration_minutes,
      'event_type', event_kind
    );
  elsif operation = 'delete' then
    update event set cancelled = true, deleted_at = now(), updated_at = now()
    where id = target_event;
    action_payload := jsonb_build_object('title', existing.title);
  else
    raise exception 'operation must be edit or delete' using errcode = 'check_violation';
  end if;

  insert into discord_event_action(event_id, operation, channel_id, message_id, payload, requested_by)
  values (target_event, operation, existing.channel_id, existing.message_id, action_payload, actor);

  insert into personnel_audit(actor_id, action, entity, entity_id, detail)
  values (actor, 'event.' || operation, 'event', target_event::text,
    jsonb_build_object('before', to_jsonb(existing), 'after', action_payload));

  return target_event;
end;
$$;

revoke all on function manage_event(uuid, text, text, text, text, timestamptz, int, text) from public;
grant execute on function manage_event(uuid, text, text, text, text, timestamptz, int, text) to authenticated;
