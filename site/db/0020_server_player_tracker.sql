-- Store public player samples from game server queries.
-- Some games expose player names, some only expose a count, and private
-- servers may expose neither. Keep the field explicit so the site can show
-- exactly what the query returned without inventing a roster.
alter table server_status
  add column if not exists player_names jsonb not null default '[]'::jsonb;
