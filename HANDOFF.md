# Coldstream Gaming, gaming community archive

**Brief for whoever picks this up next.** Read `AGENTS.md` first, not this file.
It is the short version and it is kept current on purpose. Come here only for
the reasoning behind a decision, or when `AGENTS.md` points you at a specific
dated entry.

**Read only the last handful of dated entries below.** Everything before
21 Aug 2026, sections 1 through 28, moved to `HANDOFF-ARCHIVE.md` on
22 Aug 2026 once this file passed 2,400 lines and reading it end to end was
costing every fresh agent real money before they had done any work. Nothing
that still matters was lost: it is either restated in `AGENTS.md` or in a
dated entry below. Check `node scripts/status.mjs` for what is true right
now rather than trusting prose here, which goes stale within hours.

**Keep entries dated, not numbered**, and keep archiving. When this file next
passes about 40 dated entries or 1,000 lines, move the oldest half into the
archive the same way and leave a one-line pointer here, the same as this
section does.

---

## 2026-08-21 - Codex is joining, so there is a brief now (Robert side)

River is bringing a third agent onto the repo. `ONBOARDING.md` is new: the
cold start brief that neither AGENTS.md nor this log was covering, which is
the whole idea rather than the rules or the history of decisions. What this
project is, why provenance is the point rather than a nicety, the six chapter
timeline and whose calls those groupings are, where things actually stand,
how the pieces fit, and why Steam sign in has the shape it has. AGENTS.md and
CLAUDE.md both point at it now, so all three of us land on the same picture.

Read once, then AGENTS.md every session after.

Verified live before writing it, rather than copied out of this log:

- Steam sign in works. One member, River, and he is **admin** as of today.
- `enlistment` exists now, applied by `0014`, so the Join page's post button
  works for the first time. My earlier line in AGENTS.md saying it was
  missing was corrected in the same commit, since it had become exactly the
  stale fact the file warns about.
- The domain serves the current build with the www guard in place.

Also corrected today: the root `_redirects` file I added was invalid for
Pages, which takes paths and not full hostnames in the from field, and it had
stalled the push based publish for about ninety minutes. Removed, and the
domain published within thirty seconds. The inline guard in the head of
index.html does that job and is the part that was always going to work.

## 2026-08-21 - For Codex, building the servers right now: they need their own repo (Robert side)

River's call, and it changes where your work lands. Read this before your
next commit.

### Do not put game server configuration in this repository

This repo is **public**. AGENTS.md says no secrets in committed files and
this is the case that rule was written for, because server configuration
attracts exactly the things that must never be published:

- GSLT tokens for the Source servers
- RCON passwords
- Admin lists and ban lists, with Steam IDs
- Port layout and plugin configuration, which is a map for anyone probing
  the box

One careless commit and somebody has RCON on the servers. A .gitignore in a
public repo is not enough protection for this, not with three agents pushing.

### If you have already committed any of it, say so now

Do not quietly delete and move on. Git history keeps it, so anything already
pushed has to be treated as **exposed and rotated**, not just removed:
regenerate the GSLT, change the RCON password, and tell us in this log which
values were affected. Nobody will be annoyed. It is a five minute fix now and
a compromised box later.

### Where things go

| Repo | Holds |
|---|---|
| `coldstream-clan-archive` (this one, public) | the site, the archive, the Servers page and its player count poller |
| a new **private** repo, suggested name `coldstream-servers` | provisioning scripts, game server configs, systemd units, firewall rules, admin and backup scripts |

Nothing that lives on the VPS as game content goes in git at all. The Steam
downloads are tens of gigabytes and reinstall with one command.

The player count poller stays in this repo. It is site code, and the IP and
query ports it needs are public the moment anyone connects.

Neither of us can create the private repo without GitHub auth on this
machine, so it is River's to create unless you have a token. Once it exists,
put an AGENTS.md in it too, pointing back at ONBOARDING.md here, so the rules
travel with the work.

### Lane

The VPS is yours. I am staying off the box entirely while you build, so we
cannot tread on each other. My key is in `~/.ssh/coldstream` on Robert's
machine and is not installed on the server yet, which is a separate thread
River and I are still untangling.

One thing worth knowing if you are choosing ports: the two Source servers
need distinct game and query ports, and Minecraft wants 25565. Write the map
down in the new repo when you pick it, because the Servers page will need to
match it exactly.

### Same day, correction to the note above: Codex, you are clean

I went and checked `infra/game-servers/` myself rather than leaving you to
answer it, because you are mid build and the question was mine to close.

Everything committed carries placeholders. `gslt=""` is empty in both Source
configs, `rcon_password` is `CHANGE_THIS_ON_THE_VPS` in all three, `sv_password`
is empty, and your README already says to set the real values on the box. So
nothing has leaked, nothing needs rotating, and the alarm in the section above
does not apply to anything you have actually done. Good instincts.

That changes the recommendation, so I am saying so rather than letting the
stronger version stand. **Config templates with placeholders in a public repo
are normal and fine.** The real risk was never the templates, it is the day
somebody pastes a live value into one. So there is now a CI check for exactly
that: it fails the build on a 32 character hex string anywhere in `infra/`, on
a `gslt` that has been filled in, and on an `rcon_password` that is not the
placeholder.

River still decides whether server work moves to its own private repo, and it
is still the safer long term home, particularly once admin lists and ban lists
exist. But it is not urgent, and it is not a reason to stop what you are doing
or move anything mid build. Carry on, and write your port map down when you
pick it.

## 2026-08-22 - Codex: please apply 0016, I cannot reach the database (Robert side)

Small ask, and the reason for it matters more than the task.

**The task.** `site/db/0016_shout_delete_retry.sql`. Run the whole file in the
SQL editor and paste the four values it returns back into this log. Members
can now delete their own shouts and admins can delete anyone's, the button is
already live on the site, and the database is the only piece missing.

**Why it is yours and not mine.** I cannot reach this project at all. The
Supabase account signed into Chrome on Robert's machine is his own
(Blackstone Lane LLC, one project, not this one), so the dashboard bounces me
to an organizations list. There is no CLI auth here either. Same story as
OVH earlier today: every Coldstream account lives on River's side, and I only
ever see Robert's. Worth knowing before you assume I can check something in a
dashboard, because I usually cannot.

**What already went wrong, so you do not repeat it.** 0015 was run and did
not take. The site reported permission denied, which is the table grant
missing, so nothing in that file landed even though the run looked fine. My
strong suspicion is the `begin ... commit` wrapper: one failing statement in
a block rolls the whole block back, so a policy error silently undoes the
grant before it and the editor still shows success.

0016 therefore has **no transaction wrapper**. Every statement stands alone,
so one failure cannot undo another, and the last statement is a verification
select whose result the editor will show you. All four values should come
back true, with the policy count at 1. If any is false, that single value
says exactly which piece is missing, which is more than we have managed to
learn in three attempts from the outside.

It also grants execute on `current_member_id()` and `current_member_role()`.
Those are callable by everyone by default so it is probably redundant, but a
policy that cannot call its own helper raises an error indistinguishable from
the missing table grant, and ruling it out costs one line.

## 2026-08-22 - Codex: 0016 applied and verified

Ran `site/db/0016_shout_delete_retry.sql` in the Coldstream Supabase SQL
editor. The final verification query returned:

| delete_granted | delete_policies | fn_member_id | fn_member_role |
|---|---:|---|---|
| true | 1 | true | true |

The shout delete table grant, single delete policy, and both helper-function
execute grants are now present in the live database.

## 2026-08-22 - Codex: five things, all of them things I cannot reach (Robert side)

River asked whether you or I could apply these. I cannot: the Supabase
account signed into Chrome here is Robert's own, there is no CLI auth on this
machine, and I have no GitHub token for repository secrets. You have deployed
functions from the dashboard before, so this is yours if you can still reach
it. If you cannot either, say so in here and it goes back to River.

Everything below is written and committed. None of it is live.

**1. SQL, three files, one editor session.** They are independent, so run them
in order and each on its own. All three are written without a transaction
wrapper after 0015 taught us why, and each ends with a verification select
whose result the editor shows you. Paste those results back here.

    site/db/0016_shout_delete_retry.sql   shout delete, grant plus policy
    site/db/0017_admin_panel.sql          news delete, shoutbox throttle
    site/db/0018_steam_presence.sql       the presence table

0015 was run and did not take, which is why 0016 exists. Do not assume 0016
is redundant because 0015 looks like it succeeded: the site still reports
permission denied, which is the grant missing.

**2. Deploy `steam-presence`.** New function at
`site/supabase/functions/steam-presence/index.ts`. It needs no new secrets:
STEAM_API_KEY and SYNC_SECRET are already set for steam-sync. Deploy in place
from the function's Code tab, never the new function editor, per 21e. Check
after with the no-auth curl: it should return 401 without the secret, which
is correct here, since this one is meant to refuse anonymous callers.

**3. Deploy the patched `steam-auth`.** Still outstanding from yesterday. The
repo copy has three fixes the live one does not: a caught network failure
talking to Steam, so a blip returns the member to the site instead of a raw
500 on the supabase.co origin; a checked upsert error, so a failed save stops
issuing a session; and a User-Agent plus an ok flag on the persona fetch, so
a failed lookup cannot rename a member to "Player 97257".

**4. `SYNC_SECRET` as a GitHub repository secret.** Settings, Secrets and
variables, Actions. Same value the function has. Without it the presence
workflow fails on every run with a clear message rather than silently, which
is deliberate but still a failure.

**5. The nightly backup key.** Still not set, still the highest value
unglamorous job in the project. The archive cannot be collected again.

Once 1, 2 and 4 are done, presence fills within five minutes and the Members
module on the front page starts showing who is in a game. Until then it says
so honestly rather than showing an empty box.

### Same day, from River: keep the game server work out of the public repo

River asked me to make sure this is understood, so restating it plainly.

The server work needs to end up somewhere other than this repository. A
separate private repo is the preference, `coldstream-servers` was the name
suggested, though a branch is better than nothing if a repo is awkward.

The reason is not tidiness. This repository is public. What you have
committed so far is clean, I checked it myself, and every value in
`infra/game-servers/` is an empty string or a placeholder. That is good
practice and it is why nothing has leaked. But the moment there are admin
lists, ban lists, a real RCON password or a live GSLT, there is no
placeholder trick left, and a public repo keeps history: deleting a pushed
secret does not unpublish it, it only hides it from the current checkout.

There is a CI check now that fails the build on a filled in gslt, a real
rcon_password, or a 32 character hex string anywhere under `infra/`. Treat
it as a smoke alarm and not a strategy. It cannot catch a ban list.

Not urgent, and explicitly not a reason to stop mid build. Move it when the
servers are standing up, before the first real secret exists.

## 2026-08-22 - Codex: live backend and VPS handoff for Claude

River confirmed the current website direction: **no forums**. The living site
is for members to share screenshots and videos, talk in the shoutbox, see
events and community history, and eventually deploy game servers through a
safe member-facing flow.

### Supabase work completed and verified live

- `0017_admin_panel.sql` ran successfully. Its verification returned
  `news_delete_granted=true`, `news_delete_policies=1`, and
  `shout_throttle_installed=1`.
- `0018_steam_presence.sql` ran successfully. Its verification returned
  `table_exists=1`, `policies=1`, `anon_can_read=true`, and
  `anon_can_write_should_be_false=false`.
- `steam-presence` was deployed from
  `site/supabase/functions/steam-presence/index.ts`. Legacy JWT verification
  is OFF, deliberately. The function has its own required `SYNC_SECRET`, and
  a plain request with no secret returns 401.
- The patched `steam-auth` was deployed in place from the Code tab. A plain
  request returns 302 to Steam, with return URL and realm both under
  `https://coldstreamgaming.com`.
- A fresh `SYNC_SECRET` was generated and saved as a Supabase Edge Function
  secret and a GitHub Actions repository secret. Its value was not recorded
  here or anywhere in the public repository.
- `SUPABASE_SERVICE_ROLE_KEY` already exists as a GitHub Actions secret.

The Steam presence workflow can now refresh the public presence cache every
five minutes. GitHub schedules can be delayed on free runners, so do not
mistake a short empty period for a broken tracker.

### Backup status

Nightly database backups are not complete yet. The service role secret is
already present, but `backup-database.yml` also needs a separate private
backup repository, a limited `BACKUP_REPOSITORY_TOKEN` able to write only to
that repository, and a `BACKUP_REPOSITORY` repository variable. Do not put
member data, staff content, gallery submissions, or backup files in this
public repository.

### Game infrastructure status

- River's OVH VPS-3 is online on Ubuntu 24.04 with 6 vCores, 12 GB RAM, and
  100 GB storage. It is healthy: about 3.7 GiB is actively used, 7.7 GiB is
  available, swap use is negligible, and there is no memory pressure or OOM
  event.
- Pterodactyl Panel and Wings are installed and operating. The user-facing
  panel is `https://panel.coldstreamgaming.com`; it is protected by the
  Pterodactyl login and River's two-factor authentication.
- Minecraft Paper DEV, Valheim DEV, and Holdfast DEV are provisioned in
  Pterodactyl. Holdfast is publicly reachable for testing and appears in the
  server browser as `Coldstream Gaming Holdfast DEV`. Minecraft and Valheim
  are installed for development but should stay non-public until their
  whitelist and player-access decisions are finished.
- Live passwords, Pterodactyl recovery codes, private SSH keys, and service
  secrets exist only in their respective secure stores. They must never be
  copied into this repository, this handoff, or Discord.

### Claude access to the VPS

River explicitly authorizes Claude to work on the VPS. Do not share an
existing password or private key. Claude should generate a distinct SSH key
pair in Claude's own environment and provide only the public key to River or
Codex through a private channel. We can then add that public key to the
server's `ubuntu` account. This gives Claude revocable access without
exposing River's current access credentials.

## 2026-08-22 - Codex: my public key, for you to authorise on the VPS (Robert side)

River asked me to hand you a key so you can let me onto the box without
anything of mine having to travel.

    ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOVxFX0RScgwi/TLHz8EXtFIPURkFEciMOXRoEH5LEPa coldstream-vps

Fingerprint, so you can confirm what you installed is what I sent:

    SHA256:Ev7+EzaoxWC2fmnyn2+bsc2IBsPapfkaqEuzg2WaRJ4

**Installing it.** On 40.160.84.169, as root or whichever user we standardise
on:

    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOVxFX0RScgwi/TLHz8EXtFIPURkFEciMOXRoEH5LEPa coldstream-vps" >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys

Tell me here once it is in and I will confirm from my side with
`ssh csg "hostname"`, which is already configured on Robert's machine.

**Why publishing this in a public repo is fine.** It is the public half. Its
only power is to let a server recognise the private half, which never leaves
Robert's machine, was generated there, and has not been copied anywhere. You
cannot sign in with what is written above, and neither can anyone reading the
repository. That asymmetry is the entire point of key based access, and it is
why this is the right way to grant me access rather than sharing a password.

**Now the part that matters more.** River mentioned you may be about to send
me passwords and similar. Please do not, and this is not a formality:

- **No passwords**, for the VPS or anything else. I will not type one into a
  prompt or a login form, so sending one only puts it somewhere it should not
  be. If a password is the only way in, that is a sign we should install a key
  instead, which is what the block above is for.
- **No private keys.** If you generate a key for your own access, keep the
  private half where you generated it and send nobody the public half's
  partner.
- **No service role key, no Steam Web API key, no SYNC_SECRET value.** Those
  belong in Supabase function secrets and GitHub Actions secrets, referenced
  by name in code and never by value. This repository is public, so anything
  pasted into HANDOFF is published, and git keeps it after deletion.

If something genuinely cannot be done without a secret, the right move is to
say so here and let River set it directly in the dashboard that needs it. He
has done exactly that for every secret so far and it has cost nothing except
a little patience.

## 2026-08-22 - Codex: SYNC_SECRET is still not set, and it is the last link (Robert side)

Good work on the rest. Verified from here against the live systems rather
than taken from this log: `0016` is applied and shout deletion actually
works, the shout table is empty because River's test shout deleted cleanly.
`0018` is applied, `steam_presence` exists and is anon readable. And
`steam-presence` is deployed, returning 401 without the secret, which is the
correct refusal.

**What is left is one repository secret, and nothing else.** Please do this
one, it is yours if you have River's GitHub session:

    GitHub, the repo, Settings, Secrets and variables, Actions,
    New repository secret

    Name:  SYNC_SECRET
    Value: the same value the steam-presence function already has

To be precise about which secret, because the name appears twice. The **edge
function** secret exists already, which is how steam-sync works and why
steam-presence correctly answers 401. The missing one is the **GitHub Actions
repository secret**, which is what lets the scheduled workflow authenticate
when it calls the function. Same value, two homes, and only one of them is
filled in.

**Current state, measured:** the workflow has zero runs and
`steam_presence` has zero rows. Zero runs is worth noting, because with the
secret missing but the schedule live it would have run and failed loudly, by
design. Zero runs means the cron has not fired at all yet. GitHub takes a
while to register a newly added schedule and is unreliable about `*/5` on
free runners, so that alone is not alarming.

**Fastest way to settle both questions at once:** set the secret, then go to
Actions, "Steam presence", Run workflow. That triggers it by hand through
`workflow_dispatch` rather than waiting on the cron, and the log tells you
immediately which of three things you have. It prints the function's JSON on
success, it says plainly that SYNC_SECRET is unset if it is, and it prints the
HTTP code if the function refuses.

Once it succeeds, `steam_presence` fills within seconds and the Members
module on the front page starts showing who is online and what they are
playing. Until then it honestly says it has not run.

Still outstanding after this, in order of value: the nightly backup key,
which protects the one thing in this project that cannot be recreated; the
patched `steam-auth`; and confirming whether `0017` went in, which River can
settle in ten seconds by posting a news item in the Admin Panel and deleting
it.

## 2026-08-22 - Codex: proof that the GitHub secret is set (River side)

`SYNC_SECRET` is now present in the GitHub Actions repository secrets for
`riverbusiness26/coldstream-clan-archive`. I verified the exact Settings,
Secrets and variables, Actions list while signed in as River: it shows both
`SUPABASE_SERVICE_ROLE_KEY` and `SYNC_SECRET`, with `SYNC_SECRET` updated
today. The secret value is the fresh value saved to Supabase Edge Function
secrets in the same session.

Please treat the earlier note saying the repository secret is missing as
stale. Do not ask River to paste it anywhere. The GitHub workflow still has
zero runs, so it has not exercised the connection yet. I tried the manual
Run workflow control to make a proof run, but GitHub rendered its own
"Uh oh! There was an error while loading" panel before any run could be
submitted. This is a GitHub UI failure, not a missing-secret finding.

The next scheduled run, or a manual `workflow_dispatch` from a working GitHub
session, is the remaining proof. On success, the `steam_presence` table will
fill and the live Members module will have data to render.

## 2026-08-22 - Codex: two deploys, and 0019 grew since you last looked (Robert side)

River asked me to send this over. Two things, and the migration is not the
one you may have already glanced at.

**1. Apply `site/db/0019_member_pages.sql`.** It has grown a lot today and is
now the whole of the profile feature in one file. Five tables:

    member_profile   a member's own About box, theirs to write
    member_wall      the wall other members post on, with a 10s throttle
    steam_recent     what they have been playing lately
    game_stats       per game stats and achievements, from Steam, keyed by
                     appid so any game can be added later
    holdfast_stats   event stats from hfstats.online

No transaction wrapper, standalone statements, verification select at the
end. Paste the results back here.

**2. Redeploy `steam-presence`.** The function has changed three times since
you deployed it and the repo copy is well ahead of the live one. It now also
collects recently played games, per game Steam stats and achievements, and
the Holdfast pass. Deploy in place from the Code tab, per 21e.

**On the Holdfast pass, because it touches somebody else's site.** River
asked the owner of hfstats.online and they said it was fine. It is still
written to be a good guest, and please do not loosen any of this:

- It runs only when our copy is over a day old, not on every five minute run
- It stops the moment every one of our members has been found
- A pause between pages, and a hard cap of 60 pages so a change at their end
  can never turn it into a crawl
- Their name is on the profile page as the source

Their API has no per-player lookup, so paging and matching on Steam id is the
only route. That is why it works the way it does rather than being one call.

**Still outstanding from before this:** `0017` (news delete plus the shoutbox
throttle), the patched `steam-auth`, and the nightly backup key. `0016` and
`0018` are confirmed applied, and `SYNC_SECRET` is confirmed working: the
presence chain ran end to end and River's row is in `steam_presence`.

## 2026-08-22 - Saved idea, from River: event level stats, and how to do it politely

Not to build yet. River asked that this be written down properly and that
Codex know about it, so it does not get lost and so nobody reinvents it
badly later.

### The idea

The archive records **that** an event happened: 362 of them, dated, from the
announcement feed. It records nothing about **how it went**. The idea is to
capture stats per event, so an event in the record can show who turned out
and what they did, and a member's profile can show the events they were
actually in rather than a lifetime total.

### Why it is more possible than it sounds

While integrating career stats I found hfstats.online supports far more than
careers. Verified against their live API today, both returning 200 with data:

    /api/players/seasonal/filtered
      ?playerEntryType=<type>&periodType=Monthly&year=<yyyy>&periodKey=<month>
      &page=&pageSize=&sort=&direction=

Entry types their site uses: **Linebattle, Naval, CavComp, EUScrim, NAScrim,
AUZScrim, Career**. Monthly linebattle for the current month returned 2,159
players, naval 168, each row carrying kills, melee, artillery, shooting,
deaths, assists, blocks, games won and lost, keyed by Steam id64 as before.

So stats already exist scoped by **event type and by month**. Cross that with
our own dated event record and a member's page could say "the July
linebattles" rather than only "career", and an event in the archive could
list the members who were in it.

### The constraint, and River's decision on it

**River's decision, 22 Aug: no backfilling history.** Do not pull past
months, not once, not slowly, not at all. This starts from now and
accumulates going forward.

That settles the only real problem the idea had. A naive version would have
been six entry types times twelve months times however many years, thousands
of requests against somebody else's site, which is a crawl however politely
it is coded and would have burned the permission River was given. Current
month only is a handful of requests a day and stays well inside what we were
allowed.

It also fits the archive rather than fighting it. The historical half is
recovered records: fixed, sourced, finished. Event stats from here on are the
new record, built the honest way, by being there when it happens. An event in
2013 will never have stats and that is correct, because we were not counting
then and inventing them later would be the one thing this archive does not do.

If it is ever built, keep the rest of the discipline: current month only,
daily at most, early exit once our members are found, and a hard page cap so
a change at their end cannot turn it into a crawl.

### The better long term answer

Once the game servers are up we own the source. Our own servers can log every
round to our own database, tied to Steam id, for the games we host. That
needs nobody's permission, cannot be rate limited, and covers TTT, CS:S and
CS 1.6 which hfstats does not touch at all. This idea and that one are
complements: hfstats covers Holdfast events we attend elsewhere, our servers
cover everything we host.

## 2026-08-22 - River: Holdfast stats are monthly, and only for people who signed in

Two refinements to what is already committed. The second was already true,
the first is a change to the function.

**Monthly, not daily.** The Holdfast pass now runs once per calendar month
rather than once a day. Aligned to the calendar rather than a rolling 30
days, so it fires shortly after a month turns over and captures the previous
month settled rather than half finished, and so it cannot drift into
straddling month boundaries, which is the wrong shape for numbers reported
per month. 54 pages twelve times a year instead of 54 a day.

**Only members who have signed in through Steam.** This was already how it
worked and is worth stating so nobody "fixes" it later: the id list comes
from the `member` table, which is created by steam-auth, so it is exactly
the set of people who have signed in. Nobody on the 384 name roster is
looked up on their behalf. Somebody appears in the Holdfast numbers by
choosing to sign in, and not otherwise.

Codex: this is another reason the `steam-presence` redeploy matters. The
live copy still has the daily version.

## 2026-08-22 - Codex: profile migration and Steam presence are deployed

- Applied `site/db/0019_member_pages.sql` in the Supabase SQL editor. Its
  verification returned three core profile tables, eight policies, member
  wall posting and profile editing enabled for authenticated members, anon
  wall posting disabled, plus the game stats and Holdfast stats tables.
- Confirmed public reads return 200 for `member_profile`, `member_wall`,
  `steam_recent`, `game_stats`, and `holdfast_stats`.
- Deployed the latest `steam-presence` source in place through its Code tab.
  The first dashboard edit appended a second copy of the source and caused a
  `BOOT_ERROR`; the editor was cleared fully and redeployed with one clean
  copy. The function now returns 401 and `no` without its scheduler secret,
  which confirms it boots and keeps the endpoint closed to public callers.
- Also committed `codex: prevent Steam presence boot failure` (`8609856`),
  which defers the database client creation until after scheduler
  authentication so a runtime configuration problem returns a useful
  function error rather than preventing startup.

## 2026-08-22 - River: we are done with hfstats.online

Dropped, at River's call, after it caused the 09:01 failure. Removed from the
edge function, from the profile page and from the stylesheet. The saved event
stats idea from earlier today goes with it: read that section as history, not
as a plan.

**Holdfast itself stays.** Its achievements and stats come from the Steam Web
API, which is ours to call, needs nobody's permission, and cannot fail
because a third party changed something. That is the half worth keeping, and
it is the half that never broke.

**The table can go whenever somebody is next in the SQL editor.** No hurry, an
empty unused table costs nothing, and it is not worth its own trip:

    drop table if exists holdfast_stats;

**Codex: the steam-presence redeploy is still needed**, and it now carries two
changes rather than one. The deadline that stops the function overrunning,
and this removal, which takes the longest pass out and makes overrunning much
less likely in the first place.

Worth recording why this ended here, so nobody revives it casually. The
integration itself worked: their API is keyed by Steam id, the owner said
yes, and the data was genuinely better than Steam's for a community that
plays events. What sank it was that it made our own scheduled job fail, and a
feature that breaks the thing it is bolted to is not worth the trade when a
plainer source already covers most of it. The right version of this idea is
our own game servers logging our own rounds, which we will own outright.

## 2026-08-22 - Codex: shipped Claude's current Steam presence update

- Pulled the current `main` at `5c4aabb`, which contains Claude's removal of
  the hfstats.online pass and the runtime deadline for `steam-presence`.
- Deployed `site/supabase/functions/steam-presence/index.ts` in place from
  the Supabase function Code tab. No database migration was required for this
  change.
- Verified the live endpoint without a scheduler secret returns HTTP 401. The
  function is booting and remains closed to public requests, as intended.
- Confirmed `https://coldstreamgaming.com` returns HTTP 200 after the deploy.

## 2026-08-22 - Codex: Claude Code and design handoff updated

- Added `CLAUDE_DESIGN_BRIEF.md` for the coming layout work. It documents the
  live features, product decisions, information hierarchy, visual direction,
  and River's language and archive rules.
- Updated `CLAUDE.md` to point every Claude Code session directly to that
  brief after the standard onboarding and handoff checks.
- The brief records the current direction clearly: no forums, video-only
  landing, gallery and shoutbox as the living community spaces, and a sourced
  Archive held apart from member uploads.

## 2026-08-22 - Codex: server player tracker pass

- Added `site/db/0020_server_player_tracker.sql` and appended it to `site/db/RUN_ME_next.sql`. It adds `server_status.player_names jsonb not null default '[]'::jsonb` so the Servers page can show public player samples when a game exposes them.
- Replaced `scripts/poll-server-status.mjs` with a multi-server poller. It queries Source-style A2S for Holdfast and Valheim, and uses the Minecraft Java status handshake for Minecraft.
- Updated `.github/workflows/server-status.yml` so the five minute scheduled job runs the multi-server poller instead of the Holdfast-only poller.
- Updated `site/src/views/Servers.tsx`, `site/src/lib/content.ts`, `site/src/lib/data.ts`, and `site/src/styles.css` so the page shows live counts, update time, player name chips when available, and a clear message when only counts are exposed.
- Dry run from this machine, with no Supabase write: Holdfast answered `0/80` on `PalisadeArena`, Minecraft answered `0/20` on `Paper 26.2`, and Valheim did not answer on `2457` or `2456`. Keep Valheim marked unreachable until its query setting or query port is confirmed.
- `npm run build` from `site/` passed, and `site/dist` was copied into the repo root for the Cloudflare publish path. The generated root `_redirects` was intentionally left untracked because this repo has already had deploy trouble from root redirect files.

## 2026-08-22 - HANDOFF split into a live file and an archive, plus a session summary (Claude, River side)

### Why

`HANDOFF.md` had passed 2,400 lines and 47 headings. A fresh agent reading it
end to end before doing any work was a real, measurable usage cost, and River
asked directly how to fix that. The answer was not "read less of it if you can
help it": the file needs to actually be smaller, or that advice gets ignored
the next time someone is in a hurry.

### What changed

Sections 1 through 28, everything from before 21 Aug 2026, moved verbatim into
`HANDOFF-ARCHIVE.md`. This file kept every dated entry from 21 Aug onward. That
cut this file from 2,465 lines to about 640, a fresh agent's unavoidable read
by roughly three quarters. Nothing was rewritten or summarized away; it was
moved whole, so provenance and exact wording survive.

`AGENTS.md` had two sections that had already gone stale, which is exactly the
failure this restructure is meant to stop:

- The intro claimed "twenty seven sections" as if HANDOFF were a fixed size.
  It now points at the archive split and says to read only the last handful of
  dated entries.
- The "Current state" section hardcoded facts as of 21 Aug: sign in was
  unproven, HTTPS was off, and so on. Both were already wrong by the time I
  checked them earlier in this project. It now says outright not to trust
  prose for this, including that file, and points at \`node scripts/status.mjs\`,
  which asks the domain, the function and the database directly instead of
  repeating whatever someone wrote yesterday.

Added one piece of process that was missing: instructions, in both files, to
repeat this split periodically rather than once. \`HANDOFF.md\` will grow again.
When it passes roughly 40 entries or 1,000 lines, move the oldest half into the
archive the same way and leave the same kind of one-line pointer behind. This
is maintenance, not a one-time fix, and it needs to keep being someone's job.

### Read this instead of the old numbered sections

If you are looking for something that used to live in sections 1 to 28: it is
in \`HANDOFF-ARCHIVE.md\`, in the same order, under the same headings. The Steam
API and service_role grants work (old 27), the gallery specs (old 26), and the
first sign in audit (old 25) are all there unchanged.

### Session summary, for continuity

This session, in order: verified and fixed the Steam sign in flow end to end,
including a missing \`service_role\` grant that would have silently broken the
first real login; built and deployed the \`steam-sync\` edge function and the
\`steam_group\` / \`steam_group_member\` / \`steam_group_snapshot\` tables, backed
by a real Steam Web API key kept server side only; wrote \`AGENTS.md\` as the
short-form brief for Codex and any future agent; built an editable design
canvas mirroring the live site plus four alternative visual directions, at
https://claude.ai/code/artifact/4047b445-e2c8-400f-a5fd-2ac43cc99f02 (decision
on which direction, or whether to blend two, is still open and is River's
call); and, in parallel, Codex shipped Steam presence, profile pages, and a
live server player tracker, recorded further down this file.

**Note for whoever reads this next:** the project directory moved during this
session. It is no longer at the "2ndCS History / CSG Archive Project" path
referenced in the old archived sections. It is now:

`C:\Users\thegr\Desktop\Coldstream Gaming\CSG Website\coldstream-codex-data-agent`

Same git remote, same repo, same everything else. Only the folder on disk
moved. If a script or a note anywhere still has the old path baked in, it is
stale for that reason alone, not because anything about the repo changed.

## 2026-08-22 - My read on the four design directions, so it is not only in my head (Claude, River side)

The canvas linked above carries four alternative visual directions on its own
page, each drawn against the same slice of the site so they compare fairly.
Written down here too because a canvas annotation is not something Codex can
read, and the reasoning behind a choice like this should not live only in a
conversation that gets cleared.

**A, Regimental** (navy and brass, serif, heritage played straight): the most
memorable of the four and the only one that earns the 2011 date instead of
hiding it, but it is also the direction most likely to tip into the costume
drama the brief explicitly warns against. Highest risk, highest ceiling.

**B, Field Manual** (IBM Plex, hard grid, one signal green, everything a
readout): this community's whole personality is the archive, and this is the
direction where provenance and live figures stop being clutter and become
the aesthetic itself. It is also the coldest of the four, and the brief asks
for old friends getting together, not a monitoring tool.

**C, Broadcast** (full bleed video, Archivo Black, almost no chrome): the
video only landing page is already a decided requirement, and this is the
only direction that actually commits to that decision rather than working
around it. Most modern of the four, most likely to pull a stranger in. It is
also content hungry: without genuinely good footage behind it, it is an
empty black page, and the 32 preserved films have to be worth the frame they
would be given.

**D, Quiet Modern** (the existing cold grey kept, execution modernised with
soft cards and a real spacing scale): lowest risk by a wide margin, ships
fastest, nothing already built has to be rethought. Also the least
distinctive of the four, and done without care it becomes indistinguishable
from any dark dashboard, which is precisely what the brief says this site is
not.

**My actual read, for whatever it is worth:** B and C are the two with real
conviction behind them, and they are not in tension with each other the way
they first look. C is a front door; B is what sits behind it. A video only
landing in the Broadcast style, opening into a Field Manual style archive and
server tracker, is a plausible combination in a way that just picking one of
the four usually is not. A is the highest ceiling if River wants to gamble on
distinctiveness. D is the safe answer and is fine, but only if it is chosen
on purpose rather than defaulted into because nothing else got picked.

None of this is a decision. It is one opinion, offered because River asked
for it, and it is his call which direction the site actually takes.

## 2026-08-23 - ONBOARDING.md and AGENTS.md merged into one PROJECT.md (Claude, River side)

River asked directly for less usage per session while keeping the actual
substance of the project intact, and to package it so any AI landing here
gets the soul of the project without three files and 500-plus combined
lines to read first.

**What changed.** `ONBOARDING.md` and `AGENTS.md` are merged into one new
`PROJECT.md`: what this is and why the never-invent-a-number rule exists,
the six chapter timeline, the house rules, the stack, repo layout, the
gotchas that have each cost real time, the multi agent claims and lanes
system, and the current priority order. Nothing in it was invented, it is
the same facts the two source files carried, cut down and de-duplicated.

`ONBOARDING.md` is deleted outright. `AGENTS.md` is kept as a one line stub
pointing at `PROJECT.md`, because some tools look for that filename by
convention and a stub costs nothing to read. `CLAUDE.md` and `COWORK.md`
now point at `PROJECT.md` instead of the two old files.

**What did not change.** `HANDOFF.md` stays the append only log, unsplit for
now, at River's call this round. `HANDOFF-ARCHIVE.md` is untouched. The
design canvas link is dropped from the new file: River is reworking the
visual direction directly with the design skill now, so the four earlier
canvas directions are superseded, not current guidance.

**For Codex and any other agent:** the same merge was applied to the
`coldstream-bot` repo as a trimmed `PROJECT.md` there too, carrying the
house rules and project soul plus that repo's own specifics, so both repos
now point new agents at the same short brief pattern.
