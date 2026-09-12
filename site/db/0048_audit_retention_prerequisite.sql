-- Apply only after a verified private export and approval to trim old audits.
-- Supply the export's rows_digest in app.audit_backup_digest for this session.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.personnel_audit in share row exclusive mode;

do $$
declare actual_digest text;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text)
    into actual_digest from public.personnel_audit a;
  if nullif(current_setting('app.audit_backup_digest',true),'') is distinct from actual_digest then
    raise exception 'Audit log changed or backup fingerprint missing; export again before trimming';
  end if;
end;
$$;

-- Every inserting transaction updates the same private guard row. This
-- serializes read-committed writers; stale repeatable-read writers fail with
-- a serialization error instead of committing an incorrect retained count.
create table if not exists public.personnel_audit_retention_guard (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0
);
alter table public.personnel_audit_retention_guard enable row level security;
revoke all on public.personnel_audit_retention_guard from public, anon, authenticated, service_role;
insert into public.personnel_audit_retention_guard(singleton) values(true) on conflict do nothing;

create or replace function public.serialize_personnel_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.personnel_audit_retention_guard set revision=revision+1 where singleton;
  if not found then raise exception 'Audit retention guard missing'; end if;
  return null;
end;
$$;

create or replace function public.trim_personnel_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.personnel_audit where id in (
    select id from public.personnel_audit order by created_at desc,id desc offset 75
  );
  return null;
end;
$$;
revoke all on function public.serialize_personnel_audit() from public, anon, authenticated, service_role;
revoke all on function public.trim_personnel_audit() from public, anon, authenticated, service_role;

drop trigger if exists personnel_audit_serialize on public.personnel_audit;
create trigger personnel_audit_serialize before insert on public.personnel_audit
for each statement execute function public.serialize_personnel_audit();
drop trigger if exists personnel_audit_keep_latest on public.personnel_audit;
create trigger personnel_audit_keep_latest after insert on public.personnel_audit
for each statement execute function public.trim_personnel_audit();

delete from public.personnel_audit where id in (
  select id from public.personnel_audit order by created_at desc,id desc offset 75
);
commit;
