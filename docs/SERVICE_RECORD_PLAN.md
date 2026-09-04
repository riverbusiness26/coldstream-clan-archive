# The Service Record, and the loop it closes

For Codex. This is the build brief for the member-facing half of the site: the
page a member lands on after signing in, and the reasons they come back to it.

Read in this order and nothing else before starting:

1. `PROJECT.md` at the repo root. House rules, stack, the gotchas that have each
   cost real time. Non negotiable.
2. `docs/ORDERLY_ROOM_SPEC.md`, then `docs/ORDERLY_ROOM_PLAN.md`. The staff side.
   This file is the member side and sits on top of that schema.
3. This file.
4. The last few dated entries in `HANDOFF.md`.
5. `claims/`, every file, before you touch anything.

Then run `node scripts/status.mjs` before you believe any sentence in any of
them, this one included.

## Corrections to the brief that produced this file

River's write up was drafted against a stale read of the tree. Four of its
statements are wrong as of 4 Sep 2026 and one is a trap. They are corrected
here rather than quietly, because acting on any of them wastes a session.

**The primary checkout is not eight commits behind.** It is level with the
remote at `d878cd2`. `git rev-list --left-right --count origin/main...HEAD`
returns `0 0` after a real fetch, and `status.mjs` agrees. Codex fast forwarded
it on 3 Sep and logged that in `HANDOFF.md`. Do not re-sync it, and do not treat
its code as suspect.

**Attendance is not missing.** `ORDERLY_ROOM_PLAN.md:32` says RSVPs exist but
`attended` and `no_show` do not. That sentence was true when it was written and
is now stale prose, which is exactly what `PROJECT.md` warns about. The schema
landed in `site/db/0027_orderly_room.sql:239` to `:256`: intent stays in
`event_rsvp.status`, outcome goes in a separate `attendance` column, and a row
can exist with no status at all for the person who never replied and turned up
anyway. `mark_attendance` is the write path. What is actually missing is a
surface that calls it and a bot that writes presence samples.

**Attendance review is live; Holdfast activity is not.** On 4 Sep,
`site/db/0029_attendance_review.sql` was applied to production and all four
schema and permission proofs passed. Every table from
`0024_holdfast_activity.sql` still returns 404, so that migration remains
pending. Build against the schema that is live, and say plainly in your handoff
which migration a feature needs before it can work.

**There are two migrations numbered 0024.** `0024_discord_personnel.sql` is
applied; `0024_holdfast_activity.sql` is not. Do not renumber either one, since
one of them is already recorded as applied under that name, but be aware that
"0024" alone is ambiguous in conversation and in `HANDOFF.md`. Say the full
filename.

**`0029` is committed and applied.** It landed in `b41255a` and was applied to
production on 4 Sep. The database read side is ready, but the staff review
screen and the bot presence sampler still need to be built.

## What this is for

Toxic Flaggers is the reference because it retains people, not because of how it
looks. Underneath the shop, the reels and the Cheese Hub there is one loop:

    attend, get recorded, see the record change, get told it changed, come back

Everything worth borrowing serves that loop. The currency, the mini games and
the leaderboard framing are decoration around it and some of it is actively
wrong for Coldstream. Build the loop. Leave the decoration until the loop runs.

Its front page also claims a "Global Holdfast Leaderboard" over millions of
kills. Coldstream cannot make that claim and must not imply it.
`docs/HOLDFAST_STATS.md` sets out why: there is no global feed for a player's
activity across unrelated Holdfast servers. Coldstream can report its own
servers, partner servers running the collector, and partner servers that supply
compatible scoreboard logs. Nothing else. A number on this site without a
source behind it breaks the one rule the whole project exists for.

## The moderation rule

Every member-supplied string, file, caption, tag or claim is signed in and
approved before anybody else can see it. No exceptions, no anonymous path, no
"trusted member" bypass.

This is not caution for its own sake. The reference site's own reviews page is
the argument: submissions there take an optional name, require no account, and
appear unfiltered. The result, at the time of writing, is twelve pages carrying
profanity, hostile posts and sexually explicit content under a Coldstream-sized
community's public brand. That is what an unsigned public submission form
produces, on a real site, today.

The pattern already exists here and works. `gallery_item.approved` defaults to
false (`site/db/0001_init.sql:74`), moderators and admins approve, an uploader
may withdraw their own submission only while it is still pending, and the
storage object is removed with the row
(`site/db/0008_gallery_moderation.sql`). Copy that shape for anything new.
Do not invent a second moderation model.

Note also that `evidence_submission` in `site/db/0024_discord_personnel.sql:118`
was deliberately built as a closed skeleton with a `status` enum and a
`reviewed_by`. When member submitted claims open, that is the table, and intake
stays shut until the review surface exists.

## What is live today, verified

Checked on 4 Sep 2026 by reading the tree and probing the production REST API.
Do not trust this table next week. Re-probe.

| Piece | Where | State |
|---|---|---|
| Discord sign in | `site/src/lib/auth.ts` | Live. OAuth through Supabase, then `discord-member-sync` reads guild roles and sets admin, moderator or member |
| Steam identity | `site/supabase/functions/steam-link` | Live as an optional link on a Discord member. The old `steam-auth` sign-in function is retired |
| Command Board | `site/src/views/Admin.tsx` | Live. Catalogue, assignments, members, evidence skeleton, audit, news |
| Rank and medal catalogue | `personnel_item`, `personnel_assignment` | Live, twelve rank Line Infantry ladder seeded, Volunteer as default recruit |
| Rank ladder structure | `0027`, applied | `seniority`, `band`, `discord_role_id`, `is_default_recruit` |
| Service record fields on member | `0027`, applied | `status`, `company_id`, `notes`, `enlisted_at`, `discharged_at`, written only through `set_member_file` |
| Events and RSVP | `site/db/0010_events.sql:35` | Live, going, maybe, out |
| Attendance outcome | `0027`, applied | `attendance`, `attendance_by`, `attendance_at` plus `mark_attendance` |
| Presence samples | `event_presence_sample`, applied | Table exists. Nothing writes to it yet |
| Presence roll up views | `0029`, applied | Live with security invoker rights and no anonymous select grant |
| Gallery | `gallery_item` | Live, submit and approve, free text `tags` at `0021:19` |
| Holdfast session statistics | `0024_holdfast_activity.sql`, **not applied** | Plus an ingest script at `scripts/ingest-holdfast-scoreboard.mjs`, dry run by default |
| Archive profile | `site/src/views/Profile.tsx` | Live, keyed on the recovered roster |
| Live profile half | `site/src/components/ProfileLive.tsx` | Live, Steam recent games, About, member wall |
| Profile groundwork page | `site/src/views/PlayerProfileMock.tsx:20` | Live at `#/player-profile`, labels itself groundwork, every figure reads "Pending" |
| Bot | `coldstream-bot`, separate repo | Live, has its own `PROJECT.md`. Does not write presence yet |

Members in production: two, River as admin and `notriver` as an ordinary member.
The ordinary-member attendance view and write restrictions are proven live.
A real moderator walkthrough is still outstanding because no moderator member
exists yet.

## The gaps, in the order they hurt

**1. A signed in member has no page.** This is the crux and it is a routing
problem before it is a design problem. `Profile.tsx:32` keys on an archive
roster key, or on `steam:<id64>` for somebody who signed in through Steam and is
not in the archive. A member who signed in through Discord and never linked
Steam has no URL at all. There is nothing to link to from Discord, nothing to
put behind a "My Record" item, and nothing for a medal notice to point at.

Fix the identity first: a member record needs a stable public route of its own,
keyed on the `member` row, with the archive entry and the Steam identity
attaching to it rather than being the thing that addresses it.

**2. Three profile surfaces, none of them the profile.** `PlayerProfileMock` is
honest groundwork with placeholder statistics. `ProfileLive` is the older Steam
era half with an About box and a wall. `Profile` is the archive record. The
brief asks for one, and it is right. Merge toward `Profile` as the shell, since
it already handles "member with no archive behind them" gracefully, and fold the
other two in as sections.

Done since this file was written, on 4 Sep: every Steam sign in surface now
says Discord, `ProfileLive`'s wall prompt included, and `SteamButton` and the
three unreachable views that used it are out of `site/src`. A member can also
link a Steam account to their own record from `#/player-profile`, through
`site/supabase/functions/steam-link/`. Steam is a link on a member row and
never a way in. See the 4 Sep entry in `HANDOFF.md`.

**3. No way in.** `Home.tsx:100` lists Home, About, Games, Community, Media,
Join, and Community and Join both point at Discord rather than at the site.
There is still no Members link anywhere.

Half of this closed on 4 Sep: the account strip in `App.tsx` now carries a My
profile link for any signed in member, which is what made Steam linking
reachable for staff at all. Home still sends staff to the Command Board and
ordinary members to the profile, so an admin's only route to their own record
is that strip, and the strip does not render on Home or the landing page.

**4. Nothing writes attendance.** The schema is ready, the write function is
ready, no surface calls it and the bot does not sample. Until the loop's first
step records anything, none of the rest has input.

**5. Media cannot be tagged to a person.** `gallery_item.tags` is a free text
array. "Recent photographs or videos they were tagged in" needs a real join
between an approved gallery item and a member, which is new schema and does not
exist in any migration written so far.

**6. Nothing tells anybody anything changed.** No Discord message links back to
a changed profile or a published recap. The loop ends at "profile changes" and
never reaches "come back".

## Release one: the Service Record

Ship these together. Each step below ends somewhere usable and none of them
needs the step after it to be worth having, which is the same rule
`ORDERLY_ROOM_PLAN.md` sets for the staff side.

### 1.1 A member has a route

New: a stable public identifier on `member` and a route that resolves it.
Existing `#/member/<archive key>` and `#/member/steam:<id64>` links must keep
working, since they are in the archive, in past Discord messages and possibly in
search results. Resolve all three onto one page.

Do this before anything else. Every remaining item links to it.

### 1.2 One profile, three sections

Merge `PlayerProfileMock` and `ProfileLive` into `Profile`. Keep the existing
separation of evidence from self description, which is the whole reason the two
halves were split in the first place and is documented at the top of
`ProfileLive.tsx`: an archive entry is a sourced record and not the member's to
edit, the About box is theirs. Preserve that boundary visually.

Sections, in the order the brief asks for:

* Identity: Discord avatar and display name, current rank, detachment.
* Medals, with award date and the reason recorded on the assignment.
* Attendance: events attended, current streak, history.
* Verified statistics only, and only from a Coldstream controlled source.
* Media they are tagged in, approved items only.
* Their next event and RSVP state.
* What is new since their last visit.
* A short editable biography and games played, theirs to write, and moderated
  the same way anything else member-supplied is.

Delete `PlayerProfileMock.tsx` once its content has a real home, and remove the
`#/player-profile` route from `App.tsx:163` with a redirect to the real page.
Leaving a mock alongside the thing it was a mock of is how a codebase ends up
with two competing profiles a second time.

### 1.3 Navigation

The account strip half is done: `App.tsx` shows a My profile link to any signed
in member, alongside the Command Board link that is still staff only. What is
left is a Members link in `NAV` in `Home.tsx:100`, and deciding what Home should
offer staff, who are currently sent to the Command Board and given no route to
their own record from that page.

### 1.4 Members directory

A real listing. Rank, detachment, status, avatar, link through to the record.
`Roster.tsx` and the members tab of the Command Board both already do most of
this, so read them before writing a third version.

Ordinary members see a directory. Notes and status stay staff only, which the
database already enforces: `member.notes` and `member.status` are writable only
through `set_member_file`.

### 1.5 Attendance, end to end

`site/db/0029_attendance_review.sql` is live. It is not cosmetic:
`event_presence_sample` is one row per person per sample, a
ninety minute event with thirty people in voice runs to roughly two thousand
rows, and PostgREST caps a select at a thousand by default. Without the roll up
views the approval screen reads a silently truncated list and calls it the roll.
The reasoning is written out in the file, read it.

Three parts:

* The bot samples voice presence during an event and writes `discord_id` rows.
  That work lives in the `coldstream-bot` repo, not here.
* A staff approval screen reads `event_presence_roll` and calls `mark_attendance`
  per member. Do not derive minutes from a hard coded cadence; read the interval
  from `event_presence_window`, which is why that view exists.
* The result appears on the member's record.

Attendance is confirmed by a human. A sample is evidence, never a verdict.

### 1.6 Media tagged to members

New join table between `gallery_item` and `member`. Approved items only on a
profile. A tag is a claim about a person, so it needs the same approval path as
the upload itself, and a member needs a way to ask for a tag to be removed.

### 1.7 This Week at Coldstream

One homepage module reading four things: the next event, current server status,
the newest approved gallery item, and the most recent promotion or medal. All
four already have tables. This is a read, not a feature.

### 1.8 Discord deep links back

When a medal is awarded, a member is tagged, or a recap is published, the Discord
message carries a link to the page that changed. This closes the loop. It also
crosses into the bot repo, so co-ordinate through `HANDOFF.md` there, and note
that `PROJECT.md` forbids posting to Discord without River's say so. That
includes test posts.

## Later, and deliberately not now

**The Campaign Board.** Campaigns of six to ten events. Members accumulate
attendance marks, approved commendations, company results, media contributions,
ribbons and milestones.

One rule from River, and it is a design constraint rather than a preference:
**military rank never derives from points automatically.** Rank and real Discord
authority stay staff managed. Campaign rewards are cosmetic, historical or
commemorative. The schema already keeps these apart and the reasoning is written
at the top of `site/db/0027_orderly_room.sql`: `member.role` answers who may
change things and comes from Discord, `band` answers what somebody is in the
regiment. A points total must touch neither.

Kills appear only when verified through a Coldstream controlled server log or
approved evidence. See the moderation rule and `docs/HOLDFAST_STATS.md`.

**The Mess.** Weekly archive quiz, caption competition, event predictions,
collectible campaign cards, profile frames, a rotating poll, and a small non
purchasable currency for cosmetics. Build it last, if at all.

River's own read is that a daily click for points system would become a chore
for this community and that event based participation fits better. That is the
call. Anything here that rewards showing up every day rather than turning up to
events is the wrong shape for Coldstream, however well it works elsewhere.

Every one of these carries member-supplied text or images. Captions, quiz
answers, predictions, frames: signed in, approved, no anonymous path.

## How it fits the stack

No second backend. No Laravel or Next.js rebuild. React, Vite and Supabase carry
all of it, and the reasons are already recorded in `ORDERLY_ROOM_PLAN.md`: a
second database, a second login and a second bot means the roster lives in two
places and drifts.

* **Discord is the member identity. Steam is the optional game statistics
  identity.** That split is already built and working. Do not merge them and do
  not replace Discord sign in with anything.
* **Connect `personnel_assignment` to the profile directly**, so a rank or medal
  assigned on the Command Board appears on the record without a second write.
* **Authorisation stays in the database.** Members edit their own biography,
  moderators handle assignments and submissions, admins control artwork and
  configuration. Policies plus grants, not checks in the browser. A check in
  React is a hint to the person using the page, never the thing that stops them.
* **Realtime only where freshness earns it**: server status, new awards, RSVP
  totals. Everything else is an ordinary read. A subscription per section on a
  profile page is a lot of sockets for data that changes weekly.

## The rules you will be held to

From `PROJECT.md`, condensed. Read the original, it explains why each one exists.

* **No em dashes, anywhere.** CI fails the build. `house-rules.yml` scans
  `site/src`, `site/db`, `site/supabase`, `claims/`, `scripts/` and the root
  markdown. Use a comma, a colon, or a middle dot.
* **Vocabulary.** Gaming community, never the other two words. Eras, never
  rebrands. Admin and moderator in anything a member reads. Note the one
  subtlety: `band` in the schema uses `officer` and `nco` on purpose, because the
  regiment's own rank sheet does, and `house-rules.yml` deliberately does not
  grep for that word. Schema identifiers are not member-facing copy.
* **Never invent a number.** If the archive or a Coldstream controlled log does
  not support a figure, it does not go on the site. Provenance lines on anything
  quantitative. Two incidents made this literal law.
* **Comments explain why, not what.** Match the voice already in `site/src` and
  `site/db`. It is plain, it reasons out loud, and it tells the next person what
  went wrong last time. That house style is worth more than it looks: three of
  the last five bugs in `HANDOFF.md` were found because a comment said what a
  previous attempt had tried.
* **Grants are checked before policies.** A table with perfect RLS and no grant
  returns 401 and looks exactly like a broken login. Every new table needs its
  grants. Note the trap `0029` documents: `0004` set default privileges granting
  select to `anon` on every table created since, so a new table is readable by
  signed out visitors whatever your migration thought it was granting. Revoke
  explicitly for anything not public.
* **Views need `security_invoker`.** Without it a view runs as its owner and
  hands everything to anybody signed in, past the policies on the table beneath.
  `0028` exists because of exactly this.
* **The repo is public.** No keys, no tokens, no secrets in committed files.
* **Do not hand edit `site/src/seed/`.** Regenerate with
  `npm run seed --prefix site`.
* **Migrations are applied by River**, in the Supabase SQL editor. Write the
  file, write the proof queries into it the way `0027` and `0029` do, and say in
  your handoff that it is pending. Never claim a feature works when its migration
  has not been run.

## Working alongside the others

* Claim before you edit, in `claims/codex.md`, and read every other file in that
  directory first. `App.tsx`, `PROJECT.md`, root `index.html` and the built
  `assets/` are always claim first.
* Lanes: front of house owns `site/src/views`, `site/src/components`,
  `styles.css`. Data and back end owns `site/db`, `site/supabase/functions`,
  `site/src/lib`. This brief crosses both, so claim explicitly and expect to hand
  back and forth.
* Stage by name. Never `git add -A`.
* Prefix commits `codex:`.
* Append a dated entry to `HANDOFF.md`, newest last, in the house format:
  DONE, VERIFIED, UNVERIFIED, BLOCKED, NEXT. Say what you verified and how, not
  just what you changed. Write back even if you changed no files, because River
  deletes chats and a conversation is not storage.

## Release ritual

The site is served static from the repo root, not built on deploy. So:

1. `npm run build --prefix site`
2. Copy `site/dist/index.html` and the whole of `site/dist/assets/` to the repo
   root. Both. `house-rules.yml` has a check for exactly this, because copying
   the new `index.html` without its assets publishes a page asking for a bundle
   nobody has and takes the whole site down.
3. Commit, push, then confirm the live domain serves the new bundle hash.
   `node scripts/status.mjs` reads it for you.

Worth knowing before you look at anything on a page: `homepage/index.html` and
`profile/index.html` have both been pointing at an older bundle for some days,
recorded in `HANDOFF.md` on 3 Sep and not yet fixed. If a change does not appear
on one of those two entry pages, that is why, and it is a separate job.

## Things not to do

* Do not rebuild on a second stack, add a second database, or add a second login.
* Do not imply the site can read global Holdfast statistics. It cannot.
* Do not derive rank or Discord authority from points, campaign or otherwise.
* Do not open any member submission path without sign in and approval behind it.
* Do not build The Mess before the loop it decorates runs.
* Do not leave `PlayerProfileMock` in place next to the real profile.
* Do not post to Discord without River's say so, test messages included.
* Do not delete anything on River's behalf without asking.

## First move

Claim `site/src/views/Profile.tsx`, `site/src/components/ProfileLive.tsx`,
`site/src/views/PlayerProfileMock.tsx` and `site/src/App.tsx` in
`claims/codex.md`, then do 1.1 and 1.2 as one piece of work. Everything else in
release one links to the page those two steps produce, and until a member has a
page with a URL there is nothing for the loop to point at.

The `0029` database foundation is live. Build the unified member profile first,
then the attendance review screen and bot sampler can use it without another
database prerequisite.
