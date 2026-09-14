begin;

-- The count is retained only for compatibility with previously deployed clients.
alter table public.event_series alter column occurrence_count drop not null;
alter table public.event_series add column if not exists stopped_at timestamptz;
alter table public.event_series add column if not exists next_position int not null default 1;
update public.event_series s set occurrence_count=null, request=request-'count',
  next_position=greatest(next_position,coalesce((select max(e.series_position)+1 from public.event e where e.series_id=s.id),1));

-- Only trusted background workers can extend the rolling calendar. Existing
-- dates, including individually edited or removed dates, are never overwritten.
create or replace function public.extend_event_series(target_series uuid, as_of timestamptz default now())
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare
  s public.event_series%rowtype; first_local timestamp; local_start timestamp;
  window_start timestamp; window_end timestamp; next_start timestamptz;
  position int; minimum_index int; added int:=0;
begin
  if as_of is null or not isfinite(as_of) then raise exception 'finite calendar date required'; end if;
  select * into s from public.event_series where id=target_series for update;
  if not found or s.stopped_at is not null then return 0; end if;
  first_local:=(s.request->>'start')::timestamptz at time zone 'America/Chicago';
  window_start:=as_of at time zone 'America/Chicago';
  window_end:=greatest(window_start,first_local)+interval '1 year';
  -- Catch up after downtime without inventing years of past attendance events.
  minimum_index:=case s.repeat_kind
    when 'daily' then window_start::date-first_local::date-1
    when 'weekly' then (window_start::date-first_local::date)/7-1
    else (extract(year from window_start)::int-extract(year from first_local)::int)*12
      +extract(month from window_start)::int-extract(month from first_local)::int-1 end;
  position:=greatest(s.next_position,minimum_index+1,1);
  loop
    local_start:=first_local+case s.repeat_kind
      when 'daily' then make_interval(days=>position-1)
      when 'weekly' then make_interval(days=>(position-1)*7)
      else make_interval(months=>position-1) end;
    exit when local_start>window_end;
    -- PostgreSQL uses standard time for ambiguous/missing Chicago clock times:
    -- spring 02:30 becomes 03:30 for that date; fall uses the second 01:30.
    next_start:=case when position=1 then (s.request->>'start')::timestamptz
      else local_start at time zone 'America/Chicago' end;
    if next_start>=as_of then
      insert into public.event(title,body,game,starts_at,duration_minutes,created_by,event_type,series_id,series_position)
      values(trim(s.request->>'title'),nullif(trim(s.request->>'body'),''),nullif(trim(s.request->>'game'),''),
        next_start,(s.request->>'duration')::int,s.created_by,s.request->>'kind',s.id,position)
      on conflict(series_id,series_position) where series_id is not null do nothing;
      if found then added:=added+1; end if;
    end if;
    position:=position+1;
  end loop;
  update public.event_series set next_position=position where id=s.id;
  if added>0 then
    insert into public.personnel_audit(actor_id,action,entity,entity_id,detail)
    values(s.created_by,'event.series.extend','event_series',s.id::text,
      jsonb_build_object('events_added',added,'calendar_through',window_end,'automatic',true));
  end if;
  return added;
end; $$;
revoke all on function public.extend_event_series(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.extend_event_series(uuid,timestamptz) to service_role;

create or replace function public.refresh_recurring_events()
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare series uuid; added int:=0;
begin
  for series in select id from public.event_series where stopped_at is null order by id loop
    added:=added+public.extend_event_series(series);
  end loop;
  return added;
end; $$;
revoke all on function public.refresh_recurring_events() from public,anon,authenticated;
grant execute on function public.refresh_recurring_events() to service_role;

create or replace function public.create_repeating_website_event(
  request_id uuid,repeat_kind text,event_title text,event_body text,event_game text,
  event_starts_at timestamptz,event_duration_minutes int,event_kind text
) returns uuid[] language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.current_member_id(); payload jsonb; previous public.event_series%rowtype; first_id uuid;
begin
  if actor is null or public.current_member_role() is null or public.current_member_role() not in ('admin','moderator') then
    raise exception 'staff role required' using errcode='insufficient_privilege';
  end if;
  if request_id is null or repeat_kind is null or repeat_kind not in ('daily','weekly','monthly')
    or event_starts_at is null or not isfinite(event_starts_at) then
    raise exception 'Choose daily, weekly or monthly and a valid start date.' using errcode='check_violation';
  end if;
  payload:=jsonb_build_object('title',event_title,'body',event_body,'game',event_game,'start',event_starts_at,
    'duration',event_duration_minutes,'kind',event_kind,'repeat',repeat_kind);
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into previous from public.event_series where id=request_id;
  if found then
    if previous.created_by<>actor or previous.request-'count'<>payload then
      raise exception 'This request was already used with different event details.' using errcode='check_violation';
    end if;
    return array(select id from public.event where series_id=request_id order by series_position);
  end if;
  -- Reuse the single-event validation and audit path before saving the template.
  first_id:=public.create_website_event(event_title,event_body,event_game,event_starts_at,event_duration_minutes,event_kind);
  insert into public.event_series(id,created_by,repeat_kind,request,next_position)
    values(request_id,actor,repeat_kind,payload,2);
  update public.event set series_id=request_id,series_position=1 where id=first_id;
  perform public.extend_event_series(request_id);
  return array(select id from public.event where series_id=request_id order by series_position);
end; $$;
revoke all on function public.create_repeating_website_event(uuid,text,text,text,text,timestamptz,int,text) from public,anon;
grant execute on function public.create_repeating_website_event(uuid,text,text,text,text,timestamptz,int,text) to authenticated;

-- Old cached clients also create indefinite schedules; count no longer controls an end.
create or replace function public.create_recurring_website_events(
  request_id uuid,repeat_kind text,occurrence_count int,event_title text,event_body text,event_game text,
  event_starts_at timestamptz,event_duration_minutes int,event_kind text
) returns uuid[] language sql security invoker set search_path=public,pg_temp as $$
  select public.create_repeating_website_event(request_id,repeat_kind,event_title,event_body,event_game,event_starts_at,event_duration_minutes,event_kind);
$$;

create or replace function public.stop_repeating_event(target_series uuid)
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.current_member_id(); s public.event_series%rowtype; future_event uuid; removed int:=0;
begin
  if actor is null or public.current_member_role() is null or public.current_member_role() not in ('admin','moderator') then
    raise exception 'staff role required' using errcode='insufficient_privilege';
  end if;
  select * into s from public.event_series where id=target_series for update;
  if not found then raise exception 'Repeating schedule not found'; end if;
  if s.stopped_at is not null then return 0; end if;
  update public.event_series set stopped_at=now() where id=s.id;
  for future_event in select id from public.event where series_id=s.id and starts_at>now()
    and not historic and deleted_at is null and not cancelled order by id loop
    perform public.manage_event(future_event,'delete');
    removed:=removed+1;
  end loop;
  insert into public.personnel_audit(actor_id,action,entity,entity_id,detail)
  values(actor,'event.series.stop','event_series',s.id::text,jsonb_build_object('future_events_removed',removed));
  return removed;
end; $$;
revoke all on function public.stop_repeating_event(uuid) from public,anon;
grant execute on function public.stop_repeating_event(uuid) to authenticated;

-- Production scheduler. The isolated SQL test substitutes only this extension block.
create extension if not exists pg_cron;
select cron.schedule('coldstream-recurring-events','17 8 * * *','select public.refresh_recurring_events();');
select public.refresh_recurring_events();
notify pgrst,'reload schema';
commit;
