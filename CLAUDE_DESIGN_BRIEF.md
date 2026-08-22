# Coldstream Gaming layout brief

This is the current brief for a design pass. It describes the real product,
not a mockup that still needs to be invented.

## The community

Coldstream Gaming is River's gaming community, established in 2011. The site
has two jobs that must feel like one home:

1. Let current members meet, share screenshots and films, plan events, talk
   in the shoutbox, and find game servers.
2. Preserve the record people made together. The Archive contains 384 sourced
   names, 362 dated events, recovered screenshots, films, Steam groups, and
   old community posts.

The site should feel established, welcoming, and built to last. It is not an
esports team landing page, a generic SaaS dashboard, or a military roleplay
site. The core feeling is old friends getting together around whatever game
they are playing.

## Product decisions already made

- The landing page is video only. Use the community's own footage, not a
  screenshot carousel.
- The public home page is a noticeboard, not a marketing funnel.
- There are no forums. Conversation happens in the shoutbox and Discord.
- Gallery uploads are a main community feature. Members submit images or
  YouTube videos into categories, then a moderator checks them in.
- The Archive is separate from live member material. Recovered content needs
  its date and source visible. New uploads are clearly labelled as member
  material.
- Steam sign in is the only member login. It is already live.
- The site needs to work comfortably on a phone as well as a desktop.

## What is already working

| Area | Current capability |
| --- | --- |
| Landing | Community footage, mark, concise entry point |
| Home | Next event, live and recovered news, shoutbox, Discord widget, member presence, server strip, sourced community figures |
| Archive | Six community chapters, roster, event record, Steam groups, rank ladder, films, provenance |
| Gallery | Recovered screenshots, category filters, member image uploads, YouTube submissions, moderation controls |
| Events | Calendar and admin-managed event records |
| Profiles | Steam identity, member about box, wall, recent games, selected Steam game stats |
| Servers | Server page and live game-server status work in progress |
| Admin | Back office for news, gallery moderation, events, and site management |

The layout pass should build around these real functions. Do not replace a
working feature with a static card that loses what it does.

## Suggested information hierarchy

### Landing

Keep it sparse. The video should carry the atmosphere, with the Coldstream
mark, the line "A gaming community, est. 2011. The games changed. We did not."
and "Second to None" used as a supporting signature. The primary action is
entering the community site, not a long scroll of statistics.

### Home

The first useful thing should be the next event or current activity. Give the
shoutbox and people currently around enough visual weight to make the site
feel inhabited. News should be legible and calm. The server strip should feel
like a live utility, not a decorative grid.

### Gallery

This deserves the strongest design attention. Make it feel like a carefully
kept collection instead of a loose feed. The recovered half should read like
an archival contact sheet, while the member half should invite contribution.
Show category, game, year, member, and video state without burying the image.
The submission form should be easy on mobile and moderation should be obvious
to admins and moderators without being visible to ordinary members.

### Archive

Treat it like a record room with life in it. Chapters, timeline, names, event
counts, and sources should be easy to navigate without turning it into a
history textbook. Use provenance as a small but confident visual language,
not as clutter.

### Profiles

Profiles should feel personal and earned. Steam identity, a short About box,
recent games, shared wall activity, and optional game stats should read as one
member page rather than disconnected widgets.

### Servers

Make live server status easy to scan: game identity, status, players, map or
mode when available, and a clear join path when a server is public. Do not
show empty placeholder metrics as if they are live.

## Visual direction

Take the structure and community density people remember from the old Enjin
style sites, then make it cleaner and more deliberate. The visual language
should be dark, restrained, game-adjacent, and durable. It can carry subtle
regimental character through the globe mark, navy, brass, frost, paper, or
metal textures, but should not become costume drama.

Use real footage, recovered photographs, and game artwork as evidence. Avoid
stock photos, fake player counts, invented awards, empty sponsor rails, and
generic AI imagery. Let the archive material do the work.

## Non negotiable language and content rules

- No em dashes anywhere.
- Use gaming community as the community noun.
- Roles are member, moderator, and admin.
- Call the historical chapters eras, never renames or rebrands.
- Never invent a number. Every quantitative display needs a source or clear
  live-data state.
- Do not flatten every period of the community into a list of name changes.
  The main public story foregrounds the 21stPA beginning, 2nd Coldstream, and
  Coldstream Gaming.

## Code landmarks for implementation

- `site/src/views/Landing.tsx`: video landing page
- `site/src/views/Home.tsx`: home page modules
- `site/src/views/Gallery.tsx`: gallery and member submissions
- `site/src/views/Archive.tsx`: history and record
- `site/src/views/Profile.tsx`: member profile
- `site/src/views/Servers.tsx`: server tracker
- `site/src/styles.css`: shared visual system
- `brand/` and root image files: existing visual assets

Read `AGENTS.md` and check `claims/` before changing any of these files.
