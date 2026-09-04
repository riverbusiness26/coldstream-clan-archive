-- The read side of attendance review. Run after 0027 and Codex's 0028.
--
-- 0027 gave the bot somewhere to write presence samples and gave staff a way
-- to confirm them. This is the missing third piece: a way to look at what the
-- bot recorded without pulling it all into a browser.
--
-- The raw table is one row per person per sample. A ninety minute linebattle
-- samples every two minutes across a window that opens fifteen minutes early
-- and closes thirty minutes late, so about sixty seven samples, and thirty
-- people in voice makes two thousand rows for one event. PostgREST caps a
-- select at a thousand by default, so the approval card would have been
-- reading a truncated list and calling it the roll. Grouping belongs in the
-- database anyway: the browser only ever wants one line per person.
--
-- Both views are security_invoker, so the staff only policy on
-- event_presence_sample still decides who sees anything. Without it a view
-- runs as its owner and hands the whole roll to anybody signed in, which is
-- the same trap as a table with good policies and a missing grant.

-- One line per person per event: how many samples they appear in, and the
-- first and last time the bot saw them.
create or replace view event_presence_roll
with (security_invoker = true) as
  select event_id,
         discord_id,
         count(*)::int as samples,
         min(sampled_at) as first_seen,
         max(sampled_at) as last_seen
  from event_presence_sample
  group by event_id, discord_id;

-- One line per event, describing the sampling run itself.
--
-- This exists so nobody has to hard code the bot's two minute cadence into
-- the site to turn a sample count into minutes. The interval is measured from
-- the run: the span between the first and last sample, divided by the gaps
-- between them. If the bot's cadence ever changes, or a restart leaves a hole
-- in the middle, the site reads what actually happened rather than what a
-- constant in another repository claims happened.
create or replace view event_presence_window
with (security_invoker = true) as
  select event_id,
         count(distinct sampled_at)::int as samples_taken,
         count(distinct discord_id)::int as people_seen,
         min(sampled_at) as first_sample,
         max(sampled_at) as last_sample
  from event_presence_sample
  group by event_id;

grant select on event_presence_roll to authenticated;
grant select on event_presence_window to authenticated;

-- ------------------------------------------------------------------ proof
--
-- Run these after applying. Every one should be true.
--
-- select count(*) = 2 as views_exist
--   from pg_views where viewname in ('event_presence_roll', 'event_presence_window');
--
-- Both views respect the base table's row level security rather than their
-- owner's rights. reloptions carries security_invoker=true when it is set.
-- select bool_and('security_invoker=true' = any(c.reloptions)) as invoker_rights
--   from pg_class c
--   where c.relname in ('event_presence_roll', 'event_presence_window');
--
-- A signed in member with no staff role sees nothing through either view.
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<an ordinary member auth id>"}';
-- select count(*) = 0 as ordinary_member_sees_nothing from event_presence_roll;

-- ------------------------------------------------ one fix to mark_attendance
--
-- Clearing an attendance mark failed for exactly the people this feature was
-- built to catch: somebody who never RSVP'd and turned up anyway.
--
-- mark_attendance writes into event_rsvp, and 0027 added a constraint saying a
-- row has to carry a status or an attendance. For a person who did RSVP that
-- holds: clearing the outcome leaves their intent behind. For a person the bot
-- saw who never replied, the row exists only to hold the outcome, so emptying
-- it leaves a row saying nothing and the constraint refuses the whole
-- statement. The admin sees a check violation and the mark stays put, which
-- reads as the button not working.
--
-- A row with nothing in it should not exist, so clearing removes it rather
-- than blanking it. Everything else about the function is unchanged: same
-- staff check, same values, same audit row, and clearing is still recorded,
-- because deciding somebody was not there after all is a decision.
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

  if outcome is null then
    update event_rsvp set attendance = null, attendance_by = null, attendance_at = null
      where event_id = target_event and member_id = target_member and status is not null;
    delete from event_rsvp
      where event_id = target_event and member_id = target_member and status is null;
  else
    insert into event_rsvp(event_id, member_id, status, attendance, attendance_by, attendance_at)
    values (target_event, target_member, null, outcome, actor, now())
    on conflict (event_id, member_id) do update set
      attendance = excluded.attendance,
      attendance_by = excluded.attendance_by,
      attendance_at = excluded.attendance_at;
  end if;

  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (actor, 'event.attendance', target_member, 'event', target_event::text,
          jsonb_build_object('event_id', target_event, 'attendance', outcome));
end;
$$;

revoke all on function mark_attendance(uuid, uuid, text) from public;
grant execute on function mark_attendance(uuid, uuid, text) to authenticated;

-- --------------------------------------------------- anon does not get these
--
-- 0004 ends with `alter default privileges in schema public grant select on
-- tables to anon, authenticated`, so every table and view created since then
-- is granted to anon the moment it exists, whatever the migration that created
-- it thought it was granting. 0027 granted event_presence_sample to
-- authenticated only and got anon anyway, and so did both views above.
--
-- Row level security still holds the line, so a signed out reader sees an
-- empty result rather than the roll. But then RLS is the only thing standing
-- between a public site and a list of who was in voice, and the grant says
-- something different from what the migration meant. Two barriers, both
-- saying the same thing, is the shape everything else in this database has.
revoke select on event_presence_sample from anon;
revoke select on event_presence_roll from anon;
revoke select on event_presence_window from anon;

-- Proof, after applying:
-- select bool_and(not has_table_privilege('anon', t, 'SELECT')) as anon_shut_out
--   from unnest(array['event_presence_sample', 'event_presence_roll', 'event_presence_window']) as t;
