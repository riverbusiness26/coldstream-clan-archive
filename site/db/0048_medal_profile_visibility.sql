-- Draft only. Apply after review; hiding an award does not remove its record.
begin;

alter table public.personnel_assignment
  add column if not exists display_on_profile boolean not null default true;

comment on column public.personnel_assignment.display_on_profile is
  'Profile display preference for an awarded medal. False does not revoke the award or make its record private.';

-- The existing assignment trigger writes one audit entry per real change.
-- Extend only its visibility-only case instead of adding a second audit row.
create or replace function public.record_personnel_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  row_json jsonb;
  before_json jsonb;
begin
  if tg_op = 'DELETE' then
    row_json := to_jsonb(old);
  else
    row_json := to_jsonb(new);
  end if;

  if tg_table_name = 'personnel_assignment' and tg_op = 'UPDATE' then
    before_json := to_jsonb(old);
    if row_json ->> 'item_kind' = 'medal'
       and before_json -> 'display_on_profile' is distinct from row_json -> 'display_on_profile'
       and before_json - 'display_on_profile' = row_json - 'display_on_profile' then
      insert into public.personnel_audit(actor_id, action, member_id, item_id, entity, entity_id, detail)
      values (
        public.current_member_id(),
        'personnel.medal_visibility',
        (row_json ->> 'member_id')::uuid,
        (row_json ->> 'item_id')::uuid,
        'personnel_assignment',
        row_json ->> 'id',
        jsonb_build_object(
          'record_id', row_json ->> 'id',
          'before', jsonb_build_object('display_on_profile', before_json -> 'display_on_profile'),
          'after', jsonb_build_object('display_on_profile', row_json -> 'display_on_profile')
        )
      );
      return new;
    end if;
  end if;

  -- Preserve 0026's catalogue-delete handling and all other audit actions.
  insert into public.personnel_audit(actor_id, action, member_id, item_id, detail)
  values (
    public.current_member_id(),
    tg_table_name || '_' || lower(tg_op),
    case when tg_table_name = 'personnel_assignment'
      then (row_json ->> 'member_id')::uuid else null end,
    case
      when tg_table_name = 'personnel_assignment' then (row_json ->> 'item_id')::uuid
      when tg_op = 'DELETE' then null
      else (row_json ->> 'id')::uuid
    end,
    jsonb_build_object('record_id', row_json ->> 'id')
  );
  return coalesce(new, old);
end;
$$;

-- Do not offer a successful save if its required audit or retention trigger is
-- absent. This check does not change either trigger or the existing 75-row cap.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.personnel_assignment'::regclass
      and tgname = 'personnel_assignment_audit'
      and tgfoid = 'public.record_personnel_audit()'::regprocedure
      and tgenabled in ('O', 'A')
  ) then
    raise exception 'personnel assignment audit trigger must be enabled before 0048';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.personnel_audit'::regclass
      and tgname = 'personnel_audit_keep_latest'
      and tgfoid = 'public.trim_personnel_audit()'::regprocedure
      and tgenabled in ('O', 'A')
  ) then
    raise exception 'personnel audit retention trigger must be enabled before 0048';
  end if;
end;
$$;

create or replace function public.set_personnel_medal_visibility(
  target_assignment uuid,
  visible_on_profile boolean
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.current_member_id();
  actor_role public.member_role := public.current_member_role();
  actor_status public.member_status;
  awarded public.personnel_assignment%rowtype;
begin
  if target_assignment is null or visible_on_profile is null then
    raise exception 'medal record and display preference are required'
      using errcode = 'null_value_not_allowed';
  end if;

  -- SQL NOT IN alone is not safe when a helper returns NULL for a guest.
  if auth.uid() is null or actor is null or actor_role is null then
    raise exception 'signed-in member required' using errcode = 'insufficient_privilege';
  end if;
  select m.status into actor_status
  from public.member m
  where m.id = actor and m.auth_user_id = auth.uid();
  if not found or actor_status is null or actor_status not in ('applicant', 'active', 'reserve') then
    raise exception 'current member access required' using errcode = 'insufficient_privilege';
  end if;

  select a.* into awarded
  from public.personnel_assignment a
  where a.id = target_assignment
  for update;
  if not found then
    raise exception 'active medal award not found' using errcode = 'no_data_found';
  end if;
  if awarded.member_id is distinct from actor and actor_role not in ('moderator', 'admin') then
    raise exception 'only the member or staff may change this preference'
      using errcode = 'insufficient_privilege';
  end if;
  if awarded.item_kind <> 'medal' or awarded.removed_at is not null or not exists (
    select 1 from public.personnel_item i where i.id = awarded.item_id and i.kind = 'medal'
  ) then
    raise exception 'active medal award not found' using errcode = 'no_data_found';
  end if;

  -- A retired catalogue item may still be an earned award. Only removal of the
  -- member's award ends display eligibility; the catalogue active flag does not.
  if awarded.display_on_profile = visible_on_profile then
    return awarded.display_on_profile;
  end if;
  update public.personnel_assignment
  set display_on_profile = visible_on_profile
  where id = target_assignment;
  -- The existing AFTER trigger writes the detailed audit in this transaction.
  return visible_on_profile;
end;
$$;

revoke all on function public.set_personnel_medal_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_personnel_medal_visibility(uuid, boolean) to authenticated;

commit;
