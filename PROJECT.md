# Coldstream Gaming, the short brief

Read this once. It replaces `ONBOARDING.md` and `AGENTS.md`, which said the
same things at much greater length and were costing every fresh agent real
money before it had done any work. If a fact below turns out wrong, fix it
in the same commit that proves it wrong.

`HANDOFF.md` is still the append only cross agent log, newest entry last.
Read only its last handful of dated entries, never the whole file.
`HANDOFF-ARCHIVE.md` holds everything from before 21 Aug 2026: read it only
when you need the reasoning behind a specific past decision, not as a
briefing.

**Never trust prose for current state, including this file's "Current
state" section below.** Run:

    node scripts/status.mjs

It asks the domain, the sign in function, and the database directly. Two
agents each wrote a confident state paragraph on the same day in Aug 2026
and both were wrong within hours. That is the whole reason the script
exists.

## What this is, and the one rule that makes it matter

**coldstreamgaming.com** is a real gaming community that has run continuously
since 2011, under several banners. **River owns it. It is his community, his
call, and his read on his own history.** This is not a demo: people who
played here in 2012 will read this site and check it against their own
memory.

One site, two halves:

1. **A living community site.** Steam sign in, roster, gallery, shoutbox,
   events, Discord presence, game servers.
2. **The Archive.** Fifteen years of this community's record, recovered from
   places about to lose it: Steam group posts, an old Enjin site pulled from
   the Wayback Machine, forum threads, YouTube, Photobucket screenshots one
   outage from gone.

**Never invent a number.** If the archive does not support a figure, it does
not go on the site. Two incidents made this literal law rather than a style
preference: a "627 events" figure nothing could reproduce, and Steam
reporting two different member counts for the same group. Provenance lines
go on anything quantitative.

Six chapters, one continuous community, recomputed from 1,210 archived
announcements to 362 events total. If you change how they are counted, they
must still reconcile, and you must say so on the page.

| Years | Banner | Events |
|---|---|---:|
| 2011 | 21stPA Public Linebattle Group | 26 |
| 2011 to 2012 | Midnight Mercenaries / 2nd Coldstream Regiment, one unit, three group pages | 140 |
| 2013 to 2015 | Nox Viator, with 2nd Coldstream as its sub group | 149 |
| 2017 to 2018 | RoaR Gaming, Counter-Strike, ESEA and FACEIT | 29 |
| 2020 | 2nd Coldstream Guard | 18 |
| 2020 to now | Coldstream Gaming | present |

## House rules, non negotiable

- **No em dashes. Anywhere.** Site copy, commits, code comments, Discord. Use
  a comma, a colon, or a middle dot. CI fails the build on one.
- **Vocabulary:** gaming community, never clan or club. Eras, never renames
  or rebrands. Admin and moderator, never officer.
- **Never invent a number.** Covered above; it is the whole point of the
  project, not a nice to have.
- **Comments explain why, not what.** Match the plain, reasoning voice
  already in `site/src` and `site/db` before adding new ones.

## Stack

| Thing | Where |
|---|---|
| Site | Cloudflare Pages, static from repo root, `coldstreamgaming.com` |
| DB, auth, storage, functions | Supabase, project `zcpbpcktinlqnxmqddzc`, free tier |
| Repo | GitHub `riverbusiness26/coldstream-clan-archive`, public |
| Game servers | OVH VPS-3, Ubuntu 24.04, Pterodactyl panel at `panel.coldstreamgaming.com` |
| Discord bot | separate repo, `coldstream-bot`, its own `PROJECT.md` |

**The repo is public. No keys, no tokens, no secrets in committed files,
ever.** Secrets live in Supabase Edge Function secrets and GitHub Actions
secrets, referenced by name in code, never by value.

## Repo layout

```
site/                    React app, Vite + TypeScript, hash routing
  src/views/             page level components
  src/lib/                supa.ts, auth.ts, data.ts, asset.ts
  src/seed/               generated, do not hand edit, regenerate with npm run seed
  db/                     numbered SQL migrations, plus RUN_ME_next.sql
  supabase/functions/     Deno edge functions
assets/, index.html       the BUILT site, committed at repo root, served by Cloudflare
data/                     the raw scraped archive
infra/game-servers/       Pterodactyl eggs, configs, install script for the VPS
HANDOFF.md                cross agent log, append only, newest section last
claims/                   who is holding what, see below
```

## Gotchas that have each cost real time

- **Grants are checked before policies.** A table with perfect RLS and no
  grant returns 401 and looks exactly like a broken login. Every new table
  needs `grant ... to anon, authenticated`.
- **service_role bypasses RLS but still needs grants.** Same trap, different
  hat. Check with `has_table_privilege('service_role','<table>','INSERT')`,
  never `information_schema.role_table_grants`, which shows nothing for
  service_role even when the grant exists.
- **Redeploying via "Deploy a new function" resets JWT verification to ON.**
  Deploy in place from the function's own Code tab instead. After any
  deploy, curl it with no auth header: 302 is healthy for steam-auth, 401
  means the toggle came back on and every member is locked out.
- **One deploy path only.** The site publishes from the repo root on push.
  A second path (`wrangler pages deploy`) alongside it once silently broke
  the push based build for ninety minutes. If the domain looks stale, run
  `npx wrangler pages deployment list --project-name=coldstreamgaming`
  before assuming the build failed.
- **There is a second checkout of this repo on River's machine**, left at the
  old path when the directory moved on 22 Aug:
  `CSG History & Archive\2nd Coldstream Guards\CSG Archive Project\coldstream-research`.
  Same git remote, one day behind, and that day is the one that deleted
  `ONBOARDING.md` and gutted `AGENTS.md`. An agent landing there reads its
  `PROJECT.md`-less doc set, its own `HANDOFF.md` and its own `claims/`, and
  every signal it uses to orient itself is present and wrong. It carries a
  `STALE-DO-NOT-USE.md` and a `scripts/status.mjs` that refuses to run, so
  the trap announces itself now. `node scripts/status.mjs` also checks its
  own checkout, here or anywhere else.
- **Windows Git Bash specifics:** shell heredocs eat backslashes, breaking
  regex, use the Write tool instead. Paths passed as arguments get mangled,
  prefix with `MSYS_NO_PATHCONV=1`. `/tmp` is invisible to Windows Node, use
  the scratchpad directory. `tr -d` deletes characters, not strings, never
  use it to strip a Steam ID out of text.
- **The Supabase dashboard often does not hydrate on a cold deep link.** Load
  `/functions` or the SQL editor's list page first, then click through.

## Working alongside other agents

More than one agent works this repo at once, coordinating only through
`HANDOFF.md` and `claims/`.

- **Claim before you edit**, in your own file under `claims/`. Read
  everyone else's first. A shared claim list is itself a thing to collide on.
- **Lanes**, in `claims/README.md`: front of house owns `site/src/views`,
  `site/src/components`, `styles.css`. Data and back end owns `site/db`,
  `site/supabase/functions`, `site/src/lib`. The archive owns `data/`,
  `site/seed`, `site/src/seed`. Files everyone needs (`App.tsx`, this file,
  `index.html`, the built `assets/`) are always claim first.
- **Stage by name. Never `git add -A`.** Somebody else's half finished file
  is always sitting in the tree.
- **Prefix commits with who you are:** `claude:`, `codex:`, and so on.
- **Push small and often.** Pull and rebase before pushing. Whoever loses a
  race rebases, and it should cost seconds.
- **Append to `HANDOFF.md`, dated, never numbered:**
  `## 2026-08-23 - what this is (whose side)`. Say what you verified and
  how, not just what you changed.
- **Write back before the session ends, even if you changed no files.**
  River deletes chats to keep usage down, so a conversation is not storage
  and nothing said only in one survives. This applies hardest to the roles
  that produce no diff: a coordinator that routed work, an agent that read
  the tree and concluded nothing needed doing, an investigation that ruled
  something out. A ruled-out option is a finding, and the next agent will
  otherwise pay to rule it out again. The old rule said to log what you
  changed, so these sessions fell straight through it and left no trace.

## Current state, as of 23 Aug 2026, verify with the script above

Live: site on `coldstreamgaming.com` over TLS, Steam sign in end to end,
one member (River, admin), the Archive, gallery, shoutbox, Discord presence,
Steam presence tracker, member profile tables, server player tracker for
Holdfast and Minecraft.

**Priority order right now:**

1. **Nightly database backup. It is failing, not merely unconfigured.**
   `.github/workflows/backup-database.yml` had run 59 times as of 23 Aug 2026
   and had succeeded zero times, ever. Nothing surfaced that, because nothing
   ever asked the workflow how it went. `node scripts/status.mjs` asks now.
   Every run dies on its first step, the config guard, so the export has
   never executed. It needs three things, not one: the secrets
   `SUPABASE_SERVICE_ROLE_KEY` and `BACKUP_REPOSITORY_TOKEN`, plus the
   **variable** `BACKUP_REPOSITORY`, which goes on the Variables tab and not
   the Secrets tab. It pushes to a separate private repo, since this one is
   public. `DURABILITY.md` has the full table and said "one secret, into
   backup/" until 23 Aug, which is part of why this went unfixed. Highest
   value unglamorous job in the project: the archive cannot be recollected
   if lost.
2. **Redeploy the patched `steam-auth`.** Repo copy has three fixes not yet
   live: a caught Steam network failure, a checked upsert error, and a
   guarded persona fetch so a failed lookup cannot rename someone to
   "Player 97257".
3. **Design.** River is redoing the site's visual direction directly with
   the design skill. `CLAUDE_DESIGN_BRIEF.md` is the live product brief for
   what a design pass must keep working; treat anything about the four
   earlier canvas directions as superseded.
4. **Shipped, kept here so nobody re-opens it.** The Discord deploy command
   landed in the separate `coldstream-bot` repo as `/games deploy`, not
   `/deploy-server`, in `8a422a6`, with status controls in `98a3867` and a
   cooldown note in `605115f`. It calls the Pterodactyl Application API
   through `src/lib/pterodactyl.js` against the eggs in
   `infra/game-servers/`, and does not provision a new VPS. That repo's
   `HANDOFF.md` carries the detail.

## Things not to do

- No em dashes.
- No secrets in commits. The repo is public.
- No Steam Web API key near the frontend, ever. Server side only, through an
  edge function.
- Do not scrape `forums.taleworlds.com`. Behind a Cloudflare challenge, and
  River said stop after browser automation crashed his session.
- Do not hand edit `site/src/seed/`. Regenerate with `npm run seed --prefix site`.
- Do not post to Discord without River's say so.
- Do not delete anything on River's behalf without asking.
