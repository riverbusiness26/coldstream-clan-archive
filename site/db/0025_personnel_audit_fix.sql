-- 0025: the personnel audit trigger could not see a catalogue row.
--
-- Symptom: every rank or medal upload failed. The file reached the
-- personnel-artwork bucket, the catalogue insert came back 400 with
--
--   {"code":"42703","message":"record \"new\" has no field \"member_id\""}
--
-- and the frontend then deleted the orphaned file, so the upload appeared
-- to do nothing at all.
--
-- Cause: 0024 gave personnel_item and personnel_assignment the same trigger
-- function, and that function reached for new.member_id inside a CASE.
-- PL/pgSQL resolves every record field reference in an expression against
-- the actual row before the CASE is evaluated, so guarding the reference
-- with a tg_table_name test does not help. personnel_item has no member_id
-- column, so the insert failed on the audit write rather than on anything
-- to do with permissions.
--
-- Fix: read the row as jsonb and pull fields out by name. A missing key is
-- null instead of an error, so one function serves both tables.

create or replace function record_personnel_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  row_json jsonb;
begin
  if tg_op = 'DELETE' then
    row_json := to_jsonb(old);
  else
    row_json := to_jsonb(new);
  end if;

  insert into personnel_audit(actor_id, action, member_id, item_id, detail)
  values (
    current_member_id(),
    tg_table_name || '_' || lower(tg_op),
    case when tg_table_name = 'personnel_assignment'
      then (row_json ->> 'member_id')::uuid
      else null end,
    case when tg_table_name = 'personnel_assignment'
      then (row_json ->> 'item_id')::uuid
      else (row_json ->> 'id')::uuid end,
    jsonb_build_object('record_id', row_json ->> 'id')
  );

  return coalesce(new, old);
end;
$$;

-- Proof. Both inserts must succeed and both must leave an audit row.
-- Run this as a signed-in admin, not in a service-role console, because
-- current_member_id() reads auth.uid().
--
--   insert into personnel_item(kind, name, storage_key, image_mime)
--   values ('rank', 'Migration check', 'check/' || gen_random_uuid() || '.png', 'image/png')
--   returning id;
--
--   select action, item_id, member_id from personnel_audit
--    order by created_at desc limit 1;
--
-- Then remove the check row:
--
--   delete from personnel_item where name = 'Migration check';
