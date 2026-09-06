-- 0036: Keep member gallery uploads within a predictable size envelope.
-- The browser also rejects larger files, but this bucket limit protects the
-- gallery when somebody submits outside the website UI.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'gallery';
