-- Public task intake for the leadership progress board.
--
-- The browser never writes to this table directly. The progress-board Edge
-- Function validates the small public form and writes with service_role. That
-- keeps anonymous visitors away from update and delete, even while task entry
-- itself is open to everyone.

create table if not exists progress_task (
  id uuid primary key default gen_random_uuid(),
  lane text not null check (lane in (
    'website', 'game-servers', 'discord', 'graphics',
    'archive', '2nd-coldstream', 'training-map'
  )),
  title text not null check (char_length(title) between 3 and 120),
  note text not null default '' check (char_length(note) <= 280),
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'blocked', 'done')),
  source text not null default 'public' check (source in ('public', 'leadership')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists progress_task_recent
  on progress_task(created_at desc);
create index if not exists progress_task_lane
  on progress_task(lane, status, created_at desc);

alter table progress_task enable row level security;

-- All browser traffic goes through the narrow Edge Function. Keeping both
-- browser roles off the table makes a public add form much smaller than a
-- public database write policy.
revoke all on progress_task from anon, authenticated;
grant all on progress_task to service_role;

