# Working on this in Cowork

A cold start kit for an agent running in the cloud rather than on Robert's
machine. Read [ONBOARDING.md](ONBOARDING.md) once for what this project is
and [AGENTS.md](AGENTS.md) for the rules. This file covers the part those
two do not: what a cloud environment can and cannot reach here, and how to
get the site running from a fresh clone.

Verified against the live systems on 2026-08-22.

## Getting it running, and the one thing that will catch you

    git clone https://github.com/riverbusiness26/coldstream-clan-archive
    cd coldstream-clan-archive/site
    npm ci

**`site/.env` is gitignored, so a fresh clone builds in demo mode with no
backend at all.** Every page renders off the bundled seed data, sign in is a
local pretend, and nothing you test touches the real database. This is the
single most likely way to spend an hour confused, so do it first.

The two values are public by design: the URL is not a secret and the
publishable key ships inside the browser bundle on every page load, gated by
row level security. They are kept out of the repository because the repo is
public and a key in git is a bad habit even when the key is harmless. Recover
them from the live site rather than asking anyone:

    curl -s https://coldstreamgaming.com/ \
      | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1 \
      | xargs -I{} curl -s "https://coldstreamgaming.com/{}" \
      | grep -o 'https://[a-z]*\.supabase\.co\|sb_publishable_[A-Za-z0-9_-]*' \
      | sort -u

Then write them into `site/.env`:

    VITE_SUPABASE_URL=https://zcpbpcktinlqnxmqddzc.supabase.co
    VITE_SUPABASE_ANON_KEY=<the sb_publishable_ value>

Check it took: `npm run build` and then `grep -c supabase.co dist/assets/*.js`
should be non zero. If the site still says DEMO BUILD in the corner, the file
did not load.

Never put the service role key, the Steam Web API key or SYNC_SECRET in that
file or anywhere else in the repo. Nothing on the frontend needs them.

## What you can do from a cloud environment

- Everything in `site/src`: the whole frontend, the build, the styles
- `node scripts/status.mjs`, which asks the live site and database what is
  actually true right now. Run it before writing any sentence that begins
  "currently"
- Read live data through the public key, which is how the status script works
- Commit and push, if River has given the environment repository access

## What you cannot do, and must hand over instead

None of these are permission problems. The accounts simply are not reachable
from here, and pretending otherwise wastes a cycle each time:

- **Apply SQL.** The Supabase dashboard is River's login
- **Deploy edge functions.** Same
- **Publish to Cloudflare.** The site publishes from the repo root on push,
  so a push is a deploy, but a direct `wrangler` deploy needs an account
- **Reach the game server VPS.** Needs a key installed on the box

Hand these to Codex by appending to `HANDOFF.md` with today's date, saying
plainly what is needed and why it is theirs. That is how everything has moved
so far and it works.

## The rules that get broken most

Full list is in AGENTS.md. These are the ones that actually catch people:

- **No em dashes.** Anywhere, including commit messages and code comments.
  CI fails the build on one
- **Gaming community, never club or clan.** CI checks this too
- **Never invent a number.** If the archive does not support a figure it does
  not go on the site. Provenance lines on anything quantitative
- **Claim files in `claims/` before editing**, in your own file, and read the
  others first. Two agents in one file is the collision that keeps happening
- **Stage by name.** Never `git add -A` while somebody else is working

## Where things stand, 22 August 2026

Live and working: the site on coldstreamgaming.com, the Archive with 384
names and 362 events, Steam sign in, the gallery with moderation, the
shoutbox, the Discord widget, the admin back office, and the Steam presence
tracker.

Built and waiting on a deploy that is not ours to do:

    0017    news delete, shoutbox throttle          not applied
    0019    profiles, walls, recent games, stats    APPLIED
    steam-presence redeploy                          needed, two changes behind
    steam-auth redeploy                              needed, three fixes
    nightly backup key                               not set

The presence tracker works end to end and has River's row in it. The profile
tables exist but are empty, because the passes that fill them are in the
version of the function that has not been deployed yet.

## What is worth doing next

In rough order of value, and all of it is frontend work that a cloud
environment can do end to end:

1. **The Servers page is still placeholders.** Once the game servers exist it
   needs live player counts. The shape is already proven by the Steam
   presence tracker: a job writes a table, the page reads it
2. **Nobody has tested the site as a new member.** Sign in has been exercised
   once, by River. The first ten real members will find things neither agent
   can predict from here
3. **The gallery has 12 recovered screenshots.** There are more in `data/`
   that were never brought through to the seed
4. **Mobile has had less attention than desktop.** Worth a pass at 375px
   across every page

## The one habit that matters here

State goes stale within hours on this project. Two agents wrote a "current
state" section into HANDOFF on the same day and both were wrong by evening.
`node scripts/status.mjs` asks the live systems instead of trusting the log.
Run it at the start of a session and again before claiming anything is true.
