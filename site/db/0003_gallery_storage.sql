-- Storage for member gallery uploads.
--
-- Run this after 0001_init.sql. It creates the public bucket the Gallery page
-- writes to and the policies that decide who may write into it.
--
-- Reads are public because the images are meant to be seen. Writes are
-- restricted: a signed-in member may only write inside a folder named after
-- their own member id, so nobody can overwrite anyone else's uploads. The
-- gallery_item row still starts unapproved, so uploading does not put an image
-- in front of the community until an officer clears it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery', 'gallery', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_object_read on storage.objects;
create policy gallery_object_read on storage.objects
  for select using (bucket_id = 'gallery');

-- The first path segment must be the uploader's own member id.
drop policy if exists gallery_object_write on storage.objects;
create policy gallery_object_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = current_member_id()::text
  );

drop policy if exists gallery_object_delete on storage.objects;
create policy gallery_object_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gallery'
    and (
      (storage.foldername(name))[1] = current_member_id()::text
      or current_member_role() in ('officer','admin')
    )
  );
