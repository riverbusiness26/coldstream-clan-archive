# Start here

Read this once, on your first session. `AGENTS.md` is the short list of rules
you follow every session after that. `HANDOFF.md` is the running log between
agents. This file is the thing neither of those explains: what we are actually
doing and why it is built the way it is.

Last verified against the live systems on 2026-08-21. If you are reading this
later, run `node scripts/status.mjs` before you trust any sentence in the
"where things stand" section.

## What this is

**Coldstream Gaming** is a real gaming community that has been running since
2011. **River owns it.** It is his community, his call, and he is the one who
decides what is true about its history.

We are building two things that share one website:

1. **A living community site.** Steam sign in, a members roster, a gallery
   people upload to, an events board, a shoutbox, Discord presence, and game
   servers we run ourselves. The things a community actually uses.
2. **The Archive.** Fifteen years of this community's record, recovered from
   places that were about to lose it: Steam group announcements, an old Enjin
   site pulled back out of the Wayback Machine, forum threads, YouTube
   channels, and screenshots that were sitting on Photobucket one outage away
   from being gone for good.

The Archive is the part that makes this different from every other community
site. Anyone can stand up a roster. Almost nobody can tell you what their
community was doing in March 2013 and show you where that came from.

## The thing that matters most

**Never invent a number.** If the archive does not support a figure, it does
not go on the site.

This is not a style preference, it is the whole point. Real people who played
here in 2012 are going to read this and check it against their own memory. A
number that cannot be traced is worse than no number, because it quietly turns
a record into a story.

Two incidents made this a rule rather than a hope. A "627 events" figure was
on the site that nothing in the archive could reproduce, while the site's own
per year chart added up to 362. And Steam reported two different member counts
for the same group. In both cases the fix was the same: show the real number,
say where it came from, and where the record is thin say so on the page.

Anything quantitative gets a provenance line. Look at how the existing pages
do it before you add one.

## The story the Archive holds

One community, continuous, under several banners. The timeline currently runs
as six chapters:

| Years | Banner | Events called |
|---|---|---|
| 2011 | 21stPA Public Linebattle Group | 26 |
| 2011 to 2012 | Midnight Mercenaries and the 2nd Coldstream Regiment of Footguards, one unit under three group pages | 140 |
| 2013 to 2015 | Nox Viator, the community renamed, with the 2nd Coldstream carrying on as its sub group | 149 |
| 2017 to 2018 | RoaR Gaming, the Counter-Strike years, ESEA and FACEIT | 29 |
| 2020 | 2nd Coldstream Guard, the regiment name back over the door | 18 |
| 2020 to now | Coldstream Gaming | the present |

Those groupings are River's calls about his own history, not inferences from
the data. He merged three banners into one 2011 to 2012 chapter because they
were one unit, and he named the 2013 to 2015 chapter himself. The counts are
recomputed from 1,210 archived announcements by one rule, and they reconcile
to 362 events total. If you change how they are counted, they must still
reconcile, and you must say so on the page.

## Where things stand, verified 2026-08-21

**Live and working:**

- The site, on `coldstreamgaming.com`, over TLS, published from the repo root
- **Steam sign in works end to end.** One member row so far, River, admin
- The Archive: 384 people on the roster with 596 sourced entries, the rank
  ladder, the six chapter timeline, 362 dated events, 32 films, and the
  statistics, all on one page
- Gallery with member uploads and moderation, shoutbox, Discord presence,
  the enlistment book on the Join page
- The landing page is video only, by River's instruction: the community's own
  battle footage, the mark, and one button

**Not done yet:**

- **The gallery redesign.** River wants the screenshots to look properly
  professional. Three full design specs exist and were paid for, see
  HANDOFF. Judge them, graft the best parts together, build it. Do not start
  a fresh design pass.
- **Game servers.** River has bought an OVH VPS-3 and nothing is installed on
  it. The plan is LinuxGSM running Garry's Mod TTT, Counter-Strike Source,
  Counter-Strike 1.6 and Minecraft, with the Servers page showing live player
  counts. The server software is all free. A Steam Game Server Login Token is
  needed for the Source servers and is also free.
- **The patched `steam-auth` function is in the repo but not deployed.** It
  catches a network failure talking to Steam that currently returns a raw 500,
  stops a failed member upsert from issuing a session anyway, and stops a
  failed profile lookup renaming somebody to "Player 97257".
- **Nightly database backups are not switched on.** The workflow exists and
  needs a key set as a GitHub secret. Given the archive cannot be re collected,
  this is the highest value unglamorous job on the list.

## How the pieces fit

    Browser
      |
      |  static site, published from the repo root
      v
    Cloudflare Pages  ->  coldstreamgaming.com
      |
      |  supabase-js, publishable key, in the browser
      v
    Supabase  ->  Postgres with row level security
                  Auth, sessions issued through a magic link
                  Storage, gallery uploads
                  Edge functions: steam-auth, steam-sync

Steam sign in is worth understanding once, because its shape is not obvious
and every part of it was forced by something:

1. The browser hits the `steam-auth` function, which redirects to Steam.
2. Steam returns the browser to `coldstreamgaming.com/steam-return/`, a
   static page on our own domain, not to the function. This is because
   OpenID 2.0 requires `return_to` to sit under `openid.realm`, and pointing
   it at the function meant Steam told every member that a supabase.co
   hostname "is not affiliated with Steam or Valve".
3. That page forwards the OpenID parameters to the function, which verifies
   them with Steam, creates the auth user, upserts the member row, and issues
   a session through a one time link.
4. The session lands in the URL fragment. The site consumes it, clears the
   fragment, and carries the member to Home. It has to be carried
   deliberately: clearing the fragment fires a hashchange to an empty hash,
   which the router would otherwise read as "go to the landing video", and
   the member who just signed in would be thrown onto the splash screen.
5. **The apex is canonical.** Supabase deposits sessions on www because that
   is its Site URL, and browser sessions are per origin, so www folds onto the
   apex through a guard in the head of `index.html`. Two live origins meant a
   member could sign in on one and look like a guest on the other.

## How to plug in

1. `git pull --rebase`
2. `node scripts/status.mjs` and believe it over anything written down
3. Read `AGENTS.md` for the rules, then the last few sections of `HANDOFF.md`
   for what just happened
4. Read every file in `claims/` to see what the others are holding
5. Pick a lane (`claims/README.md`), write your claim in **your own file**,
   commit it on its own, push it before you start
6. Work in small commits, prefix the subject with your name, push often

The lanes exist so that most work needs no coordination at all. The claims
exist for the crossings. The one file per agent rule exists because a shared
claim list is itself a thing to collide on.

Two hazards worth knowing before you touch anything:

- **One deploy path only.** The site publishes from the repo root on push.
  A second path was used alongside it on 21 Aug and a file added at the repo
  root for it silently broke the push based build. The domain sat on an old
  deployment for about ninety minutes with two verified fixes in it, while
  the newer deployments looked perfectly healthy at their own URLs.
- **State goes stale within hours.** Two agents each wrote a "current state"
  section on the same day and both were wrong by evening. That is what
  `scripts/status.mjs` is for.

## The voice

Read a few files in `site/src` before writing new ones. Comments explain why
something is the way it is and name the failure being prevented, in plain
sentences. Site copy is written for the people who were there, not for
search engines.

And the house rules from River, which are not negotiable and are listed in
full at the top of `AGENTS.md`: no em dashes anywhere, it is a gaming
community and never a club, roles are member, moderator and admin, and
nothing is ever deleted, only labelled for what it is.
