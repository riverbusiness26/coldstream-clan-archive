begin;

create table if not exists public.event_series (
  id uuid primary key,
  created_by uuid not null references public.member(id),
  repeat_kind text not null check (repeat_kind in ('daily','weekly','monthly')),
  occurrence_count int not null check (occurrence_count between 2 and 104),
  request jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.event_series enable row level security;
revoke all on public.event_series from public, anon, authenticated;
grant select on public.event_series to authenticated;
grant all on public.event_series to service_role;
create policy event_series_staff_read on public.event_series for select to authenticated
  using (public.current_member_role() in ('admin','moderator'));
alter table public.event add column if not exists series_id uuid references public.event_series(id);
alter table public.event add column if not exists series_position int;
create unique index if not exists event_series_position_unique on public.event(series_id,series_position) where series_id is not null;

create or replace function public.create_recurring_website_events(
  request_id uuid, repeat_kind text, occurrence_count int,
  event_title text, event_body text, event_game text,
  event_starts_at timestamptz, event_duration_minutes int, event_kind text
) returns uuid[] language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.current_member_id();
  payload jsonb; previous public.event_series%rowtype;
  first_local timestamp; local_start timestamp; occurrence_start timestamptz;
  new_id uuid; ids uuid[] := '{}'; i int;
begin
  if actor is null or public.current_member_role() is null or public.current_member_role() not in ('admin','moderator') then
    raise exception 'staff role required' using errcode='insufficient_privilege';
  end if;
  if request_id is null or repeat_kind is null or repeat_kind not in ('daily','weekly','monthly')
    or occurrence_count is null or occurrence_count not between 2 and 104 or event_starts_at is null then
    raise exception 'Choose daily, weekly or monthly and between 2 and 104 occurrences.' using errcode='check_violation';
  end if;
  payload := jsonb_build_object('title',event_title,'body',event_body,'game',event_game,'start',event_starts_at,
    'duration',event_duration_minutes,'kind',event_kind,'repeat',repeat_kind,'count',occurrence_count);
  -- Serialize a retry of the same request without blocking other staff series.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into previous from public.event_series where id=request_id;
  if found then
    if previous.created_by <> actor or previous.request <> payload then
      raise exception 'This request was already used with different event details.' using errcode='check_violation';
    end if;
    return array(select id from public.event where series_id=request_id order by series_position);
  end if;
  insert into public.event_series(id,created_by,repeat_kind,occurrence_count,request)
    values(request_id,actor,repeat_kind,occurrence_count,payload);
  first_local := event_starts_at at time zone 'America/Chicago';
  for i in 0..occurrence_count-1 loop
    -- Anchor monthly arithmetic to the original day so February cannot shift March.
    local_start := first_local + case repeat_kind when 'daily' then make_interval(days=>i)
      when 'weekly' then make_interval(days=>i*7) else make_interval(months=>i) end;
    occurrence_start := case when i=0 then event_starts_at else local_start at time zone 'America/Chicago' end;
    if occurrence_start at time zone 'America/Chicago' <> local_start then
      raise exception 'A recurring Chicago time does not exist because clocks move forward. Choose a different start time.' using errcode='check_violation';
    end if;
    new_id := public.create_website_event(event_title,event_body,event_game,occurrence_start,event_duration_minutes,event_kind);
    update public.event set series_id=request_id,series_position=i+1 where id=new_id;
    ids := array_append(ids,new_id);
  end loop;
  return ids;
end; $$;
revoke all on function public.create_recurring_website_events(uuid,text,int,text,text,text,timestamptz,int,text) from public, anon;
grant execute on function public.create_recurring_website_events(uuid,text,int,text,text,text,timestamptz,int,text) to authenticated;
notify pgrst, 'reload schema';
commit;
