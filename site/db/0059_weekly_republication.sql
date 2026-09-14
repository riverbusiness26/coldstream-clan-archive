-- Reset stale publication metadata when an archived weekly submission is
-- reinstated and approved again. Without this, the homepage's archived_at
-- filter hides the submission and deploy_weekly_content cannot pick it up.
create or replace function set_weekly_feature_window()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
    new.deployed_at := null;
    new.featured_until := null;
    new.archived_at := null;
    new.reviewed_at := coalesce(new.reviewed_at, now());
  elsif new.status = 'approved' and new.approved_at is null then
    new.approved_at := now();
    new.featured_until := null;
    new.archived_at := null;
    new.reviewed_at := coalesce(new.reviewed_at, now());
  elsif new.status = 'pending' and old.status is distinct from 'pending' then
    new.deployed_at := null;
    new.featured_until := null;
    new.archived_at := null;
  elsif new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;
  return new;
end;
$$;

create or replace function deploy_weekly_content()
returns void language plpgsql security definer set search_path = public as $$
begin
  update weekly_content_submission
     set status = 'archived', archived_at = coalesce(archived_at, now())
   where status = 'approved'
     and featured_until is not null
     and featured_until <= now();

  update weekly_content_submission
     set deployed_at = coalesce(deployed_at, now()),
         featured_until = weekly_feature_end(now()),
         archived_at = null
   where status = 'approved'
     and (deployed_at is null or featured_until is null or archived_at is not null);
end;
$$;

revoke all on function deploy_weekly_content() from public;
grant execute on function deploy_weekly_content() to anon, authenticated;
