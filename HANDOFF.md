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
