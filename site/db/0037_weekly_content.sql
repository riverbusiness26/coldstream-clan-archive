-- Weekly feature submissions. Members submit a link; staff moderate it.
create table if not exists weekly_content_submission (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references member(id),
  url text not null check (length(trim(url)) between 8 and 1000),
  provider text not null default 'link' check (provider in ('youtube','stream','link')),
  title text not null default 'Weekly submission' check (length(trim(title)) between 1 and 160),
  description text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  rejection_reason text,
  reviewed_by uuid references member(id),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  deployed_at timestamptz,
  featured_until timestamptz,
  archived_at timestamptz
);

create index if not exists weekly_content_status on weekly_content_submission(status, approved_at desc);

create or replace function weekly_feature_end(at_time timestamptz default now())
returns timestamptz language plpgsql stable as $$
declare
  local_time timestamp := timezone('America/Chicago', at_time);
  local_end timestamp;
begin
  local_end := date_trunc('week', local_time) + interval '6 days 23 hours 59 minutes 59 seconds';
  if local_end <= local_time then local_end := local_end + interval '7 days'; end if;
  return local_end at time zone 'America/Chicago';
end;
$$;

create or replace function set_weekly_feature_window()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved' or new.approved_at is null) then
    new.approved_at := coalesce(new.approved_at, now());
    new.featured_until := null;
    new.reviewed_at := coalesce(new.reviewed_at, now());
  elsif new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;
  return new;
end;
$$;

create or replace function deploy_weekly_content()
returns void language plpgsql security definer set search_path = public as $$
declare
  now_local timestamp := timezone('America/Chicago', now());
  monday_start timestamp := date_trunc('week', now_local);
  monday_utc timestamptz := monday_start at time zone 'America/Chicago';
begin
  update weekly_content_submission
     set status = 'archived', archived_at = coalesce(archived_at, now())
   where status = 'approved' and deployed_at is not null and featured_until is not null and featured_until <= now();
  update weekly_content_submission
     set deployed_at = monday_utc,
         featured_until = weekly_feature_end(now())
   where status = 'approved' and deployed_at is null and approved_at < monday_utc;
end;
$$;
revoke all on function deploy_weekly_content() from public;
grant execute on function deploy_weekly_content() to anon, authenticated;

create or replace function archive_expired_weekly_content()
returns void language sql security definer set search_path = public as $$
  update weekly_content_submission
     set status = 'archived', archived_at = now()
   where status = 'approved' and featured_until is not null and featured_until <= now();
$$;
revoke all on function archive_expired_weekly_content() from public;
grant execute on function archive_expired_weekly_content() to anon, authenticated;

drop trigger if exists weekly_feature_window on weekly_content_submission;
create trigger weekly_feature_window before insert or update on weekly_content_submission
for each row execute function set_weekly_feature_window();

alter table weekly_content_submission enable row level security;
drop policy if exists weekly_content_read on weekly_content_submission;
create policy weekly_content_read on weekly_content_submission for select using (
  status = 'approved' or submitter_id = current_member_id() or current_member_role() in ('moderator','admin')
);
drop policy if exists weekly_content_insert on weekly_content_submission;
create policy weekly_content_insert on weekly_content_submission for insert with check (submitter_id = current_member_id());
drop policy if exists weekly_content_staff_update on weekly_content_submission;
create policy weekly_content_staff_update on weekly_content_submission for update using (current_member_role() in ('moderator','admin'));
drop policy if exists weekly_content_staff_delete on weekly_content_submission;
create policy weekly_content_staff_delete on weekly_content_submission for delete using (current_member_role() in ('moderator','admin'));

grant select, insert on weekly_content_submission to authenticated;
grant update, delete on weekly_content_submission to authenticated;
