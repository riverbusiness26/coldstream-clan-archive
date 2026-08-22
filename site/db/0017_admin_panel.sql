-- 0017: what the admin panel needs, plus a brake on the shoutbox.
--
-- No transaction wrapper, on purpose. 0015 was one begin/commit block, a
-- statement inside it failed, and the rollback took the whole thing with it
-- while the editor still reported success. Standalone statements cannot do
-- that to each other. Run the whole file. Safe to run repeatedly.

-- ------------------------------------------------------------ news delete
-- News could be written and edited by an admin but never removed: there was
-- an insert policy and an update policy and nothing for delete, so a typo
-- posted to the front page was permanent. The panel offers a delete button,
-- so the database has to mean it.
grant delete on news_item to authenticated;

drop policy if exists news_delete on news_item;
create policy news_delete on news_item for delete
  using (current_member_role() in ('moderator', 'admin') or is_operator());

-- ------------------------------------------------------- shoutbox throttle
-- Not a security hole, since only signed in members can post, but it is the
-- likeliest thing to be abused now the site is public and busier than
-- expected. Ten seconds between shouts from the same member, enforced in the
-- database rather than the interface, because an interface rule is a
-- suggestion to anyone willing to open the network tab.
--
-- Chosen deliberately over a per minute cap: a burst of four in four seconds
-- is the annoying case, and a steady conversation never notices ten seconds.
create or replace function shout_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  last_at timestamptz;
begin
  select max(created_at) into last_at
    from shout where author_id = new.author_id;

  if last_at is not null and now() - last_at < interval '10 seconds' then
    raise exception 'Slow down a moment before shouting again.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists shout_rate on shout;
create trigger shout_rate before insert on shout
  for each row execute function shout_throttle();

-- --------------------------------------------------------------- checks
-- Expect true, 1, and the trigger name.
select
  has_table_privilege('authenticated', 'news_item', 'DELETE')      as news_delete_granted,
  (select count(*) from pg_policies
     where tablename = 'news_item' and cmd = 'DELETE')             as news_delete_policies,
  (select count(*) from pg_trigger
     where tgname = 'shout_rate' and not tgisinternal)             as shout_throttle_installed;
