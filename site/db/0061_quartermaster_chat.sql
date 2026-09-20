-- Members-only Mess Chat for the Shillings page.

create table if not exists public.quartermaster_chat_message (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.member(id) on delete cascade,
  body varchar(500) not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists quartermaster_chat_message_recent on public.quartermaster_chat_message(created_at desc);
alter table public.quartermaster_chat_message enable row level security;
alter table public.quartermaster_chat_message replica identity full;

revoke all on public.quartermaster_chat_message from anon;
grant select, insert, delete on public.quartermaster_chat_message to authenticated;

drop policy if exists quartermaster_chat_read on public.quartermaster_chat_message;
create policy quartermaster_chat_read on public.quartermaster_chat_message for select to authenticated
  using (current_member_id() is not null);

drop policy if exists quartermaster_chat_insert on public.quartermaster_chat_message;
create policy quartermaster_chat_insert on public.quartermaster_chat_message for insert to authenticated
  with check (author_id = current_member_id());

drop policy if exists quartermaster_chat_delete on public.quartermaster_chat_message;
create policy quartermaster_chat_delete on public.quartermaster_chat_message for delete to authenticated
  using (author_id = current_member_id() or current_member_role() in ('moderator', 'admin'));

create or replace function public.quartermaster_chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  last_at timestamptz;
begin
  select max(created_at) into last_at from public.quartermaster_chat_message where author_id = new.author_id;
  if last_at is not null and now() - last_at < interval '10 seconds' then
    raise exception 'Slow down a moment before sending again.' using errcode = 'check_violation';
  end if;
  delete from public.quartermaster_chat_message where created_at < now() - interval '30 days';
  delete from public.quartermaster_chat_message where id in (
    select id from public.quartermaster_chat_message order by created_at desc offset 500
  );
  return new;
end;
$$;

drop trigger if exists quartermaster_chat_guard on public.quartermaster_chat_message;
create trigger quartermaster_chat_guard before insert on public.quartermaster_chat_message
  for each row execute function public.quartermaster_chat_guard();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quartermaster_chat_message'
  ) then
    execute 'alter publication supabase_realtime add table public.quartermaster_chat_message';
  end if;
end
$$;
