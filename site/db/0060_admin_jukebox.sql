-- Admin-curated music. Members can read published tracks but never upload.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jukebox-music', 'jukebox-music', false, 26214400,
  array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.jukebox_track (
  id uuid primary key,
  title text not null check (length(trim(title)) between 1 and 120),
  artist text not null default '' check (length(artist) <= 120),
  storage_key text not null unique,
  published boolean not null default false,
  sort_order int not null default 0 check (sort_order between 0 and 9999),
  created_by uuid not null references public.member(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jukebox_track enable row level security;
revoke all on public.jukebox_track from anon, authenticated;
grant select on public.jukebox_track to authenticated;
grant all on public.jukebox_track to service_role;
drop policy if exists jukebox_read on public.jukebox_track;
create policy jukebox_read on public.jukebox_track for select to authenticated
  using (public.current_member_id() is not null and (published or public.current_member_role() = 'admin'));

-- Restrictive guards also block any older permissive bucket-wide policies.
drop policy if exists jukebox_read_guard on storage.objects;
create policy jukebox_read_guard on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id <> 'jukebox-music' or (
    public.current_member_id() is not null and (
      public.current_member_role() = 'admin' or exists (
        select 1 from public.jukebox_track t where t.storage_key = name and t.published
      )
    )
  ));
drop policy if exists jukebox_insert_guard on storage.objects;
create policy jukebox_insert_guard on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'jukebox-music' or (public.current_member_id() is not null and public.current_member_role() = 'admin'));
drop policy if exists jukebox_update_guard on storage.objects;
create policy jukebox_update_guard on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'jukebox-music') with check (bucket_id <> 'jukebox-music');
drop policy if exists jukebox_delete_guard on storage.objects;
create policy jukebox_delete_guard on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'jukebox-music' or (public.current_member_role() = 'admin' and not exists (
    select 1 from public.jukebox_track t where t.storage_key = name
  )));
drop policy if exists jukebox_audio_read on storage.objects;
create policy jukebox_audio_read on storage.objects for select to authenticated
  using (bucket_id = 'jukebox-music' and public.current_member_id() is not null and (
    public.current_member_role() = 'admin' or exists (
      select 1 from public.jukebox_track t where t.storage_key = name and t.published
    )
  ));
drop policy if exists jukebox_admin_upload on storage.objects;
create policy jukebox_admin_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'jukebox-music' and public.current_member_role() = 'admin'
    and name ~ '^[0-9a-f-]{36}\.(mp3|m4a|ogg|wav)$');
drop policy if exists jukebox_upload_cleanup on storage.objects;
create policy jukebox_upload_cleanup on storage.objects for delete to authenticated
  using (bucket_id = 'jukebox-music' and public.current_member_role() = 'admin');

create or replace function public.save_jukebox_track(
  target_track uuid, track_storage_key text, track_title text,
  track_artist text default '', track_published boolean default false, track_order int default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.current_member_id();
  previous public.jukebox_track%rowtype;
  saved public.jukebox_track%rowtype;
  object_meta jsonb;
begin
  if actor is null or public.current_member_role() is distinct from 'admin' then
    raise exception 'Admin access required' using errcode = 'insufficient_privilege';
  end if;
  if target_track is null or track_storage_key is null or
    track_storage_key !~ ('^' || target_track::text || '\.(mp3|m4a|ogg|wav)$') then
    raise exception 'Invalid track file' using errcode = 'check_violation';
  end if;
  select metadata into object_meta from storage.objects
    where bucket_id = 'jukebox-music' and name = track_storage_key;
  if not found or coalesce(object_meta->>'mimetype','') not in ('audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav')
    or coalesce((object_meta->>'size')::bigint,0) not between 1 and 26214400 then
    raise exception 'Upload a supported audio file of 25 MB or less first' using errcode = 'check_violation';
  end if;
  -- Serialise competing saves so each audit snapshot reflects the previous write.
  perform pg_advisory_xact_lock(hashtextextended(target_track::text, 0));
  select * into previous from public.jukebox_track where id = target_track for update;
  if previous.id is not null and previous.storage_key <> track_storage_key then
    raise exception 'Upload replacements as a new track';
  end if;
  insert into public.jukebox_track(id,title,artist,storage_key,published,sort_order,created_by)
    values (target_track,trim(track_title),trim(coalesce(track_artist,'')),track_storage_key,track_published,track_order,actor)
    on conflict (id) do update set title = excluded.title, artist = excluded.artist,
      published = excluded.published, sort_order = excluded.sort_order, updated_at = now()
    returning * into saved;
  insert into public.personnel_audit(actor_id, action, entity, entity_id, detail)
    values (actor, case when previous.id is null then 'jukebox.upload' else 'jukebox.edit' end,
      'jukebox_track',target_track::text,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(saved)));
  return target_track;
end;
$$;
revoke all on function public.save_jukebox_track(uuid,text,text,text,boolean,int) from public, anon;
grant execute on function public.save_jukebox_track(uuid,text,text,text,boolean,int) to authenticated;
commit;
