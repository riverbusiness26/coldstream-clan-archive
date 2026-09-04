-- 0031: Detachment emblems.
--
-- `company` is the established detachment record and `member.company_id` is
-- already protected by set_member_file(). These columns give each detachment
-- an optional emblem without making artwork mandatory before it can be used.

alter table company add column if not exists emblem_storage_key text unique;
alter table company add column if not exists emblem_image_mime text
  check (emblem_image_mime is null or emblem_image_mime in ('image/png', 'image/jpeg', 'image/webp'));
alter table company add column if not exists updated_at timestamptz not null default now();

-- Existing company_write and personnel-artwork storage policies already make
-- structure and artwork admin-only. Moderators assign an existing detachment
-- through set_member_file(), which records the member change in the audit log.

create or replace function audit_company_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  row_id uuid;
  row_name text;
  row_tag text;
  emblem_changed boolean;
begin
  if tg_op = 'DELETE' then
    row_id := old.id;
    row_name := old.name;
    row_tag := old.tag;
    emblem_changed := old.emblem_storage_key is not null;
  else
    row_id := new.id;
    row_name := new.name;
    row_tag := new.tag;
    emblem_changed := case when tg_op = 'UPDATE'
      then new.emblem_storage_key is distinct from old.emblem_storage_key
      else new.emblem_storage_key is not null end;
  end if;

  insert into personnel_audit(actor_id, action, entity, entity_id, detail)
  values (
    current_member_id(),
    case tg_op when 'INSERT' then 'company.create' when 'UPDATE' then 'company.update' else 'company.delete' end,
    'company',
    row_id::text,
    jsonb_build_object(
      'name', row_name,
      'tag', row_tag,
      'emblem_changed', emblem_changed
    )
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function audit_company_change() from public;

drop trigger if exists company_audit_change on company;
create trigger company_audit_change
after insert or update or delete on company
for each row execute function audit_company_change();

-- Proof. Run after applying the migration. Every column should read true.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'company' and column_name = 'emblem_storage_key'
  ) as emblem_key_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'company' and column_name = 'emblem_image_mime'
  ) as emblem_mime_ready,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'company'::regclass and tgname = 'company_audit_change' and not tgisinternal
  ) as company_audit_ready,
  has_table_privilege('authenticated', 'company', 'UPDATE') as admin_policy_has_update_grant,
  has_function_privilege('authenticated', 'set_member_file(uuid, member_status, uuid, text, boolean)', 'EXECUTE')
    as detachment_assignment_callable;
