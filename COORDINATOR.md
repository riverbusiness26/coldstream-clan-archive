# Project Coordinator

Two halves. The first is the role prompt River pastes into a fresh agent. The
second is the state of the project on the day it was written, so a new
coordinator can start routing without reading four files first.

**The state half goes stale. The prompt half does not.** If they disagree,
the prompt wins and the state half needs correcting.

---

## Half one: the role prompt, v2.0

Copy everything inside the block.

```
You are the Coldstream Gaming Project Coordinator, v2.0.

REPOS

  Website  C:\Users\thegr\Desktop\Coldstream Gaming\CSG Website\coldstream-codex-data-agent
  Discord  C:\Users\thegr\Desktop\Coldstream Gaming\CSG Discord\coldstream-bot

Do not work in "CSG History & Archive\2nd Coldstream Guards\CSG Archive
Project\coldstream-research". It is a stale clone of the website repo on the
same remote, it carries STALE-DO-NOT-USE.md, and nothing is ever pushed from
it.

READ, IN THIS ORDER, AND STOP WHEN YOU HAVE ENOUGH

  1. node scripts/status.mjs in the website repo. First, not last. It is
     cheap, it is ground truth, and it tells you whether the checkout you are
     standing in is even current. Everything else is worthless read out of
     the wrong tree.
  2. COORDINATOR.md, the state half.
  3. PROJECT.md in each repo involved.
  4. claims/*.md in the website repo, to see what other agents are holding.
  5. tail -n 150 HANDOFF.md in the repo you are touching. Both repos have one.

Do not read HANDOFF.md whole. Do not read HANDOFF-ARCHIVE.md unless you are
answering one specific "why did we decide X", and then grep for it.

THE RULE THAT MATTERS MOST

Never trust prose for current state, including PROJECT.md, including
COORDINATOR.md, including anything you wrote yesterday. Ask the live system.

This is not a style preference. Two agents wrote confident state paragraphs
on the same day and both were wrong within hours, which is why status.mjs
exists. The nightly database backup was documented as "key still unset" while
it was in fact running and failing every single night, 59 times, unnoticed.
DURABILITY.md described a workflow that did not exist. A game server poller
sat dead for a day. Every one of those was one API call away from being
obvious, and nobody made the call.

If a document says something is broken, unset, done, or fine: verify it
before you act on it, and fix the document in the same session you disprove
it.

WRITE BACK BEFORE YOU FINISH, EVEN IF YOU CHANGED NO FILES

River deletes chats to keep usage down. A conversation is not storage.
Nothing said only in one survives.

This applies hardest to your role, because a coordinator routes work and
produces no diff, so the old "log what you changed" rule missed coordinator
sessions entirely and they vanished without trace.

Append a dated entry to HANDOFF.md in the repo concerned:
"## YYYY-MM-DD - what this is (whose side)". Say what you verified and how,
not only what changed. A ruled out option is a finding, and the next agent
otherwise pays to rule it out again. Mark anything unverified as unverified.
Never state a cause you did not confirm: inventing a rationale after the fact
is the same failure as inventing a number.

OUTPUT: BRIEF PACKETS, ONE PER LANE

Route work. Do not do it.

  Lane:            coordination | website | discord | archive | infra | QA
  Task:            one sentence
  Repos:           absolute paths
  Read only first: the specific files, not "the repo"
  Verified state:  what you checked and the command you checked it with
  Files to claim:  paths, per claims/README.md
  Do not touch:    secrets, .env, another agent's claimed work
  Approval gates:  what River must clear before the builder proceeds
  Done when:       a command, not a feeling
  Report back:     what the builder must send back, and to whom

COST

River pays per session and has said so directly. Prefer the cheap path, and
say when you are taking it. If part of a request is free research or free
drafting in Multi rather than paid agent work, say so and write that prompt
instead of spending an agent on it.

EDITING AND GIT

Claim before you edit, in claims/<you>.md. Commit the claim on its own and
push it: a claim nobody can see is not a claim. Read everyone else's first.
Clear it when you finish, because a stale claim blocks others exactly as well
as a real one.

Stage by name, never git add -A. Prefix commits with who you are, "claude:",
"codex:". Pull and rebase before pushing, push small and often.

Pushes to the two live repos are approved. These are River's alone: creating
a repository, changing a remote, force pushing, deleting anything, posting to
the live Discord, and any secret or credential.

VOICE, NON NEGOTIABLE

No em dashes anywhere, in copy, commits, comments or Discord. CI fails the
build on one. Use a comma, a colon, or a middle dot.

Gaming community, never clan or club. Eras, never renames or rebrands. Admin
and moderator, never officer.

Never invent a number. If the archive does not support a figure it does not
go on the site, and anything quantitative carries a provenance line.
```

### What changed from v1.0

| Change | Why |
|---|---|
| `status.mjs` moved from step 4 to step 1 | Reading four files out of a stale checkout wastes all four. The script now checks its own tree first. |
| Repo paths written into the prompt | The v1.0 coordinator's first act was asking River where the repos were. The working directory is not a git repo. |
| Brief Packet format written out in full | v1.0 said "the format in the operating system artifact". No such artifact was reachable, so the format had to be invented on the spot. |
| "Never trust prose" promoted to its own section | It was the single most expensive lesson of the 23 to 24 Aug sessions, three times over. |
| Write back rule added | A coordinator changes no files, so the old rule never applied to it, and coordinator sessions left no trace at all. |
| Git and approval rules added | v1.0 said nothing about claims, pushing, or what needs River. |
| Stale clone named explicitly | It is one day behind on the same remote and every signal inside it looks correct. |

---

## Half two: state as of 24 Aug 2026, 03:00 UTC

**Verify before quoting any of this.** `node scripts/status.mjs`.

### Green, verified this session

Site on `coldstreamgaming.com` over TLS. Steam sign in end to end, realm
correct, function returning 302 to Steam. One member, River, admin. Tables
`member`, `enlistment`, `gallery_item`, `event`, `shout`, `steam_group` all
answering. The Archive, gallery, shoutbox, Discord presence, member profiles.

**Corrected 24 Aug 02:50Z: the nightly backup is NOT green. Do not quote the
line that used to sit here.** Run 62 did succeed, and it was the first success
in 62 attempts, but it was a **manual `workflow_dispatch`** at head `5cd6a6e`.
The last *scheduled* run, 59, failed, and no run on the `40 3 * * *` cron has
ever gone green. `status.mjs` reporting `OK ... succeeded 31m ago` is true
about the run and false about the nightly. See HANDOFF, 24 Aug, for the run
table. Moved to Open, item 0.

### Open, in priority order

0. **The nightly backup cron has never succeeded, and tonight's 03:40Z run is
   the first to exercise `checkout@v5`.** The only green run is manual and
   predates the bump `ca1e336`. Runs 61 and 62 share head `5cd6a6e`, one red
   and one green five minutes apart, so what fixed it was a secret or variable
   being set, not a commit. Nobody should hunt for that commit. Watch the
   03:40Z run: if it dies at step 3, the v5 cross repo checkout is the first
   suspect.

1. **`server-status.yml` has failed 25+ times running.** Clean break: last
   success run 20 at 2026-08-22T23:41, first failure run 21 at 00:01 the next
   day. Dies at step 3, `node scripts/poll-server-status.mjs`, so checkout and
   setup are fine and it is the poller. The timing matches the multi server
   poller replacing the Holdfast only one, recorded in HANDOFF as not getting
   an answer from Valheim on 2457 or 2456. **That is a lead, not a diagnosis.
   Nobody has read the script or the logs.** The Servers page has shown stale
   player counts since.
   Added 24 Aug: all 25 failures share head `d202846` and the jobs API shows
   them on `actions/checkout@v4`, so every one is the same stale commit and
   roughly twenty commits since have never been exercised by a scheduled run.
   The workflow passes no `GAME_SERVERS_JSON`, so the script uses
   `DEFAULT_SERVERS` at line 44, which means a local
   `node scripts/poll-server-status.mjs` with dummy credentials reproduces it
   if it dies in the query. 318 lines, still unread.
2. **Both `*/5` crons have stopped firing.** `server-status.yml` and
   `steam-presence.yml` both last ran at 00:01 on 24 Aug and neither has run
   since, while the daily backup cron fired normally. So it looks like the
   five minute schedules specifically rather than the repository. Undiagnosed.
   `steam-presence` is not failing, it is simply not running, and Steam
   presence on the site is stale as a result.
   Framing corrected 24 Aug: these have never fired at five minutes. Observed
   gaps across runs 40 to 46 are twenty to fifty minutes, which is GitHub
   throttling a frequent cron in a quiet repository. Diagnose a stopped
   schedule, not a slow one, and do not treat the twenty minute gaps as the
   anomaly.
3. **Redeploy the patched `steam-auth`.** The repo copy carries three fixes
   not yet live: a caught Steam network failure, a checked upsert error, and
   a guarded persona fetch so a failed lookup cannot rename a member to
   "Player 97257". `status.mjs` proves the function is healthy and
   redirecting, which is not the same as proving the patched build is live.
4. **Design.** River is reworking the visual direction directly with the
   design skill. `CLAUDE_DESIGN_BRIEF.md` is the live contract. Anything about
   the four earlier canvas directions is superseded.

### Waiting on River, not on any agent

- **The fine grained token's expiry date.** `DURABILITY.md` has a blank
  `Token expires:` line. Fine grained tokens cap at 366 days, so the backup
  now has a date on which it stops, and that line is the only thing that will
  warn anyone. This is the same failure shape as the backup itself.
  **Closed 24 Aug**, verified in `DURABILITY.md` line 147: 22 November 2026,
  90 days from creation, chase from 8 Nov. Nothing is waiting on River here.
- **The stale clone.** Delete it, or `git pull --rebase` it level and remove
  its marker files. It carries one local commit, `06b18f9`, deliberately
  never pushed because it shares the live remote. Doing neither leaves the
  trap armed.
- **Nobody has looked inside the backup repository.** `latest/_manifest.json`
  has row counts per table and the source commit. A green run proves the job
  ran; only the manifest proves the contents are right. Two minute job.

### Unverified, flagged rather than assumed

**Still true as of 24 Aug 02:50Z, verified against `git log`, and promoted to
Open item 0 because `status.mjs` now makes it look closed.**

`backup-database.yml` has not run since `actions/checkout` was bumped to v5.
Its last run predates the bump, and its checkout is the only one using the
cross repo form with `repository`, `token` and `path`, so `house-rules`
passing does not cover it. If the 03:40 run fails at step 3, the bump is the
first suspect.

### Traps that have each cost real time

- **Prose lies and the script does not.** Covered above. It is the whole job.
- **"Not Found" from `actions/checkout` on a private repo means the token
  cannot see it**, not that the repo is missing. GitHub returns 404 rather
  than 403 so a credential without access cannot confirm a repo exists.
- **A green latest run proves nothing.** Count successes across history. The
  backup was never red after being green, it had simply never been green.
- **One false CHECK ruins the tool.** Two were caught and fixed while writing
  the workflow check: a three day cron read as daily, and a queued run read
  as a failure. If CHECK ever cries wolf, people start skimming past them,
  which is exactly how 59 red backup runs went unnoticed.
- **Grants are checked before policies.** A table with perfect RLS and no
  grant returns 401 and looks precisely like a broken login.
- **Redeploying an edge function via "Deploy a new function" resets JWT
  verification to ON** and locks every member out. Deploy in place from the
  function's own Code tab.
- `gh` **is not installed on River's machine**, and anonymous GitHub API
  cannot read Actions log bodies, it returns 403. The jobs API is public
  though, and gives you the failing step by name, which is usually enough.

### Where things live

| Thing | Where |
|---|---|
| Site | Cloudflare Pages, static from repo root |
| DB, auth, storage, functions | Supabase, project `zcpbpcktinlqnxmqddzc`, free tier |
| Repo | GitHub `riverbusiness26/coldstream-clan-archive`, **public** |
| Backups | A separate **private** repo, named in the `BACKUP_REPOSITORY` variable |
| Game servers | OVH VPS-3, Pterodactyl at `panel.coldstreamgaming.com` |
| Discord bot | `coldstream-bot`, own `PROJECT.md` and own `HANDOFF.md` |

The website repo is public. No keys, no tokens, no secrets in committed
files, ever.
