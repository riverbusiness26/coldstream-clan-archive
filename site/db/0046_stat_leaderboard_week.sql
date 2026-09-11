-- Current-week approved statistics for the public homepage feature card.
-- The source submissions stay staff/member scoped; this view exposes only totals.
create or replace view stat_leaderboard_week as
select
  s.submitter_id as member_id,
  coalesce(sum(r.kills), 0)::integer as kills,
  coalesce(sum(r.deaths), 0)::integer as deaths,
  coalesce(sum(r.is_mvp::integer), 0)::integer as mvps,
  coalesce(sum(r.is_top5::integer), 0)::integer as top5,
  case
    when sum(r.deaths) = 0 then sum(r.kills)::numeric
    else round(sum(r.kills)::numeric / nullif(sum(r.deaths), 0), 2)
  end as kdr
from stat_submission s
join stat_round r on r.submission_id = s.id
where s.status = 'approved'
  and s.created_at >= (
    date_trunc('week', now() at time zone 'America/Chicago')
    at time zone 'America/Chicago'
  )
group by s.submitter_id;

grant select on stat_leaderboard_week to anon, authenticated;
