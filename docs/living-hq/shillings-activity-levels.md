# Shillings activity levels

Implemented locally, 2026-09-19. Not published. Scope is five category tracks on Your Profile, separate from regiment rank. Chat, DMs, visitor routing, rare item drops and new cosmetic artwork are separate work.

## Rules implemented

| Track | XP per eligible completion | XP-bearing completions per Chicago day |
| --- | ---: | ---: |
| Dice | 10 | 10 |
| Blackjack | 15 | 10 |
| Heists | 50 | 3 |
| Duty | 25 | 3 |
| Daily Ration | 40 | 1 |

The first eligible completion in each category each Chicago day also grants 20 XP. These are initial balancing defaults, not modifications to shilling rewards, stakes, probabilities or existing cooldowns. Participation above the XP cap still counts toward completed activity and distinct active days. XP never depends on wager size or winning. No purchase grants XP.

Level 1 starts at zero XP. Reaching level L requires 50 * L * (L - 1) lifetime XP. There is no fixed maximum level and no reset. Category titles unlock at levels 5, 10 and 20, giving 15 real, equipable rewards through the existing title action. Additional collectible/cloth/frame reward art is not implemented by this change.

Active-day milestones are 5, 20, 50 and 100 distinct days. A day run counts consecutive Chicago dates with eligible completions, not the Daily Ration payment streak (which uses elapsed-time grace). Missing a day can end the current day run but never reduces XP, levels, best run or earned titles.

## Evidence and authority

- Shared engine source: `Desktop/2nd Coldstream Guards/shilling-economy/quartermaster/src/engine/progression.js`.
- Server-side ledger writes update persisted category aggregates in the same guild-state transaction as the game outcome. Actor identity remains server-derived. No XP mutation endpoint was added.
- Retained, dated `anchor_settle`, `vingt_settle`, `heist_win`, `heist_lose`, `duty` and `ration` receipts backfill historical activity once. The full saved ledger is used, not the 100-entry UI slice. Imported balances do not imply past participation.
- Deals, draws, stakes, abandoned blackjack hands, refunds, cancelled heists, transfers, purchases and grants do not earn XP. Legacy timed-out blackjack receipts are identified by their existing server-written timeout marker. New settlements carry explicit timeout/outcome metadata.
- Duplicate requests reuse existing service receipts; a processed-ledger cursor and per-member game identity also protect progression replay. Both crew members earn their own heist XP after a completed result.
- Existing JSON state storage holds progression automatically. No separate SQL migration is needed. Do not delete old ledger records to backfill this feature.
- Snapshot payload adds `profile.activityLevels`. The UI shows an explicit unavailable state if an older backend omits it, never fabricated zero progress.

## Local review

The isolated preview script `scripts/local-activity-preview.mjs` in the shared engine creates a temporary local PostgreSQL instance, seeded only by synthetic actions. API ports 3462 and 3463, site review at `http://127.0.0.1:4185/#/stores`. Local review login is disposable; after refreshing, use Continue with Discord to re-enter the synthetic account, then Your Profile. This does not contact Discord when the preview is launched with blank Supabase configuration.

The website must be started with `VITE_QUARTERMASTER_API_URL=http://127.0.0.1:3462`, empty `VITE_SUPABASE_URL` and empty `VITE_SUPABASE_ANON_KEY` in that process only. Do not put preview settings into production environment files.

## Verification

- `npm test` in shared engine: 87 engine/service tests and 14 adapter checks passed.
- `npm run test:database` in shared engine: 19 PostgreSQL checks, including concurrency, duplicate XP prevention and service-restart persistence.
- `node --test site/tests/*.test.mjs`: 133 website checks, including rendered component states, earned-title controls, HTML escaping and missing-backend behavior.
- `npm run build --prefix site`: TypeScript and production build pass. Existing large Three.js chunk warning remains.
- Browser: five server-derived tracks, title equipped successfully, Daily Ration level 5 to 6 after a real synthetic claim, persistence after page reload/re-entry; desktop and 390 x 844 mobile inspection with no card/page horizontal overflow.

## Release boundary

No production records, deployed services, SQL, Discord registration or root publishing artifacts were changed. The website checkout remains dirty and behind its remote branch. Release must reconcile existing unpublished work and coordinate service plus frontend deployment. Original rate rules are version 1; future rebalance work should preserve earned XP rather than silently recompute it.
