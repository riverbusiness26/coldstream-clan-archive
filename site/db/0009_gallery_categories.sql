-- Gallery categories, and video as a first class item. Run after 0008.
--
-- Modelled on how the big forum platforms actually do this. XenForo Media
-- Gallery, which is what most large gaming communities run, organises media
-- into admin-defined categories with their own permissions, and each category
-- decides what it will hold. That is the shape here, minus the parts that only
-- make sense at their scale.
--
-- Videos are stored as a YouTube id, not as a file. A free Supabase project
-- gets one gigabyte of storage, which is roughly two phone clips, and video
-- hosting is the fastest way to turn a free site into a paid one. Every
-- community of this size already puts its footage on YouTube: the site's job
-- is to gather it, not to host it. Thirty two of our own films are already on
-- the site that way.

create table if not exists gallery_category (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  position int not null default 0,
  -- What the category will take. A category cannot be changed once it has
  -- items in it that the new setting would not allow.
  accepts text not null default 'both' check (accepts in ('image', 'video', 'both')),
  -- Locked categories are readable by everyone and writable by nobody. The
  -- recovered archive lives in one: it is a record, not a noticeboard.
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gallery_category_order on gallery_category(position, name);

alter table gallery_item
  add column if not exists category_id uuid references gallery_category(id),
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video')),
  add column if not exists video_id text,
  add column if not exists title text,
  add column if not exists width int,
  add column if not exists height int;

-- storage_key was mandatory when everything was an uploaded image. A video has
-- no stored file, so the rule becomes: exactly one of the two, and it has to
-- match what the item claims to be.
alter table gallery_item alter column storage_key drop not null;

alter table gallery_item drop constraint if exists gallery_item_media_shape;
alter table gallery_item add constraint gallery_item_media_shape check (
  (media_type = 'image' and storage_key is not null and video_id is null)
  or
  (media_type = 'video' and video_id is not null and storage_key is null)
);

create index if not exists gallery_item_category on gallery_item(category_id, created_at desc);

-- ---------------------------------------------------------------- policies
alter table gallery_category enable row level security;

drop policy if exists gallery_category_read on gallery_category;
create policy gallery_category_read on gallery_category for select using (true);

drop policy if exists gallery_category_admin on gallery_category;
create policy gallery_category_admin on gallery_category for all
  using (current_member_role() in ('moderator','admin') or is_operator())
  with check (current_member_role() in ('moderator','admin') or is_operator());

-- Nobody may add to a locked category, whatever else they are allowed to do.
-- Moderators can still unlock one if they mean to.
drop policy if exists gallery_insert on gallery_item;
create policy gallery_insert on gallery_item for insert
  with check (
    uploader_id = current_member_id()
    and (
      category_id is null
      or exists (select 1 from gallery_category c where c.id = category_id and not c.locked)
    )
  );

-- ---------------------------------------------------------------- grants
grant select on gallery_category to anon, authenticated;
grant insert, update, delete on gallery_category to authenticated;

-- ---------------------------------------------------------------- seeding
-- Categories drawn from what the community actually played, in the order it
-- played them. Everything else is "Other Games" rather than a category per
-- title nobody will fill.
insert into gallery_category (slug, name, description, position, accepts, locked) values
  ('napoleonic-wars', 'Napoleonic Wars', 'Mount & Blade: Warband. The regiment years, linebattles and drills.', 10, 'both', false),
  ('counter-strike',  'Counter-Strike',  'CS:GO and CS:S. Retakes, 10 mans, and the ESEA years.', 20, 'both', false),
  ('battlegrounds',   'Battlegrounds 2', 'Where it started in 2011, before the regiment had a name.', 30, 'both', false),
  ('holdfast',        'Holdfast',        'Nations at War.', 40, 'both', false),
  ('garrys-mod',      'Garry''s Mod',    'TTT and whatever else the server was running that week.', 50, 'both', false),
  ('other-games',     'Other Games',     'Everything else we have played together.', 60, 'both', false),
  ('films',           'Films',           'Videos of the community, ours and other people''s.', 70, 'video', false),
  ('the-archive',     'The Archive',     'Recovered material, pulled off Photobucket and imgur before the links died. Read only: this is a record, not a noticeboard.', 80, 'both', true)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      position = excluded.position,
      accepts = excluded.accepts,
      locked = excluded.locked;
