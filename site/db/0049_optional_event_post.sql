-- Applied 2026-09-12: separates website creation from an explicit Discord post.
begin;
create or replace function post_managed_event(target_event uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare existing public.event%rowtype; actor uuid := current_member_id();
begin
  if actor is null or current_member_role() is null or current_member_role() not in ('moderator','admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;
  select * into existing from public.event where id = target_event for update;
  if not found or existing.historic or existing.deleted_at is not null or existing.cancelled then
    raise exception 'current event not found' using errcode = 'no_data_found';
  end if;
  -- The row lock serializes repeat clicks; a queued or existing post is not duplicated.
  if existing.message_id is not null or exists(select 1 from discord_event_action where event_id = target_event and operation = 'create' and processed_at is null) then return target_event; end if;
  insert into discord_event_action(event_id,operation,payload,requested_by)
  values(target_event,'create',jsonb_build_object('title',existing.title,'body',existing.body,'game',existing.game,'starts_at',existing.starts_at,'duration_minutes',existing.duration_minutes,'event_type',existing.event_type),actor);
  insert into personnel_audit(actor_id,action,entity,entity_id,detail)
  values(actor,'event.post','event',target_event::text,jsonb_build_object('queued',true));
  return target_event;
end; $$;

create or replace function create_website_event(
  event_title text, event_body text default null, event_game text default null,
  event_starts_at timestamptz default null, event_duration_minutes int default 90,
  event_kind text default 'linebattle'
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := current_member_id(); new_id uuid;
begin
  if actor is null or current_member_role() is null or current_member_role() not in ('moderator','admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(length(trim(event_title)),0) = 0 or event_starts_at is null or event_duration_minutes is null or event_duration_minutes not between 15 and 1440 or event_kind is null or event_kind not in ('public_server','linebattle','competitive','training','social','campaign','other') then
    raise exception 'valid title, start, duration and event type required' using errcode = 'check_violation';
  end if;
  insert into event(title,body,game,starts_at,duration_minutes,created_by,event_type)
  values(trim(event_title),nullif(trim(event_body),''),nullif(trim(event_game),''),event_starts_at,event_duration_minutes,actor,event_kind) returning id into new_id;
  insert into personnel_audit(actor_id,action,entity,entity_id,detail)
  values(actor,'event.create','event',new_id::text,jsonb_build_object('discord_posted',false));
  return new_id;
end; $$;
revoke all on function post_managed_event(uuid) from public, anon;
revoke all on function create_website_event(text,text,text,timestamptz,int,text) from public, anon;
grant execute on function post_managed_event(uuid) to authenticated;
grant execute on function create_website_event(text,text,text,timestamptz,int,text) to authenticated;
-- An unposted event can be edited or removed without a doomed Discord action.
create or replace function skip_unposted_event_action() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.operation in ('edit','delete') and new.message_id is null
     and not exists(select 1 from discord_event_action where event_id=new.event_id and operation='create') then return null; end if;
  return new;
end; $$;
revoke all on function skip_unposted_event_action() from public,anon,authenticated;
drop trigger if exists skip_unposted_action on discord_event_action;
create trigger skip_unposted_action before insert on discord_event_action for each row execute function skip_unposted_event_action();

create table if not exists discord_schedule_request (
  id boolean primary key default true check(id), revision bigint not null default 0,
  processed_revision bigint not null default 0, message_ids jsonb not null default '[]',
  requested_at timestamptz, last_error text
);
insert into discord_schedule_request(id) values(true) on conflict do nothing;
alter table discord_schedule_request enable row level security;
revoke all on discord_schedule_request from public,anon,authenticated;
grant all on discord_schedule_request to service_role;
create or replace function request_event_schedule() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_member_id(); version bigint;
begin
  if actor is null or current_member_role() is null or current_member_role() not in ('admin','moderator') then raise exception 'staff role required' using errcode='insufficient_privilege'; end if;
  update discord_schedule_request set revision=revision+1,requested_at=now(),last_error=null where id returning revision into version;
  insert into personnel_audit(actor_id,action,entity,entity_id,detail) values(actor,'event.schedule','discord_schedule','staff-chat',jsonb_build_object('revision',version));
  return version;
end; $$;
revoke all on function request_event_schedule() from public,anon;
grant execute on function request_event_schedule() to authenticated;
commit;
