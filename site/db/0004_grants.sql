-- Role grants. Run this once, in the Supabase SQL editor.
--
-- Why this is needed: 0001_init.sql enabled row level security and wrote the
-- policies, but never granted the browser roles access to the tables in the
-- first place. Postgres checks the grant BEFORE it ever looks at a policy, so
-- every request from the site came back 401 "permission denied for table",
-- and the site quietly fell back to its bundled seed data on every page.
--
-- Grants and policies do different jobs and you need both:
--   the GRANT decides whether the role may touch the table at all
--   the POLICY decides which rows it sees and which it may write
-- The policies in 0001 are already correct, so these grants are safe: anon can
-- read only what the read policies expose, and authenticated can only write
-- rows the with-check clauses accept.

grant usage on schema public to anon, authenticated;

-- Reading. The read policies in 0001 do the filtering: the staff board stays
-- hidden, unapproved gallery items stay hidden from everyone but their own
-- uploader and the moderators.
grant select on
  member, roster_entry, board, thread, post,
  gallery_item, shout, server_status, news_item
to anon, authenticated;

-- Writing. Signed-in members only, and the insert policies pin every row to
-- the member doing the writing.
grant insert on thread, post, gallery_item, shout to authenticated;
grant insert on news_item to authenticated;          -- policy limits to moderators and admins

-- Editing. post_edit_own covers your own posts; thread_mod and gallery_mod
-- limit the rest to moderators and admins.
grant update on post, thread, gallery_item to authenticated;

-- A member may keep their own display name and avatar current.
grant update on member to authenticated;

-- Anything added later should inherit the same shape rather than silently
-- repeating this bug.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
