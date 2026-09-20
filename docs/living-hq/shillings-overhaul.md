# Shillings overhaul, local review, 19 September 2026

## Approved rules implemented

- Quartermaster's Desk remains the home. Your Profile retains its clear name. Unreleased linebattle profile cards remain removed.
- Games are grouped into Cards and dice, With friends, Raids and schemes, and Weekly lottery. Blackjack, Lucky Dice, duels, Split or Steal, heist, crime, counter-steal and forage are retained.
- Split or Steal: one free 50-Shilling pot per member per Chicago calendar day. Secret choices. Split/split pays 25 each; steal/split pays 50 to the thief; steal/steal pays zero. Open invitations cannot overlap. Declining does not spend the daily opportunity.
- Lottery: Sunday 20:00 America/Chicago, including daylight-saving changes. Starts at 50, each ticket adds 20, maximum three per member. At least two distinct entrants. Otherwise preserve the same tickets and pot until next Sunday. Automatic service settlement, no administrator draw required.
- Heist: minimum two, maximum twenty members, 90-second joining window, 20 entry each. One shared 40% success outcome, 80-120 returned to each participant. Failure loses entry; each participant has a 50% chance of an extra 5-15 fine, capped by remaining Wallet. Pay Chest safe. One-hour cooldown. Understaffed or frozen-account crews refund entries and clear cooldowns.
- Permanent cosmetics: one frame, nameplate, cloth, display trim and effect at a time. Existing title selection remains. Six individually selected collectible positions. One owned object cannot occupy multiple positions. Unequipping does not consume ownership.
- Limited-use protections remain limited-use. No cosmetic gifting. No balance reset or rotating store. Fictional currency only.
- Profile shows game wins and collections. Current customization screen is the member's own Shillings profile; a dedicated browse-other-members showcase is not added in this pass.
- Default-enabled coin sound still waits for a browser user gesture. Persistent mute, separate optional jukebox volume, no music autoplay. Jukebox supports future public playlist and temporary local songs. No community songs supplied yet.
- Candlelight and mist use alternating continuous motion, with Pause atmosphere and reduced-motion support.

## Sources and assets

Website source: this repository, branch codex/living-hq-redesign.

Current shared engine: `C:/Users/thegr/Desktop/2nd Coldstream Guards/shilling-economy/quartermaster`. Do not deploy from the older AI Projects bot copy or sibling archive configuration. Website copies of config/seed match the runtime files.

Six new generated WebP assets: sentry lantern, provost kit, brass frame, crimson cloth, rifle cloth, campaign telescope. Source prompts and provenance: `shillings-art-prompts.json`. Optimization script: `site/scripts/prepare-quartermaster-art.mjs`. Existing original desk, drum and game-table imagery is retained. Some store variants share an original illustration; silver frame uses the frame's silver treatment. The new permanent nameplate is distinct from the existing consumable rename item.

New catalogue prices are starting tuning values, not user-mandated prices. Eleven additional permanent items bring the catalogue to 22. There are six display slots, but the first collection does not yet contain six distinct keepsake designs.

## Verification

- `npm run build --prefix site`: TypeScript and Vite pass. Existing lazy Three.js chunk size warning remains.
- `node --test site/tests/*.test.mjs`: 127 pass.
- Shared engine `npm test`: 77 tests pass, plus 14 preserved adapter checks.
- Shared engine `npm run test:database`: 17 PostgreSQL checks pass, including concurrent ticket cap, concurrent secret choices, one daily payout, zero-ledger rollover persistence and equipped cosmetic persistence.
- Browser: real isolated local API; dice result and matching balance, purchase of crimson cloth, equip response, same selected cloth after reload/sign-in. Desktop and 390x844 layouts visually checked. Two synthetic members entered a heist; the service automatically settled its result after 90 seconds. No live balances or Discord messages touched.
- Legacy tests retain paid five-Shilling heists at their old 60% odds and original accounting. Legacy lottery tickets/costs are preserved; the 50 seed is added once. Old draws move to the next Sunday. Members with more than three old tickets retain them, but cannot buy more for that draw.

## Local preview

`http://127.0.0.1:4184/#/stores`, synthetic account only. Continue with Discord is a local demo sign-in here, not a real OAuth login. Demo sign-in resets on refresh, but the isolated game database preserves equipment during this preview process.

Backend launcher: `node scripts/local-overhaul-preview.mjs` in current shared engine. Disposable embedded PostgreSQL at 5550; API 3460, companion API 3461. The launcher does not load production environment files. Two synthetic 800-Shilling accounts are created.

Website launcher uses empty VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and VITE_QUARTERMASTER_API_URL=http://127.0.0.1:3460, with Vite port 4184. Do not carry these demo environment overrides into a production build. The disconnected fallback now rejects unsupported social/equip actions rather than claiming success.

## Release boundary

Not published, no command registration, no production service restart. Obtain review before release. Back up economy state, reconcile both checkouts, deploy the shared engine/config/catalogue and register updated Discord command definitions, then build/publish the website through its existing root-assets/main-branch path. Confirm authenticated live reads and service scheduler health without inventing test member transactions. No new SQL migration is required by these changes; the existing persisted JSON state gains fields compatibly.

The status script reports this website checkout behind remote, a missing bundle-reference match at the live root, and delayed server-status/steam-presence workflows. These are release-review findings, not established diagnoses or fixes in this Shillings pass. Do not push this dirty checkout blindly.

## Report back

DONE: Local games-room, cosmetic equipment, six-object display, original store art, jukebox and approved economy rules implemented across website and shared engine.
VERIFIED: Build, 127 website tests, 77 engine/service tests, 14 adapter checks, 17 database checks, desktop/mobile synthetic browser review.
UNVERIFIED: Live website/Discord rollout, supplied-song playback, physical phone interaction and peer showcase browsing.
BLOCKED: Release needs remote reconciliation and user review; public playlist awaits songs.
NEXT: Review the local Shillings preview before coordinated release preparation.
