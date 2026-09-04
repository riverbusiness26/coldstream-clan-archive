-- 0028: make the Orderly Room views obey the querying member's permissions.
--
-- Production received 0027 before its commits were reconciled into main.
-- Supabase correctly reported audit_event as a security definer view. Both
-- views below expose RLS-protected tables, so both use the caller's access.

alter view public.audit_event set (security_invoker = true);
alter view public.event_attendance set (security_invoker = true);

-- 0027 initially let any signed-in member append arbitrary audit text. The
-- audit trail is only useful if ordinary members cannot manufacture entries.
create or replace function public.record_audit(
  audit_action text,
  audit_entity text default null,
  audit_entity_id text default null,
  audit_member uuid default null,
  audit_detail jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_member_role() not in ('moderator', 'admin') then
    raise exception 'staff role required' using errcode = 'insufficient_privilege';
  end if;
  insert into personnel_audit(actor_id, action, member_id, entity, entity_id, detail)
  values (current_member_id(), audit_action, audit_member, audit_entity, audit_entity_id, audit_detail);
end;
$$;

revoke all on function public.record_audit(text, text, text, uuid, jsonb) from public;
grant execute on function public.record_audit(text, text, text, uuid, jsonb) to authenticated;

-- Expected: true for both rows.
select
  c.relname as view_name,
  coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true'] as uses_caller_permissions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('audit_event', 'event_attendance')
order by c.relname;
