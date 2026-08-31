-- Device-scoped removal for tasks submitted through the public board.
--
-- The browser keeps the original token only on the device that created the
-- task. Supabase stores only its SHA-256 hash, so reading the table does not
-- reveal a token that can remove somebody else's entry.

alter table progress_task
  add column if not exists delete_token_hash text;
