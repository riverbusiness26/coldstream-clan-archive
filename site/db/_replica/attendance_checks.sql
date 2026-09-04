-- What the attendance review has to be true for, run against the replica.
--
-- The point of each check is the case that would otherwise ship broken: a view
-- that hands the roll to anybody signed in, a sample count the browser
-- silently truncated, staff permissions that are checked in the interface and
-- nowhere else.

\set ON_ERROR_STOP on
\pset pager off

-- ------------------------------------------------------------------ people
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into member (id, auth_user_id, steam_id64, display_name, discord_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '7656119800000001', 'River', '900000000000000001', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '7656119800000002', 'Ordinary Member', '900000000000000002', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', '7656119800000003', 'Said Going', '900000000000000003', 'member')
on conflict do nothing;

insert into event (id, title, starts_at, duration_minutes, event_type, historic)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Thursday linebattle', now() - interval '2 hours', 90, 'linebattle', false)
on conflict do nothing;

-- One sampling run: 31 samples two minutes apart. River is in voice for all of
-- them, the ordinary member for the last ten, and a fourth Discord account
-- that has never signed in to the site turns up for five.
insert into event_presence_sample (event_id, discord_id, sampled_at)
select 'eeeeeeee-0000-0000-0000-000000000001', d.discord_id, now() - interval '3 hours' + (n * interval '2 minutes')
from generate_series(0, 30) as n
cross join lateral (values ('900000000000000001'), ('900000000000000002'), ('999999999999999999')) as d(discord_id)
where (d.discord_id = '900000000000000001')
   or (d.discord_id = '900000000000000002' and n >= 21)
   or (d.discord_id = '999999999999999999' and n >= 26);

-- Somebody who said they were coming and appears in no sample at all. This is
-- the row the whole feature exists to make visible.
insert into event_rsvp (event_id, member_id, status)
values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'going')
on conflict do nothing;

-- ------------------------------------------------------------------ checks
select 'views_exist' as check,
       count(*) = 2 as pass
from pg_views where viewname in ('event_presence_roll', 'event_presence_window');

select 'invoker_rights' as check,
       bool_and('security_invoker=true' = any(c.reloptions)) as pass
from pg_class c where c.relname in ('event_presence_roll', 'event_presence_window');

-- The roll must agree with the raw table it summarises, or the whole panel is
-- reporting a number nothing can reproduce.
select 'roll_matches_raw' as check,
       (select sum(samples) from event_presence_roll) = (select count(*) from event_presence_sample) as pass;

select 'roll_counts' as check,
       (select samples from event_presence_roll where discord_id = '900000000000000001') = 31
   and (select samples from event_presence_roll where discord_id = '900000000000000002') = 10
   and (select samples from event_presence_roll where discord_id = '999999999999999999') = 5 as pass;

-- The window is what the site divides by to turn samples into minutes.
select 'window_run' as check,
       samples_taken = 31 and people_seen = 3
   and extract(epoch from (last_sample - first_sample)) / (samples_taken - 1) = 120 as pass
from event_presence_window;

-- ------------------------------------------------- as a signed in ordinary member
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

select 'member_sees_no_roll' as check, count(*) = 0 as pass from event_presence_roll;
select 'member_sees_no_window' as check, count(*) = 0 as pass from event_presence_window;

do $$ begin
  begin
    perform mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'attended');
    raise exception 'FAIL: an ordinary member marked their own attendance';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'member_cannot_mark' as check, true as pass;
commit;

-- ------------------------------------------------------- as a signed in admin
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

select 'admin_sees_roll' as check, count(*) = 3 as pass from event_presence_roll;

select mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'attended');
select mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'attended');
-- The person who said going and was never in voice.
select mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'no_show');

select 'attendance_recorded' as check,
       count(*) filter (where attendance = 'attended') = 2
   and count(*) filter (where attendance = 'no_show') = 1 as pass
from event_rsvp where event_id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Marking somebody present must not silently rewrite what they said they were
-- doing. Intent and outcome are separate columns for exactly this reason.
select 'rsvp_intent_survives' as check,
       status = 'going' and attendance = 'no_show' as pass
from event_rsvp
where event_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and member_id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- Somebody who never RSVP'd and turned up anyway gets a row with no status.
select 'attended_without_rsvp' as check, status is null and attendance = 'attended' as pass
from event_rsvp
where event_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and member_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$ begin
  begin
    perform mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'present');
    raise exception 'FAIL: a made up attendance value was accepted';
  exception when check_violation then null;
  end;
end $$;
select 'bad_outcome_refused' as check, true as pass;

-- Clearing has to be able to undo either kind of mark. For somebody who never
-- RSVP'd the row exists only to hold the outcome, so it goes; for somebody who
-- did, their intent stays behind. 0027 could do neither: the constraint
-- refused an emptied row and the whole statement failed.
select mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', null);
select 'clear_removes_bare_row' as check, count(*) = 0 as pass
from event_rsvp
where event_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and member_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select mark_attendance('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', null);
select 'clear_keeps_the_rsvp' as check, status = 'going' and attendance is null and attendance_by is null as pass
from event_rsvp
where event_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and member_id = 'aaaaaaaa-0000-0000-0000-000000000003';

select 'every_mark_audited' as check, count(*) = 5 as pass
from personnel_audit where action = 'event.attendance';

select 'audit_names_the_event' as check,
       bool_and(entity = 'event' and entity_id = 'eeeeeeee-0000-0000-0000-000000000001') as pass
from personnel_audit where action = 'event.attendance';
commit;

-- ------------------------------------------------------------- as a stranger
-- Signed out. Two separate things have to be true, because 0004's default
-- privileges hand anon a select on anything created after it and would
-- otherwise leave row level security as the only barrier.
select 'anon_has_no_grant' as check,
       bool_and(not has_table_privilege('anon', t, 'SELECT')) as pass
from unnest(array['event_presence_sample', 'event_presence_roll', 'event_presence_window']) as t;

begin;
set local role anon;
do $$ begin
  begin
    perform count(*) from event_presence_roll;
    raise exception 'FAIL: anon could read the presence roll';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'anon_refused' as check, true as pass;
commit;

-- The profile page reads this as an ordinary signed in member, so it has to
-- work for one: confirmed attendance is public, the evidence behind it is not.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select 'profile_reads_own_attendance' as check, count(*) = 1 as pass
from event_rsvp where member_id = 'aaaaaaaa-0000-0000-0000-000000000002' and attendance = 'attended';
commit;
