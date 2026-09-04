-- 0032: Atomic rank and medal catalogue ordering.
--
-- Dragging the catalogue writes the whole selected ladder in one transaction.
-- A partial browser update could otherwise leave duplicate or broken order
-- values if one request failed halfway through.

create or replace function reorder_personnel_items(ordered_items uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  selected_kind personnel_item_kind;
  supplied_count integer := coalesce(array_length(ordered_items, 1), 0);
begin
  if current_member_role() <> 'admin' then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;
  if supplied_count = 0 then
    raise exception 'an ordered item list is required' using errcode = 'check_violation';
  end if;

  select kind into selected_kind
  from personnel_item where id = any(ordered_items)
  limit 1;

  if selected_kind is null
     or (select count(*) from personnel_item where id = any(ordered_items)) <> supplied_count
     or (select count(distinct kind) from personnel_item where id = any(ordered_items)) <> 1
     or (select count(*) from personnel_item where kind = selected_kind) <> supplied_count then
    raise exception 'the order must contain every item from exactly one catalogue section' using errcode = 'check_violation';
  end if;

  update personnel_item item
     set sort_order = ordered.position * 10,
         updated_at = now()
    from unnest(ordered_items) with ordinality as ordered(id, position)
   where item.id = ordered.id;

  insert into personnel_audit(actor_id, action, entity, entity_id, detail)
  values (
    current_member_id(),
    'catalogue.reorder',
    'personnel_item',
    selected_kind::text,
    jsonb_build_object('kind', selected_kind, 'ordered_items', ordered_items)
  );
end;
$$;

revoke all on function reorder_personnel_items(uuid[]) from public;
grant execute on function reorder_personnel_items(uuid[]) to authenticated;

-- Proof after applying. Every column should read true.
select
  has_function_privilege('authenticated', 'reorder_personnel_items(uuid[])', 'EXECUTE') as authenticated_can_call,
  not has_function_privilege('anon', 'reorder_personnel_items(uuid[])', 'EXECUTE') as anonymous_cannot_call;
