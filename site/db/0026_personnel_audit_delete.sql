-- 0026: a catalogue item could not be deleted, and now there is a button for it.
--
-- Found on 3 Sep 2026 while removing the test row that proved 0025. Deleting
-- a personnel_item returns
--
--   23503 insert or update on table "personnel_audit" violates foreign key
--   constraint "personnel_audit_item_id_fkey"
--
-- The after-delete trigger writes an audit row whose item_id is the id it just
-- watched disappear. personnel_audit.item_id is a foreign key back to
-- personnel_item, so the audit row cannot be written and the delete rolls back.
-- Nothing an admin does in the interface can get past it.
--
-- This was always broken. Before 0025 the same delete failed earlier, on the
-- 42703 error, so nobody reached this one.
--
-- Fix: on a personnel_item delete, leave item_id null. The id is not lost, it
-- is already in detail.record_id, which is where a reference to a row that no
-- longer exists belongs. An assignment delete is unaffected: its item_id
-- points at a catalogue row that is still there.
--
-- What this does NOT change, on purpose: personnel_assignment.item_id is
-- `not null references personnel_item(id)` with no delete rule, so an item
-- somebody currently holds still cannot be deleted. That is correct. Deleting
-- it would rewrite a service record. The interface checks the holder count
-- first and says to archive instead.

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
    case
      when tg_table_name = 'personnel_assignment' then (row_json ->> 'item_id')::uuid
      when tg_op = 'DELETE' then null
      else (row_json ->> 'id')::uuid
    end,
    jsonb_build_object('record_id', row_json ->> 'id')
  );

  return coalesce(new, old);
end;
$$;

-- Clears the test row left behind proving 0025. Harmless if it is already gone.
delete from personnel_item where id = '4b0ee02c-3853-4e5a-a9da-a6e5c88ccc47';
