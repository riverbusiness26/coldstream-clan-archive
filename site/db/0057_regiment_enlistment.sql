-- Discord regiment applications, staff review, and a durable bot action queue.
-- The existing enlistment table keeps its older rows and gains only the
-- Discord details required to finish a reviewed application safely.

begin;

alter table enlistment add column if not exists discord_id text;
alter table enlistment add column if not exists discord_username text;
alter table enlistment add column if not exists guild_id text;
alter table enlistment add column if not exists staff_channel_id text;
alter table enlistment add column if not exists staff_message_id text;
alter table enlistment add column if not exists discord_status text not null default 'not_synced';
alter table enlistment add column if not exists discord_last_error text;
alter table enlistment add column if not exists discord_processed_at timestamptz;

do $$ begin
  alter table enlistment add constraint enlistment_discord_status_check
    check (discord_status in ('not_synced', 'queued', 'complete', 'error'));
exception when duplicate_object then null;
end $$;

create unique index if not exists enlistment_one_pending_per_discord_member
  on enlistment(guild_id, discord_id)
  where status = 'pending' and discord_id is not null and guild_id is not null;

create table if not exists discord_enlistment_action (
  id bigint generated always as identity primary key,
  application_id uuid not null references enlistment(id) on delete cascade,
  operation text not null check (operation in ('accepted', 'denied')),
  guild_id text not null,
  discord_id text not null,
  holdfast_name text not null,
  review_note text,
  requested_by uuid not null references member(id),
  requested_at timestamptz not null default now(),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create unique index if not exists discord_enlistment_action_pending
  on discord_enlistment_action(application_id)
  where processed_at is null;
create index if not exists discord_enlistment_action_due
  on discord_enlistment_action(next_attempt_at, requested_at, id)
  where processed_at is null;

alter table discord_enlistment_action enable row level security;
revoke all on discord_enlistment_action from anon, authenticated;
grant all on discord_enlistment_action to service_role;
grant usage, select on sequence discord_enlistment_action_id_seq to service_role;

-- Reviews go through one function so the website decision and bot work item
-- are created together. Direct browser updates could accept an application
-- without ever assigning its Discord roles.
drop policy if exists enlist_review on enlistment;
revoke update on enlistment from authenticated;

create or replace function review_regiment_enlistment(
  target_application uuid,
  decision text,
  staff_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  existing enlistment%rowtype;
  normalized_reason text := nullif(trim(staff_reason), '');
  holdfast_name text;
begin
  if actor is null or current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
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
    reviewed_by = actor,
    review_note = normalized_reason,
    reviewed_at = now(),
    discord_status = 'queued',
    discord_last_error = null,
    discord_processed_at = null
  where id = target_application;

  insert into discord_enlistment_action(application_id, operation, guild_id, discord_id, holdfast_name, review_note, requested_by)
  values (target_application, decision, existing.guild_id, existing.discord_id, holdfast_name, normalized_reason, actor);

  insert into personnel_audit(actor_id, action, entity, entity_id, member_id, detail)
  values (actor, 'enlistment.' || decision, 'enlistment', target_application::text, existing.member_id,
    jsonb_build_object('status', decision, 'discord_id', existing.discord_id));

  return target_application;
end;
$$;

revoke all on function review_regiment_enlistment(uuid, text, text) from public;
grant execute on function review_regiment_enlistment(uuid, text, text) to authenticated;
grant select, insert, update on enlistment to service_role;

commit;
