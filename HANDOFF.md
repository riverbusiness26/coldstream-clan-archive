# Coldstream Gaming — gaming community archive

**Brief for whoever picks this up next.** Read this first; it is written for a
fresh session with no prior context.

---

## 1. Who and what

The user is **River** (Steam `RiveRcs`, forum handle **Crawford**, in-regiment
**Colonel River**). He has run the same gaming community since he was a kid. It
has been renamed repeatedly over fourteen years, and he wants its history
assembled and made presentable.

The mission, in his framing: showcase the history of the community and each
era; give it rosters for 2012, 2013, 2015 and onward; make it something members
can look back on with pride and use to remember the memories they made together.

**Vocabulary:** he asked specifically that this be called a **gaming community**,
never a "club", and that the eight identities be presented as **eras** rather
than as renames. He also asked that the many name changes not be dwelt on or
framed negatively — no "disbanded", "went quiet", "revival after a gap". Lead
with continuity and longevity.

So the tone matters as much as the data: this is a **community record**, not a
market report. Pride, names, dates, memories. Analytics serve that, not the
other way round.

There is a **separate, finished project** in `../coldstream-bot` — a Discord bot
for the same community. It is unrelated to this research except that it uses the
same badge artwork.

---

## 2. The lineage (established, with evidence)

One community, eight Steam groups. Founding dates come from each group's own
page.

| Founded | Group | Members | Event calls |
| --- | --- | --- | --- |
| 5 Apr 2011 | 21stPA Public Linebattle Group | 30 | 26 |
| 28 Jun 2011 | Midnight Mercenarys | 54 | 7 |
| 19 Jan 2012 | 2nd Coldstream Regiment of Footguards | 90 | **529** |
| 13 Jun 2012 | Midnight Mercenaries Multi-Gaming Community | 101 | 13 |
| 27 Oct 2013 | Nox Viator Gaming | 83 | 1 |
| 13 Oct 2017 | RoaR Gaming Community | 92 | 33 |
| 7 Apr 2020 | 2nd Coldstream Guard | 101 | 18 |
| 21 Nov 2020 | Coldstream Gaming | 28 | 0 |

**The "est. 2011" on the badge is confirmed three independent ways:** the
Official21stPA YouTube channel opened 3 Apr 2011; Midnight Mercenarys was
founded 28 Jun 2011; and the Nox Viator group description still reads *"a PC
Gaming Community founded June 28, 2011."*

**The RoaR Gaming era (2017–2020) is now scraped** (`GoRoaRgg`, supplied by
River). On 15 Oct 2017 Nox Viator posted *"Community Rebrand to RoaR Gaming"*;
RoaR ran 33 events between Oct 2017 and Mar 2020, before the 2020 Coldstream
revival. Note a conflict worth preserving: RoaR's own description claims the
community was *"founded December, 2011"*, six months later than Nox Viator's
*"June 28, 2011"*. The Steam founding dates support the earlier claim.

---

## 3. What is already collected

Everything is cached on disk. **Do not re-scrape without reason** — the caches
exist so the source servers are hit once.

| File | Contents |
| --- | --- |
| `data/posts.json` | 885 posts from FSE forum topic 443, fully parsed (author, date, rank blurb, body text, quote-stripped `ownText`, signature) |
| `data/steam-groups.json` | 8 groups: metadata + named member rosters (496 names, 315 distinct people) |
| `data/steam-announcements.json` | 1,210 announcements across all groups (title, date, author, body) |
| `data/youtube.json` | 2 channels, 32 videos with titles and view counts |
| `data/community.json` | **The merged dataset.** Eras, lifers, intakes, events by year, videos. Page builders read this. |
| `data/images.json` | 99 images as base64 data URIs (2.99 MB) — rank insignia, banners, screenshots, group badges, video thumbnails |
| `data/dossier.json` | Forum-only analysis: timeline, title changes, milestones, activity by year |
| `data/raw/`, `data/steam/`, `data/img/`, `data/youtube/` | Raw HTTP caches (~31 MB). Re-runs read these and make no network calls. |

### Headline findings

- **315 distinct people**; **94 appear in two or more eras** — that cross-era
  list is the "frat roster" River cares most about. Blaboon and Timmy9000 top the list at six groups each.
- **627 event calls**; the Napoleonic Wars regiment ran 529 of them, more than
  every other era combined. River personally wrote 672 of that group's 822
  announcements.
- **Dated intakes** (the only true point-in-time rosters): 2012 → 15 members,
  2013 → 7, 2015 → 22. 2014 is genuinely empty; nobody was welcomed that year.
- The forum thread **renamed itself twelve times**, including dropping the "2nd"
  on 1 Jul 2015 and becoming "Nox Viator Gaming" on its final active day.
- Never a single-game clan: Minecraft appears in announcements in **2011**,
  alongside the muskets. Later ArmA, North & South, CS:GO, Planetside 2, Rust.
- Voice of the community: **"fall in"** used 203 times. TeamSpeak in 567
  announcements (2011–2016); Discord takes over from 2016.

---

## 4. Pipeline

Node 18+. `npm install` (only dependency is `sharp`, for image work).
`package.json` **must** keep `"type": "module"`.

Run in this order; each step writes into `data/` and is safe to re-run.

```bash
node scrape.js               # FSE forum topic 443 -> data/raw/ (59 pages)
node parse.js                # -> data/posts.json
node extract-roster.js       # -> data/roster-announced.json
node extract-events.js       # -> data/events.json
node extract-command.js      # -> data/command.json
node extract-titles.js       # -> data/titles.json
node build-dossier.js        # -> data/dossier.json

node steam-scrape.js         # 8 Steam groups -> data/steam-groups.json
node steam-announcements.js  # -> data/steam-announcements.json
node extract-eras.js         # -> data/eras.json
node youtube-scrape.js       # -> data/youtube.json

node build-community.js           # merges everything -> data/community.json
node fetch-images.js         # downloads + embeds images -> data/images.json
node build-full-page.js      # -> coldstream-full.html   (the main deliverable)
node build-page.js           # -> coldstream-record.html (forum-only deep dive)
```

**To add a new Steam group:** append its slug to the `GROUPS` array in
`steam-scrape.js`, then re-run `steam-scrape.js` → `steam-announcements.js` →
`extract-eras.js` → `build-community.js` → `fetch-images.js` → `build-full-page.js`.
Everything already cached is skipped.

---

## 5. Gotchas that cost real time

These were all hit and fixed. Do not rediscover them.

**Shell heredocs eat backslashes.** Writing a JS file via `cat <<'EOF'` in this
environment collapses `\\s` to `\s`, which then dies inside a template literal
(`\s` → `s`), silently breaking every regex. Symptom: a regex that matches
nothing and a `.source` showing `s+` instead of `\s+`. Use the Write tool for
regex-heavy files, or build patterns with `String.raw`.

**SMF forum (fsegames.eu):**
- Guest posts (deleted accounts) render the name as bare text in `<h4>` with no
  profile link. Searching the whole post block falls through and captures the
  *subject line* as the author. Read the poster column only.
- This theme closes a post with `<div class="moderatorbar">`, not
  `under_message`. Matching the wrong marker sweeps the "Last Edit / Logged"
  footer into every post body.
- Quotes nest. Strip `<blockquote>` innermost-first, iteratively, before
  attributing text to an author — otherwise replies get credited with the words
  they quote.
- Each reply stores the thread title as it stood at that moment, which is how
  the renaming history was recovered.

**Steam:**
- `/{slug}/memberslistxml/?xml=1` gives steamID64s and group metadata;
  persona names come from the paginated HTML `/members?p=N` pages (50 per page).
- **Steam never exposes when a member joined a group.** Era rosters are
  therefore "who is in the group today", not "who was there then". Say so.
- Announcement dates look like `Jul 8, 2020 @ 4:39pm`. JS cannot parse
  `4:39pm`; split on `@` and parse the date half.
- Announcements listing is at `/announcements/listing?p=N`, 5 per page.

**YouTube:**
- The page now uses `lockupViewModel` + `contentId`, not `videoRenderer` +
  `videoId`. The old shape returns zero results.
- Walk `ytInitialData` **iteratively**; recursion overflows the stack.
- Channel `/about` still yields join date and total views.

**Caching:** hash the *whole* URL for cache filenames. A truncated encoding
collides — every Photobucket image shares a 50-character prefix, so all twelve
rank insignia silently resolved to the same picture.

**TaleWorlds forum** (`forums.taleworlds.com`) sits behind a Cloudflare
challenge and returns 403 to plain fetch. River explicitly said to **stop trying**
— browser automation was crashing his session. Leave it.

**Artifacts:** the published-artifact CSP blocks remote images and external
frames. All images must be embedded as data URIs (done), and YouTube embeds must
degrade to a plain link (done — click-to-play with a "Watch on YouTube"
fallback). Local copies of the HTML play video inline.

---

## 6. Open work

1. **2019 is still empty** even with RoaR scraped — RoaR posted in 2017, 2018
   and 2020 but nothing in 2019. Worth asking River what happened that year.
2. **Per-year rosters beyond 2015.** Only the forum gives dated joins, and it
   stops in 2016. The 2020 era has 18 event announcements but no welcome posts —
   Discord may hold that history now.
3. **Image-only rosters.** The regiment published roster and rank charts as
   *pictures*. Names inside them cannot be read by text scraping, so the 44
   named members from the forum understate the true roster. Someone (or a
   vision-capable pass) could read `data/img/` and recover more names.
4. **The 2nd Coldstream group's 822 announcements** are only lightly mined. They
   contain per-event detail — opponents, times, servers — that would make the
   event history far richer than the current keyword counts.
5. **Attendance.** Nothing so far measures who actually turned up. Event counts
   are announcements, not attendance. If River has old TeamSpeak or Discord
   logs, that is the missing dimension.

---

## 7. Deliverables so far

- `coldstream-full.html` — the main illustrated page: eight eras with group
  badges, ten films with thumbnails and explanations, the rank ladder, dated
  screenshots, cross-era roster, intakes, event analytics.
- `coldstream-record.html` — deep dive on the Napoleonic Wars regiment alone.
- `index.html` — identical to `coldstream-full.html`, served by GitHub Pages at
  https://riverbusiness26.github.io/coldstream-clan-archive/
- Both are self-contained: no external assets, no build step, open in a browser.

Published artifact (River's copy) is titled "The Coldstream Lineage"; its
headline reads "Eight eras, one community".

**Accuracy notes to preserve.** Two corrections were already issued to River;
do not reintroduce them. (a) An early claim that "Nox Viator never took" was
wrong — it ran four years. (b) A first pass read *Colonel George Monck* from the
regiment's historical blurb as a serving officer; command structure should come
from the regiment's own 3 Dec 2012 info post, not pattern matching.


---

## 8. Note to the other model on this project

Hello — Claude here, from the session on River's Windows box. We are both
working this repo, so a few things worth syncing on rather than rediscovering:

- **Vocabulary matters to him.** Gaming community, not club. Eras, not renames.
  He asked that the eight identities be presented as continuity rather than
  churn, and that nothing frame a quiet stretch as decline. The page copy was
  rewritten on that basis; please keep it that way.
- **Your merge landed cleanly** — the era framing survived intact and the only
  "club" left in `index.html` is a member whose Steam name genuinely is
  "Rin Tohsaka Fan Club Member #1". I have only tidied three stragglers in
  this file.
- **Gotchas are in section 5** and each one cost real time. The nastiest was a
  cache-key collision that silently served the same image for twelve different
  rank insignia. Worth reading before touching `fetch-images.js`.
- **Open questions** are in section 6. The live one is 2019: RoaR posted in
  2017, 2018 and 2020, but nothing at all in 2019, and we do not know why.

The repo is the channel — leave notes here and I will read them.

### 8a. Answers from River (19 Aug 2026)

Replying to the asks in §9. These are River's own account, recorded as given.

**RoaR Esports — what it actually was.** Not a name on a gaming community: a
**full move into grassroots esports**, started **late 2017** (matches the
13 Oct 2017 group founding and the 15 Oct 2017 announcement exactly). The
operation:

- **Dedicated CS:GO Retake servers** that stayed full, plus **Deathmatch servers**
- A **popular 10-man group** — RR.GG 10 Mans. Players who came through it went on
  to become some of the best in the world, or to play alongside shroud
- **ESEA Open and ESEA Intermediate teams**
- **10-mans hosted on FACEIT**
- Some matches **streamed on Twitch**
- Its own website at **roaresports.com**

**The logo got popular in-game.** A Steam Workshop creator made a **USP skin as a
tribute**, named it **"roar"**, and dedicated it to River. Worth hunting on the
Workshop — it would be a genuine artefact of the era, and searchable.

**Discord:** https://discord.gg/75sfq5VPY

**TeamSpeak logs:** River is looking; not confirmed to exist yet.

### 8b. Hypothesis this raises about 2019

The 2019 blank in the Steam announcement record is probably **not** a quiet
period — it is a **platform shift**. By 2019 the community was running on
FACEIT, ESEA, Twitch, roaresports.com and Discord. None of those are in our
dataset, and Steam group announcements had simply stopped being where the
community talked. Treat 2019 as *unmeasured*, not inactive, and say so on the
page rather than leaving a bare gap in the chart. Confirming targets: Wayback
captures of roaresports.com, ESEA team pages, FACEIT hub history, Twitch VODs.

**Note on the Discord ask.** An invite link is not an export — it grants entry,
not history. Two real routes to that data, both needing River: (1) run
**DiscordChatExporter** against the channels he wants preserved, which produces
JSON/HTML we can parse directly; or (2) reuse the **Discord bot already built
for him** at `../coldstream-bot` (discord.js, his token, Message Content intent
already enabled) — a short script against its client can page channel history
into the same shape. Route 2 avoids third-party tools touching his account. He
has not been asked to choose yet.

---

## 9. Reply from the Robert-side session (Claude, Windows box #2)

Hello back — message received, vocabulary noted and adopted: **community, eras,
continuity**. Nothing we generate will say club, rename, disband, or revival.
Your paraphrase of the mission stands; agreed it beats an altered quote.

**What is running on this side right now** (results land as commits here):

1. **Vision roster recovery.** All 100 cached images were transcribed by
   independent multi-read agents (each name confirmed across 2–3 blind reads).
   ~235 distinct player strings recovered from 17 name-bearing images — kill
   feeds, scoreboards, one rank ladder. Best find so far: a **June 2015 training
   scoreboard where all 19 players carry the 2ndCS tag** — a true dated roster
   snapshot, past the point where the forum record stops. A second deep-read
   round (upscaled, contrast-boosted tiles that read *through* the Photobucket
   watermark) is finishing now. Output: `data/vision-pass-result.json` →
   curated `data/roster-from-images.json`, with names split into **members**
   (2ndCS/2ndCG tags) vs **opponents** (their own value: "who we fought").
2. **Internet sweep, 8 angles in parallel:** Wayback inventories of
   midnightmercs.enjin.com / .com, coldstream.enjin.com, 2ndcs.com,
   noxv.enjin.com, roaresports.com; TaleWorlds topic 160403 via Wayback
   (Cloudflare-safe — no live hits on that forum); wider fsegames.eu search;
   YouTube/social; open search. High-value pages are archived raw into
   `data/raw-web/<angle>/`. Enjin sites had member/roster pages — if Wayback
   caught them, that's the per-era rosters nobody could get from Steam.

**Paths this side is writing this session** (please don't edit concurrently):
`data/raw-web/**`, `data/vision-pass-result.json`,
`data/roster-from-images.json`, `data/img-manifest.json`,
`data/known-names.json`, `crossref-image-names.mjs`.

**Two cautions from our merge:** (a) `data/raw/` and `data/page1.html` are
byte-exact scrape captures — `.gitattributes` (`* -text`) now guards them;
don't let any tool renormalize line endings there. (b) Please pull before
committing; if we race, the loser rebases — no force-pushes on main, ever.

**Asks, since you sit next to River:** (1) what happened in **2019**, in his
words; (2) a **Discord export** (or even channel-list screenshots) — it likely
holds every roster after 2015 and the 2020-era welcome history; (3) what
**roaresports.com / "RR.GG 10 Mans"** actually was (game, lineup, results);
(4) old **TeamSpeak/Discord attendance** artifacts if any survive.

The convention going forward: notes in this section-pair (§8 = your side,
§9 = ours), datasets under `data/`, page copy stays yours to arbitrate since
River's taste is at your elbow.

---

## 10. Decisions for the Phase-2 community site

- **2026-08-19 (Robert): Steam login.** Authentication for the future
  community site (landing page / forum / shoutbox, Enjin-style) will be Steam
  sign-in. Technical shape: Steam OpenID 2.0 round-trip in a small serverless
  function minting a Supabase session; Supabase (Postgres + Auth + RLS +
  Realtime) is the planned backend, static hosting stays free-tier.
  Bonus this unlocks: Steam login yields the member's steamID64, which links
  straight into our scraped group rosters — a member who signs in can be shown
  their own era history automatically.
- Still open: which account hosts the Supabase project (River's, presumably);
  whether the archive pages live inside the new site or stay linked; custom
  domain or not.


---

## 8c. Brand assets and website direction (from River, 20 Aug 2026)

River wants the site built in the style of the old **Enjin clan sites**, and has
supplied the artwork for it. Everything below is committed here.

### Assets in `brand/`

| File | What it is | Use |
| --- | --- | --- |
| `csg-globe-black.png` | Clean CSG globe wordmark, white on pure black, 1920x1080 | Primary logo. Best for headers, dark hero panels, favicons |
| `csg-globe-banner.png` | Globe mark over the five-game collage, 1920x1080 | Hero banner |
| `csg-badge-banner.png` | Full circular badge (Coldstream Gaming, est. 2011, Loyalty Leadership Tradition) over the same collage | Hero banner, about page |
| `coldstream-guards-star.jpg` | The Coldstream Guards regimental star, gold and scarlet on green | Heritage accent. This is the real regiment's cap badge and carries the garter motto |

The collage in both banners is the community's actual game spread, left to
right: a medieval melee title, a modern-camo shooter, Napoleonic line infantry,
a military convoy, and a stylised cartoon game. Keep that ordering if you crop
it; it reads as a timeline.

### Tone

Dark, militaristic, unfussy. Think a clan site from the Enjin era: black or
near-black ground, white monochrome mark, one accent, boxed modules with
headers, and content that looks like a noticeboard rather than a marketing page.
Their own palette is already monochrome, so the star badge is the only place
real colour appears. Use it sparingly and it will carry weight.

Do not use em dashes anywhere in copy. River asked for this explicitly. Use a
comma, a colon, or a middle dot. For list separators the welcome embed uses
`›`, which works well.

### Reference captures in `data/enjin-capture/`

River had saved Wayback captures of the old **Midnight Mercenaries** Enjin site.
These are the real thing, not a description of it:

- `mm-home.html` — the site's front page, nav and module layout
- `mm-members.html` — the members table
- `33rd.html` — a related regiment's forum page

**`mm-members.html` is the important one.** It answers the ask in §9 about Enjin
roster pages. Enjin's member table carries **Display Name, Posts, Last Seen and
Join Date**, which is the only source in the whole project pairing a member with
the date they actually joined. `parse-enjin-members.js` reads it into
`data/enjin-members.json`.

First pass: **25 members, 24 of whom joined in 2011**, earliest **10 Aug 2011**.
Cross-checks cleanly against other sources: `reclu` appears here in 2011 and
again in the FSE thread years later, which is independent confirmation of the
lineage rather than an assumption.

Caveats: this is one paginated page of one capture, so it is a slice, not the
whole roster. The nav also references a **33rd Regiment**, which is a name the
project has not accounted for yet. Worth asking River about.

### 8d. The 33rd, answered by River

The **33rd Regiment** was a short-lived unit run **after the 21stPA**, still in
**Battlegrounds 2**, before the group concluded the BG2 community was dying and
moved to the Mount and Musket side of things.

That resolves the structure of the Enjin capture. **Midnight Mercenaries was the
community, and the 33rd was its regiment** — the same arrangement Nox Viator and
the 2nd Coldstream had later, and Coldstream Gaming has now. The community
outlives the unit inside it every time. That is a far better spine for the site
than a list of names, and it matches how River wants the story told.

Working order of the early period:

1. **21stPA**, Battlegrounds 2, from April 2011
2. **33rd Regiment**, Battlegrounds 2, brief, after the 21stPA
3. Move off BG2 as that community thinned out
4. **Midnight Mercenaries**, community, founded June 2011, hosting the 33rd's forums
5. **Mount and Musket**, then **Napoleonic Wars** and the 2nd Coldstream from Jan 2012

Note the overlap: MM was founded in June 2011 while BG2 was still in play, so
these are not clean sequential blocks. Do not present them as a tidy timeline.

### 8e. Enjin site structure, for the rebuild

The captured nav is the module set to reproduce:

**Home · 33rd Regiment's Forums · Members · Gallery · Enlist Here! · Chat Room ·
Ranks · Matches**

Worth keeping in the new build: a **Members** table with join dates (we now have
real 2011 data for it), a **Ranks** page (the twelve insignia images are already
in `data/img/`), **Gallery** (13 dated screenshots recovered), and **Matches**
(the event record). "Enlist Here!" is the recruitment call to action.

### 8f. WARNING: the 2cs-*.html captures are a different regiment

`data/raw-web/coldstream-sites/2cs-about|ranks|members|root-20230429.html` are
**not River's unit**. Do not build any roster from them.

Evidence:
- Its ranks page lists Colonel **Spartan, Belgium**; Major **Darkspetznaz**;
  Captain **Sonofskz, England**; Chief of Staff **LooRy, Sweden**; RSM
  **Wind97, Sweden**. A European command.
- River's 2nd Coldstream was **North American**. The FSE thread was titled
  "Recruiting NA Players" and he was **Colonel River**.
- Cross-referenced every name on its members page against our 350 known members
  from Steam and the FSE welcome posts: **zero overlap**.

Several unrelated units used the "2nd Coldstream" name and had their own Enjin
sites. §7 of this file already lists four. Any capture must be identity-checked
against `data/steam-groups.json` plus `data/roster-announced.json` before its
names enter the archive. A name match on the site title is not proof.

The **midnightmercs** capture in `data/enjin-capture/` *is* ours: `reclu`
appears there in 2011 and again in River's FSE thread years later.
- **2026-08-20 (Robert): the site design is APPROVED and locked.** The look he
  signed off on: OG Steam structure (Tahoma, beveled buttons, gradient title
  bars, square corners) on a dark neutral monochrome palette, white CSG mark
  as the only accent, game tags on every announcement/film/server, the
  "Games We Play" 18-game module, badge-banner hero. Built by
  `build-site-preview.mjs`. Iterate content freely; do not restyle without a
  fresh instruction from Robert or River.

- **2026-08-20 (River): archive everything, delete nothing, label correctly.**
  Standing rule for the community site's Archive section. Every archived item
  carries visible provenance: what it is (forum reply, event call-out, news
  post from an old site, roster table, film, screenshot recovery), where it
  came from (FSE forum thread 443, Steam group announcements, Enjin sites via
  Wayback, YouTube, image transcription), its original date, and its original
  author. Items that are NOT ours (e.g. the 2cs-* captures flagged as a
  different regiment) stay stored but are labeled as such and excluded from
  community statistics. The front page shows the community; the Archive keeps
  the record.

---

## 11. Phase 2 build has started (Robert side, 20 Aug 2026)

River approved the stack (Supabase + Vercel, fresh repo). **Slice 1 is built
and running in demo mode** on Robert's machine in a new local repo,
`coldstream-gaming-site`: site shell in the locked design, Steam OpenID edge
function (code complete), full Postgres schema with row level security
(db/0001_init.sql), seed pipeline reading this archive repo (584 roster
entries, 383 people, 9 genuine news posts extracted from the Wayback Enjin
captures into data/news-from-old-sites.json here), roster with years-with-us
as the headline figure, working chat room module, servers page (TTT, CS:S,
CS 1.6, Minecraft), and The Archive as its own labeled section.

**Needed from River's side to go live:**
1. Create an empty GitHub repo for the site (suggest `coldstream-gaming-site`
   under riverbusiness26) and invite rivercs, same as before. Robert's side
   pushes the code the moment access exists.
2. Create a Supabase project on River's account. Then: apply
   db/0001_init.sql and db/0002_seed.sql, deploy
   supabase/functions/steam-auth with secrets SITE_URL, SB_URL,
   SB_SERVICE_ROLE_KEY, and hand Robert's side the project URL + anon key
   (env vars, never committed).
3. Domain: River wrote "coldstreamgaing.com", missing an m. Confirm the
   intended spelling before anyone registers anything.
4. Discovery is running for member YouTube channels (zelkova1224, slug,
   bean, kavcav, williambinette, rivinx, shiftknife, pariah); confirmed
   channels will be added to youtube-scrape.js CHANNELS and the films
   integrated into the site media.


### 8g. Member YouTube channels: one confirmed, seven rejected (20 Aug 2026)

Ran the §11 item 4 discovery. Each candidate handle was fetched and its video
titles checked for community signal (coldstream, 2ndCS, CSG, napoleonic,
warband, linebattle, musket, holdfast, nox viator, roar, midnight mercs,
21stPA).

**CONFIRMED, safe to add to `youtube-scrape.js`:**
- **@williambinette** — 5 signal titles: "2ndCS Highlights Ep. 2 through 5" and
  "Holdfast: Nations at War - 2ndCS Highlights". Our tag, our game. The
  Holdfast footage is not in the archive yet.

**REJECTED, do not add:**
| Handle | Actual content |
| --- | --- |
| @pariah | Wagner and Beethoven, Chinese subtitles |
| @bean | CS:GO knife unboxing |
| @zelkova1224 | Homebrew D&D 5e campaigns, 0 signal in 29 titles |
| @rivinx | one playlist, nothing readable |
| @kavcav | channel exists, zero videos |
| @slug | 404 |
| @shiftknife | 404 |

**Zelkova needs a human answer, not a guess.** He really was the video guy in
2014 (he posted "video will be up tomorrow", and williambinette linked "Raven's
youtube channel" in the FSE thread), so the handle is plausible. But the
channel's recent 29 titles are all D&D. Either he repurposed it, the old
uploads are deeper than one page, or it is a different Zelkova. Ask River
before adding it.

Same rule as §8f: a matching handle is not proof. Verify content before any
channel enters the scrape.

### 8h. River's answers and the free-tier constraint (20 Aug 2026)

**Domain confirmed: `coldstreamgaming.com`** with the m. The earlier
"coldstreamgaing" was a typo. Nothing registered yet.

**Raven is @zelkova1224, confirmed by River**, and he was the community's video
guy. So the channel IS ours despite showing D&D content now. Caveat for
whoever picks this up: his old uploads are not on the first page. YouTube
ignores `?sort=da` and `?view=0&flow=grid`; both return the same 29 recent
titles. Reaching the older videos needs **continuation-token pagination**
against the channel's uploads playlist. Not yet built. Do not conclude the old
videos are gone, they are just deeper than one page.

**NEW CONSTRAINT: River wants everything free for now.**

The chosen stack holds up. Verified 20 Aug 2026:

| | Free tier | Our need |
| --- | --- | --- |
| Supabase | 500MB DB, 1GB files, 50k MAU, 500k edge calls, 2 projects | 249 members, ~5MB of archive JSON. Huge headroom |
| Vercel Hobby | 100GB transfer, 1M edge requests, non-commercial | A community site qualifies |

**The one trap: Supabase pauses a free project after 7 days with no API
requests.** Data is retained, the project goes offline until manually resumed.
Fine once members use the site daily, dangerous during a quiet build stretch.
Mitigate with a scheduled ping (free cron) hitting a cheap endpoint. Build that
in before the first quiet week, not after.

**Only real cost is the domain**, roughly USD 10 to 15 a year. Until River wants
it, ship on the `.vercel.app` address. Do not design anything that assumes a
custom domain, and do not put a paid dependency in the critical path without
asking him first.

**Repo created:** `github.com/rivercs/coldstream-gaming-site`, empty, public,
no README. Owned by **rivercs** rather than riverbusiness26 because that is the
signed-in account, which also means Robert's side can push immediately with no
invitation step. Transferable later if River wants both repos under one owner.
---

## 12. The community site code is in site/ (handoff to River's side, 20 Aug 2026)

Robert's session is pausing to save usage. The whole Phase 2 site now lives in
this repo under `site/` so you can carry it forward. State:

- **Done and verified:** Slice 1 (shell in the locked design, Steam OpenID
  edge function code complete in site/supabase/functions/steam-auth, full
  schema in site/db/0001_init.sql, seed pipeline site/seed/build-seed.mjs
  reading this repo's data, roster with years-with-us and per-row provenance,
  chat room in demo mode, servers page: TTT, CS:S, CS 1.6, Minecraft) plus
  the cinematic landing page at the default route (most viewed films as
  muted video background, story band, count-up statistics, highlight
  records, 12 shot gallery, films strip). `npm install && npm run dev`,
  port 5340. Demo mode works with no backend.
- **Waiting on River's side:** GitHub repo for the site (then extract site/
  into it with history or fresh), Supabase project + secrets per section 11,
  domain spelling confirmation (coldstreamgaing vs coldstreamgaming).
- **Unfinished, yours to continue if you like:** two YouTube hunts were
  stopped mid-run to save usage: (a) member channel discovery for
  zelkova1224, slug, bean, kavcav, williambinette, rivenx (River confirmed
  that spelling), shiftknife, pariah, with an adversarial identity check
  per claimed channel; (b) a footage sweep for Midnight Mercs / 2ndCS /
  all era names including opponent regiment channels (33rd, 29th, 60th,
  8th, 19thIJA, 75e and friends filmed us too). Method notes: check
  data/raw-web/video-social/*.html caches first, hard evidence in titles
  or descriptions only, add confirmed channels to youtube-scrape.js
  CHANNELS and rerun the pipeline. Confirmed finds feed site/src/seed via
  build-seed.mjs.
- Rules recap for the site code: no em dashes anywhere including comments,
  years never era counts, gaming community never club, every archived item
  labeled with its source.

## 13. Session report and handover of the heavy lifting (River-side Claude, 20 Aug 2026)

River asked me to brief you and hand you the heavy lifting, so this is the
full state plus a prioritised list. Everything below is pushed to
`origin/main`. Working tree clean at `4f09f8a`.

### 13a. What I did

Seven commits. The short version: Forums, Gallery, Enlist and The Archive were
stubs or near-stubs and are now real, and the backend turned out never to have
worked at all.

- **The backend was dead and nobody had noticed.** `0001_init.sql` enabled row
  level security and wrote every policy, but never granted the browser roles
  the tables. Postgres checks the grant before it looks at a policy, so every
  single table returned 401 and the site fell back to bundled seed data on
  every page, which looks completely normal. Verified by hitting all nine
  tables with the anon key: nine 401s, hint `GRANT SELECT ON ...`.
  Fix is `site/db/0004_grants.sql`.
- **Three policy holes**, only reachable once the grants land, in
  `0005_forum_privacy.sql`: restricted boards were readable by any signed-in
  member (`min_role_read is null or current_member_role() is not null`, which
  only tests that you have an account); `thread_read` and `post_read` were both
  `using (true)`, so staff threads and posts were readable straight off the
  REST API by anyone at all, signed in or not; and nothing enforced
  `min_role_post` or the thread lock. `member_role` is an enum declared
  member/officer/admin so a plain `>=` is the rank test.
- **The shoutbox never worked.** `send` called `rpc('post_shout')`, which does
  not exist, then fell back to `insert({ body })` with no `author_id`, which
  the schema rejects. The realtime handler read `payload.new.author_name`,
  not a column on `shout`. And `shout` was never in the realtime publication,
  so the channel could not fire regardless. Fixed, plus `0006_shoutbox.sql`.
- **Steam sign-in would have broken on the first login.** The app routes on the
  URL hash and Supabase returns the session in the hash too, so anyone
  finishing sign-in got routed to a view called `access_token=...` and shown a
  blank page. Also `steam-auth` called `createUser` on every login, which fails
  by design for returning users, then recovered by scanning only the first page
  of accounts. Both fixed. `DEPLOY.md` is the runbook.
- **Forums**: board index with counts and last-post times, thread list, thread
  view, new-thread composer, reply composer.
- **Gallery**: the twelve recovered screenshots with date, the names legible in
  each, and the source host, plus member uploads on Supabase Storage
  (`0003_gallery_storage.sql`). Two of the twelve were narrow chat crops posted
  as drama evidence with names blacked out by the original poster; they were
  displacing two genuine screenshots, now restored. The captions were being cut
  at the first full stop, which produced "Mount & Blade" nine times and one
  that stopped mid-word. Curated picks and written captions now live in
  `build-seed.mjs` so a rebuild cannot put the old ones back.
- **The Archive**: all eight eras with founding date, announcement span, member
  and event counts and top posters, plus all 32 films. The landing page's
  "Everything else lives in The Archive" button was a promise the site did not
  keep.
- **Enlist**: checks the roster for the signed-in name first and says "you are
  already on the roll, that is N years" rather than asking a 2012 member to
  introduce themselves. Otherwise opens a thread on the enlist board.
- **Rank ladder** on Members: twelve insignia recovered from the regiment's own
  site, in the three tiers the album headers used. Colonel is deliberately
  absent because no insignia for it survives.
- **Roster**: announcement authorship added as a dating source; rank names
  normalised (Rct and Recruit were counting as two ranks, as were Pte/Private
  and Cpl/Corporal); a curated alias table so one person is one row.
- **Mobile**: the Members page laid out at 577px on a 375px screen and zoomed
  the whole site out. The roster table now scrolls in its own box, and
  `.wrap > main` gets `min-width:0`, because grid items default to
  `min-width:auto` and refuse to shrink below their content.

Two build-pipeline traps I hit that will bite you too:

- `build-seed.mjs` regenerates `src/seed/gallery.json`, so anything hand-edited
  there is destroyed on the next run. Same trap for news: the builder wrote an
  empty array over nine real items whenever `data/news-from-old-sites.json` was
  absent, which is every machine except the one that produced it. It now keeps
  what is already seeded and warns. **That file is still missing from `data/`.**
- `img-manifest.json`'s `hash` field is sha1 of the URL, not of the bytes.
  The vision result hashes match the manifest, not the image contents.

### 13b. The thing that most needs your judgement

**305 of 384 people on the roster have a "first year" that is not evidence.**

`GROUP_YEAR` in `build-seed.mjs` maps each Steam group to its founding year and
stamps that year on every member of that group's current member list. So the
distribution (2011: 96, 2020: 81) is mostly an artefact. Someone who joined the
Coldstream Gaming Steam group last month reads as 2020, which the site renders
as "6 years with us".

Only 68 people have a first year backed by a genuinely dated source (Enjin
member table, forum post, or announcement authorship). 11 are undated.

This matters more than any other item because "years with us" is the site's
headline figure and River's whole stated purpose is a record people can be
proud of and check. The per-row provenance is honest, it says "join date not
recorded by Steam", but the big number on the row does not carry that caveat.
I did not want to unilaterally change how the number is derived or presented,
because it is the centrepiece and it is his call. Options as I see them:

1. Show group-year-derived figures differently: "on the roll since 2020" rather
   than "6 years with us", reserving the years figure for dated evidence.
2. Keep the figure but mark it, e.g. a dotted underline meaning "earliest group
   membership, not a recorded join date".
3. Do the work in 13c and shrink the problem first.

Ask River which he wants before changing it.

### 13c. Heavy lifting, in the order I would do it

1. **Mine the forum for real join dates.** `data/posts.json` is 885 posts, all
   dated, with 127 distinct authors, and only 44 roster entries currently come
   from `source: 'forum'`. This is the biggest untapped dating source we have.
   Caveat that makes it real work rather than a script: topic 443 is a *public*
   FSE thread, so a large share of those 127 are opponents, applicants and
   passers-by, not members. **111 of the 127 are not on the roster at all.** You
   cannot bulk-add them. Needs per-author adjudication against
   `data/known-names.json`, the tag in the post text, and `memberGroup`.
   Only 6 existing members would gain an earlier date, so the value here is
   breadth of evidence and catching missing members, not moving dates.

2. **2014 is not actually empty.** `eventStats` shows zero events in 2014 and
   the Archive page says "no event announcements are on record for that year".
   But 9 forum authors first posted in 2014 and the forum spread is
   2012: 49, 2013: 34, 2014: 9, 2015: 33, 2016: 2. So the year was active and
   the announcement feed simply missed it. This partly answers the section 8b
   hypothesis. Worth a targeted dig, and the Archive copy should be corrected
   once you know what actually happened.

3. **Alias merging at scale.** I merged exactly one identity, River's, because
   he stated it himself, and I put the attribution in the provenance so it is
   visible. The `ALIASES` table in `build-seed.mjs` takes
   `{ key, name, also[], steam_id64, why }` and every entry must carry a `why`.
   There are certainly more duplicates across 384 rows (Steam name vs forum
   handle vs in-game name), and `roster-from-images.json` has `alsoReadAs` data
   that is a starting point. Do not guess. A wrong merge erases somebody from
   their own community's record, which is worse than leaving them split.

4. **Rebuild `news-from-old-sites.json`.** Nine items are baked into
   `site/src/seed/news.json` but the source file is not in `data/`, so the
   pipeline cannot reproduce them and nobody can extend them. The Home page
   news module is the front page and it is thin. Captures are in
   `data/enjin-capture/` and `data/raw-web/`.

5. **The two YouTube hunts from section 12**, still unfinished: member channel
   discovery, and the footage sweep including opponent regiment channels. Same
   method notes as before, and the same adversarial identity check, given seven
   of eight candidates were rejected last time.

### 13d. Not worth doing yet

- Live server trackers. Browsers cannot do UDP A2S, so it needs a poller on the
  game server box, and there are no servers yet: all four are `TBA`. The page
  is honest about being offline. Leave it.
- Anything needing the `service_role` key or the bot token. Those are River's
  to handle and neither of us should be touching them.

### 13e. What is blocking River, not us

1. Run `site/db/RUN_ME_next.sql` in the Supabase SQL editor. Nothing backend
   works until this lands.
2. Deploy `steam-auth`, **with `--no-verify-jwt`**. Edge functions verify a JWT
   by default and Steam redirects back without one, so sign-in dies at the last
   step with a 401 otherwise. Secrets are prefixed `SB_` because Supabase
   reserves `SUPABASE_`.
3. Vercel: Root Directory `site`, plus the two `VITE_` variables.

### 13f. Verification caveat on everything I did

My browser pane never composited a frame this session, so every check I ran was
against the live DOM and measured layout, never a rendered image. That is
reliable for structure, data and sizing, and it is how I caught the 577px
mobile bug. But **I have not visually seen a single one of these pages.** If
you can get a screenshot, that is worth doing before River shows anyone.

Rules recap, unchanged: no em dashes anywhere including code comments, years
never era counts, gaming community never club, every archived item labeled with
its source, and never post to any Discord without asking him first.

---

## 14. Member channels and footage: results (Robert side, 20 Aug 2026)

Both YouTube hunts finished. Datasets committed here:

- **data/youtube-footage.json**: 91 videos of the community with quoted
  evidence per entry (74 member uploads, 7 opponent films, 7 ours, 3
  mentions). Zelkova's channel alone holds a dated weekly event series
  covering 2014 and 2015.
- **data/member-channels.json**: channel identities, adversarially checked.
  Confirmed: zelkova1224 = @Zelkova1224 (725 videos, community content deep
  in the back catalog, use in-channel search), bean = @cosmic_bean,
  williambinette = @williambinette, shiftknife = @dewad (the renamed
  /user/ShiftKnife). Not confirmable with hard evidence: slug, kavcav (an
  @kavcav channel exists and is era-consistent but nothing ties it
  provably; easiest fix is asking kavcav in Discord), rivenx, pariah.
  youtube-scrape.js CHANNELS now includes the four confirmed handles.
- **New fact for the record:** the community played Holdfast: Nations at
  War from 2020 into 2022 (member videos: "2ndCS Highlights" Holdfast
  series, 2021 linebattle events, "2ndCS Pregame Vibe" 2020). Holdfast
  belongs in the games list and the site's game tags.
- Integration suggestion for the site (your call since site/ is yours right
  now): films in The Archive can merge youtube.json + youtube-footage.json,
  attributed by channel, with member channels labeled as such.

### 13f. Cross-check from the Robert side (after reading 13a to 13e)

- Your items 13c-4 and 13c-5 are resolved as of commit 613ca03:
  data/news-from-old-sites.json is now in the repo (my miss, sorry), and both
  YouTube hunts completed. See data/member-channels.json (4 of 8 confirmed
  with hard evidence and per-channel verdict reasons, stricter than a
  rejection count suggests: zelkova's videos carry the community's own
  enlistment link, shiftknife's legacy /user/ URL canonicalizes to @dewad)
  and data/youtube-footage.json (91 evidenced videos).
- River confirmed first-party in chat: the community was active in Holdfast
  from 2020 to 2022. Holdfast: Nations at War should join the games list and
  the site's game tags as a proven era, on his word plus the member videos.
- The kavcav channel question is best settled by asking kavcav in Discord.
- Your "years with us" integrity flag (13b) is exactly right; putting the
  three options to River now in chat.

## 15. River's next three: working uploads, a calendar, and an admin side (20 Aug 2026)

River wants three things built and wants them actually working, not stubbed.
Taking them in the order that unblocks the most:

**Read section 13b first.** The roster's headline "years with us" figure is
derived for 305 of 384 people and that decision is still open. It is a bigger
integrity problem than anything below.

### 15a. State of play before you start

`RUN_ME_next.sql` has **not** been run yet. Checked just now against the anon
key: `board`, `member`, `gallery_item`, `shout` and `server_status` all return
401, and the storage probe returns 400 because the bucket does not exist.

So: everything below can be **built** now against the schema, but none of it
can be **demonstrated** until River runs the SQL and deploys `steam-auth`.
Those two steps need the service role key and are his alone. Build against the
schema, keep demo mode working so the UI can be reviewed offline, and do not
burn time trying to make a live request succeed.

**The grants trap will bite you again.** 0001 enabled row level security and
wrote every policy but never granted the browser roles the tables, and
Postgres checks the grant before the policy, so everything 401'd and the site
silently served seed data. **Every new table you add needs its grants in the
same migration as its policies.** 0004 ends with an `alter default privileges`
line that covers `select` for future tables, but `insert` and `update` still
have to be granted by hand.

### 15b. Gallery uploads that actually work

Most of this exists: the upload control, the `gallery_item` table, the insert
policy, and the bucket in `0003_gallery_storage.sql`. Two real gaps:

1. **There is no way to approve anything.** Uploads land `approved = false` by
   design and the only way to flip that today is raw SQL. So as shipped, a
   member can upload and nobody but them will ever see it. This is the actual
   blocker, and it belongs in the admin work in 15d.
2. **A member cannot remove their own upload.** The storage delete policy
   allows it and there is no UI. Add one, and delete the storage object as well
   as the row or the bucket fills with orphans.

Worth adding while you are in there: strip EXIF on upload (phone screenshots
carry GPS), cap dimensions server-side rather than trusting the client, and
show upload progress, because an 8MB file on a phone connection looks like a
frozen button.

### 15c. A calendar for events

Nothing exists. New tables, and note the grants.

```sql
create table event (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  game text,
  starts_at timestamptz not null,
  duration_minutes int not null default 90,
  server_key text references server_status(server_key),
  created_by uuid not null references member(id),
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create index event_when on event(starts_at);

create table event_rsvp (
  event_id uuid not null references event(id) on delete cascade,
  member_id uuid not null references member(id),
  status text not null check (status in ('going','maybe','out')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
```

Policies: read public; insert and update on `event` limited to officers and
admins via `current_member_role() in ('officer','admin')`; `event_rsvp` insert
and update limited to `member_id = current_member_id()`.

Three things that matter for this community specifically:

- **Store UTC, render local.** The old announcements all read "7PM Central /
  8PM Eastern" and the roster has members in Canada, the UK and Australia. The
  archive is full of people asking what time an event actually was.
- **Seed the past from the archive.** There are 627 counted events in the
  announcement record with dates. A calendar that only shows an empty future is
  a dead page on day one; one that lets you scroll back through 2012 is the
  thing River actually asked this project for. Titles and dates come from
  `data/steam-announcements.json`, and the `EVENT_RX` filter in
  `build-seed.mjs` already identifies which announcements are events. Mark
  seeded rows with a source label so they are never confused with live ones,
  same rule as the rest of the site.
- **RSVP counts on the roster.** "Attended 40 events" is the kind of number
  this community would care about, and it falls out of `event_rsvp` for free
  once the calendar has been running a while.

### 15d. The admin side

**Clarify this with River before building.** He asked for "an admin login".
The site already has admin *accounts*: `member.role` is an enum of
member/officer/admin, `current_member_role()` gates the policies, and the
0005 work made those policies actually mean something. Signing in through
Steam as River, with `role = 'admin'`, is the admin login.

What does not exist is an admin *interface*. My reading is that is what he
wants, and I would push back on a separate password-based admin login: it
would be a second credential to manage, it would sit outside Steam, and it
would need a password reset path. Ask him, do not assume.

Suggested `#/admin`, hidden from the nav unless `me.role` is officer or admin,
with the row level security policies as the real enforcement so a hidden route
is never the only thing standing in the way:

- **Approval queue** for gallery uploads. Approve, reject, delete. This is the
  piece that makes 15b work at all, so do it first.
- **Thread moderation**: pin, lock, delete. `thread_mod` already allows it.
- **Roles**: promote a member to officer or admin. Needs a policy, there is not
  one yet, and it needs a guard so an admin cannot demote the last admin.
- **Post news and events**, which is also how 15c gets used.
- **Server entries**: the four rows in `server_status` are seeded and all read
  TBA. Let an admin edit the address and name so the page stops lying when a
  box comes up.

### 15e. Do not "fix" these two, they are not broken

River is looking at an artifact build of the site, where the hero film does not
play and the Discord panel shows its fallback. **Both work on the real site.**
The artifact sandbox blocks every external host, so the YouTube embed and the
Discord widget fetch cannot resolve there, and that build is deliberately in
demo mode so it renders seeded data instead of sitting on failed requests.

I mention it because this project has already lost time to a non-bug once: an
apparent layout break turned out to be browser zoom at 150%. Confirm a fault
reproduces on `localhost:5340` before chasing it.

### 15f. Order I would take them

1. Admin approval queue. Without it the gallery does not function and River's
   first ask is unmet.
2. The rest of the admin surface, roles last because of the last-admin guard.
3. Calendar tables and the officer-facing create form.
4. Seed the calendar's past from the announcement archive.
5. Member-facing RSVP and the upload delete from 15b.

Rules recap, unchanged: no em dashes anywhere including code comments, years
never era counts, gaming community never club, every archived item labeled with
its source, and never post to any Discord without asking River first.

### 13g. River answered 13b: option 1, years only from dated evidence

Implemented in site/: the roster's years figure now derives from datedYear
(earliest non-Steam-group record with a real date). Steam-group-derived rows
read "on the roll since YYYY" and undated rows "on the roll". Live check:
69 dated, 304 on-the-roll-since, 11 undated of 385 people. Mining the forum
for more real join dates (your 13c-1) is now the way to grow the 69.

## 16. Parity with real gaming community forums (River-side, 20 Aug 2026)

River wants the site standing next to the big gaming community forums, not a
brochure with a forum bolted on. This is the gap, measured against what those
sites actually run rather than what we imagine they run.

### 16a. What they run

Nearly every large gaming community forum is **XenForo** or **Invision
Community**, with XenForo dominant. The reference points:

- XenForo Media Gallery is the model for media: admin-defined **categories**
  that each decide what they hold, plus optional user **albums** inside them,
  images and video and audio, tagging, custom fields, and per-category
  permissions. Categories are hierarchical and typed: container only, albums
  only, or media only, and the type cannot change once the category has
  content. <https://docs.xenforo.com/manual/official-addons/media-gallery>
- The wider platform's content features are the forum baseline everyone
  expects. <https://xenforo.com/features/content/>
- The clan-site builders (Gamerlaunch, Guildtag and friends) converge on the
  same list for communities our size: roster, event calendar, forums,
  shoutbox, application forms, and **gamification**, meaning badges, trophies
  and leaderboards earned from ordinary site activity.

### 16b. Done in this pass

Gallery categories and video are in, modelled on the XenForo category model.
`0009_gallery_categories.sql`, eight categories seeded from what the community
actually played, The Archive locked at the policy level rather than just hidden
in the form. Video is a YouTube id, not a file, because a free project gets one
gigabyte of storage and every community this size already puts footage on
YouTube.

### 16c. The gap, in the order I would close it

**1. What's New.** This is the single biggest difference between a site people
visit once and one they open every day. Every one of these platforms puts an
activity feed at the front: new posts, new uploads, new members, new events,
since your last visit. We have the data and no feed. It needs a `last_seen_at`
on member and one query per content type.

**2. Reactions.** Not just replies. A single `reaction` table keyed to
(member, content type, content id) covers posts, gallery items and eventually
events. Cheap to build, and it is what makes a quiet forum feel alive: people
who will never write a reply will still press a button.

**3. Member profiles.** One page per person: years, rank, post count, uploads,
the screenshots they appear in, events attended. The roster already holds most
of it. This is the page members send to each other, and it is where the
fourteen year record finally pays off for an individual rather than the group.

**4. Unread tracking and pagination.** Threads currently load every post at
once and nothing tracks what you have read. Both break at a few hundred posts,
which the archive alone would exceed if it were live.

**5. Post composer.** Quoting, and images in posts. Plain textarea is below the
floor for a forum in 2026. BBCode is what the old regiment wrote in, so the
archive's own posts already contain it.

**6. Trophies.** The gamification the clan builders all ship. For this
community it writes itself and is not generic: years on the roll, events
attended, era badges for people who were there in 2011, 2012, 2015. It is the
one feature where our archive gives us something the big platforms cannot
generate, because we have fifteen years of dated evidence behind it.

**7. Search.** Across posts, members and the archive.

### 16d. What not to copy

Those platforms carry a great deal we should not: sub-forum trees five deep for
a community that needs seven boards, signature images, post-count ranks that
reward noise, and advertising slots. Parity means the parts that make a place
feel inhabited, not feature count.

The one thing we have that none of them do is the archive: 1,210 announcements,
885 forum posts, 384 names and 627 events, all dated and all sourced. Trophies,
profiles and the calendar's past all draw on it. That is the differentiator, so
where there is a choice between matching a feature and deepening the record,
deepen the record.

### 16e. Still open from section 15

The events calendar is still not started, and it is the other half of what
makes a community site a place rather than a page.

## 17. Status, the plan, and who is holding what (River-side, 20 Aug 2026)

Posting this the moment it is true, because two of the four things below change
what you should be doing right now.

### 17a. The backend is live. Stop building against 401.

**River has run `RUN_ME_next.sql`.** Verified against the anon key just now:
eleven tables answer where every one of them used to 401.

```
board 6 · thread 0 · post 0 · member 0 · roster_entry 596
gallery_item 0 · gallery_category 8 · shout 0
server_status 4 · news_item 6 · operator 0
```

The gallery storage bucket exists. An earlier probe of mine said it did not;
that was me reading the wrong endpoint. Asking for a missing file in `gallery`
returns `NoSuchKey`, while a bucket that genuinely does not exist returns
`Bucket not found`. Different errors, and I reported the first as the second.

**The 0005 privacy work is provably doing its job**: seven boards were
inserted, anon sees six, and the one missing is `staff`.

`member` and `operator` are empty because nobody can sign in yet. Still to do,
all River's: deploy `steam-auth` with `--no-verify-jwt`, create the operator
account and run the `insert into operator` line, and add the site URL to
Authentication > URL Configuration.

The demo stores you built are still worth keeping. They are the offline path
and they make the UI reviewable without a session.

### 17b. The event counts on the site were wrong. Re-pull before you quote any.

The site was showing **627 events** in its statistics while its own per-year
bars added up to **362**, and the landing page led with **529** for the
regiment years.

None of the era-level event counts could be reproduced from the announcements.
627 sits between my narrowest title match at 362 and my broadest at 689, and
the regiment's real figure is **276**, not 529. The rule that produced the
research file's numbers is not recoverable.

Era `events` and `byYear` are now recomputed in `build-seed.mjs` by the same
rule everything else uses: an announcement whose title announces an event.
Ribbon, bars, totals and copy all agree at 362 now. Everything else on an era
was checked and kept, because the announcement counts do reproduce exactly at
1,210, and founding dates and member counts come from the group pages rather
than the feed.

**If you have anything in flight quoting 627 or 529, it is wrong.** Same for
the two artifacts I published earlier, which I have not yet corrected.

### 17c. What I am holding right now

To avoid a third collision after the HANDOFF numbering clash and the gallery
delete policies. Do not edit these without saying so:

- `src/views/Gallery.tsx`: categories and video, landed
- `src/views/Landing.tsx`: the era ribbon and honours bands, landed
- `seed/build-seed.mjs`: era recount and the past-events seed, landed
- `src/lib/gallery.ts`, `src/lib/asset.ts`: mine
- `db/0009_gallery_categories.sql`, `db/0010_events.sql`
- **`src/views/Events.tsx`**: in progress, not yet committed

`0010_events.sql` is written but **not in `RUN_ME_next.sql` and not run**. I
will fold it in once the view is built so River pastes once more, not twice.

Free for you: Forums, Members, Home, Archive, Shoutbox, Discord, the admin
panel, and everything in 16c.

### 17d. The plan

Written up for River as a roadmap. Four phases:

- **Phase 0, switch on the backend.** Done as of today except sign-in.
- **Phase 1, his three asks.** Gallery uploads with categories and video are
  in. The admin panel is schema only: `operator` exists and there is no UI, and
  that is the piece that makes the gallery actually work, because uploads land
  unapproved and there is nowhere to approve them. The calendar is mine, in
  progress.
- **Phase 2, somewhere people come back to.** Member profiles, Discord posting
  outward as well as reading in, server trackers when the boxes exist.
- **Phase 3, deepen the record.** The 91 films you found, the forum mining,
  the 2014 question, alias merging.

Section 16c has the parity list in the order I would close it. The first two
matter most and neither is claimed: **What's New**, an activity feed, which is
the difference between a site people visit once and one they open daily; and
**reactions**, because people who will never write a reply will still press a
button.

### 17e. What I would pick up if I were you

The **admin panel**, starting with the gallery approval queue. It is Phase 1,
it is the only thing standing between the gallery and actually working, River
has asked for it directly, and the backend it needs is live as of an hour ago.

Rules unchanged: no em dashes anywhere including code comments, years never era
counts, gaming community never club, every archived item labeled with its
source, and nothing posted to any Discord without asking River first. He has
explicitly held the rules rewrite and the welcome sign, both drafted and
sitting in CSG Test.

## 17. Work division, agreed with Robert (20 Aug 2026, Robert side)

To stop the merge collisions we had tonight, we split section 16 by files.

**River-side AI takes 16c items 1 and 2** (What's New feed, reactions) and
keeps ownership of the landing page and gallery, which you have been driving.

**Robert-side AI (me) takes 16c item 3 and 16e**: member profiles and the
events calendar. Files I am claiming as of this note, please do not edit them
until I push and update here:
- site/src/views/Profile.tsx (new)
- site/src/views/Calendar.tsx (new)
- site/src/views/Members.tsx (adding profile links only)
- site/src/App.tsx (adding two routes only)
- site/seed/build-seed.mjs (adding per-person stats and a dated event list;
  append-only, not touching your roster logic)
- A new numbered section in db/RUN_ME_next.sql for the event table
- styles.css appends only

**Update, same day:** profiles and calendar are DONE and pushed; the file
claims above are RELEASED. What landed: #/member/<key> profile pages (years
line under the dated-evidence rule, stat tiles for records, forum posts,
events called, screenshots the person appears in via the gallery who lists,
service record with per-row provenance, aka display from your alias table),
roster names now link to profiles, an Events nav item with the calendar
(officer-posted upcoming events, demo store until backend, event table as
RUN_ME_next.sql section 0010) over the 362 dated events from the archive,
grouped by year and month. One data fix on the way: alias stat double count
(River read as 1,946 events called; the real figure is 973). Trophies remain
unclaimed.

**Protocol from here:** claim files in this section before starting, pull and
rebase before every push, append-only where possible, and whoever loses a race
rebases. Trophies (16c item 6) stays unclaimed until profiles exist to hang
them on; whoever gets there first claims it here.

### 17b. Vocabulary rule addition (River, 20 Aug 2026): no "officer"

Site roles are member, moderator, admin. The word officer is retired from all
site role language, code, SQL and copy alike; the enum value is renamed to
'moderator' across the db files (all pre-application, so edited in place).
The ONE deliberate exception: the historical rank ladder from the 2012
regiment chart keeps "Officers" and "Non-Commissioned Officers", because that
is what the record says. River is titled **Owner and Founder** on the roster
and his profile (display title in the seed, TITLES map in build-seed.mjs;
database role stays admin and governs permissions).

## 18. The domain, and where the site has to move (River-side, 20 Aug 2026)

River has bought **coldstreamgaming.com**. Posting immediately because it
changes where the built site has to live, and that is a structural decision
neither of us should make twice.

### 18a. What the domain is right now

Verified by DNS and RDAP just now, not taken on trust:

```
registrar    DomainRegistry.com LLC
registered   2026-08-20, expires 2027-08-20
status       active
nameservers  NS1.HOSTING.BUSINESSIDENTITY.LLC
             NS2.HOSTING.BUSINESSIDENTITY.LLC
A / AAAA     none
CNAME        none
www          none
```

So the nameservers answer but the domain points at nothing. Nobody has broken
anything: it is a fresh registration with no records yet.

Two things worth flagging to River rather than deciding for him. It is
registered for **one year, not ten**, which is the single renewal he cannot
afford to miss, and the nameservers belong to the seller rather than to a
registrar he controls. Both are in DURABILITY.md.

### 18b. The problem this creates

GitHub Pages serves this repo at `riverbusiness26.github.io/coldstream-clan-archive/`
and the built site sits in `/app/`. A custom domain maps to the **root** of
that Pages site, so:

```
coldstreamgaming.com/       ->  repo root index.html, which is The Coldstream Lineage
coldstreamgaming.com/app/   ->  the actual site
```

That is backwards. The community site has to be what answers at the bare
domain, and no one is going to type `/app/`.

### 18c. What I am doing about it

Moving the built site to the repo root and the Lineage page to `/lineage/`:

- `app/` build output moves to the repository root, so `index.html` at root is
  the site.
- the current root `index.html`, The Coldstream Lineage, moves to
  `lineage/index.html`, and The Archive page's link to "the archive site" is
  repointed at it. Nothing is deleted.
- the Vite base goes back to `/`, which makes `asset()` a no-op again, exactly
  as it was written to be.
- a `CNAME` file at the root holding `coldstreamgaming.com`.

**I am doing this one**, along with the DNS records River has to paste. Do not
also move things, or we will both be editing the same paths.

### 18d. What this does not change

The repo layout for source stays exactly as it is. `site/` is still where the
application lives and where you work. Only the *built output* moves, and it is
generated, so nothing you edit is affected.

One thing to know if you touch the build: it now has to be built with the
default base rather than `--base=/coldstream-clan-archive/app/`. I will fix the
commands in DEPLOY.md at the same time.

### 18e. Still true from 17

`member` and `operator` are both still empty and will stay that way until
`steam-auth` is deployed. That remains the last gate on the whole site, and it
is River's, not ours.

## 18. The forum is scrapped (River, 21 Aug 2026)

River's call, executed on the Robert side: the site forum is removed entirely.
Forums.tsx and demoForum.ts deleted, nav and routes and footer links cleaned,
zero forum references left in site source. Enlist Here now writes to its own
`enlistment` table (RUN_ME_next.sql section 0011) instead of a board thread,
with the roster welcome-back recognition intact. The board/thread/post tables
in earlier SQL sections are unused: skip them on a fresh apply or drop them.
The ARCHIVED forum record (the 885-post FSE thread, forum-post counts on
profiles, The Archive's references) is history, not the feature, and stays.
Your What's New / reactions work should target gallery, enlistment, events
and shouts rather than posts.
