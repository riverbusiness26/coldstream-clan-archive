-- The events calendar. Run after 0009.
--
-- Two things this has to do that a generic calendar does not.
--
-- Times are stored in UTC and rendered in whoever is looking at it's own zone.
-- Every announcement in the archive reads "7PM Central / 8PM Eastern" and the
-- roster has members in Canada, the UK and Australia. The archive is full of
-- people asking what time an event actually was, and that stops here.
--
-- The past is seeded from the record. There are 627 dated events in the
-- announcement archive. A calendar that only shows an empty future is a dead
-- page on the day it ships; one you can scroll back through 2012 is the thing
-- this whole project exists for. Seeded rows carry their source and are marked
-- historic, so they can never be mistaken for something you can turn up to.

create table if not exists event (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  game text,
  starts_at timestamptz not null,
  duration_minutes int not null default 90,
  server_key text references server_status(server_key),
  created_by uuid references member(id),
  cancelled boolean not null default false,
  -- A historic event is a record of something that happened, pulled from the
  -- archive. Nobody can RSVP to it and nobody should try.
  historic boolean not null default false,
  source_detail text,
  created_at timestamptz not null default now()
);
create index if not exists event_when on event(starts_at desc);
create index if not exists event_upcoming on event(starts_at) where not historic;

create table if not exists event_rsvp (
  event_id uuid not null references event(id) on delete cascade,
  member_id uuid not null references member(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'out')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index if not exists event_rsvp_member on event_rsvp(member_id);

-- ---------------------------------------------------------------- policies
alter table event enable row level security;
alter table event_rsvp enable row level security;

drop policy if exists event_read on event;
create policy event_read on event for select using (true);

drop policy if exists event_write on event;
create policy event_write on event for all
  using (current_member_role() in ('officer','admin') or is_operator())
  with check (current_member_role() in ('officer','admin') or is_operator());

drop policy if exists rsvp_read on event_rsvp;
create policy rsvp_read on event_rsvp for select using (true);

-- You may only speak for yourself, and only about something still to happen.
drop policy if exists rsvp_write on event_rsvp;
create policy rsvp_write on event_rsvp for insert
  with check (
    member_id = current_member_id()
    and exists (select 1 from event e where e.id = event_id and not e.historic and not e.cancelled)
  );

drop policy if exists rsvp_change on event_rsvp;
create policy rsvp_change on event_rsvp for update
  using (member_id = current_member_id())
  with check (member_id = current_member_id());

drop policy if exists rsvp_withdraw on event_rsvp;
create policy rsvp_withdraw on event_rsvp for delete
  using (member_id = current_member_id());

-- ---------------------------------------------------------------- grants
grant select on event, event_rsvp to anon, authenticated;
grant insert, update, delete on event to authenticated;
grant insert, update, delete on event_rsvp to authenticated;

-- ---------------------------------------------------------------- counts
-- The board wants "nine going" without pulling every row down to the browser.
create or replace view event_attendance as
  select event_id,
         count(*) filter (where status = 'going') as going,
         count(*) filter (where status = 'maybe') as maybe
  from event_rsvp
  group by event_id;

grant select on event_attendance to anon, authenticated;
