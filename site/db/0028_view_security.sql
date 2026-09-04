-- 0028: make the Orderly Room views obey the querying member's permissions.
--
-- Production received 0027 before its commits were reconciled into main.
-- Supabase correctly reported audit_event as a security definer view. Both
-- views below expose RLS-protected tables, so both use the caller's access.

alter view public.audit_event set (security_invoker = true);
alter view public.event_attendance set (security_invoker = true);

-- Expected: true for both rows.
select
  c.relname as view_name,
  coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true'] as uses_caller_permissions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('audit_event', 'event_attendance')
order by c.relname;
