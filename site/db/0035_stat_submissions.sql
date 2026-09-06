-- 0035: Discord stat submissions, round proof, and qualified attendance.
-- The bot writes with service_role; staff review happens in the Admin panel.
create table if not exists stat_submission (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references member(id) on delete cascade,
  event_id uuid references event(id) on delete set null,
  category text not null check (category in ('competitive','public_linebattle','public_server')),
  event_name text,
  status text not null default 'submitted' check (status in ('draft','submitted','approved','rejected')),
  reviewed_by uuid references member(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists stat_round (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references stat_submission(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 30),
  kills integer not null check (kills >= 0),
  deaths integer not null check (deaths >= 0),
  is_mvp boolean not null default false,
  is_top5 boolean not null default false,
  created_at timestamptz not null default now(),
  unique (submission_id, round_number)
);
create table if not exists stat_proof (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references stat_round(id) on delete cascade,
  storage_key text not null,
  content_type text not null check (content_type like 'image/%'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists stat_submission_queue on stat_submission(status, created_at);
create index if not exists stat_round_submission on stat_round(submission_id, round_number);
alter table stat_submission enable row level security;
alter table stat_round enable row level security;
alter table stat_proof enable row level security;
drop policy if exists stat_submission_read on stat_submission;
create policy stat_submission_read on stat_submission for select using (submitter_id = current_member_id() or current_member_role() in ('moderator','admin'));
drop policy if exists stat_round_read on stat_round;
create policy stat_round_read on stat_round for select using (exists (select 1 from stat_submission s where s.id = submission_id and (s.submitter_id = current_member_id() or current_member_role() in ('moderator','admin'))));
drop policy if exists stat_proof_staff_read on stat_proof;
create policy stat_proof_staff_read on stat_proof for select using (current_member_role() in ('moderator','admin'));
grant select on stat_submission, stat_round, stat_proof to authenticated;
grant all on stat_submission, stat_round, stat_proof to service_role;

create or replace view stat_leaderboard as
select s.category, s.submitter_id as member_id,
  coalesce(sum(r.kills),0)::integer as kills,
  coalesce(sum(r.deaths),0)::integer as deaths,
  coalesce(sum(r.is_mvp::integer),0)::integer as mvps,
  coalesce(sum(r.is_top5::integer),0)::integer as top5,
  case when sum(r.deaths)=0 then sum(r.kills)::numeric else round(sum(r.kills)::numeric / nullif(sum(r.deaths),0),2) end as kdr
from stat_submission s join stat_round r on r.submission_id=s.id
where s.status='approved'
group by s.category,s.submitter_id;
grant select on stat_leaderboard to anon, authenticated;

create or replace view event_presence_qualified as
with ordered as (
  select event_id, discord_id, sampled_at,
    lag(sampled_at) over (partition by event_id, discord_id order by sampled_at) as previous_sample
  from event_presence_sample
), runs as (
  select *, sum(case when previous_sample is null or sampled_at - previous_sample > interval '5 minutes' then 1 else 0 end)
    over (partition by event_id, discord_id order by sampled_at) as run_id
  from ordered
)
select event_id, discord_id, min(sampled_at) as first_seen, max(sampled_at) as last_seen,
  count(*)::integer as samples
from runs
group by event_id, discord_id, run_id
having max(sampled_at) - min(sampled_at) >= interval '10 minutes';
grant select on event_presence_qualified to anon, authenticated;
