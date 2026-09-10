-- 0040: allow member-hosted video uploads and non-YouTube links in the gallery.
--
-- The website still prefers YouTube/stream links, but members may also submit
-- a short MP4/WebM/MOV directly. Moderation happens on the row just like an
-- image, and storage remains private to the uploader until approval.

alter table gallery_item
  add column if not exists external_url text;

alter table gallery_item drop constraint if exists gallery_item_media_shape;
alter table gallery_item add constraint gallery_item_media_shape check (
  (media_type = 'image' and storage_key is not null and video_id is null and external_url is null)
  or
  (media_type = 'video' and (
    (video_id is not null and storage_key is null and external_url is null)
    or (video_id is null and storage_key is not null and external_url is null)
    or (video_id is null and storage_key is null and external_url is not null)
  ))
);

-- 100 MB is the hard video ceiling. The browser keeps images at 10 MB and
-- rejects anything larger before it can consume storage. Supabase buckets
-- have one limit for all objects, so the app enforces the smaller image
-- ceiling client-side.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm','video/quicktime'
    ]
where id = 'gallery';
