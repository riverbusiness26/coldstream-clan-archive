# Living Campaign: Milestone 1 review

Prepared for River on 19 September 2026. Development only; production remains disabled.

## Review the running build

Open http://127.0.0.1:4186/?quartermaster=campaign#/stores.

This is the existing React/Vite Quartermaster application in an isolated copy of the current working tree. It uses a persistent synthetic PostgreSQL database and the real Quartermaster storage/ledger implementation. It does not connect to production, debit real members, issue live rewards, or start Discord. The local development sign-in exists only in the explicitly selected campaign mode, without Supabase configuration, on localhost or 127.0.0.1.

The original website and backend working trees were dirty. Their unrelated edits were copied into isolated worktrees and preserved. Campaign patches are relative to those exact copied working files, not a claim that the original branch was clean or current with origin.

## Wallet trace and transaction boundary

The current frontend client, `site/src/lib/quartermaster.ts`, points to the dedicated Quartermaster API. Its current local source is `Desktop/2nd Coldstream Guards/shilling-economy/quartermaster`, not the earlier Supabase economy implementation.

`src/service/api.js` verifies the Supabase session, resolves the member's Discord mapping and current website role, and retains the existing guild-membership access check. No Discord activity is queried for campaign progress. Web cancellation uses a server-resolved admin/moderator role; a body-supplied identity or privilege is rejected.

`EconomyStore.transaction()` locks the guild row in PostgreSQL with SELECT FOR UPDATE. `persist()` writes the state and new entries into the append-only `quartermaster_ledger`; `quartermaster_receipt` stores the request fingerprint and result. Campaign actions use this same transaction, lock, purse, ledger and receipt table as purchases. No shadow wallet, extra currency or cross-storage payment sequence is introduced.

A contribution validates the stored member-owned quote, target revision, cycle, expiry, frozen status, purse, daily limit and original target cap. Purse debit, ledger entry, commitment, funded progress and replay receipt commit together. A quote itself makes no payment reservation: the whole confirmation is one database transaction. A lost confirmation leaves the browser Pending and the original request identity is saved locally for reconciliation; no balance or progress is trusted from browser storage. If committed, the allowance/cap is already consumed; if rolled back, neither is consumed.

## Working functionality

- Versioned pure rules from the supplied standalone v0.3 configuration, including DST-safe 05:00 America/Chicago cycles.
- Persistent shared Field Kitchen with frozen requirements, useful Gather/Build quotes, three starter orders, three per day, maximum six, and no repeat starter grant.
- Optional Materials funding at one Shilling per Material, maximum 50% of the frozen target and 30 Shillings per member per campaign day. Free construction remains complete and viable.
- Authoritative private committed/consumed/refunded receipts. Technical campaign UUIDs are hidden from member-facing copy; readable ledger references remain.
- Automatic settlement on the campaign clock and before new-cycle campaign work. Completed projects consume commitments once and activate their benefit in the next cycle. Incomplete progress is retained.
- Restricted reasoned cancellation, one refund to each original owner, original ledger linkage, no earnings inflation, and retained original daily allowance. Campaign closure also reconciles unfinished commitments.
- Campaign tab alongside all previous Quartermaster sections, with War Map, Our Camp, My Service, Dispatches and How to Play. A mission brief explains the immediate Kitchen and longer campaign goal.
- Loading, settling, pending recovery, rejection, completed and refunded states. Keyboard actions, touch layouts, reduced motion and a readable location list.

## Map and later steering

The optional 3D renderer contains authored geometry for raised terrain, water, roads, camp tents, bridge, apple orchard, a windmill, village, depot with crates/cart, earthworks/cannon and the fort. It renders only when needed, shares the existing Three.js dependency, disposes resources, and falls back to the readable list if WebGL is unavailable. Labels remain HTML.

The full eight-location route and both operation plans are inspectable now. Only camp construction is playable in Milestone 1. Every other location is labeled work in progress, and the board explicitly says map gameplay, capture and ballots will be completed in Milestone 2.

River requested a tabletop-adventure feel, random internal encounters, roughly one month of play, and 4–5 active participants. `review-targets.json` records a five-member planning population with four as the low-turnout case. Future operation previews scale the supplied requirements accordingly. The staging initializer now selects five for newly created campaigns. It never rewrites an existing campaign's frozen rules.

River already contributed synthetic progress to the first N=10 staging Kitchen. It stays at its original 160 Materials / 12 Work. A new N=5 Kitchen requires 80 Materials / 6 Work, paid cap 40; N=4 requires 64 / 5, paid cap 32. The supplied baseline configuration is retained unchanged for provenance and baseline tests.

The month-long duration is a target, not a verified result of the current arithmetic. Milestone 2 must add meaningful encounter/route decisions and playtest cadence with four and five participants. It must not stretch duration through mandatory attendance, progress decay or silently inflated funded goals. Encounter concepts are labeled as planned. Reveal their effects before accepting funding for the affected future target; no hidden random failure after fulfilling published requirements.

## Verification

The delivery's `verification/` folder contains raw results. Final counts are recorded in `REVIEW.md` at the delivery root.

- Website: `npm run build --prefix site`; this includes `tsc -b`.
- Staging bundle: from the website root, `npm run build --prefix site -- --mode campaign --outDir dist-campaign`.
- Website regressions: `node --test site/tests/*.test.mjs`.
- Backend regressions/rules: `npm test` in the isolated Quartermaster root.
- PostgreSQL/HTTP: `node scripts/test-campaign-database.mjs` in that root. Synthetic ephemeral database; no production environment variables used.
- Browser: `node work/ui-tests/verify-campaign.mjs` from the task root while the QA Vite server uses port 4190 and local API 3468. The harness creates its own ephemeral PostgreSQL database and test guilds, separate from River's persistent review state.
- No lint script is defined in either package. JavaScript syntax checks, TypeScript, diff whitespace and authored-file house-rule checks supplement the tests.

## Remaining scope

Milestone 2: actual operations, route and project ballots, the participant gate, capture, Workshop/Signal Post, successor resolution and the full campaign ending. Add the newly requested internal encounter system and validate a month-long experience for 4–5 participants. The existing pilot rules remain the baseline until new encounter/pacing rules are reviewed.

Milestone 3: earned campaign cosmetics, three pinned highlights, showcase integration, full operation service history and richer dispatches.

Milestone 4: complete all-route free/funded independence, recovery and release review. No outside-game progress integration is planned.

Production OAuth/roles and a hosted staging deployment have not been exercised. Physical touchscreen hardware has not been tested. Both production guards remain off: `VITE_LIVING_CAMPAIGN_ENABLED` defaults false, and the backend requires an explicit `campaignEnabled` constructor flag plus an approved production rule configuration. No live migration or publishing occurred. Reconcile current remote and unrelated active work before any release.

## Local tools note

The native browser-control tool failed twice with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`, including after a reset. No speculative repairs were made. Browser verification instead used isolated headless Edge through Playwright and Axe; the app browser was opened to the review URL. The Three.js bundle-size warning remains non-fatal.

## Report back

DONE: Standalone Milestone 1 Kitchen, wallet transaction integration, 3D route review, mission brief, How to Play and review artifacts in isolated website/backend worktrees.
VERIFIED: Exact commands and results are captured in the delivery verification files, including atomic spending/refunds and full free/funded Kitchen paths.
UNVERIFIED: Live release, real member OAuth, month-long pacing, full route play and physical mobile hardware.
BLOCKED: Production release remains intentionally gated on River's review and explicit authorization; no development access blocker.
NEXT: Review Milestone 1, then implement Milestone 2 with the five-member/month-long/encounter requirements.
