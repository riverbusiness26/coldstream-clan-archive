-- Let staff correct service dates explicitly from the member editor.
-- The older seven-argument function remains replaced by this named-argument
-- version so existing callers can still omit the new fields.
drop function if exists set_member_file(uuid, member_status, uuid, text, boolean, text, int);

create or replace function set_member_file(
  target_member uuid,
  new_status member_status default null,
  new_company uuid default null,
  new_notes text default null,
  clear_company boolean default false,
  new_display_name text default null,
  new_joined_year int default null,
  new_enlisted_at timestamptz default null,
  new_discharged_at timestamptz default null,
  clear_notes boolean default false,
  clear_enlisted_at boolean default false,
  clear_discharged_at boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  before record;
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;

  select status, company_id, notes, display_name, joined_year, enlisted_at, discharged_at
    into before from member where id = target_member;
  if not found then raise exception 'no such member' using errcode = 'no_data_found'; end if;
  if new_display_name is not null and length(trim(new_display_name)) = 0 then
    raise exception 'display name cannot be empty' using errcode = 'check_violation';
  end if;
  if new_joined_year is not null and (new_joined_year < 2011 or new_joined_year > extract(year from now())::int) then
    raise exception 'joined year is outside the supported range' using errcode = 'check_violation';
  end if;
  if new_discharged_at is not null and new_enlisted_at is not null and new_discharged_at < new_enlisted_at then
    raise exception 'discharge date cannot be before enlistment date' using errcode = 'check_violation';
  end if;

  perform set_config('app.service_record_write', 'on', true);
  update member set
    display_name = coalesce(nullif(trim(new_display_name), ''), display_name),
    joined_year = coalesce(new_joined_year, joined_year),
    status = coalesce(new_status, status),
    company_id = case when clear_company then null else coalesce(new_company, company_id) end,
    notes = case when clear_notes then null else coalesce(new_notes, notes) end,
    enlisted_at = case
      when clear_enlisted_at then null
      when new_enlisted_at is not null then new_enlisted_at
      when new_status = 'active' and enlisted_at is null then now()
      else enlisted_at end,
    discharged_at = case
      when clear_discharged_at then null
      when new_discharged_at is not null then new_discharged_at
      when new_status = 'discharged' then coalesce(discharged_at, now())
      when new_status is not null and new_status <> 'discharged' then null
      else discharged_at end
  where id = target_member;
  perform set_config('app.service_record_write', 'off', true);

  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (actor, 'member.update', target_member, 'member', target_member::text, jsonb_build_object(
    'display_name_changed', new_display_name is not null and trim(new_display_name) is distinct from before.display_name,
    'joined_year_changed', new_joined_year is not null and new_joined_year is distinct from before.joined_year,
    'status_from', before.status, 'status_to', coalesce(new_status, before.status),
    'company_changed', (clear_company or new_company is not null),
    'notes_changed', (clear_notes or (new_notes is not null and new_notes is distinct from before.notes)),
    'enlisted_at_from', before.enlisted_at, 'enlisted_at_to', case when clear_enlisted_at then null else coalesce(new_enlisted_at, before.enlisted_at) end,
    'discharged_at_from', before.discharged_at, 'discharged_at_to', case when clear_discharged_at then null else coalesce(new_discharged_at, before.discharged_at) end
  ));
end;
$$;

revoke all on function set_member_file(uuid, member_status, uuid, text, boolean, text, int, timestamptz, timestamptz, boolean, boolean, boolean) from public;
grant execute on function set_member_file(uuid, member_status, uuid, text, boolean, text, int, timestamptz, timestamptz, boolean, boolean, boolean) to authenticated;
