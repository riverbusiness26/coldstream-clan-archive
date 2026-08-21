# Working on this project

Read this before touching anything. It is the short version. `HANDOFF.md` is the
long version, twenty seven sections of accumulated decisions and post mortems,
and you do not need most of it to start. Read the last two or three sections of
it for current context, and search it when something here says "see HANDOFF".

## What this is

**coldstreamgaming.com**, the site for a real gaming community that has existed
since 2011. It is being rebuilt from a scraped and recovered archive of Steam
groups, an old Enjin site, forum threads, and YouTube channels.

The owner is **River**. It is his community and his call.

This is not a demo or a portfolio piece. Real people who played here in 2012 are
going to read it. The record is the point: every figure on the site should be
traceable to a source, and where the record is thin the site says so rather than
guessing.

## Non negotiable house rules

**No em dashes. Anywhere.** Not in site copy, not in commit messages, not in code
comments, not in Discord posts. River asked for this explicitly and more than
once. Use a comma, a colon, or a middle dot. This has been broken by accident
several times, including once inside the file that documents the rule, so check
before you commit.

**Vocabulary:**

- **gaming community**, never "clan" or "club"
- **eras**, never "renames" or "rebrands"
- **admin** and **moderator**. Never "officer". The database enum was renamed for
  this in `0000_role_rename.sql`.

**Never invent a number.** If the archive does not support a figure, do not put
it on the site. Two separate incidents came from this: a "627 events" claim that
nothing could reproduce, and Steam reporting two different member counts for the
same group. In both cases the fix was to show the real numbers and say plainly
where they came from. Provenance lines belong on anything quantitative.

**Comments explain why, not what.** Look at any file in `site/src` or `site/db`
before writing new ones. The established voice is plain full sentences that
explain the reasoning and name the failure being prevented. Match it.

## Repo layout

```
site/                    the React app (Vite + TypeScript, hash routing)
  src/views/             page level components
  src/components/        shared pieces (Roster, Ranks, SteamGroups)
  src/lib/               supa.ts, auth.ts, data.ts, asset.ts
  src/seed/              generated JSON, do not hand edit
  seed/build-seed.mjs    regenerates src/seed from data/
  db/                    numbered SQL migrations, plus RUN_ME_next.sql
  supabase/functions/    Deno edge functions
assets/, index.html      the BUILT site, committed at repo root, served by Cloudflare
data/                    the raw scraped archive
HANDOFF.md               cross agent log, append only, newest section last
```

The build output is committed to the repo root, not to `site/dist`. Cloudflare
serves the root. `.assetsignore` keeps it from publishing the whole repo, which
it tried to do twice, once including a 144 MiB binary.

## Stack

| Thing | Where | Notes |
|---|---|---|
| Site | Cloudflare, static from repo root | domain `coldstreamgaming.com` |
| Database, auth, storage, functions | Supabase, project `zcpbpcktinlqnxmqddzc` | free tier |
| Repo | GitHub `riverbusiness26/coldstream-clan-archive` | public |
| Game servers | OVH VPS-3, US-EAST-VA, Ubuntu 24.04 | 6 vCore, 12 GB, being set up |
| Discord bot | `../coldstream-bot`, separate directory | |

**The repo is public.** No keys, no tokens, no secrets in committed files, ever.
Secrets live in Supabase Edge Function secrets and GitHub Actions secrets.
Referenced by name in code, never by value.

## Environment gotchas

This runs on **Windows 11**. Both PowerShell and Git Bash are available and they
need different syntax.

**Shell heredocs eat backslashes.** Writing a file with `cat <<'EOF'` collapses
`\s` to `s`, which silently breaks every regex in it. Use the Write tool for
anything regex heavy, or build patterns with `String.raw`. This has bitten twice.

**Git Bash mangles paths.** Arguments that look like paths get rewritten. Prefix
with `MSYS_NO_PATHCONV=1` when passing something like `--base /foo`.

**`/tmp` is invisible to Windows Node.** Write a file there from bash and then
`require` it from node and node cannot find it. Use the scratchpad directory.

**Do not extract text with `tr -d`.** It deletes characters, not strings.
`tr -d '<steamID64>'` strips every 6 and 4 out of the number. Use `sed -n
's/.*<tag>\([0-9]*\)<\/tag>.*/\1/p'`. This produced convincing but wrong Steam
IDs in one session.

## Supabase gotchas

These have each cost real time. Do not rediscover them.

**Grants are checked before policies.** Row level security policies are only
consulted after the table grant. A table with perfect policies and no grant
returns 401 and looks exactly like a broken login. Every new table needs
`grant ... to anon, authenticated`. See `0004_grants.sql`.

**service_role bypasses RLS but still needs grants.** This is the same trap
wearing a different hat and it is the most recent bug found. Bypassing the policy
is not the same as being allowed near the table. `0013_service_role_grants.sql`
fixes it globally including `alter default privileges`, so new tables are covered
automatically. Do not go back to granting per table.

To check a service_role grant, use `has_table_privilege('service_role','member',
'INSERT')`. Do **not** use `information_schema.role_table_grants`, which only
reports roles the current session belongs to and shows nothing for service_role
even when the grant is present.

**The dashboard often does not hydrate on a cold deep link.** Loading
`/functions/steam-auth/details` directly frequently renders nothing. Load
`/functions`, wait for the table, then click through. Client side navigation
works where a cold load does not. Same for the SQL editor: go to `/functions`
first, then use the sidebar link.

**Redeploying via "Deploy a new function" resets JWT verification to ON.**
Deploying in place from the function's own Code tab does not. Use the Code tab.
After any deploy, check the way a browser would, with no auth header at all:

```
curl -s -o /dev/null -w '%{http_code}\n' \
  https://zcpbpcktinlqnxmqddzc.supabase.co/functions/v1/steam-auth
```

302 is healthy. 401 means the toggle came back on and every member is locked out
while a curl carrying the anon key still looks fine. That asymmetry is why it
went unnoticed the first time.

**The "new function" editor pre-fills a random name.** If the name field does not
take, you get a stray function. There is one called `rapid-action` in the project
right now from exactly this, still awaiting deletion by River.

## Deploying

**Site:** `cd site && npm run build`, then copy `dist/` output to the repo root
and commit. Cloudflare publishes on push.

**SQL:** migrations are numbered in `site/db/`. `RUN_ME_next.sql` is the bundle
River runs. Applied through the dashboard SQL editor. Additive only where
possible: `create table if not exists`, `on conflict do update`.

**Edge functions:** dashboard, Edge Functions, the function, Code tab, Deploy
updates. Then re-check the JWT toggle as above.

## Current state

Live and verified:

- The site, on the domain, with TLS
- Steam sign in redirects correctly and Steam's login page names
  `coldstreamgaming.com` rather than the Supabase hostname. This required a
  static forwarder at `site/public/steam-return/` because OpenID 2.0 requires
  `return_to` to sit under `openid.realm`
- Steam groups: 8 groups, 589 memberships, 588 named, synced by the `steam-sync`
  edge function into `steam_group`, `steam_group_member`, `steam_group_snapshot`
- Migrations `0000` through `0010`, plus `0012` and `0013`
- **Steam sign in completes end to end.** First real sign in landed 2026-08-21 at
  19:01 UTC and wrote a `member` row with a real Steam ID, persona and avatar.
  Earlier sections of HANDOFF, up to and including 25, say this was unproven with
  zero rows in `member`. That is now out of date. It was blocked by the missing
  service_role grant fixed in `0013`, and it started working once that landed.
- Cloudflare "Always Use HTTPS" is on. Plain http 301s to https.

Known broken or pending:

- **`0011_enlistment_book` has never been run**, so `enlistment` 404s and the Join
  page's book is dead. 0011 also creates the table with policies but no grants, so
  the order that works is: run 0011, then run 0012 again.
- **Nightly database backups are not running.** The workflow exists and is
  correct; the `SUPABASE_SERVICE_ROLE_KEY` GitHub secret was never set. This is
  the largest outstanding risk to a project whose stated goal is to outlast
  everything.
- **River's own member row has `role = 'member'`, not `'admin'`.** He is the
  community owner. Anything gated on admin will refuse him until that is changed.
  Ask before changing it rather than assuming.
- The operator account has not been created.
- `site/tsconfig.tsbuildinfo` is tracked and churns on every build, dirtying the
  tree and blocking rebases. Probably wants gitignoring.

## Working alongside other agents

More than one agent works on this repo at once, in separate sessions, and they
coordinate only through `HANDOFF.md`. Treat it as the shared log.

- **Append, never rewrite.** New section at the end, numbered, dated, with whose
  side it came from.
- **Say what you verified and how**, not just what you changed. "Verified against
  the deployed source, 180 lines, no live roster call" is useful. "Fixed it" is
  not.
- **Pull and rebase before pushing.** Concurrent sessions collide regularly.
- If another agent left an action item for you, do it or say why not.

Recent relevant sections: **27** is the Steam API work and the service_role bug,
**26** is three gallery specs drafted but not built, **25** is a full sign in
audit.

## Things not to do

- Do not use em dashes.
- Do not commit secrets. The repo is public.
- Do not put a Steam Web API key anywhere near the frontend. Beyond the obvious,
  the Steam Web API sends no CORS headers, so a browser cannot call it anyway.
  Server side only, through an edge function.
- Do not scrape `forums.taleworlds.com`. It sits behind a Cloudflare challenge
  and River explicitly said to stop trying after browser automation crashed his
  session.
- Do not hand edit anything in `site/src/seed/`. Regenerate with
  `npm run seed --prefix site`.
- Do not post anything to Discord without River's say so. The rules rewrite and
  the welcome sign are drafted and deliberately on hold.
- Do not delete anything on River's behalf without asking, including the stray
  `rapid-action` function.
