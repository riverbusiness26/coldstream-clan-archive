-- Shoutbox: realtime delivery and trimming. Run after 0005.
--
-- 0001 said the shoutbox was "delivered over realtime; old rows trimmed by a
-- scheduled job", but neither existed. Without the table in the realtime
-- publication the browser subscribes to a channel that never fires, so a
-- shout only appears for the person who sent it until someone reloads.

-- Deliver inserts to subscribed browsers.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shout'
  ) then
    execute 'alter publication supabase_realtime add table public.shout';
  end if;
end
$$;

-- The payload needs the author id so the browser can put a name to the line.
alter table shout replica identity full;

-- The shoutbox is a chat room, not a record. Keep the last 200 lines and let
-- the rest go. Doing it on insert means there is no scheduled job to forget
-- about, and at this volume the cost is not worth measuring.
create or replace function trim_shouts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from shout
  where id in (
    select id from shout order by created_at desc offset 200
  );
  return null;
end;
$$;

drop trigger if exists shout_trim on shout;
create trigger shout_trim after insert on shout
  for each statement execute function trim_shouts();

create index if not exists shout_recent on shout(created_at desc);
