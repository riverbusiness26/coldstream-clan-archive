-- Gallery moderation. Run after 0007.
--
-- Written by the other session and inlined straight into RUN_ME_next.sql,
-- which meant it was not reproducible from the db/ directory and would be lost
-- the next time the bundle was regenerated. Same content, now a real file, with
-- one thing added: the operator from 0007 can do these too, or the back end
-- cannot moderate the gallery it is supposed to be moderating.
--
-- Approval itself is an update and is already covered by gallery_mod in 0007.
-- What is here is removal.

-- Officers and admins may remove anything. An uploader may withdraw their own
-- upload only while it is still pending, so an approved picture cannot be
-- pulled out from under the community later.
drop policy if exists gallery_remove on gallery_item;

drop policy if exists gallery_delete_mod on gallery_item;
create policy gallery_delete_mod on gallery_item
  for delete using (
    current_member_role() in ('officer','admin')
    or is_operator()
  );

drop policy if exists gallery_delete_own_pending on gallery_item;
create policy gallery_delete_own_pending on gallery_item
  for delete using (uploader_id = current_member_id() and not approved);

-- The storage side of a removal. Deleting the row without the object leaves
-- the bucket filling up with files nothing points at.
drop policy if exists gallery_object_delete on storage.objects;
create policy gallery_object_delete on storage.objects
  for delete using (
    bucket_id = 'gallery'
    and (
      current_member_role() in ('officer','admin')
      or is_operator()
      or (storage.foldername(name))[1] = current_member_id()::text
    )
  );
