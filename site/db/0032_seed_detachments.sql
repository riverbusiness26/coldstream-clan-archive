-- 0032: Seed the four standard 2nd Coldstream detachments.
-- Idempotent: existing records are preserved, including member assignments and
-- any custom Discord role or emblem values an admin has already configured.

insert into company (name, tag, sort_order)
select seed.name, seed.tag, seed.sort_order
from (values
  ('Line Infantry', 'LINE', 10),
  ('Skirmishers', 'SKIRM', 20),
  ('Artillery', 'ARTY', 30),
  ('Grenadiers', 'GREN', 40)
) as seed(name, tag, sort_order)
where not exists (
  select 1 from company existing where lower(existing.name) = lower(seed.name)
);

-- The built-in crest sprite is selected by detachment name in the website UI.
-- Admin-uploaded emblems remain supported and always take precedence.

select
  (select count(*) from company where lower(name) in ('line infantry', 'skirmishers', 'artillery', 'grenadiers')) = 4
    as standard_detachments_seeded;
