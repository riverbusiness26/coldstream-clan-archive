-- Approved features join this week's rotation immediately, not next Monday.
create or replace function deploy_weekly_content()
returns void language plpgsql security definer set search_path=public as $$
begin
  update weekly_content_submission set status='archived',archived_at=coalesce(archived_at,now())
    where status='approved' and deployed_at is not null and featured_until<=now();
  update weekly_content_submission set deployed_at=now(),featured_until=weekly_feature_end(now())
    where status='approved' and deployed_at is null;
end; $$;
