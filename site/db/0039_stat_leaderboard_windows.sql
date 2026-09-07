-- 0039: Public Server rankings reset at the start of each calendar month.
-- Competitive rankings continue to use stat_leaderboard, which is all-time.
create or replace view stat_leaderboard_public_server_month as
select
  'public_server'::text as category,
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
  and s.category = 'public_server'
  and s.created_at >= date_trunc('month', now())
group by s.submitter_id;

grant select on stat_leaderboard_public_server_month to anon, authenticated;
