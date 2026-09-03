-- 0024: Discord identity and the personnel command board.
--
-- The catalogue comes before player profiles. Admins own the artwork library.
-- Admins and moderators assign existing items. The database enforces both
-- rules, because hiding a button is only a courtesy.

-- Discord-only members do not have a Steam id yet. Steam stays available as
-- a separate game identity for statistics and can be linked later.
alter table member alter column steam_id64 drop not null;
alter table member add column if not exists discord_username text;
alter table member add column if not exists discord_role_synced_at timestamptz;

create unique index if not exists member_discord_id_unique
  on member(discord_id) where discord_id is not null;

-- Extend the existing member guard. Discord identity is written by the sync
-- function, never by a browser editing its own member row.
create or replace function guard_member_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  from_browser boolean := auth.uid() is not null;
begin
  if from_browser and not is_operator() then
    if new.role is distinct from old.role then
      raise exception 'only the Discord role sync may change a role';
    end if;
    if new.steam_id64 is distinct from old.steam_id64 then
      raise exception 'steam id cannot be changed';
    end if;
    if new.discord_id is distinct from old.discord_id
       or new.discord_username is distinct from old.discord_username
       or new.discord_role_synced_at is distinct from old.discord_role_synced_at then
      raise exception 'Discord identity cannot be changed';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'account link cannot be changed';
    end if;
  end if;

  if old.role = 'admin' and new.role is distinct from old.role
     and (select count(*) from member where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin';
  end if;
  return new;
end;
$$;

create type personnel_item_kind as enum ('rank', 'medal');

create table personnel_item (
  id uuid primary key default gen_random_uuid(),
  kind personnel_item_kind not null,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  storage_key text unique not null,
  image_mime text not null check (image_mime in ('image/png', 'image/jpeg', 'image/webp')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid not null default current_member_id() references member(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personnel_item_kind_order on personnel_item(kind, active, sort_order, name);

create table personnel_assignment (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references member(id) on delete cascade,
  item_id uuid not null references personnel_item(id),
  item_kind personnel_item_kind not null,
  assigned_by uuid not null default current_member_id() references member(id),
  assigned_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 300),
  removed_by uuid references member(id),
  removed_at timestamptz
);

create unique index personnel_one_current_rank
  on personnel_assignment(member_id)
  where item_kind = 'rank' and removed_at is null;

create unique index personnel_one_current_medal
  on personnel_assignment(member_id, item_id)
  where item_kind = 'medal' and removed_at is null;

create index personnel_assignment_member on personnel_assignment(member_id, removed_at, assigned_at desc);
create index personnel_assignment_item on personnel_assignment(item_id, removed_at);

create table personnel_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references member(id),
  action text not null,
  member_id uuid references member(id) on delete set null,
  item_id uuid references personnel_item(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index personnel_audit_created on personnel_audit(created_at desc);

-- This is the deliberately closed foundation for the next profile feature.
-- No member insert policy or grant exists yet, so the future form cannot be
-- exposed accidentally. The eventual intake can accept event kills, public
-- server kills and screenshots without another table redesign.
create type evidence_submission_kind as enum (
  'event_kill',
  'public_server_kill',
  'screenshot_proof'
);

create type evidence_submission_status as enum (
  'draft',
  'submitted',
  'approved',
  'rejected'
);

create table evidence_submission (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references member(id) on delete cascade,
  subject_member_id uuid not null references member(id) on delete cascade,
  kind evidence_submission_kind not null,
  status evidence_submission_status not null default 'draft',
  event_name text,
  server_name text,
  game_name text,
  claimed_kills integer check (claimed_kills is null or claimed_kills >= 0),
  statement text check (statement is null or char_length(statement) <= 1000),
  proof_storage_key text,
  reviewed_by uuid references member(id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index evidence_submission_queue on evidence_submission(status, created_at);
create index evidence_submission_member on evidence_submission(subject_member_id, created_at desc);

alter table personnel_item enable row level security;
alter table personnel_assignment enable row level security;
alter table personnel_audit enable row level security;
alter table evidence_submission enable row level security;

create policy personnel_item_read on personnel_item for select using (true);
create policy personnel_item_create on personnel_item for insert
  with check (current_member_role() = 'admin');
create policy personnel_item_change on personnel_item for update
  using (current_member_role() = 'admin') with check (current_member_role() = 'admin');
create policy personnel_item_remove on personnel_item for delete
  using (current_member_role() = 'admin');

create policy personnel_assignment_read on personnel_assignment for select using (true);
create policy personnel_assignment_create on personnel_assignment for insert
  with check (current_member_role() in ('moderator', 'admin'));
create policy personnel_assignment_change on personnel_assignment for update
  using (current_member_role() in ('moderator', 'admin'))
  with check (current_member_role() in ('moderator', 'admin'));

create policy personnel_audit_staff_read on personnel_audit for select
  using (current_member_role() in ('moderator', 'admin'));

create policy evidence_submission_staff_read on evidence_submission for select
  using (
    submitter_id = current_member_id()
    or subject_member_id = current_member_id()
    or current_member_role() in ('moderator', 'admin')
  );

grant select on personnel_item, personnel_assignment to anon, authenticated;
grant insert, update, delete on personnel_item to authenticated;
grant insert, update on personnel_assignment to authenticated;
grant select on personnel_audit, evidence_submission to authenticated;
grant all on personnel_item, personnel_assignment, personnel_audit, evidence_submission to service_role;
grant usage, select on sequence personnel_audit_id_seq to authenticated, service_role;

-- Assignment goes through one function so replacing a rank is atomic. A
-- moderator cannot end up leaving somebody with two current ranks between
-- separate browser requests.
create or replace function assign_personnel_item(
  target_member uuid,
  target_item uuid,
  assignment_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  chosen_kind personnel_item_kind;
  assignment_id uuid;
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;

  select kind into chosen_kind from personnel_item
    where id = target_item and active = true;
  if chosen_kind is null then
    raise exception 'catalogue item is not available' using errcode = 'check_violation';
  end if;

  if chosen_kind = 'rank' then
    update personnel_assignment
       set removed_at = now(), removed_by = actor
     where member_id = target_member
       and item_kind = 'rank'
       and removed_at is null;
  end if;

  insert into personnel_assignment(member_id, item_id, item_kind, assigned_by, note)
  values (target_member, target_item, chosen_kind, actor, nullif(trim(assignment_note), ''))
  returning id into assignment_id;

  return assignment_id;
end;
$$;

create or replace function remove_personnel_assignment(target_assignment uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare actor uuid := current_member_id();
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;

  update personnel_assignment
     set removed_at = now(), removed_by = actor
   where id = target_assignment and removed_at is null;
  return found;
end;
$$;

revoke all on function assign_personnel_item(uuid, uuid, text) from public;
revoke all on function remove_personnel_assignment(uuid) from public;
grant execute on function assign_personnel_item(uuid, uuid, text) to authenticated;
grant execute on function remove_personnel_assignment(uuid) to authenticated;

create or replace function record_personnel_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into personnel_audit(actor_id, action, member_id, item_id, detail)
  values (
    current_member_id(),
    tg_table_name || '_' || lower(tg_op),
    case when tg_table_name = 'personnel_assignment' then coalesce(new.member_id, old.member_id) else null end,
    case when tg_table_name = 'personnel_assignment' then coalesce(new.item_id, old.item_id) else coalesce(new.id, old.id) end,
    jsonb_build_object('record_id', coalesce(new.id, old.id))
  );
  return coalesce(new, old);
end;
$$;

create trigger personnel_item_audit
after insert or update or delete on personnel_item
for each row execute function record_personnel_audit();

create trigger personnel_assignment_audit
after insert or update or delete on personnel_assignment
for each row execute function record_personnel_audit();

-- Artwork is public because player profiles will display it. Upload, replace
-- and delete remain admin-only at the storage layer as well as in the UI.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personnel-artwork',
  'personnel-artwork',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy personnel_artwork_admin_insert on storage.objects for insert
  with check (bucket_id = 'personnel-artwork' and current_member_role() = 'admin');
create policy personnel_artwork_admin_update on storage.objects for update
  using (bucket_id = 'personnel-artwork' and current_member_role() = 'admin')
  with check (bucket_id = 'personnel-artwork' and current_member_role() = 'admin');
create policy personnel_artwork_admin_delete on storage.objects for delete
  using (bucket_id = 'personnel-artwork' and current_member_role() = 'admin');

-- Expected: true, true, false. The last value proves moderators cannot upload.
select
  has_table_privilege('authenticated', 'personnel_assignment', 'INSERT') as staff_assignment_grant,
  has_table_privilege('authenticated', 'personnel_item', 'INSERT') as admin_catalogue_grant,
  has_table_privilege('anon', 'personnel_item', 'INSERT') as anonymous_catalogue_write;
