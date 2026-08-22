# Coldstream Gaming, community history

Scrapers and page builders that reconstruct the history of River's gaming
community (2011 – present) from public records.

**Start with [HANDOFF.md](HANDOFF.md)**: it carries the project brief, the
established findings, and the traps worth knowing before touching the code.

## Quick start

```bash
npm install
node build-full-page.js
```

That rebuilds `coldstream-full.html` from the cached data already in `data/`.
No network access needed; open the file in any browser.

## What's here

| | |
| --- | --- |
| `coldstream-full.html` | **The main page.** The eras, rosters, event stats, rank insignia, screenshots, ten explained films. Self-contained, all images embedded. |
| `coldstream-record.html` | Deep dive on the Napoleonic Wars regiment (2012–2016) alone. |
| `data/*.json` | Every derived dataset. `community.json` is the merged one the pages read. |
| `data/raw/`, `data/steam/`, `data/img/`, `data/youtube/` | Raw HTTP caches, so nothing needs re-fetching. |

## Published page

The repo root contains `index.html`, so enabling **GitHub Pages** (Settings →
Pages → Deploy from branch → `main` / root) publishes the archive at
`https://<user>.github.io/<repo>/` with no further setup. It is identical to
`coldstream-full.html` and fully self-contained, every image is embedded, so
there is nothing else to upload.

## Sources

- FSE forum topic 443, 885 posts, 59 pages (the Napoleonic Wars regiment)
- The Steam groups, membership, founding dates, 1,210 announcements
- Two YouTube channels, 32 videos

All fetched once, rate-limited, and cached. Re-running any script reads the
cache rather than hitting the servers again.

## Scripts

Scrapers: `scrape.js`, `steam-scrape.js`, `steam-announcements.js`,
`youtube-scrape.js`, `fetch-images.js`

Extractors: `parse.js`, `extract-roster.js`, `extract-events.js`,
`extract-command.js`, `extract-titles.js`, `extract-eras.js`,
`extract-regiments.js`

Builders: `build-dossier.js`, `build-community.js`, `build-page.js`,
`build-full-page.js`

Full run order is in [HANDOFF.md](HANDOFF.md#4-pipeline).

## Requirements

Node 18+. One dependency (`sharp`). `package.json` must keep
`"type": "module"`.
