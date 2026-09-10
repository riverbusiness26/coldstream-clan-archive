-- Staff member editor extensions and a hard cap for the compact audit log.
drop function if exists set_member_file(uuid, member_status, uuid, text, boolean);
create or replace function set_member_file(
  target_member uuid,
  new_status member_status default null,
  new_company uuid default null,
  new_notes text default null,
  clear_company boolean default false,
  new_display_name text default null,
  new_joined_year int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  before record;
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;

  select status, company_id, notes, display_name, joined_year
    into before from member where id = target_member;
  if not found then raise exception 'no such member' using errcode = 'no_data_found'; end if;
  if new_display_name is not null and length(trim(new_display_name)) = 0 then
    raise exception 'display name cannot be empty' using errcode = 'check_violation';
  end if;
  if new_joined_year is not null and (new_joined_year < 2011 or new_joined_year > extract(year from now())::int) then
    raise exception 'joined year is outside the supported range' using errcode = 'check_violation';
  end if;

  perform set_config('app.service_record_write', 'on', true);
  update member set
    display_name = coalesce(nullif(trim(new_display_name), ''), display_name),
    joined_year = coalesce(new_joined_year, joined_year),
    status = coalesce(new_status, status),
    company_id = case when clear_company then null else coalesce(new_company, company_id) end,
    notes = coalesce(new_notes, notes),
    enlisted_at = case when new_status = 'active' and enlisted_at is null then now() else enlisted_at end,
    discharged_at = case when new_status = 'discharged' then now() when new_status is not null and new_status <> 'discharged' then null else discharged_at end
  where id = target_member;
  perform set_config('app.service_record_write', 'off', true);

  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (actor, 'member.update', target_member, 'member', target_member::text, jsonb_build_object(
    'display_name_changed', new_display_name is not null and trim(new_display_name) is distinct from before.display_name,
    'joined_year_changed', new_joined_year is not null and new_joined_year is distinct from before.joined_year,
    'status_from', before.status, 'status_to', coalesce(new_status, before.status),
    'company_changed', (clear_company or new_company is not null),
    'notes_changed', (new_notes is not null and new_notes is distinct from before.notes)
  ));
end;
$$;

revoke all on function set_member_file(uuid, member_status, uuid, text, boolean, text, int) from public;
grant execute on function set_member_file(uuid, member_status, uuid, text, boolean, text, int) to authenticated;

create or replace function trim_personnel_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from personnel_audit
  where id in (
    select id from personnel_audit
    order by created_at desc, id desc
    offset 75
  );
  return new;
end;
$$;

drop trigger if exists personnel_audit_keep_latest on personnel_audit;
create trigger personnel_audit_keep_latest
after insert on personnel_audit
for each statement execute function trim_personnel_audit();

delete from personnel_audit
where id in (
  select id from personnel_audit
  order by created_at desc, id desc
  offset 75
);
