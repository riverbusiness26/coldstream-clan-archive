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

## 2026-08-23 - Coordinator session: the nightly backup has never once worked, plus the continuity gaps that hid it (Claude, River side)

### Why this entry exists at all

River asked how a Project Coordinator arriving after him would have
everything it needs, given that he deletes chats to keep usage down. Working
through that surfaced a hole in our own process, and then the hole turned out
to be hiding something real.

The old rule said to append here when you change something. A coordinator
routes work and changes nothing, so it fell straight through that rule and
left no trace at all. Same for any session that reads the tree and concludes
nothing needs doing, or rules an option out. `PROJECT.md` now says to write
back before the session ends even when you changed no files, because a
ruled-out option is a finding and the next agent otherwise pays to rule it
out again.

### The finding that matters

**`.github/workflows/backup-database.yml` has run 59 times and has succeeded
zero times, ever.** Verified against the GitHub Actions API, not inferred:
`?status=success&per_page=1` returns `total_count: 0`. The most recent
failure was run 59 at 2026-08-23T05:04:57Z. Failures go back at least to
21 Aug, five in a row on the first page.

`PROJECT.md` had this as "key still unset", which read like a job nobody had
started. It is worse than that: the job has been running nightly, failing
nightly, and reporting to nobody. `DURABILITY.md` calls the database the weak
link and says losing Supabase costs at most a day once this is running. It is
not running, so that sentence has been false the whole time.

The missing `SUPABASE_SERVICE_ROLE_KEY` repository secret is the likeliest
cause, and DURABILITY.md already documents where it goes. Do not close this
on that assumption. It is not confirmed until a run goes green. Nobody has
read the failure logs yet, and the first job is to read run 32619460912.

I did not fix it. Setting that secret is River's to do, no agent should hold
the service role key, and it bypasses row level security by design.

### What changed in this repo

- `scripts/status.mjs` gained two sections that ask live systems rather than
  trusting prose, which is the whole point of that script.
  - **Checkout**, printed first, because if the tree is stale then every
    other line is being read out of the wrong repository. It checks the
    briefing files are the current `PROJECT.md` set, and compares HEAD to the
    remote. Ahead and behind print differently on purpose: unpushed local
    work is normal mid-session, a tree that is behind is the stale clone
    failure below.
  - **Backups**, which is what caught the 59 failures. It counts successful
    runs rather than looking at the last one, because a green latest run
    would not have caught this either.
  - New `NOTE` marker for what the script could not determine, as against
    what it determined to be wrong. Silence used to mean both, which is
    exactly how the backup sat broken under a screen full of OK.
- `PROJECT.md`: priority 1 rewritten around the above. Priority 4 marked
  shipped, see below. Stale checkout added to the gotchas. Write back rule
  added to the multi agent section.
- I got two things wrong mid-session and both are corrected in place. I said
  the stale clone was three weeks behind, it is one day. I said the backup
  had never run, inferred from the missing `backup/` directory, and the API
  says it has run 59 times and never worked. The inference was lazy and the
  directory was consistent with both stories.

### `/deploy-server` shipped, under a different name

Both `PROJECT.md` files still called it in progress and handed to Codex. It
landed in `coldstream-bot` as **`/games deploy`**, not `/deploy-server`, in
`8a422a6`, with status controls in `98a3867` and a cooldown note in
`605115f`, all on 23 Aug, through `src/lib/pterodactyl.js`. Both files now
say shipped, with hashes, so nobody re-opens it.

### The second checkout of this repo

`CSG History & Archive\2nd Coldstream Guards\CSG Archive Project\coldstream-research`
is a clone of this repo left at the old path when the directory moved on
22 Aug. Same git remote. One day behind, and that day is the one that deleted
`ONBOARDING.md` and gutted `AGENTS.md`, so an agent landing there reads the
exact files River paid to remove, plus a `HANDOFF.md` and a `claims/` of its
own. Every signal it uses to orient itself is present and wrong.

Its working tree is clean, so nothing of River's is stranded in it. It now
carries a `STALE-DO-NOT-USE.md` and a `scripts/status.mjs` that refuses to
run and points here. Those markers are committed locally there and
**deliberately not pushed**: it shares this repo's remote, and per River's
instruction nothing goes up from that clone until the two are reconciled.
Deleting it is River's call and I have not.

### `coldstream-bot` now has a HANDOFF

That repo had `PROJECT.md` and `README.md` and no log, a deliberate call for
a single agent repo. It means the whole record of the Pterodactyl work is
commit messages: the what survives, the why does not. It has a `HANDOFF.md`
now, seeded from what the commits actually show, and its `PROJECT.md` points
at it.

### Still open, in order

1. Read the backup failure logs, run 32619460912. Then set the secret. Then
   confirm with `node scripts/status.mjs`, which will say so.
2. Redeploy the patched `steam-auth`. Unchanged from before: the repo copy
   carries a caught Steam network failure, a checked upsert error and a
   guarded persona fetch. The script proves the function is healthy and
   redirecting, which is not the same as proving the patched build is live.
3. Design, with River, directly.

## 2026-08-23 - Diagnosed the backup failure: it is three missing settings, and DURABILITY.md was documenting a different workflow (Claude, River side)

Follow up to the coordinator entry above. River asked for the actual cause
rather than the assumption I left in it.

### Where it fails, exactly

Run 32619460912, from the public jobs API, which needs no auth even though
the log bodies return 403:

    1 Set up job                 success
    2 Check backup settings      FAILURE
    3 actions/checkout@v4        skipped
    4 Export every table         skipped
    5 Commit if anything changed skipped
    6 Complete job               success

It dies on the config guard, step 2 of 6. The export has never executed, the
backup repo has never been touched, Supabase has never been queried by this
workflow. That is the guard doing its job correctly: it is designed to fail
loudly rather than produce a convincing partial backup.

### My earlier assumption was wrong and so was DURABILITY.md

I wrote that the missing `SUPABASE_SERVICE_ROLE_KEY` was the likeliest cause,
on DURABILITY.md's authority. Reading the workflow itself, it needs three
settings and fails until all three are present:

- `SUPABASE_SERVICE_ROLE_KEY`, secret
- `BACKUP_REPOSITORY_TOKEN`, secret, fine grained, write only to the backup repo
- `BACKUP_REPOSITORY`, **repository variable, not a secret**, `owner/name`

DURABILITY.md said one secret, and said the export writes `backup/*.json`
into this repo. Both wrong. The workflow pushes to a **separate private
repository**, and the header comment says why in as many words: this repo is
public, so writing member identifiers, staff posts or unapproved gallery
uploads here would turn a backup into a data leak. Somebody rewrote the
workflow properly and did not update the durability doc, so the doc has been
describing a job that does not exist while the real one failed nightly.

Corrected DURABILITY.md, PROJECT.md priority 1, and my own `status.mjs`
backup check, which had inherited the same wrong `backup/` assumption from
the doc a few hours earlier.

The variable is the likeliest single trip hazard: `BACKUP_REPOSITORY` lives
on the Variables tab of the same settings page as the two secrets, and put on
the Secrets tab it reads as empty and the guard fails identically. The public
API cannot show which of the three are set, so this is not confirmed until a
run goes green.

### Checked so nobody hits it next

All 17 tables the export names exist and answer 200 to the anon key:
member, roster_entry, board, thread, post, gallery_category, gallery_item,
shout, server_status, news_item, operator, event, event_rsvp, enlistment,
steam_group, steam_group_member, steam_group_snapshot. The export fails the
whole run on any non-ok table rather than saving a partial snapshot, so a
dropped table would have been the next failure after the config. It is not
one. The forum tables are still there despite forums being off the roadmap.

### Left for River, none of it agent work

Creating the private backup repository, generating the fine grained token,
and pasting the service role key are all his. Per the coordinator packet,
creating a repository and making a public or private decision need him
regardless. One thing worth saying out loud: `actions/checkout` cannot check
out a repository with no commits, so the new private repo needs at least an
initial commit, a README is enough, before the first run can pass step 3.

## 2026-08-24 - The nightly backup works. First success in 62 attempts (Claude, River side)

River set the three settings and ran it by hand. Run 62,
2026-08-24T02:19:07Z, all six steps green, all 17 tables exported and
committed to the private backup repository. `node scripts/status.mjs` now
reads `OK nightly backup last succeeded`, where yesterday it read
`CHECK ... has NEVER succeeded`.

The archive's live data has a backup for the first time since the site went
up. Runs 1 to 59 all died on the config guard, so the export had never once
executed, and nothing had ever noticed because nothing ever asked the
workflow how it went.

### The two failures on the way, both now in DURABILITY.md

Runs 60 and 61 failed, and the second one is worth recording properly because
the error is actively misleading.

`actions/checkout` reported `Retrieving the default branch name` then
`Not Found`, twice retried, then fatal. That reads like the repository does
not exist. It is not what it means. **On a private repository GitHub returns
404 rather than 403**, deliberately, so that a credential without access
cannot confirm a repo exists by the shape of the refusal. So "Not Found" and
"your token cannot see this" are indistinguishable from the log.

Worth knowing which things it is NOT, since all three are plausible and all
three are wrong: it is not the missing README, an empty repo gets past this
step and fails later on a missing ref. It is not the Supabase key, that is
step 4. It is not the config guard, that is step 2 and it had already passed.

The real causes, in the order to check them, are in DURABILITY.md now. The
one I would bet on next time is the token's **Repository access** set to
"Public repositories", which cannot see a private repo and fails exactly like
this. Second is a fine grained token created *before* the repository, since
one pinned to selected repositories does not pick up repos made afterwards.

**River did not say which of these it actually was.** If you are reading this
and you know, put it in DURABILITY.md. I have documented the candidates
rather than claim a cause I did not verify.

### Docs corrected, since several were describing a job that did not exist

- `PROJECT.md`: the backup is off the priority list and into a Done section.
  Priority 1 is now the `steam-auth` redeploy, unchanged and still open.
  Also fixed a duplicated entry I introduced yesterday.
- `DURABILITY.md`: the "it is not running" section rewritten around run 62,
  and the failure reading guide expanded with the 404 explanation above.
- The `Token expires:` line is still blank and River needs to fill it in.
  Fine grained tokens cap at 366 days, so the backup now has a date on which
  it stops, and the only question is whether anyone wrote that date down.

### New, added to the priority list

`actions/checkout@v4` and `actions/setup-node@v4` target Node 20, which is
deprecated. GitHub is currently forcing them onto Node 24 and printing a
warning on every run, including the successful backup. When that fallback is
removed they break. Three workflows are affected: `backup-database.yml`,
`house-rules.yml` and `server-status.yml`, and one of those is the backup we
just spent two days fixing. A scheduled breakage that is already printing its
own warning is exactly the failure this project keeps walking into, so it is
on the list rather than in a comment.

### Still worth doing, not blocking

Nobody has looked inside the backup repository yet. `latest/_manifest.json`
carries the row counts per table and the source commit. That is the only real
proof the contents are right rather than merely present, and it is a two
minute check that nobody has done.

## 2026-08-24 - Actions bumped to Node 24, and server-status has been failing for a day (Claude, River side)

### The bump

`actions/checkout` and `actions/setup-node` moved from `@v4` to `@v5` in
`backup-database.yml`, `house-rules.yml` and `server-status.yml`. Both v5
tags resolve to `using: node24`, verified from each action's `action.yml` at
the tag rather than assumed, which is the entire point: v4 targets Node 20,
GitHub has been forcing it onto Node 24 with a warning on every run, and that
fallback goes away eventually.

**Pinned at v5, not the current v7, deliberately.** I checked the release
notes for every major rather than taking the newest:

- checkout v5: Node 24 runtime, nothing else. Minimum runner v2.327.1, which
  hosted runners exceed.
- checkout v6: "Persist creds to a separate file". The backup job checks out
  the private backup repo with a token and then pushes to it from the last
  step, relying on exactly those persisted credentials. That workflow first
  succeeded yesterday after 61 failures. Not today.
- checkout v7: blocks checking out fork PRs for `pull_request_target` and
  `workflow_run`, plus an ESM migration. We use neither trigger.
- setup-node v5: adds automatic caching when `package.json` has a
  `packageManager` field. Harmless here only because `cache: npm` is set
  explicitly, which is why this needed no other change.

Revisit v6 and v7 once the backup has more than one night behind it. The
reasoning is in a comment on the checkout step in `backup-database.yml` so
whoever bumps it next does not have to rediscover it.

`node-version: '20'` in `house-rules.yml` was left alone. It is the Node the
site is built and typechecked with, a different decision from the action
runtime, and changing it risks the build gate every agent depends on. The two
now have a comment explaining which is which, because four adjacent lines
mentioning two different Node versions is a trap.

**Verified:** the push triggered `House rules`, which runs both bumped
actions and is the full gate, em dash scan, secret scan, `npm ci`, typecheck
and build. Green on `ca1e336`.

**Not verified yet:** `server-status.yml` has not run since the bump, and
`backup-database.yml` does not run again until 03:40. The backup's checkout
is also the only one using the cross repo form, with `repository`, `token`
and `path`, so it exercises a path `house-rules` does not. If the 03:40 run
fails at step 3, look at the bump first.

### Separate finding: server-status.yml has failed 25 times running

Found while confirming the bump had not broken anything. **It was already
broken, well before the bump, so do not attribute it to v5.**

- Last success: run 20, 2026-08-22T23:41:02Z
- First failure: run 21, 2026-08-23T00:01:54Z
- Every run since: failure. 20 successes and 25 failures in its history.

A clean break between two scheduled runs twenty minutes apart, which means a
change rather than a flaky server. It dies at step 3,
`node scripts/poll-server-status.mjs`. Checkout and setup pass. The timing
lines up with the entry further up this file where the Holdfast-only poller
was replaced with the multi-server one and Valheim was recorded as not
answering on 2457 or 2456. I have not read the script or the logs, so that is
a lead and not a diagnosis. Log bodies need auth and `gh` is not installed on
River's machine.

The Servers page has therefore been showing stale player counts for a day.

Also worth a look: the schedule is `*/5` but the most recent run is 00:01,
with nothing since, so the five minute cron does not appear to be firing
either. Two problems or one, I do not know which.

### The pattern worth naming

This is the third thing in two days that was broken while every visible
surface looked fine: the backup failing 59 times, the docs describing a
workflow that did not exist, and now a poller dead for a day. In each case
the information was one API call away and nobody made it.

`status.mjs` was extended yesterday to ask the backup workflow how it went,
and that is what caught the backup. It only checks that one workflow. The
same few lines pointed at all five would have caught this a day ago, and will
catch the next one. That is the obvious next job and I have not done it,
since River asked for the bump and this was already a detour.

## 2026-08-24 - status.mjs now asks every workflow, and two more were quietly broken (Claude, River side)

The Backups section became a Workflows section. It lists the workflows from
the API rather than from a list in the script, so adding one to
`.github/workflows` is enough and there is nothing here to keep in step.

Per workflow it reports the last run, its age, and the cron if it has one. On
a failure it also asks how many times that workflow has ever succeeded, which
is the question that caught the backup: 59 failures showed up nowhere,
because nothing was red that had ever been green.

Two failure modes it now catches that nothing did before:

- **A workflow GitHub has switched off.** `state` other than `active`, which
  includes `disabled_inactivity`, GitHub disabling scheduled workflows in a
  quiet repository. From the outside that is indistinguishable from fine.
- **A schedule that has stopped firing.** Distinct from a run that fails, and
  invisible everywhere a person would look.

### What it found the first time it ran

- `server-status.yml`, already known, failing since 23 Aug.
- **`steam-presence.yml` has stopped running.** Last run 2026-08-24T00:01:31Z
  and nothing since, against a `*/5` schedule. It is not failing. It is not
  running. Steam presence on the site has been stale for hours and this was
  the first thing to notice.

Both stalled workflows are the `*/5` ones and both stopped at the same 00:01,
while `backup-database.yml` on a daily cron fired normally. So this looks like
the five minute schedules specifically, not the repository. GitHub does drop
frequent scheduled runs under load, which is why the tolerance here is six
missed slots rather than one, but two and a half hours of nothing from both
is past that. **I have not diagnosed it, only found it.**

### A false positive I shipped and caught

The first version read `17 6 */3 * *` as daily and reported
`supabase-keepalive.yml` as stalled at 43 hours. It runs every third day and
was perfectly healthy. Fixed by reading the step syntax in the minute, hour
and day fields rather than only the minute.

Worth saying plainly because the whole value of this script is the line at
the bottom promising that CHECK means something. One wrong CHECK and the next
person starts skimming past them, which is how the backup went unnoticed
through 59 red runs. A check that cries wolf is worse than no check.

### Still unverified

`backup-database.yml` has not run since the v5 bump. Its last run is 62 at
head `5cd6a6e`, which predates it, and the nightly is at 03:40. Its checkout
is the only one using the cross repo form with `repository`, `token` and
`path`, so `house-rules` passing does not cover it. If tonight's run fails at
step 3, look at the bump first.

## 2026-08-24 - COORDINATOR.md, and the role prompt at v2.0 (Claude, River side)

River is clearing this chat and starting a fresh coordinator. This is the
handoff, written so the next one can start routing without reading four files
first.

`COORDINATOR.md` is new, at the repo root, in two halves. The first is the
role prompt River pastes into a fresh agent, now versioned at **v2.0**. The
second is the project state as of 03:00 UTC today, explicitly marked as the
half that goes stale, with the instruction that the prompt wins if they ever
disagree. `PROJECT.md` points at it in the opening lines.

### What v2.0 changes, and why each one is there

Every change below is something that actually cost time in the 23 to 24 Aug
sessions, not a tidy-up.

- **`status.mjs` moved from step 4 to step 1.** Reading four files out of a
  stale checkout wastes all four, and the script checks its own tree before
  reporting anything.
- **Repo paths written into the prompt.** The v1.0 coordinator's first action
  was asking River where the repos were, because the working directory is not
  a git repo and the prompt did not say.
- **The Brief Packet format written out in full.** v1.0 referred to "the
  format in the operating system artifact", which was not reachable, so the
  format got invented on the spot and would have drifted every session.
- **"Never trust prose" promoted to its own section.** Three separate things
  in two days were documented as one state while being in another.
- **The write back rule.** A coordinator changes no files, so the old "log
  what you changed" rule never applied to it and those sessions vanished.
- **Git, claims and approval gates added.** v1.0 said nothing about any of it.
- **The stale clone named explicitly**, since every signal inside it looks
  correct.

### One more false positive caught before it shipped

While capturing the final state for the briefing, the new workflow check
reported `house-rules.yml` as failing when it was merely queued. A run in
flight has no conclusion yet. Fixed: anything not `completed` now reports as
a NOTE saying it is running, not a CHECK.

That is the second false CHECK in one sitting, after the three day cron read
as daily. Both were caught only because the output was read carefully rather
than skimmed, which is itself the argument for keeping CHECK rare and true.
The footer promises CHECK is a real finding. That promise is the entire
value of the script and it is one wrong line from worthless.

### State at handover

Green: site, TLS, Steam sign in, the database tables, and the nightly backup,
which succeeded for the first time in 62 attempts yesterday.

Open: `server-status.yml` failing since 23 Aug at the poller step, both `*/5`
crons stopped firing at 00:01 and undiagnosed, the patched `steam-auth` still
not redeployed, design with River.

Waiting on River alone: the token expiry date in `DURABILITY.md`, the fate of
the stale clone, and somebody actually opening `latest/_manifest.json` in the
backup repo to confirm the contents rather than the fact of the backup.

Unverified: `backup-database.yml` has not run since the `checkout@v5` bump.
Its cross repo checkout is not covered by `house-rules` passing.

## 2026-08-24 - the nightly backup has still never run green (Claude, coordinator session)

No files changed except this one and `COORDINATOR.md`. This is a verification
session: everything below is a live API read, and it contradicts the handover
written three hours ago on the item that handover called its best news.

### The correction that matters

**`COORDINATOR.md` listed the nightly backup under "Green, verified this
session". That is wrong, and I wrote the line I am correcting.**

Run 62, the celebrated first success in 62 attempts, was a
**`workflow_dispatch`**, not a scheduled run. Read from
`/actions/workflows/backup-database.yml/runs`:

| Run | Trigger | Head | Result | When |
|---|---|---|---|---|
| 62 | `workflow_dispatch` | `5cd6a6e` | success | 2026-08-24T02:18:47Z |
| 61 | `workflow_dispatch` | `5cd6a6e` | failure | 2026-08-24T02:13:22Z |
| 60 | `workflow_dispatch` | `4f239b7` | failure | 2026-08-24T01:55:53Z |
| 59 | `schedule` | `1ac0003` | failure | 2026-08-23T05:04:57Z |

So the last *scheduled* run, 59, failed, and **no run on the `40 3 * * *`
cron has ever succeeded.** A person reading `status.mjs` sees
`OK backup-database.yml succeeded 31m ago, on '40 3 * * *'` and concludes the
nightly works. The line is factually true and the conclusion is false. This is
the project's own named trap, "a green latest run proves nothing", surviving
the very check that was written to catch it.

### Two things that follow from the same table

**Runs 61 and 62 share head `5cd6a6e`.** Same commit, five minutes apart, one
red and one green. Nothing in the repository fixed this. The change was
environmental, a secret or the `BACKUP_REPOSITORY` variable being set between
the two. Do not go looking for the commit that fixed the backup. There isn't
one.

**The `checkout@v5` question is still open, and is now the live risk.**
`ca1e336` is the bump. Run 62 is at `5cd6a6e`, which `git log` puts *before*
`ca1e336`. So the only green backup run predates the bump, exactly as the
previous entry flagged, and the green line in `status.mjs` makes that look
closed when it is not. The 03:40Z run tonight is the first that will exercise
the cron path and the v5 cross repo checkout together. If it fails at step 3,
the bump is the first suspect.

### server-status.yml, one real correction to the lead

Failing step confirmed from the public jobs API, no auth needed: step 3,
`Query public development game servers`, which is
`node scripts/poll-server-status.mjs`. That much matches what was recorded.

But every failing run, 40 through 45, has head **`d202846`**, and the jobs API
shows them running **`actions/checkout@v4`** while the file at `HEAD` says v5.
So all 25 failures are one stale commit. Roughly twenty commits have landed
since and **not one of them has ever been exercised by a scheduled run**,
because the cron stopped at the same time the evening's commits started
landing. Nobody has yet seen this workflow fail at current code.

`d202846` is "merge ONBOARDING.md and AGENTS.md into one PROJECT.md", a docs
commit. It is the head at run time, not a cause. The multi server poller lead
still stands and is still a lead.

**Cheapest next move, and it needs no secret.** The workflow passes only
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It does not pass
`GAME_SERVERS_JSON`, so the script falls through to `DEFAULT_SERVERS` at line
44. If it dies while querying, it dies before it needs the key, so
`node scripts/poll-server-status.mjs` reproduces it locally with dummy
credentials. 318 lines. Nobody has read it. That is still true after three
sessions of writing about it.

### The */5 crons, framing corrected

Still stalled: both last ran 2026-08-24T00:01:2xZ and neither has run since,
2h49m at the time of writing against a longest prior gap of 51 minutes. Real,
and `status.mjs` is right to flag it.

But the schedule has never behaved as `*/5`. Actual intervals across runs 40
to 46: 20:54, 21:41, 22:01, 22:52, 23:40, 00:01, so twenty to fifty minutes,
not five. GitHub throttles high frequency crons in a quiet repository. Anyone
diagnosing this should be explaining a stopped schedule, not a slow one, and
should not treat the twenty minute gaps as the anomaly.

### Verified green, by live read this session

Site serving, www to apex guard, Steam sign in redirecting with the realm
correct, all six tables answering, `member` at 1 row. `house-rules.yml`
passing. `supabase-keepalive.yml` healthy on its three day cron.

### Unverified, flagged not assumed

I did not open `latest/_manifest.json` in the backup repository. It is private
and `gh` is not installed. So run 62 proves the job exited zero. It still does
not prove a single row was written, which is the third session in a row that
this has been true.

### Addendum, 24 Aug 02:57Z: the backup cron fires 83 minutes late

Checked for tonight's run and it had not fired. Before calling that a stall, I
asked what time this cron actually lands. Filtering the runs API to
`event=schedule` gives every scheduled run this workflow has ever had:

| Run | Fired | Late vs `40 3 * * *` |
|---|---|---|
| 59 | 2026-08-23T05:04:57Z | +84m |
| 58 | 2026-08-22T05:02:05Z | +82m |

**The nightly lands at roughly 05:02 to 05:05Z, not 03:40Z.** Anyone checking
at 04:00Z will see nothing and conclude the cron has stopped. I wrote a brief
telling River to watch 03:40Z and that is exactly the false alarm it would
have produced.

`event=schedule` also returns a total of **2**. Sixty of the 62 runs are pushes
and manual dispatches. That is not itself a finding, the workflow only appeared
around 21 Aug so two nights have elapsed, but it is the honest framing: the
nightly has had two chances and failed both, and tonight is the third.

**This connects to the `*/5` stall.** One repository, and its daily cron is 83
minutes late while its five minute crons were firing at 20 to 50 minute gaps.
That is one phenomenon, GitHub delaying scheduled work here heavily, not two
unrelated ones. The `*/5` workflows going quiet may be that same delay
deepening rather than a distinct break, which is a cheaper hypothesis than the
ones currently written down and should be ruled out first.

**Consequence for `status.mjs`.** Its staleness tolerance is measured off the
cron expression, and this repository's real delay is 83 minutes on a daily. A
tolerance that does not account for that will eventually print a CHECK for a
healthy workflow, which is the one thing that ruins the script. Not changed
here, flagged for whoever next touches it.

### Addendum, 24 Aug: nothing is actually off Node 20

River raised the Node 24 migration. Checking it disproved a commit message in
this repo's own history, so it is recorded here rather than left to be
rediscovered.

`ca1e336` says "bump checkout and setup-node to v5, **off deprecated Node 20**".
**Nothing is off Node 20.** `house-rules.yml` line 124 still reads
`node-version: '20'`.

The bump conflated two different things. `setup-node@v4` to `@v5` changes the
Node **the action itself** runs on. `node-version:` is the Node **our code**
runs on. The bump moved the first and left the second at 20.

| Workflow | setup-node | Node our code runs on |
|---|---|---|
| `house-rules.yml` | v5, `node-version: '20'` | pinned to 20, explicitly |
| `backup-database.yml` | none at all | runner default, unpinned |
| `server-status.yml` | none at all | runner default, unpinned |

Two of the three pin no Node version anywhere. The backup's
`node - <<'JS'` heredocs and `node scripts/poll-server-status.mjs` both run
whatever the runner image ships. **I did not verify which version that is and
did not guess it**, because the finding holds either way: it is unpinned, so
GitHub can change it with no commit on our side, and the export would start
running on a different runtime overnight with nothing in the repo to show it.

GitHub's fall 2026 forced migration moves action runtimes automatically. It
will not touch a `node-version: '20'` pin and it will not announce a change to
the runner's bundled Node. So the migration will make this repo *look* handled
while both unpinned workflows drift and `house-rules` stays on 20.

### Order this should be done in, and why not all at once

1. `house-rules.yml` to `'24'`. Runs on every push, immediate feedback, no data
   at risk, and it is the line that contradicts `ca1e336`. Its `cache: npm`
   interacts with setup-node v5 auto caching, already noted at line 119 as
   harmless, so just confirm the cache key rolls cleanly.
2. `server-status.yml`, add setup-node pinned to 24. It is 25 runs deep in
   failure, so changing it costs nothing.
3. `backup-database.yml`, **not tonight.** Its own comment says it first
   succeeded after 61 failures and is not the place to change the mechanism it
   runs on. Tonight's ~05:03Z run is the first time the cron path and
   `checkout@v5` are exercised together. Adding Node 24 now means a failure
   cannot be attributed. The deprecation runs to fall 2026, so one night costs
   nothing and buys a clean signal on the most valuable workflow here. Add it
   after, with no cache, and prove it by `workflow_dispatch` before trusting
   the cron, which is how run 62 was proven.

Leave `checkout@v5` alone in the backup. v6 relocates the persisted git
credentials that its final push step depends on.

## 2026-08-28 - server-status was one unapplied migration, and the site is on the 2ndCS skin (Claude, River side)

Two jobs this session: close the loose ends `status.mjs` was flagging, and
start the rebuild against `CSG Graphics/2ndCS-mockup`.

### server-status.yml: diagnosed, and it is not the script

Three sessions of notes said nobody had read `poll-server-status.mjs`, so I
ran it. It is not the problem. It queries the servers fine and dies on the
last line, at the upsert.

**`server_status.player_names` does not exist on the live database.**
`0020_server_player_tracker.sql` adds it and has never been applied. The
script gained the field in Codex's 22 Aug tracker pass and has been posting a
column the table does not have ever since.

Proved by live query, not by reading:

```
select=server_key,player_names  ->  400 42703 column server_status.player_names does not exist
POST with player_names          ->  400 PGRST204 Could not find the 'player_names' column
```

The dates line up exactly. `server_status` last wrote at
`2026-08-22T23:40:58Z`; `status.mjs` reports the last workflow success at
`2026-08-22T23:41:02Z`. Same event. Everything since has been this 400.

Note for anyone testing this: **PostgREST checks the column before it checks
the key**, so the anon key reproduces it perfectly. You do not need the
service role key to work on this.

**The fix River has to run** is one line, in the Supabase SQL editor:

```sql
alter table server_status
  add column if not exists player_names jsonb not null default '[]'::jsonb;
```

That is the whole of `site/db/0020_server_player_tracker.sql`. It is already
inside `RUN_ME_next.sql` too, so running that file also does it.

**What I changed in the meantime.** The script now catches exactly this error
and retries once with `player_names` stripped. Losing player names is bad;
losing the counts and the online flags as well, which is what the hard failure
was doing, is worse, and the counts are what the site actually renders. The
retry matches on `PGRST204` **and** the column name, so unrelated schema drift
still fails loudly instead of being quietly written round. It warns with the
migration path when it fires. Once River runs the SQL the branch stops firing
on its own and names start storing, with no second deploy.

Verified end to end by pointing the script at the anon key: it logged the
warning, stripped the field, and the retry got past the schema check to a
plain `42501 permission denied`, which is the correct wall for anon. With the
service role key in Actions that retry succeeds.

### steam-presence.yml: narrowed, not solved, and here is the one command

Not fixed. What is now ruled out, by live probe:

- The function is up. No secret returns 401, a wrong secret returns 401. It is
  running and its secret check works.
- All three tables it writes exist and hold rows: `steam_presence`,
  `steam_recent`, `game_stats`. This is **not** another missing migration.
- The workflow file did not change. It is pure `curl`, no checkout and no
  setup-node, so the 24 Aug Node bump cannot have touched it.

It succeeded at `2026-08-24T00:01:31Z` and has failed since, so something
changed on the function's side, not ours. The public jobs API confirms the
failing step is "Refresh who is online". Logs need auth and `gh` is still not
installed here.

**Do not guess at this. The function returns a descriptive JSON body for every
failure**, so one authenticated call ends it:

```
curl -sS "https://zcpbpcktinlqnxmqddzc.supabase.co/functions/v1/steam-presence?secret=$SYNC_SECRET"
```

Read what comes back against `site/supabase/functions/steam-presence/index.ts`:
`STEAM_API_KEY is not set` is a 500 at line 77, `steam returned nothing for
any batch` is a 502 at line 150 and means the Steam key has stopped working,
and a 401 means `SYNC_SECRET` in the repo no longer matches the one on the
function. My money is on the Steam key, because that is the only ingredient
here that expires on its own, but I did not verify it and nobody should write
it down as fact until they have.

### The rebuild: the site is on the 2nd Coldstream skin

`site/src/styles.css` is rewritten against `CSG Graphics/2ndCS-mockup`. Near
black ground, scarlet and gold, Cinzel for names and Source Sans 3 for prose.
The old locked design, OG Steam chrome in neutral monochrome, is gone.

**Every class name survived, so not one `.tsx` file changed.** I diffed the
selector set old against new and it is identical. This was deliberate: the
data layer, the auth flow and the fifteen years of hard won layout fixes are
untouched, and the only thing replaced is the skin. The two mobile overflow
comments in the old sheet are carried over verbatim, along with the reasoning
on the gallery's justified rows.

Three rules from the mockup, written at the top of the file so the next person
extends it rather than drifting off it:

1. Flat. No bevels, no 180deg gradients on chrome. The old sheet drew depth
   with light and dark edges; this one draws it with space.
2. Gold names the thing, scarlet marks the live thing. `--accent` was white
   and is now gold, which is the one substitution that does most of the work.
3. Tracking is the texture, not weight.

Green survives in exactly one job, liveness, because "online" cannot be gold
or scarlet without reading as chrome. It is pulled toward the palette as
`--live: #8aa85a` rather than Steam's brighter green.

**The fonts are self hosted, and that was forced.** `_headers` sets
`font-src 'self'` and `style-src 'self' 'unsafe-inline'`, enforcing since
21 Aug, so a Google Fonts stylesheet and its font files would both be blocked.
Widening a policy that a previous session deliberately tightened, in order to
admit two typefaces, is the wrong trade when `'self'` already allows this. So
both faces live in `site/public/fonts` as single variable woff2 files, latin
subset, about 26KB each, declared with the weight axis as a range so 300, 600
and 700 are real instances and not synthesised. Both are SIL OFL 1.1, which
permits this. **No `_headers` change was needed and none was made.**

Verified in a browser against the dev server, not by eye over the source:

- `tsc -b && vite build` clean, no console errors on any route.
- Tokens resolve: ground `#0b0c0e`, accent `#c6a35a`, scarlet `#9e1b2e`.
- Both faces fetch 200 as `font/woff2` at the right byte counts, and
  `document.fonts.check` passes for both.
- Zero elements anywhere still computing to Tahoma.
- All five routes render every module, at desktop and at 375px.
- **No horizontal overflow on any route at 375px**, which is the regression
  that matters most here and the one the old sheet has two long comments
  about.

### Not done, and deliberately

`Landing.tsx` still uses the parent Coldstream Gaming wording. The mockup is
the 2nd Coldstream Holdfast lane and its own README says it is "not parent CSG
chrome", so the copy is a separate decision from the skin and it is River's,
not mine. The skin is applied to the parent site; nobody has said the parent
site should start calling itself the 2nd Coldstream.

**Superseded: this is committed, pushed and live.** See the publish entry at
the foot of this file for how publishing here actually works.

## 2026-08-28 - Front page rebuilt, and the skin moved to the house brand (Claude, River side)

River pointed at `Desktop/Site refs/website` and asked for four things off the
front page, plus a home page that fits the community. All four are gone and
the site now wears the parent brand, not the 2nd Coldstream one.

### The skin is the Visual Direction sheet now, not the 2ndCS mockup

`Site refs/website/CSG Visual Direction.png` is a real brand sheet, and it is
the parent community's, not the Holdfast regiment's. Ground `#121416`, panel
`#1B1F22`, ink `#E8EAE6`, muted `#9AA19A`, **brass `#B08D57` as the only warm
colour**, frost `#C5D0D8`, navy `#1A2740`. Cormorant Garamond for display,
Satoshi for UI. "Established. Welcoming. Built to last."

**Scarlet is gone.** Earlier this session I skinned the site from the
`2ndCS-mockup`, whose own README says it is "not parent CSG chrome". I flagged
that mismatch at the time and this settles it: the parent site wears the
parent brand. The `--scarlet` / `--scarlet-hot` variables still exist and are
brass values now, because they were doing a real job (left edge marker, hover
wash, primary fill) and renaming them would have touched forty rules for no
gain. That is deliberate, and it is commented at the token block.

**One judgement call worth knowing about.** The sheet calls `#0A0C0D` "Line",
which is *darker than the ground*. Used as a card border that reads as an
inset seam, and every mockup beside the sheet clearly draws a **lighter**
hairline around cards. So both exist: `--line: #262b2f` is the visible
hairline nearly every rule wants, and `--seam: #0a0c0d` is the sheet's value
for where two panels genuinely meet. If a designer says the borders are wrong,
this is the line to argue about.

Green is gone too. The brand has none, so "online" is frost.

### Fonts: four Satoshi cuts and one Cormorant, all self hosted

Same reasoning as the last entry and it still binds: `_headers` enforces
`font-src 'self'`, so neither Google nor Fontshare can be linked. Cormorant
Garamond is one variable file, 37KB, axis declared as a range. **Satoshi has
no variable webfont**, so it is four static cuts at ~25KB each, and only the
four weights this site sets. Cormorant is OFL 1.1; Satoshi is the Indian Type
Foundry Free Font Licence, which permits self hosting. The Cinzel and Source
Sans 3 files from earlier today are deleted. No `_headers` change was needed.

### The front page

Off, all four as asked: **the news blurb, the shoutbox, the next event module,
and the Join tab.** The bundle dropped 17KB.

On, and the rule behind it is that every block answers one question a visitor
actually asks:

| block | question |
|---|---|
| hero, the crest artwork | who are you |
| The Games | what do you play |
| Discord + who is on Steam | is anyone about |
| Servers, live | can I play tonight |
| The Numbers | are you for real |

The hero is `we're back.png` from the refs, resized to 1536 wide and encoded
to 266KB (`public/hero-csg.jpg`). It earns the space: one badge over medieval,
Napoleonic, modern and science fiction at once says "we have played all of
this" faster than any paragraph.

The Games is four rows, and **the wording is River's own, lifted from
`artwork.png`**, not written here. It is a list rather than cards on purpose:
cards turn a record into a storefront. Full run of games stays in the Archive.

Nothing on the page is placeholder copy and nothing invents data. Modules that
have nothing say so.

### Nav, and the one thing I did not do

Nav is now **Home, Gallery, Servers, Archive**. Join is gone.

**The reference mockups show a fifth item, Events, and I left it out.** In
this codebase `#/events` already routes to the Archive, so adding it would put
two labels on one destination, which is worse than a missing tab. If River
wants Events in the nav it needs its own view first: `views/Calendar.tsx`
exists and is currently routed to nothing, so that is where to start.

`views/Enlist.tsx` and `components/Shoutbox.tsx` are now orphaned. Left on
disk rather than deleted, because "off the front page" is not the same
instruction as "delete the enlistment flow", and `#/enlist` falls through to
Home so no old link 404s.

### Verified live, not by eye

Build clean, **no console errors on any route**. Brand tokens resolve, both
families report `document.fonts.check` true, hero art loads. Nav is the four
items. News, shoutbox and next event are absent from the DOM, not merely
hidden. All four routes render every module with **no horizontal overflow**,
which is still the regression that matters most here.

**Superseded: pushed and live.** See the publish entry below.

## 2026-08-28 - How this site actually publishes, because I got it wrong first (Claude, River side)

River said push. I pushed, and **the live site did not change.** Recording
this because the mistake is easy to repeat and `status.mjs` is the only thing
that caught it.

### The root IS the site. `site/` is source. Nothing builds on push.

`wrangler.jsonc` sets the assets directory to `./`, the repository root, and
`.assetsignore` excludes `/site/`. So:

| path | what it is |
|---|---|
| `index.html` + `assets/` at the **root** | the published site |
| `site/` | React source, **never served** |
| `site/dist/` | build output, and **gitignored** |

There is no build step on push and no Pages build configuration doing it for
us. **Publishing is a manual copy**: build in `site/`, then copy
`site/dist/index.html`, `site/dist/assets/*` and any new files from
`site/public` into the repository root, and commit those too.

The phrase "push based publish" in the 21 Aug entry is true but misleading. It
means Cloudflare picks up whatever is at the root when you push. It does
**not** mean anything gets built.

My first push, `a0f2f5e`, changed only `site/`, so it published nothing.
`status.mjs` kept saying `domain serves index-BquWNC3O.js`, the pre-session
bundle, and it was right. `ecb8270` is the commit that actually shipped.

**Anyone changing the site: your work is not live until the root changes.**
The cheapest check is the one `status.mjs` already does, and the asset hash in
it is the whole answer. If the hash did not move, neither did the site.

### The publish, verified against the domain and not against localhost

Live at `https://coldstreamgaming.com`, reading the real page:

- `assets/index-B-oo8mWO.js` serving, so the root moved.
- `hero-csg.jpg` 200, 266KB. `fonts/satoshi-400.woff2` 200, 25KB.
- **Both families report `document.fonts.check` true on the live origin**,
  which is the real proof that self hosting was the right call: the enforcing
  `font-src 'self'` accepts them, where a Google or Fontshare URL would have
  been blocked in production and nowhere else.
- Brand tokens resolve, `--accent` `#b08d57`, `--ground` `#121416`.
- Nav is Home, Gallery, Servers, Archive. News, shoutbox and next event are
  absent from the DOM. No horizontal overflow.

Old asset hashes were left at the root rather than pruned, matching what
earlier publishes did: a page cached mid-deploy still resolves its bundle. The
root now carries three generations. Worth pruning one day, not today, and not
without checking nothing still points at them.

### Two colours the brand move missed, now fixed

`site/index.html` still had the 2ndCS palette in its `theme-color` meta and
its `noscript` fallback: ground `#0b0c0e`, gold `#c6a35a`. Those two only ever
render in browser chrome and with JavaScript off, which is exactly why neither
the build nor a page load would have shown them. House brand now.

### Still open, and neither is mine to close

- **`player_names`.** The one line SQL is still unrun, so `server-status.yml`
  is still red. The poller no longer dies on it, but names are not storing.
- **`steam-presence.yml`.** Still needs one authenticated curl to read the
  function's own error body. Nobody should guess at this; the answer is one
  command away for whoever holds `SYNC_SECRET`.

## 2026-08-28 - The Archive gets the record room treatment, and the roster was already in it (Claude, River side)

River: "move the roster to the archive site, use the same art style on the
archive site, reference the archive pictures in the folder."

### Two things that were not what they looked like

**There is no separate archive site.** The folder that looks like one,
`CSG History & Archive/2nd Coldstream Guards/CSG Archive Project/coldstream-research`,
is a **clone of this same repository**: same remote, same CNAME, and it
carries its own `STALE-DO-NOT-USE.md` saying so in the first line. I did not
touch it. Anyone who reads "the archive site" as a second property will land
there and start editing a checkout that can never publish. It means the
Archive page of coldstreamgaming.com.

**The roster was already in the Archive.** `<Roster />` renders inside
`views/Archive.tsx`, and the footer link has pointed at `#/archive` since
whoever moved it left the note in `App.tsx` about old `#/members` links. So
there was nothing to move and nothing moved. Confirmed on the live domain:
the Archive runs twelve sections and The Roster is the fourth, 384 rows.

### What the refs actually added

`CSG Archive.png` and `artwork.png`, applied and scoped to a `.recordroom`
class so no other view shifted:

- **A page title.** "The Archive" over "The record room." The Archive is the
  one page that is about the record rather than about tonight, so it gets a
  header in its own right instead of arriving as another module.
- **Section marks on the page, not on a box lid.** The brass chevron from the
  refs, pointing back the way you came, which on an archive reads as earlier.
- **Numbers that say where they came from**, reordered to label, figure,
  source. The refs put a provenance line under every count and they are right
  to: a bare number on an archive page is a claim, and this is the page where
  every claim is supposed to name its source.

  **I did not copy the refs' wording here.** They read "SOURCED: CSG
  CHRONICLE". There is no CSG Chronicle in this repo, and stamping an
  invented masthead under four numbers on the one page whose entire promise
  is provenance would have been the worst possible place to make something
  up. The lines say what the seeds actually are.
- **River's own line from `artwork.png`** as a pull quote: "We keep the
  nights. We do not keep a scoreboard." It states the editorial rule the page
  already follows, so it belongs on the page.

### Deliberately not done, because it needs art that does not exist

The refs show a **shield glyph on every roster row** and a **filing cabinet
drawer** treatment for the four archive categories. Both need real assets.
Approximating them in CSS would have read as a worse version of the mockup
rather than a faithful one, so they are left out and flagged rather than
faked. If River wants them, the ask is for the drawer and shield art.

### Verified on the live domain

Published as `115e8ee`, root updated in the same commit this time rather than
as an afterthought. Live at coldstreamgaming.com, read off the real page:

- `assets/index-VVl2wb28.js` serving, so the root moved.
- Page title in Cormorant Garamond, subtitle present, chevron rendering
  `««` in brass `rgb(176,141,87)`, stat children in `l` `n` `src` order,
  pull quote present.
- Twelve sections, The Roster among them at 384 rows.
- No page level horizontal overflow at desktop or 375px. The roster table
  does extend past a phone viewport, and that is correct: it lives in
  `.tscroll` and scrolls inside its own box, which is the behaviour the two
  long comments in styles.css exist to protect.

## 2026-08-28 - The roster opens by year, and my overflow test was wrong (Claude, River side)

### The roster is shut until you pick a year

River's call, and the reason is plain once you see it: 384 names arriving at
once is a wall, not a record. It could not be read, and it buried every other
section on the Archive under a mile of scroll.

The years are the way in now. Pick one and its people expand underneath; pick
the same one again and it shuts.

**Two escape hatches, because closed by default must not mean unreachable.**

- **Search is always visible, and with no year picked it looks across every
  year.** Somebody who knows a name should not have to guess which year that
  person joined in order to find them. This is the one that would have made
  the feature actively worse if it had been left out.
- **"All years" is still there**, moved to the end of the row. The wall of 384
  is now something a member opts into, not something they land on.

Year chips carry their own count (2011 is 96, 2012 is 93, 2013 is 36). Without
it the closed state is a row of bare years with nothing to tell them apart,
which makes picking one a guess. The game filter only renders once there is a
list for it to filter, rather than floating above an empty panel.

Verified on the live domain: closed shows 0 rows and the prompt, 2012 expands
to 93, clicking it again collapses, and searching with no year picked returns
211 across all years.

### Correction: how I was testing horizontal overflow was wrong

**Every "no horizontal overflow" claim I made earlier in this session was
measured against `window.innerWidth`, and in this browser pane that returns
the scroll width rather than the viewport.** So the comparison was
`scrollWidth > scrollWidth + 1`, which is false by construction. It could
never have caught a real overflow. The conclusions happen to have been right,
but the test was not evidence and I should not have reported it as such.

**Use `documentElement.clientWidth`**, and better still, prove it by trying to
scroll:

```js
const de = document.documentElement;
de.scrollLeft = 9999;              // then read it back
// stays 0  ->  the page genuinely cannot scroll sideways
```

Re-tested properly at 375px on the live site: `body` measures exactly 375,
`visualViewport` 375 at scale 1, `scrollLeft` will not move off 0, and no
element outside a `.tscroll` box extends past the client width. **No
horizontal overflow, now actually demonstrated.**

Note for whoever tests next: with the pane emulating 375, `scrollWidth`
reports 423 while `clientWidth` reports 375. That gap is the emulation, not
the page. The scroll attempt is the test that does not lie.

## 2026-08-28 - The lineage page: the mojibake was never in the file (Claude, River side)

River asked to clean up `/lineage/`, match it to the site, get rid of the
"weird characters like a-hat-euro", and drop one paragraph. Three of those
four were the same bug.

### The characters were correct. The declaration was missing.

**Do not find-and-replace mojibake in this repo.** `lineage/index.html` is
valid UTF-8 and always was: `e2 80 9d` is a real right double quote, `e2 80
94` a real em dash. `file` reports UTF-8. What the page did not have was any
charset declaration at all, and the origin serves it as:

```
Content-Type: text/html
x-content-type-options: nosniff
```

No `; charset=utf-8`, and `nosniff` on top. So the browser fell back to the
locale default, Windows-1252 on a US Windows machine, and rendered every
multi-byte sequence as the a-hat-euro soup River was seeing. **The fix is one
`<meta charset="utf-8" />`.** Replacing the characters would have destroyed
correct data and left the actual cause in place for the next file.

Live now: `document.characterSet` is UTF-8 and **76 curly quotes and em dashes
render as themselves, mojibake count zero.**

If another static page here ever shows the same soup, check for the meta tag
before you touch a single character.

### It was also in quirks mode

The file was a bare fragment: no doctype, no `<html>`, no `<head>`, no
`<body>`. Browsers render that, but in **quirks mode**. Now wrapped properly,
and `document.compatMode` reads `CSS1Compat` on the live page.

### The Google Fonts on this page have been dead since 21 August

The page linked Saira Condensed, Newsreader and IBM Plex Mono from
fonts.googleapis.com. **`font-src 'self'` and `style-src 'self'` have been
enforcing since 21 Aug, so all three were blocked in production the entire
time** and every visitor has been reading it in fallback system faces. Nobody
noticed because it fails silently and looks merely plain.

Removed, and the page now self hosts the same woff2 files the app already
ships at `/fonts/`. It is using the brand faces for the first time.

### Style

Dark only, matching the rest of the site. It was light by default with a
`prefers-color-scheme` override and a `data-theme` override; both are gone
rather than left to rot. All 15 font declarations point at tokens.

`--scarlet` is brass and is the general accent. The other four era colours,
`--union` `--midnight` `--nox` `--roar`, stay distinct and only come down in
saturation to sit on a dark ground: telling 21stPA from RoaR from Nox Viator
is real work that colour is doing on this page, and flattening them all to
brass would have cost information to gain tidiness.

Paragraph beginning "The community has not always told the same story about
the month" removed as asked.

### Verified

Before pushing, against a local server that reproduces the origin exactly
(`text/html`, no charset, `nosniff`) rather than against a dev server that
would have quietly sent `charset=utf-8` and hidden the whole bug. Then again
on the live domain: UTF-8, standards mode, zero mojibake, both families
loaded, no Google font links left, **no console errors and so no CSP
violations**, and at 375px the body measures exactly 375 and will not scroll
sideways.

## 2026-08-29 - The gallery rebuilt: one viewer, uncropped plates, and a bug that had shipped (Claude, River side)

River picked the layout from his own ref, `Site refs/website/games.png`: the
record on the left, members in a rail on the right under one button. What went
with it was the plumbing underneath, because building that composition on top
of the old mechanics would have shipped the following into a new design.

### The lightbox was reading out of the wrong array, and had been

`views/Gallery.tsx` rendered the year filtered list:

```tsx
{shots.map((s, i) => <button onClick={() => setLightIdx(i)} ...
```

and then resolved the open plate out of the unfiltered one:

```tsx
const light = lightIdx === null ? null : SHOTS[lightIdx];
```

So with a year picked, clicking the second plate opened the second plate of
all twelve, and the arrow keys and the thumbnail strip indexed into different
arrays besides. It only looked right on "All years", which is the default, and
that is why nobody caught it.

**The fix is structural, not a patched index.** `components/PlateViewer.tsx`
takes the list that was rendered plus an index into that same list, so
`list[i]` is the thing that was clicked by construction and no future caller
can reintroduce this. Every tile on the page passes its own list: the record
passes the year filtered set, the wall passes the filtered set, the rail passes
the approved set.

Verified: filtered to 2012, eight plates, clicked the second, and the viewer
opened "Bayonets levelled, colour raised", which is the second of the eight.
Strip length eight, marked index one, arrows clamp at both ends.

### Half the pictures used to leave the site when you opened them

A recovered plate opened in the lightbox with its date, its names and its
source. A member's upload was an `<a target="_blank">` straight at the Supabase
storage URL, so it left the site for a bare JPEG on a CDN. Both halves go
through the one viewer now, and a film plays in it: `youtubeEmbed()` has been
in `lib/gallery.ts` since videos were added and had never been called once.

Zero anchors to storage remain on the page.

### width and height have been on gallery_item since 0009 and nothing wrote them

Which is why `.wall` forced every tile to 16:9 and centre cut a portrait phone
screenshot with no way to see the rest of it. The upload path now writes the
dimensions it already had in hand, and the wall is justified rows like the
record filmstrip. **No migration: the columns were already there.** Rows
written before today have them null and fall back to 16:9, exactly as they
render now, so nothing existing moves.

Checked against 9:16, 21:9, 1:1 and 16:9 in one row: 154x274, 639x274, 274x274,
and every frame box the same height as its image, so nothing is letterboxed
and nothing is cropped.

### The filters were lying about their scope

One year filter reached across both halves while the kind and category chips
reached across only one. Each half now owns its own filter, inside the module
it governs. The wall's filters only exist once the wall does.

### What the ref does not say, and the call I made

The rail is 336px. The ref draws the members' half with one upload in it, and
past a handful that rail becomes a second, narrower, worse gallery beside the
first. **Above four approved uploads the wall breaks out full width underneath
both columns and the rail keeps the newest plate and the button**, which are
the two things a rail is actually for. Below four there is no wall and no
filter, because there is nothing for a filter to do.

### Also

- **Upload and moderation left the page flow.** The form was between the
  filters and the pictures, pushing the wall down for everyone, and standing
  where the images should be for anyone not signed in. It is a drawer behind
  one button now, with a label over every field instead of placeholders that
  vanish when you type. The queue is its own module and only appears when
  something is held.
- **The Films chip is gone from the browse row.** The screenshots/films segment
  already did that filter and two controls with one job is why nobody could
  tell which was in effect. Films is still a real category and is still offered
  when you upload a video.
- **The record half filters by year, not by game.** All twelve recovered plates
  are Warband, so a game chip row would be a row of one. When the recovered set
  grows past Warband, that is where the game chips go.
- **`demoGallery` now carries the whole row.** It understood "a picture with a
  caption", so demo mode silently dropped the category, the video and the
  dimensions the person had just filled in. An agent working without a Supabase
  key sees only that path, so what it dropped is what they thought the feature
  did.

### The locked 'the-archive' category is not the recovered half

Worth stating because the names invite the mistake. The recovered half is
`site/src/seed/gallery.json`, rendered on the client. The locked category in
`gallery_category` is a different object, it is empty, and nothing on this page
reads from it. There is a comment in the view saying so.

### Verified

`npm run build --prefix site` exit 0 with `tsc -b` first. Demo build trap non
zero, so `.env` loaded. No em dashes, no club or clan.

Behaviour was tested against a second dev server in demo mode with a seeded
store, because one member upload cannot exercise a breakout wall, a filter, a
moderation queue or a video: 1265px gives record 720 and rail 336 with the wall
full width at 1080; the segment counts, the category chips, the year chips and
the empty state all track; the drawer rejects a bad link and a year outside
2011 to now, submits, and the item lands in the queue; approve moves it to the
wall and deny removes it and the module with it.

At 375px: body measures exactly 375, `scrollLeft` will not move off 0, no
element outside a `.tscroll` box exceeds the client width, and the stack order
is record, then the button, then the wall. Somebody on a phone came to look at
pictures, not to be asked for one.

## 2026-08-29 - server-status was green work reported red, for two months of runs (Claude, River side)

`server-status.yml` had failed every five minutes since 22 Aug and
`steam-presence.yml` since 24 Aug. They are two unrelated faults that happen to
look like one outage.

### The poll was working the whole time

This is the part that hid it. Every failed run **queried the servers and stored
its rows correctly**, then died. I could see fresh `updated_at` timestamps in
`server_status` written by runs whose conclusion was failure, which is what
made me stop guessing at the upsert and look at the process instead.

`minecraftStatus` gave up on a dead host after five seconds, removed its
listeners in `cleanup()`, and never destroyed the socket. Two things followed:

- **A connecting TCP socket holds the event loop open.** Linux retries the SYN
  for about 128 seconds before ETIMEDOUT. That is the entire 133 second step,
  identical on every run: fifteen seconds of work, then two minutes of a socket
  nobody was waiting for.
- **The late error had no listener left.** `cleanup()` had removed `onError`,
  and an unhandled `'error'` event is an uncaught exception, so the run ended
  non zero having already done its job.

Reproduced in isolation before changing anything, old pattern against new,
both pointed at the same dead port:

```
OLD:  [5.0s] gave up  ->  [21.0s] UNCAUGHT: ETIMEDOUT  ->  exit 1
NEW:  [5.0s] gave up  ->  [5.0s] exit 0
```

21 seconds rather than 128 because Windows retries fewer SYNs. Same failure,
shorter fuse.

**It was only ever triggered by the Minecraft server being down.** Valheim is
UDP and fails fast and clean; it was never part of this. So the moment
Minecraft comes up the workflow would have gone green on its own and read as
self healing, with the defect still sitting there for the next outage.

`udpAsk` had the same class of bug queued behind it: a dead host answers a
closed UDP socket with ICMP port-unreachable, and a second `close()` throws
`ERR_SOCKET_DGRAM_NOT_RUNNING` from inside a handler. Closing is idempotent
now and both listeners outlive the promise.

**Live: first scheduled run on the fix succeeded in 12 seconds, against 138
failing.** Rows fresh, holdfast online 0/80, the other two offline as they
should be.

### The lane's verify command could not have caught this

`node scripts/poll-server-status.mjs` is the servers lane command and it passed
throughout. With no Supabase credentials the script prints and calls
`process.exit(0)`, which tears the socket down before it can bite. **The bug
only exists on the path where the script runs to the end, and that path only
happens in Actions.** Worth remembering before trusting a green local run of
anything that opens a socket.

### steam-presence is not the same fault, and it is not code

Its failing step takes **0 to 1 second**, every run. That is too fast to have
reached Supabase and back, which points at the workflow's own guard exiting
before curl: "SYNC_SECRET is not set as a repository secret."

**It is not the JWT trap.** The function is alive: probed with a deliberately
wrong secret it returns a clean application level 401 with body `no`, so it
executed and rejected the secret rather than being rejected by the platform.

Left for River, because a repository secret is not mine to set: check Settings,
Secrets and variables, Actions for `SYNC_SECRET`, and that it still matches the
value the `steam-presence` function has.

### 0020 has never been run

Probed live: `column server_status.player_names does not exist`. The poller
survives it by design, dropping that one field and writing the counts, so it is
not why anything failed. It does mean **no player names are being stored at
all**. Running `site/db/0020_server_player_tracker.sql` in the SQL editor turns
them on with no deploy.

### Open question for River

Valheim and Minecraft are not live. They cost about ten seconds of timeouts
every five minutes and put two permanently offline rows on the site. Left in
place rather than trimmed, because whether they are placeholders for something
arriving shortly is River's call and not visible from here.

## 2026-08-29 - The gallery, pass two: a media model, and two defects it exposed (Claude, River side)

Pass one gave the gallery River's layout and one viewer. This adds what a
gallery is actually asked for: search, sort, a featured shelf, collections,
deep linked media, and the states that appear when there is nothing to show.

### lib/media.ts is the change; everything else follows from it

The view used to hold two shapes at once and branch on which was which. The
recovered seed is read synchronously at import and moderated by nobody; a
gallery_item row arrives over the network and is moderated by a human. Holding
both and branching is how the two halves drifted into different lightboxes,
different filters and different link behaviour in the first place.

Everything above `lib/media.ts` now sees one `MediaItem`. `fetchMedia` is the
only IO and runs once; `selectMedia` is pure, so filtering never refetches.
**Swapping Supabase for a CMS or an object store means rewriting `fetchMedia`
and nothing else.**

`origin` stays on the item, because keeping the record and the wall apart is
editorial and not cosmetic. A recovered plate can be checked and says where it
came from. A member upload has an author and no provenance and must never be
dressed up as though it had any.

### Two defects, found by testing rather than by reading

- **A button inside a button.** The moderation controls rendered as `children`
  of the tile, which is itself a `<button>`. React warns, it is invalid HTML,
  the inner control is unreachable in some assistive technology, and a click
  fires both. It came in with pass one and I did not catch it then because I
  tested that the buttons *worked*, not that the markup was legal. They are a
  sibling in `.frame-wrap` now, and the pending queue is a plain uniform grid,
  which suits a moderation utility better than justified rows anyway.
- **Opening a film from the wall paged through the featured shelf.** The
  viewer resolved the open item by searching a fixed list order rather than by
  where it was clicked, so an item that appeared in two places opened into
  whichever list was checked first. The list is passed along with the item now.
  Verified: the same film reads 6 of 20 from the wall, 3 of 3 from the shelf,
  and a record plate reads 1 of 12.

### The categories in the brief are not the categories in the database

The brief asked for Screenshots, Gameplay, Trailers, Events, Artwork and
Community. `gallery_category` holds Napoleonic Wars, Counter-Strike,
Battlegrounds 2, Holdfast, Garry's Mod, Other Games, Films and the locked
archive, seeded by 0009 with RLS behind it.

**I did not overwrite them.** They are different questions: one asks which
game, the other asks what kind of thing this is. The six are a second axis, a
`collection`, and both filter independently. The only collection anything is
tagged with today is `screenshots`, derived truthfully because every recovered
plate is one; nothing else is guessed, and a facet row with one entry does not
render at all.

### 0021, and why nothing needs it

It adds description, tags, collection, duration, featured, views, downloadable
and captions, plus a `security definer` function for the view counter so an
anonymous visitor can add one to a count and touch nothing else.

**None of it is required.** The client reads these off a `select *`, so until
it runs they are undefined and the page falls back: no descriptions, nothing
featured, no view counts, "most viewed" not even offered as a sort, durations
hidden rather than guessed. The upload form retries without the extras and
tells the member what was not saved, rather than losing their submission.
0020 sat unrun for a week, so this is not hypothetical. **0020 is still unrun,
and 0021 is written to run after it.**

### App.tsx routes on the first hash segment

One line, claimed first. `#/gallery/<id>` used to be read as the name of a
view, so a shared link landed on nothing.

### Verified

`tsc -b` and `vite build` clean; there is **no test suite and no linter in
this repo**, so those two lines of the checklist have nothing to run and I am
not going to pretend otherwise. `tsc -b` is the type check and `npm run build`
runs it first.

Behaviour was tested against three servers, because one live gallery of twelve
plates and two uploads cannot exercise any of this: the real one, a demo mode
one seeded with videos, featured items, all six collections, awkward aspect
ratios and thirty items, and a third pointed at the real Supabase URL with a
deliberately invalid key to make the error path real rather than imagined.

- Search reaches titles, tags and the names legible in a plate. Sorts checked
  by reading the rendered order back, not by trusting the comparator.
- Deep link cold loads straight into the viewer with the nav correct. The
  browser back button closes it. Escape closes it. A shared link, which has no
  history entry of ours, replaces instead of throwing the reader off the site.
- Focus starts on Close, Tab wraps inside the dialog, and focus returns to the
  tile that opened it. Zero unlabelled controls, zero images without alt.
- Films play in the viewer and offer no Download, because a YouTube film is
  not ours to hand over. Photos offer one.
- Progressive loading 24 then 29, the button retires when the set is
  exhausted, and changing a filter resets to the first page.
- Error state: names the real error, says which half failed and which did not,
  offers a retry, and the twelve recovered plates and the whole toolbar keep
  working.
- 375px: body measures exactly 375, `scrollLeft` will not move off 0, nothing
  outside a `.tscroll` box exceeds the client width.

Live on `index-DQ_scNV2.js`. The only console error on the domain is the
Discord widget's CORS failure, and its `Access-Control-Allow-Origin` currently
reads `http://localhost:5199`, which is my own dev server: that is a cached
response from this session's testing, not a production fault. Worth a proper
look by whoever owns that component.

### Still open, and still River's

- **`SYNC_SECRET`** is almost certainly unset, which is why steam-presence
  fails in under a second every five minutes.
- **0020 and now 0021** both want running in the SQL editor.
- **Valheim and Minecraft** are still in the server poll list and still down.

## 2026-08-29 - The Groupsy watermarks are gone, and the publish path caught me out (Claude)

Nine of the twelve gallery plates were recovered from `i891.photobucket.com`
and carried a "Groupsy by photobucket" overlay. Six now have clean originals
from River's Photobucket export. Three had no clean original anywhere in the
export and were removed with River's approval.

**Matching was done by pixel comparison, not by eye, and it is worth reusing.**
The watermark sits in a central band, so the top 22 percent and bottom 18
percent of a watermarked plate and its clean original are the same pixels. I
loaded both sets into a canvas, sampled only those two strips, scaled
everything to 160x90 so resolution and aspect differences normalise away, and
took the mean absolute difference. Every real match landed under 0.6 against a
next best above 21. That gap is wide enough that no judgement call was
involved, and the same trick will work for any overlay with a clean edge.

**Search the whole export, not the likely folder.** My own brief said to look
in `03_Gameplay_Screenshots` and check `07_Other_Images`. Five matches were
indeed in gameplay, but the Pubstomp original was filed under
`06_Documents_and_Certificates`. Following the brief as written would have
deleted a plate that had a clean copy sitting right there. Widening to all 179
files cost one extra run.

**The thing that actually bit me: the site publishes from the repo root.**
`PROJECT.md` says so plainly and I still lost time to it. Changing
`site/public/gallery` and `site/src/seed` and pushing does nothing to the live
domain. The publish step is `npm run build --prefix site` and then copying
`site/dist` into the repo root, `_redirects` excluded. Two further traps in
that copy:

- `cp -r site/dist/assets ./assets` does **not** merge when `./assets` already
  exists. It creates `assets/assets`. Same for `fonts`, `gallery`,
  `game-logos`, `ranks` and `steam-return`. Use `cp -r site/dist/assets/. ./assets/`.
- After the copy, `git add gallery/` will happily stage the nested junk
  directory too. Check `git status` before committing, not after.

`210325a830` is now a **png**, the only one in the gallery. It is a page of
kill feed text, png is what its `source` field already recorded it as, and
`recordId()` in `lib/media.ts` strips the extension, so the deep link
`rec-210325a830` is unchanged. Do not "fix" it back to jpg without a reason;
jpeg smears the glyphs. `sharp` is a root dependency if a conversion is ever
wanted.

Every clean original turned out to be the same size as the plate it replaced,
so no `w` or `h` in the seed changed. That was checked against file headers
rather than assumed, because the justified grid reserves space from those two
numbers and a stale pair is a layout shift on load.

Removed, with their seed rows: `24fa333edc` (kill feed, 42 names),
`2be252508c` (end of round Austria against France, 20 names) and
`495931f670` (five to nothing on US1, 31 names). All three were HUD captures
rather than scenes. The 93 member names they carried came off the member wall
with them and survive only in history at `95c5ddf`. River was shown that cost
before approving.

Verified live: all six plates serve bytes identical to the repo, and all four
removed files return 404. Commits `95c5ddf`, `fc963b0`, `3f5d7b2`.

Board: `web-19` was still marked blocked on a note from 25 Aug saying
`server-status.yml` was failing. It has been green since the socket fix and
`status.mjs` reads it as succeeded, so it is now done. `web-20` stays blocked;
it needs `SYNC_SECRET` in Settings, Secrets and variables, Actions.

## 2026-08-30 - A 404 page, a bundle purge, and two deploy paths that disagree (Claude)

`site/public/404.html` is new and standalone on purpose: Cloudflare serves it
for an unknown path, which is exactly the case where the app bundle may itself
be the missing thing, so it depends on nothing but the self hosted fonts and
its own rules. The palette is copied from `site/src/styles.css` rather than
imported, and there is a comment there saying to move it if the tokens move.

**It is live at https://coldstreamgaming.com/404 and it renders correctly.
But an unknown path still returns 404 with an empty body.** Cloudflare is not
wiring `404.html` up as the not found page, and I could not find out why from
here: `npx wrangler pages deployment list` needs `CLOUDFLARE_API_TOKEN`, which
is not in this environment. Somebody with the dashboard needs to look.

**While chasing that I found the thing PROJECT.md warns about.** The apex and
the pages.dev subdomain are serving different builds:

    coldstreamgaming.com      -> assets/index-BW3izRQa.js   (current, from this repo)
    coldstreamgaming.pages.dev -> assets/index-On7VicJQ.js  (a bundle not in this repo at all)

`coldstreamgaming.pages.dev` also answers 200 with index.html for an unknown
path, SPA style, where the apex answers 404. So they are not the same project
or not the same deploy path. PROJECT.md says "One deploy path only" and
records that a second one silently broke the push based build for ninety
minutes. This looks like a second one still being there. Worth resolving
before launch, because it means the pages.dev address shows visitors an old
site.

Also note the generated `_redirects` is **not** a hazard file to be avoided,
whatever the 22 Aug entry implies. It is the www to apex fold, and the comment
in `site/public/_redirects` explains why it matters: Supabase puts the session
in the fragment on www, so without the fold a member signs in on www and looks
signed out on the apex. It is currently not published to the root and the
guard is passing anyway, so that redirect is configured in Cloudflare rather
than by the file. Do not add a `/* /404.html 404` line to it without checking
that, or the www session fold may go with it.

**Bundle purge.** The publish root held 44 files in `assets` and only 6 were
reachable, 5.2M down to 804K. Reachability was computed as a transitive
closure: seed from every shipped html, then follow chunk to chunk references
inside the bundles. Do not shortcut this to grepping the html. The lazy route
chunks for Admin, Archive and Profile are named only inside the JS, and an
html only scan deletes all three. Verified after: the Archive route still
fetches its chunk, 200, console clean.

## 2026-08-30 - Mobile pass, and the one thing that was actually broken (Claude)

Every public page now measures 375 wide at a 375 viewport: home, gallery,
servers, archive, members, events. Landing is deliberately not in that list,
because Codex is rebuilding it and mobile-passing a page that is about to be
replaced is wasted work. It needs its own pass when the new one lands, and
`web-16` is left at `doing` for exactly that reason.

**The real bug was on the archive, and it was 48px wide.** The Steam Groups
rows put a bare `steamcommunity.com/groups/...` URL in `.era-game`. That is
one unbroken token, and at `.1em` tracking it measured 344px inside a 259px
column, which pushed the whole document to 423px. The parent already had
`min-width:0`. That is not enough on its own and it is worth understanding
why: `min-width:0` lets a flex or grid child shrink below its content, but
the child still cannot shrink below its longest unbreakable word. There was
no break opportunity in the string for it to take. `overflow-wrap:anywhere`
supplies one.

Worth knowing for the next long-string field: the same trap is waiting on any
column that renders a URL, a file path, or a Steam ID.

**Tap targets.** `.pulse` was an 11px tall link and the big footer links were
23px. Both are 24px now, done with `inline-flex` and `min-height` rather than
padding, so the text does not move and the footer keeps its 8px rhythm.

One undersized target is left on purpose: the "the Archive" button inside the
sentence "Every game, every era and every night on the calendar is in the
Archive." WCAG 2.2 target size exempts a target in a block of text, and
padding it out would break the line it sits in. If a future audit flags it,
that is the answer.

**The asset purge has to be repeated on every publish.** Each build renames
the bundles, so the old ones are left behind in the root the moment you copy a
new `site/dist` over it. This publish superseded 5 files. The closure script
is written out in the 2026-08-30 entry above; run it after the copy, or the
root quietly grows back to the 44 files it held this morning.

## 2026-08-30 - steam-presence had been dead for six days, and the run count lied (Claude, River side)

`status.mjs` flagged `steam-presence.yml` as failing. The first read of it,
mine, was wrong twice, and both errors would have sent River to the wrong fix.

**It was not "the secret was never set".** The workflow succeeded 45 times,
runs #1 to #46, from 22 Aug through to 24 Aug 00:01:21Z, then failed on every
run after. A working setup broke on the 24th. Adding a secret you assume is
correct to a repo that may already hold one leaves you red and none the wiser.

**It was 322 failures, not the ~1,700 I first said.** I had multiplied the
`*/5` cron out to 288 runs a day. GitHub actually fired it about 46 times a
day, 370 runs total across eight days. The workflow's own comments already
say GitHub does not honour tight schedules on free runners. Believe the
`total_count` from the API, not the cron expression.

**Diagnosis that did not need the secret.** Probing the function with a
deliberately invalid value returned `HTTP 401` / `no`, which proves it is
deployed and rejecting. It does not say which side lost the value: line 73 of
`site/supabase/functions/steam-presence/index.ts` reads
`if (!SYNC_SECRET || given !== SYNC_SECRET)` and returns the same 401 whether
the function's own env var is missing or the caller's simply does not match.
Worth remembering before reading a 401 as an answer. Every commit to that
function is dated 22 Aug, so the 24 Aug break was configuration, not code.

The fix was setting `SYNC_SECRET` to one fresh value on both sides, Supabase
edge function secrets and GitHub Actions repository secrets, which is correct
regardless of which side had drifted. **Still unknown: whether GitHub already
held a value.** River did the entry and I did not ask again afterwards. If
anyone finds out, it explains what happened on the 24th.

Verified, rather than trusting a green tick. Run #375, `workflow_dispatch`,
success, the 46th ever. Then the tables the function actually writes:
`steam_presence.checked_at` at 07:03:28Z, seven seconds after the run started,
and `game_stats.checked_at` at 07:03:30Z. Both fresh, so the row is a real
write and not a survivor from 24 Aug. `steam_recent` also populated. Note that
presence does **not** live on `member`, which has no presence columns at all.

**The thing worth fixing next.** Nothing announced six days of failure. This
is the second time: the 29 Aug entry records `server-status.yml` reporting red
for two months of green runs, and the 25 Aug note left `web-19` blocked on it.
`status.mjs` catches this only when a human remembers to run it. A workflow
that fails on a schedule needs to tell someone without being asked.

Board: `web-20` is done.

## 2026-08-30 - The front door is a plate and real type, and the film reel is gone (Claude, River side)

The landing splash was four curated YouTube segments, double buffered with a
crossfade. It is now a single sunset plate with the crest, and three lines of
HTML over it. **The film version is not lost, it is at the commit before this
one**, and it is worth reading before reviving it because it solved real
problems: no black flash, no spinner, reduced motion handled. River asked for
the plate. The cut is his call, not a defect.

**The rule that shaped it: no words are baked into the artwork.** An earlier
mockup had "WE'RE BACK." burned into the image and it cannot survive a phone,
because the crop that keeps the crest is not the crop that keeps the type.
So the plate carries sky, land and crest only, and the headline, motto and
button are markup. They reflow, they scale, they are selectable, a screen
reader reads them, and nothing gets sliced.

**Two plates, not one scaled plate.** `landing-desktop.jpg` is 3:2 and
`landing-mobile.jpg` is 9:16, swapped by `<picture>` at
`(max-width:820px) and (orientation:portrait)`. Both are `cover`. `contain`
was rejected on purpose: letterboxing a front door makes it read as an image
viewer. Each plate is composed for its own shape, so cover has nothing
important left to cut.

Sources were the matched pair in `Desktop/web`, not the ones in `Downloads`.
Both folders held a 3:2 sunset plate and they are not interchangeable: the
Downloads one has a bright grass foreground that fights the type, the
`Desktop/web` one is darker underneath and puts the crest higher. Checked by
eye against the mockup rather than by filename.

Four deviations from the brief, each on purpose:

- Desktop ships at its native **1536x1024, not the 3072x2048 asked for**.
  Enlarging cannot add detail and would double the bytes on the one image
  that blocks first paint. Regenerate at 3072 and drop it in if wanted; no
  code changes.
- Mobile is 941x1672 resized up to 1080x1920, a 1.15x enlargement.
- The button is `href="#/home"`, not `/home`. **This site is hash routed**
  and `/home` is a 404.
- The motto is letterspaced brass caps rather than the mockup's italic.
  Cormorant Garamond is one variable file here with no italic axis, so
  `font-style:italic` would be a synthetic slant on a Garamond.

The headline gradient is clipped to the glyphs and is guarded behind
`@supports`, because the fallback for an unsupported `background-clip:text`
is transparent text, which is no headline at all. The shadow becomes a
`drop-shadow` filter in that block for the same reason: a `text-shadow` on
transparent glyphs paints nothing.

`100svh`, not `100vh`. On a phone `100vh` is the viewport with the browser
chrome hidden, so the button sits under the address bar until you scroll.

Verified in a real browser at 1440x900 and at 375x812, not by reading the
CSS. One trap for whoever tests next: **`<picture>` does not re-pick its
source when you only resize the devtools viewport.** Reload after resizing or
you will see the desktop plate cropped to a phone and think the media query
is broken. It is not.

Published the documented way, repo root, `cp -r site/dist/assets/. ./assets/`,
and `git status` checked for the nested `assets/assets` trap before
committing. It was clean.

**Not in this commit: `.github/workflows/alert-failures.yml`.** It is written
and sitting untracked in the working tree. It alerts Discord on a workflow
going green to red and red to green, on the edge rather than the state, so a
five minute cron that breaks posts once instead of 288 times a day. It needs
a `DISCORD_ALERT_WEBHOOK` repository secret and does not work without one.
Committing a workflow that is guaranteed to fail, in the repo whose actual
problem was failures nobody noticed, would be the wrong thing to add. Set the
secret, then commit it.
