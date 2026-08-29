-- The fields a gallery needs that gallery_item never had. Run after 0020.
--
-- Nothing here is required for the gallery to work. The client reads these
-- off a `select *`, so until this runs they arrive undefined and the page
-- falls back: no description, no tags, nothing featured, no view counts,
-- durations hidden rather than guessed. That is deliberate and it is the same
-- shape scripts/poll-server-status.mjs uses for player_names, because 0020
-- sat unrun for a week and a gallery that breaks on an unrun migration would
-- have been a worse thing to ship.
--
-- Check afterwards with:
--   select column_name from information_schema.columns
--    where table_name = 'gallery_item' order by column_name;

alter table gallery_item
  -- A caption is one line. This is the room to say more, and it is searched.
  add column if not exists description text,
  -- Free tags, searched alongside the title and the author.
  add column if not exists tags text[] not null default '{}',
  -- What kind of media it is, as distinct from which game it is. The game
  -- lives in category_id and that taxonomy is not touched here.
  add column if not exists collection text
    check (collection is null or collection in
      ('screenshots', 'gameplay', 'trailers', 'events', 'artwork', 'community')),
  -- Seconds. Null means nobody measured it, and the interface then says
  -- nothing rather than showing a zero that reads as a real duration.
  add column if not exists duration_seconds int
    check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists featured boolean not null default false,
  add column if not exists views int not null default 0,
  -- Overrides the per type default: images are ours to hand over, a YouTube
  -- film is not. Null means "use the default for this media type".
  add column if not exists downloadable boolean,
  -- A WebVTT track, when one exists.
  add column if not exists captions_url text;

-- Featured is a shelf, so it is read far more often than it is written.
create index if not exists gallery_item_featured
  on gallery_item(featured, created_at desc) where approved;

-- ------------------------------------------------------------------ views
--
-- Counting a view is the one write an anonymous visitor is allowed to make,
-- so it is a function rather than a grant. security definer keeps it to
-- exactly this: add one to the counter of one approved row. It cannot touch
-- another column, another row, or an unapproved item, which is what stops it
-- being a way to discover what is in the moderation queue.
create or replace function gallery_item_viewed(item uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update gallery_item set views = views + 1 where id = item and approved;
$$;

revoke all on function gallery_item_viewed(uuid) from public;
grant execute on function gallery_item_viewed(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ grants
--
-- 0013 already granted service_role everything and set default privileges, so
-- new columns are covered. anon and authenticated read through the existing
-- gallery_read policy and need nothing new: these are columns on a table they
-- can already select.
--
-- Only a moderator may promote something to the shelf. There is no policy for
-- it here because 0007's gallery_mod already covers update on gallery_item
-- for moderator, admin and the operator, and adding a second policy for the
-- same action would widen it rather than narrow it.
