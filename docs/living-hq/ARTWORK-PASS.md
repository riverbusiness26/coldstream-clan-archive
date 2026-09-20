# Museum artwork pass, 2026-09-11

Local preview only: http://127.0.0.1:4180/#/landing

## Current website assets

- `site/public/museum/landing-campaign-v3.png`: landscape formation, reference-led crimson colour, officer flintlock pistol, adjusted arm and standard bearer's face.
- `site/public/museum/landing-mobile-v3.png`: dedicated portrait composition with the same corrections.
- `site/public/museum/emblem-{events,leaderboard,history,media,profile,join}-keyed.png`: six 1254px square RGBA display emblems. Landing cards display them at 128px desktop and 108px phone sizes.

Green-screen originals are preserved in `concepts/chroma-masters/`. These six masters were generated against a flat #00FF00 background, without intentional green spill or background shadows. The website uses their keyed transparent copies, never the green masters. Battlefield hero scenery is intentional and retained.

`node docs/living-hq/concepts/key-emblems.mjs` regenerates the transparent PNG exports from those masters using Sharp. Green-dominant pixels alone are keyed; neutral dark recesses, cloth and metal remain opaque. Measured fully transparent pixel percentages: events 64.9, leaderboard 52.5, history 46.1, media 63.3, profile 48.8, join 66.4. Original generation outputs remain in the Codex generated-images directory.

## Generation direction

Detailed museum display objects in aged brass, silver, crimson cloth and ivory; no green theme, sunset or golden-hour illumination. Subjects: regimental arms for Events, trophy for Leaderboard, book and quill for History, frame/play symbol for Media, portrait shield for Member HQ, bugle for Join.

Green master edit prompt: preserve the entire emblem, texture, proportions and composition; replace only the outside background and background visible through gaps with perfectly flat chroma-key green #00FF00; no gradient, pattern, checkerboard, shadow on green or green spill; preserve dark recesses and material surfaces; clean outline and generous square margins.

Hero edits retained the composition while replacing the officer's sword with a Napoleonic British officer flintlock pistol, then adjusting arm proportions and repairing the standard bearer's face. The heraldry is interpretive reference-led artwork, not a certified historical reconstruction. The existing site crest is unchanged.

## Verification and limits

Browser checked at 1280px and 390px: current v3 hero sources loaded, no horizontal overflow. All six keyed emblems loaded. Desktop cards reached opacity 1 after reveal; fixed effect cleanup so React Strict Mode remounts do not strand cards at opacity 0. Portrait composition visually inspected. Reduced-motion CSS retained; full cross-browser, reduced-motion runtime and authenticated regressions remain outstanding.

This pass does not publish, change live data, or replace the full website artwork inventory. Earlier comparison concepts are historical drafts; use the current local website link above for review.
