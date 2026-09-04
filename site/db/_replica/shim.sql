-- The Supabase shaped bits a plain Postgres does not have.
--
-- Enough of Supabase to replay every migration in this folder from empty and
-- exercise the policies as a real signed in person. Not a Supabase clone: it
-- carries the three roles, auth.uid() reading the same request setting
-- PostgREST sets, an auth.users to point auth_user_id at, and the two storage
-- tables the artwork migrations reference.
--
-- Load this into an empty database, then psql -f every 00*.sql in order.

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

create extension if not exists pgcrypto;

-- PostgREST puts the JWT claims in this setting. auth.uid() reads the subject
-- out of it, so a test signs somebody in by setting one string.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', 'anon')
$$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner uuid,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

grant all on auth.users, storage.buckets, storage.objects to anon, authenticated, service_role;

-- Storage helpers the gallery and artwork policies call. Supabase splits an
-- object name on slashes: foldername gives the leading path segments and
-- filename the last one.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select case when position('/' in name) = 0 then '{}'::text[]
              else (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] end
$$;

create or replace function storage.filename(name text) returns text
language sql immutable as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]
$$;

create or replace function storage.extension(name text) returns text
language sql immutable as $$
  select nullif(split_part(storage.filename(name), '.', 2), '')
$$;

-- Realtime's publication. Migrations add tables to it; nothing here listens.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
