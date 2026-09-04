-- 0027: the Orderly Room schema.
--
-- Read docs/ORDERLY_ROOM_SPEC.md for what this is for and
-- docs/ORDERLY_ROOM_PLAN.md for why it lands here rather than in a new repo.
-- This migration is schema only. No application code depends on it yet, and
-- nothing existing changes behaviour because of it.
--
-- Two decisions from 3 Sep 2026 are built into this file. Both were River's.
--
-- 1. BAND AND ROLE ARE DIFFERENT QUESTIONS, and both stay.
--
--    `member.role` is admin, moderator or member. It answers "may this person
--    open the Command Board and change things", it is set from Discord roles
--    by discord-member-sync, and every RLS policy in this database is built on
--    current_member_role(). It is not touched here.
--
--    `band` is command, officer, enlisted or recruit. It answers "what is this
--    person in the regiment". A Captain is officer band whether or not anyone
--    ever gives them the site panel.
--
--    Collapsing the two would mean promoting somebody to Captain silently
--    handed them admin access, and rewriting every policy in the database.
--    The spec's §4.2 permission table is about role. Its §4.1 ladder is about
--    band. They read as one thing and are not.
--
-- 2. RANKS STAY IN THE SHARED CATALOGUE. The spec models Rank and Award as
--    separate tables. Here they are one `personnel_item` table with a `kind`,
--    one assignment table, one audit trail, and a live unique index enforcing
--    one current rank per member. Splitting them would mean rebuilding all of
--    that to gain tidiness on paper. The rank-only columns below are null for
--    medals and a constraint keeps them that way.

-- ------------------------------------------------------------------ types

do $$ begin
  create type member_status as enum ('applicant', 'active', 'reserve', 'discharged', 'banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('pending', 'accepted', 'denied', 'withdrawn');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- companies

create table if not exists company (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  tag text check (tag is null or char_length(tag) <= 12),
  discord_role_id text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists company_order on company(sort_order, name);

alter table company enable row level security;

drop policy if exists company_read on company;
create policy company_read on company for select using (true);

-- Command only, per §4.2. Structure is not something a moderator edits.
drop policy if exists company_write on company;
create policy company_write on company for all
  using (current_member_role() = 'admin') with check (current_member_role() = 'admin');

grant select on company to anon, authenticated;
grant insert, update, delete on company to authenticated;

-- ----------------------------------------------------------- rank ladder

alter table personnel_item add column if not exists seniority integer;
alter table personnel_item add column if not exists band text;
alter table personnel_item add column if not exists discord_role_id text;
alter table personnel_item add column if not exists is_default_recruit boolean not null default false;

-- The ladder columns belong to ranks. A medal with a seniority is a mistake
-- somebody will otherwise make once and then debug for an hour.
alter table personnel_item drop constraint if exists personnel_item_ladder_is_rank_only;
alter table personnel_item add constraint personnel_item_ladder_is_rank_only check (
  kind = 'rank'
  or (seniority is null and band is null and discord_role_id is null and is_default_recruit = false)
);

-- The spec lists four bands and folds NCOs into `officer`. The regiment's own
-- rank sheet does not: it draws a line between Junior grades and
-- Non-Commissioned Officers, and a Colour Sergeant is not a Lieutenant. Band
-- is structure only and drives no permissions, so a fifth value costs nothing
-- and keeps `officer` free for the commissioned ranks.
alter table personnel_item drop constraint if exists personnel_item_band_known;
alter table personnel_item add constraint personnel_item_band_known check (
  band is null or band in ('command', 'officer', 'nco', 'enlisted', 'recruit')
);

-- Exactly one rank can be the one a new recruit lands on. §8.4 accept reads
-- this, and two of them would make that step ambiguous at the worst moment.
create unique index if not exists personnel_item_one_default_recruit
  on personnel_item((is_default_recruit)) where is_default_recruit;

create index if not exists personnel_item_ladder on personnel_item(band, seniority desc) where kind = 'rank';

-- --------------------------------------------------------- member file

alter table member add column if not exists status member_status not null default 'active';
alter table member add column if not exists company_id uuid references company(id) on delete set null;
alter table member add column if not exists notes text;
alter table member add column if not exists enlisted_at timestamptz;
alter table member add column if not exists discharged_at timestamptz;

create index if not exists member_company on member(company_id) where company_id is not null;
create index if not exists member_status_idx on member(status);

-- The guard gains the new columns. Without this a member could edit their own
-- row and set their own status to active, write their own service notes, or
-- post themselves to another company. The existing member_update_self policy
-- lets them update their row at all, so the guard is the only thing standing
-- between them and their own file. Staff change these through
-- set_member_file() below, which runs as definer and checks the role itself.
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
    -- The service record. set_member_file() sets this flag for the length of
    -- its own transaction, so staff edits made through the sanctioned path get
    -- through and direct writes do not. Checking the caller's role instead
    -- would have let staff quietly edit their own file with no audit row,
    -- which is the one case an audit log exists for.
    if current_setting('app.service_record_write', true) is distinct from 'on'
       and (new.status is distinct from old.status
         or new.company_id is distinct from old.company_id
         or new.notes is distinct from old.notes
         or new.enlisted_at is distinct from old.enlisted_at
         or new.discharged_at is distinct from old.discharged_at) then
      raise exception 'service record is changed through set_member_file, not by hand';
    end if;
  end if;

  if old.role = 'admin' and new.role is distinct from old.role
     and (select count(*) from member where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin';
  end if;
  return new;
end;
$$;

-- One way in for staff, so the member table's own policies stay narrow. Pass
-- null for anything you are not changing. Passing a value that equals what is
-- already there is not an edit and is not audited.
create or replace function set_member_file(
  target_member uuid,
  new_status member_status default null,
  new_company uuid default null,
  new_notes text default null,
  clear_company boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := current_member_id();
  before record;
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;

  select status, company_id, notes into before from member where id = target_member;
  if not found then
    raise exception 'no such member' using errcode = 'no_data_found';
  end if;

  perform set_config('app.service_record_write', 'on', true);

  update member set
    status = coalesce(new_status, status),
    company_id = case when clear_company then null else coalesce(new_company, company_id) end,
    notes = coalesce(new_notes, notes),
    -- Enlistment and discharge dates follow the status rather than being set
    -- by hand, so they cannot drift out of step with it.
    enlisted_at = case
      when new_status = 'active' and enlisted_at is null then now()
      else enlisted_at end,
    discharged_at = case
      when new_status = 'discharged' then now()
      when new_status is not null and new_status <> 'discharged' then null
      else discharged_at end
  where id = target_member;

  perform set_config('app.service_record_write', 'off', true);

  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (actor, 'member.update', target_member, 'member', target_member::text, jsonb_build_object(
    'status_from', before.status, 'status_to', coalesce(new_status, before.status),
    'company_changed', (clear_company or new_company is not null),
    'notes_changed', (new_notes is not null and new_notes is distinct from before.notes)
  ));
end;
$$;

revoke all on function set_member_file(uuid, member_status, uuid, text, boolean) from public;
grant execute on function set_member_file(uuid, member_status, uuid, text, boolean) to authenticated;

-- ------------------------------------------------------------- events

alter table event add column if not exists event_type text not null default 'other';
alter table event add column if not exists channel_id text;
alter table event add column if not exists message_id text;

alter table event drop constraint if exists event_type_known;
alter table event add constraint event_type_known check (
  event_type in ('linebattle', 'training', 'social', 'campaign', 'other')
);

-- ---------------------------------------------------------- attendance
--
-- The spec folds attendance into the RSVP status enum: in, out, maybe,
-- attended, no_show. That is one column answering two questions, and it loses
-- the interesting one. "Said they were coming and did not turn up" is the fact
-- worth having, and a single column cannot hold both halves of it.
--
-- So intent stays in `status` and outcome goes in `attendance`, which is null
-- until somebody confirms it. A row can now exist with no status at all, for
-- the person who never RSVP'd and turned up anyway, which happens constantly.

alter table event_rsvp alter column status drop not null;

alter table event_rsvp add column if not exists attendance text;
alter table event_rsvp add column if not exists attendance_by uuid references member(id);
alter table event_rsvp add column if not exists attendance_at timestamptz;

alter table event_rsvp drop constraint if exists event_rsvp_attendance_known;
alter table event_rsvp add constraint event_rsvp_attendance_known check (
  attendance is null or attendance in ('attended', 'no_show')
);

alter table event_rsvp drop constraint if exists event_rsvp_says_something;
alter table event_rsvp add constraint event_rsvp_says_something check (
  status is not null or attendance is not null
);

create index if not exists event_rsvp_attended
  on event_rsvp(member_id) where attendance = 'attended';

-- What the bot writes while an event is running. Sampling who is in the voice
-- channel every few minutes is the evidence; a human still confirms it. The
-- discord id rather than member_id, because somebody can be in the channel
-- before they have ever signed in to the site.
create table if not exists event_presence_sample (
  id bigint generated always as identity primary key,
  event_id uuid not null references event(id) on delete cascade,
  discord_id text not null,
  sampled_at timestamptz not null default now()
);

create index if not exists presence_by_event on event_presence_sample(event_id, discord_id);

alter table event_presence_sample enable row level security;

drop policy if exists presence_staff_read on event_presence_sample;
create policy presence_staff_read on event_presence_sample for select
  using (current_member_role() in ('moderator', 'admin'));

grant select on event_presence_sample to authenticated;
grant all on event_presence_sample to service_role;

-- Attendance goes through a function rather than a policy, because widening
-- the update policy on event_rsvp to let staff set attendance would also let
-- them rewrite anybody's RSVP. Policies are OR'd, so there is no way to say
-- "staff, but only these columns" in a policy alone.
create or replace function mark_attendance(
  target_event uuid,
  target_member uuid,
  outcome text
) returns void
language plpgsql security definer set search_path = public as $$
declare actor uuid := current_member_id();
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;
  if outcome is not null and outcome not in ('attended', 'no_show') then
    raise exception 'attendance must be attended, no_show, or null' using errcode = 'check_violation';
  end if;

  insert into event_rsvp(event_id, member_id, status, attendance, attendance_by, attendance_at)
  values (target_event, target_member, null, outcome, actor, case when outcome is null then null else now() end)
  on conflict (event_id, member_id) do update set
    attendance = excluded.attendance,
    attendance_by = excluded.attendance_by,
    attendance_at = excluded.attendance_at;

  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (actor, 'event.attendance', target_member, 'event', target_event::text,
          jsonb_build_object('event_id', target_event, 'attendance', outcome));
end;
$$;

revoke all on function mark_attendance(uuid, uuid, text) from public;
grant execute on function mark_attendance(uuid, uuid, text) to authenticated;

-- The existing event_attendance view counts intent only. Confirmed turnout is
-- the number anybody actually wants, so it goes in the same place.
create or replace view event_attendance
with (security_invoker = true) as
  select event_id,
         count(*) filter (where status = 'going') as going,
         count(*) filter (where status = 'maybe') as maybe,
         count(*) filter (where attendance = 'attended') as attended,
         count(*) filter (where attendance = 'no_show') as no_show
  from event_rsvp
  group by event_id;

grant select on event_attendance to anon, authenticated;

-- -------------------------------------------------------- applications
--
-- `enlistment` already exists and holds real posts, so it grows rather than
-- being replaced. Old rows keep their free text body and arrive as pending.

alter table enlistment add column if not exists answers jsonb not null default '{}'::jsonb;
alter table enlistment add column if not exists status application_status not null default 'pending';
alter table enlistment add column if not exists reviewed_by uuid references member(id);
alter table enlistment add column if not exists review_note text;
alter table enlistment add column if not exists reviewed_at timestamptz;

create index if not exists enlistment_queue on enlistment(status, created_at desc);

-- Applications are not public reading. §12 is explicit that answers live in
-- the database and are shown in the dashboard, not broadcast.
drop policy if exists enlist_read on enlistment;
drop policy if exists enlist_staff_read on enlistment;
create policy enlist_staff_read on enlistment for select
  using (member_id = current_member_id() or current_member_role() in ('moderator', 'admin'));

drop policy if exists enlist_review on enlistment;
create policy enlist_review on enlistment for update
  using (current_member_role() in ('moderator', 'admin'))
  with check (current_member_role() in ('moderator', 'admin'));

grant update on enlistment to authenticated;

-- ----------------------------------------------------------- settings

create table if not exists setting (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references member(id)
);

alter table setting enable row level security;

drop policy if exists setting_read on setting;
create policy setting_read on setting for select
  using (current_member_role() in ('moderator', 'admin'));

drop policy if exists setting_write on setting;
create policy setting_write on setting for all
  using (current_member_role() = 'admin') with check (current_member_role() = 'admin');

grant select on setting to authenticated;
grant insert, update, delete on setting to authenticated;

-- ---------------------------------------------------------- audit log
--
-- personnel_audit is the audit log now, not just the catalogue's. The name
-- stays: 0000_role_rename is the standing reminder that renaming something
-- every policy and every query already says costs more than it looks like it
-- will. `audit_event` below is the spec's name for the same rows.

alter table personnel_audit add column if not exists entity text;
alter table personnel_audit add column if not exists entity_id text;

create index if not exists personnel_audit_entity on personnel_audit(entity, created_at desc);

update personnel_audit set entity = split_part(action, '_', 1) where entity is null;

create or replace view audit_event
with (security_invoker = true) as
  select id, actor_id, action, member_id, item_id, entity, entity_id, detail, created_at
  from personnel_audit;

grant select on audit_event to authenticated;

-- Anything that is not a table trigger writes through here, so no caller has
-- to remember the column list or be trusted with the table.
create or replace function record_audit(
  audit_action text,
  audit_entity text default null,
  audit_entity_id text default null,
  audit_member uuid default null,
  audit_detail jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_member_id() is null then
    raise exception 'sign in required' using errcode = 'insufficient_privilege';
  end if;
  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (current_member_id(), audit_action, audit_member, audit_entity, audit_entity_id, audit_detail);
end;
$$;

revoke all on function record_audit(text, text, text, uuid, jsonb) from public;
grant execute on function record_audit(text, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- seed
--
-- A rank in the ladder is allowed to have no artwork yet. That is the normal
-- state for a ladder seeded before anybody has drawn the insignia, and the
-- catalogue already renders the placeholder mark when storage_key is empty.
-- The alternative was inventing storage keys pointing at files that are not
-- there, which produces a broken image instead of an honest empty frame.
alter table personnel_item alter column storage_key drop not null;
alter table personnel_item alter column image_mime drop not null;

-- A catalogue row created by a migration has no member who made it. Rather
-- than attribute the seeded ladder to whoever happens to be the oldest admin
-- and call that true, created_by becomes optional. It failed loudly on a clean
-- replay of every migration, which is exactly what that replay is for.
alter table personnel_item alter column created_by drop not null;

alter table personnel_item drop constraint if exists personnel_item_artwork_whole;
alter table personnel_item add constraint personnel_item_artwork_whole check (
  (storage_key is null and image_mime is null) or (storage_key is not null and image_mime is not null)
);

-- The Line Infantry ladder, from the regiment's own rank sheet. Seniority is
-- spaced in fives with room left above 70 for the commissioned ranks, which
-- are on a sheet I have not been given yet.
--
-- Ranks are matched by name, so this both inserts the ones that are missing
-- and fills in band and seniority on any that already exist. That is how the
-- Volunteer rank River uploaded keeps its artwork and still joins the ladder.

-- One DO block, because a temporary table does not survive between statements
-- when the script is run a statement at a time, which is how psql and some
-- editors send it. Inside the block it is a single transaction and the list
-- only has to be written once.
do $$
begin
  create temporary table ladder(name text, band text, seniority int, is_recruit boolean) on commit drop;
  insert into ladder values
    ('Volunteer',       'recruit',  10, true),
    ('Cadet',           'enlisted', 15, false),
    ('Private',         'enlisted', 20, false),
    ('Regular',         'enlisted', 25, false),
    ('Lance Corporal',  'enlisted', 30, false),
    ('Fusilier',        'enlisted', 35, false),
    ('Guard',           'enlisted', 40, false),
    ('Royal Guard',     'enlisted', 45, false),
    ('Corporal',        'nco',      50, false),
    ('Sergeant',        'nco',      55, false),
    ('Colour Sergeant', 'nco',      60, false),
    ('Sergeant Major',  'nco',      65, false);

  -- Clear the recruit flag first: the unique index allows only one, and
  -- setting the new one before releasing the old would collide.
  update personnel_item set is_default_recruit = false
   where kind = 'rank' and is_default_recruit;

  update personnel_item p set
    band = l.band,
    seniority = l.seniority,
    is_default_recruit = l.is_recruit,
    sort_order = l.seniority,
    updated_at = now()
  from ladder l
  where p.kind = 'rank' and lower(p.name) = lower(l.name);

  insert into personnel_item (kind, name, band, seniority, is_default_recruit, sort_order)
  select 'rank'::personnel_item_kind, l.name, l.band, l.seniority, l.is_recruit, l.seniority
  from ladder l
  where not exists (
    select 1 from personnel_item p where p.kind = 'rank' and lower(p.name) = lower(l.name)
  );

  -- Tidy up if an earlier version of this migration seeded a different ladder.
  -- Only placeholder rows go: anything with artwork, or held by a member, or
  -- named on the sheet above, is left exactly where it is.
  delete from personnel_item p
   where p.kind = 'rank'
     and p.storage_key is null
     and not exists (select 1 from ladder l where lower(l.name) = lower(p.name))
     and not exists (select 1 from personnel_assignment a where a.item_id = p.id);

  drop table ladder;
end $$;

-- One company to start, named for the regiment. Officers add more.
insert into company (name, tag, sort_order)
select '2nd Coldstream Guards', '2ndCS', 0
where not exists (select 1 from company);

-- --------------------------------------------------------------- proof
--
-- Run this after the migration. Every line should read true.

select
  (select count(*) from personnel_item where kind = 'rank' and band is not null) >= 12
    as ladder_seeded,
  (select count(*) from personnel_item where is_default_recruit) = 1
    as exactly_one_recruit_rank,
  (select count(*) from company) >= 1
    as company_seeded,
  has_table_privilege('authenticated', 'company', 'INSERT')
    as company_grant,
  has_function_privilege('authenticated', 'mark_attendance(uuid, uuid, text)', 'EXECUTE')
    as attendance_callable,
  has_function_privilege('anon', 'mark_attendance(uuid, uuid, text)', 'EXECUTE') = false
    as attendance_not_public,
  (select count(*) from personnel_item where kind = 'medal' and seniority is not null) = 0
    as no_ladder_columns_on_medals,
  (select name from personnel_item where is_default_recruit) = 'Volunteer'
    as volunteer_is_the_recruit_rank,
  (select count(*) from personnel_item where kind = 'rank' and band = 'nco') = 4
    as four_ncos;
