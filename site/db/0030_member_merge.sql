-- 0030: fold River's Steam era member row into his Discord one.
--
-- Two rows, one person. The Steam row was created on 21 Aug by steam-auth,
-- which mints its own auth user and its own member row. The Discord row was
-- created on 3 Sep by discord-member-sync. Neither knew about the other,
-- because nothing has ever matched a Steam identity to a Discord one.
--
-- The Discord row survives. That is not a preference: discord-member-sync
-- looks a member up by discord_id first and by auth_user_id second, so the
-- Discord row is the one every future sign in will find, and every RLS policy
-- in this database resolves the caller through auth_user_id. Keeping the Steam
-- row instead would mean the next sign in simply created a third row.
--
-- What moves: the Steam ID, everything pointing at the old row, and the
-- earlier created_at, because 21 Aug is when this person actually first signed
-- in to the site and the later date would quietly overwrite that.
--
-- Written to run once, but safe to run twice: if there is no Steam only row
-- left to fold in, it says so and changes nothing.
--
-- Run after 0027. Uses event_rsvp.attendance_by, enlistment.reviewed_by and
-- setting.updated_by, all of which 0027 adds.

do $$
declare
  keeper   uuid;
  loser    uuid;
  moved    text;
  n        integer;
begin
  -- The Discord row: exactly one, or this is not the situation this file was
  -- written for and it must not guess.
  select id into keeper from member where discord_id is not null;
  if not found then
    raise exception 'no member row carries a discord_id, nothing to merge into';
  end if;
  if (select count(*) from member where discord_id is not null) > 1 then
    raise exception 'more than one member row carries a discord_id, resolve by hand';
  end if;

  -- The Steam only row. Absent means this has already run.
  select id, steam_id64 into loser, moved
    from member where discord_id is null and steam_id64 is not null;
  if not found then
    raise notice 'nothing to merge: no Steam only member row';
    return;
  end if;
  if (select count(*) from member where discord_id is null and steam_id64 is not null) > 1 then
    raise exception 'more than one Steam only member row, resolve by hand';
  end if;
  if keeper = loser then
    raise exception 'keeper and loser are the same row';
  end if;

  -- ------------------------------------------------------- refuse collisions
  --
  -- Three places carry a uniqueness rule per member, so repointing blindly
  -- would either fail with a constraint error halfway through or, worse, need
  -- a decision this script is not entitled to make. All three are empty today.
  -- If that ever changes, stop and let a person choose.
  if exists (
    select 1 from event_rsvp a join event_rsvp b
      on a.event_id = b.event_id
     where a.member_id = loser and b.member_id = keeper
  ) then
    raise exception 'both rows RSVP''d to the same event, resolve by hand';
  end if;

  if exists (select 1 from member_profile where member_id = loser)
     and exists (select 1 from member_profile where member_id = keeper) then
    raise exception 'both rows have a member_profile, resolve by hand';
  end if;

  if exists (
    select 1 from personnel_assignment
     where member_id = loser and item_kind = 'rank' and removed_at is null
  ) and exists (
    select 1 from personnel_assignment
     where member_id = keeper and item_kind = 'rank' and removed_at is null
  ) then
    raise exception 'both rows hold a current rank, resolve by hand';
  end if;

  -- --------------------------------------------------------- repoint the lot
  --
  -- Every column in this database that references member(id). Listed out
  -- rather than generated, so that a column added later shows up as a missing
  -- line in review instead of being silently swept along by a loop.
  update gallery_item          set uploader_id       = keeper where uploader_id       = loser;
  update news_item             set posted_by         = keeper where posted_by         = loser;
  update post                  set author_id         = keeper where author_id         = loser;
  update thread                set author_id         = keeper where author_id         = loser;
  update shout                 set author_id         = keeper where author_id         = loser;
  update roster_entry          set member_id         = keeper where member_id         = loser;
  update event                 set created_by        = keeper where created_by        = loser;
  update event_rsvp            set member_id         = keeper where member_id         = loser;
  update event_rsvp            set attendance_by     = keeper where attendance_by     = loser;
  update enlistment            set member_id         = keeper where member_id         = loser;
  update enlistment            set reviewed_by       = keeper where reviewed_by       = loser;
  update member_profile        set member_id         = keeper where member_id         = loser;
  update member_wall           set author_id         = keeper where author_id         = loser;
  update member_wall           set subject_id        = keeper where subject_id        = loser;
  update evidence_submission   set submitter_id      = keeper where submitter_id      = loser;
  update evidence_submission   set subject_member_id = keeper where subject_member_id = loser;
  update evidence_submission   set reviewed_by       = keeper where reviewed_by       = loser;
  update personnel_assignment  set member_id         = keeper where member_id         = loser;
  update personnel_assignment  set assigned_by       = keeper where assigned_by       = loser;
  update personnel_assignment  set removed_by        = keeper where removed_by        = loser;
  update personnel_audit       set actor_id          = keeper where actor_id          = loser;
  update personnel_audit       set member_id         = keeper where member_id         = loser;
  update personnel_item        set created_by        = keeper where created_by        = loser;
  update setting               set updated_by        = keeper where updated_by        = loser;

  -- --------------------------------------------------- move the Steam ID over
  --
  -- steam_id64 is unique, so the old row has to let go before the new one can
  -- take it. Two statements, one transaction: there is no moment when the site
  -- is running with the ID on neither row.
  update member set steam_id64 = null where id = loser;
  update member set steam_id64 = moved where id = keeper;

  -- The truthful join date is the earlier of the two.
  update member k set created_at = l.created_at
    from member l
   where k.id = keeper and l.id = loser and l.created_at < k.created_at;

  delete from member where id = loser;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'expected to remove exactly one member row, removed %', n;
  end if;

  raise notice 'merged: steam_id64 % now belongs to member %', moved, keeper;
end $$;

-- ------------------------------------------------------- the orphaned account
--
-- steam-auth created its own auth user for the Steam row, with a made up
-- address of the form <steamid>@steam.coldstream.local. Now that no member row
-- points at it, that user is a way to hold a session that belongs to nobody:
-- the site would read a signed in browser, find no member row behind it, and
-- show the guest view with the "your member record did not save" message.
--
-- Removing it is the second half of making these one account. Nothing else
-- references it: member.auth_user_id is the only pointer and that row is gone.
delete from auth.users
 where email like '%@steam.coldstream.local'
   and id not in (select auth_user_id from member where auth_user_id is not null);

-- ------------------------------------------------------------------- proof
--
-- Run these after applying. Every one should be true.
--
-- One member row, carrying both identities.
-- select count(*) = 1 as one_row from member;
-- select discord_id is not null and steam_id64 is not null as both_identities
--   from member;
--
-- The Steam ID survived the move.
-- select steam_id64 = '76561198044997257' as steam_id_kept from member;
--
-- The gallery uploads followed. There were two, both on the old row.
-- select count(*) = 2 as uploads_followed
--   from gallery_item g join member m on m.id = g.uploader_id;
--
-- Nothing anywhere still points at a member row that does not exist. This is
-- the one that matters: a foreign key would have refused, but a nullable
-- column set to a stale id would not have.
-- select not exists (
--   select 1 from gallery_item where uploader_id is not null
--     and uploader_id not in (select id from member)
-- ) as no_orphan_uploads;
--
-- No auth user left over without a member row behind it.
-- select count(*) = 0 as no_orphan_steam_users
--   from auth.users where email like '%@steam.coldstream.local';
