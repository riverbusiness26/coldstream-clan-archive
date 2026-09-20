# Living Campaign expedition review

Prepared 20 September 2026. Local review only. Production remains disabled.

Review: http://127.0.0.1:4186/?quartermaster=campaign#/stores

## Playable campaign

The shared campaign now runs from Camp through all seven destinations to Fort Saint-Aubin. Every destination has Approach, Secure and Hold phases with published, frozen requirements. Members can Scout, Escort Supplies, Prepare the Line, Gather and Build. Route and plan ballots, facility ballots, ten random encounter templates, the Field Kitchen, Engineer Workshop, Signal Post, territory benefits and final victory are implemented.

Each eligible joined member has one changeable vote per open ballot. Public snapshots contain totals and the requesting member's own vote; they never expose the voter list. Route closure follows the final phase at a location, using the published priority for ties. A camp successor opens after its current facility completes. At most one phase and one facility resolve per campaign cycle, including outage recovery.

An encounter is drawn once per phase with one saved d20 roll. Options publish exact maximum useful effects before funding. The chosen effect resolves once at the next cutoff, bounded by useful remaining progress. It neither changes funded requirements nor awards participant credit. The result, roll and decision are saved in dispatches.

Four distinct members must contribute useful field orders to each phase at the five-member planning size. To prevent a permanent stall, orders, supply funding and encounters leave at least one useful unit for each still-required member. Repeat participants may receive a smaller quote or a wait-for-company rejection. A later member can always supply the reserved work. Quotes and confirmations apply the same actor-aware rule.

## Living board and artwork

The authored Three.js table now supports wheel and button zoom, pointer dragging, touch pinch/pan, keyboard arrows/+/-/0, rotation/reset and a label toggle. A company standard and small guard figures identify the current position independently of the selected location. Terrain-following roads have dark borders, state colors, active arrows and a readable legend. The company travels along connected roads after a committed capture changes its position.

Windmill sails turn, flags and treetops move, water glimmers and camp smoke rises. Confirmed work produces short scout, supply-wagon, builder or standard animations. The last 20 public activity events are projected without member identities or exact private contribution amounts. Visible pages check for updates every four seconds, then deduplicate event identities. Replays and reloads do not celebrate old actions again. This is polling, not an instantaneous socket connection.

Quick orders and encounter votes sit beside the map so members can act while watching it. Quote review, pending settlement, confirmation notices, resource progress and buttons have appropriate motion. Pause motion and the system reduced-motion preference suppress animation while leaving controls usable. The renderer pauses when hidden or outside the viewport; its action queue and geometry pools are bounded and resources are disposed on unmount.

Two original raster illustrations were generated with the built-in image_gen tool: a valley expedition at dawn and a woodland wagon encounter. They are included under site/public/quartermaster/campaign. Exact prompts and paths are in GENERATED-ART.json. The 3D map remains interactive geometry, independent of the illustrations.

## Accounting and compatibility

This extends the existing Quartermaster PostgreSQL state row, purse, append-only ledger and idempotent receipt boundary. Supply packets cost five Shillings for two Supplies, with a 25% original target cap rounded by whole packets. Materials retain the 50% cap. Both share the 30-Shilling per-member daily allowance. Confirmation rechecks the stored quote, actor, target, cycle, useful output, gate reserve and purse under the same transaction lock used by purchases.

Cancellation and manual closure refund unconsumed commitments once to their original owners and keep their original daily allowance consumed. Completed commitments remain consumed. Final victory returns any unfinished camp funding, preserves history and produces no repeatable Shilling payout. Real currency, external game logs, attendance and calendar events never advance this campaign.

Expedition rules v0.4 are opt-in and are frozen in additive expedition state. Original pilot_config.json remains unchanged. Existing Kitchen progress, requirements, orders, receipts and wallet are preserved. The current review Kitchen still uses its original N10 goal; new expedition phases and later facilities use N5. A restart check preserved the existing Kitchen identity, 45 Materials, 1 Work and 75 synthetic Shillings at upgrade time. Subsequent member play can change those values normally.

The API retains its per-member 45-request/minute ceiling. Its per-address ceiling increased from 120 to 240 to accommodate five members behind one address watching both the five-second Quartermaster feed and four-second campaign feed. This does not change authentication or action permissions.

## Pacing evidence

The fully free simulations with all seven destinations and all three facilities completed in 29 days with five members and 35 days with four. Each simulated member used available useful orders daily. The original N10 Kitchen was retained in these scenarios, while future targets used N5. A four-member funded route completed in 32 days with 23 supply packets and refunded unfinished camp funding.

Three synchronized visits per week took longer: observed direct-route runs were 38 days for five members and 50 for four; default routes with both detours were 52 and 64. The six-order bank means unused daily orders can overflow. These are finite synthetic runs with saved random encounters, not player research or guaranteed durations. The month-long target assumes most daily orders are used; casual groups can take longer without expiry, decay or punishment.

Exact scenarios are in outputs/expedition/pacing.json in the delivery.

## Verification and remaining work

Both website builds and TypeScript passed. Website regressions: 129/129. Backend suite: 109/109 plus 14/14 existing adapter checks. Original campaign PostgreSQL/HTTP checks: 17/17. Expedition PostgreSQL checks: 6/6, including persisted restart, combined caps/refunds, the late fourth-member regression and complete free/funded routes.

The expanded browser harness verifies wheel/button/keyboard/drag navigation, label hiding, correct operation/supply actions, all three ballots, direct map orders, two distinct authenticated synthetic viewers, visible world motion, pause, shared capture/next destination, replay suppression, four responsive widths and zero Axe violations. Final browser counts and raw logs are recorded in the delivery review. Physical touch hardware remains untested. The existing Three.js bundle-size warning remains non-fatal; neither package defines a lint script.

Still in development: campaign cosmetics and pinned showcase highlights, more encounter writing and map detail, real-player pacing feedback, hosted member-authentication checks and coordinated production release. The whole route is playable locally; these remaining presentation/reward features are identified as work in progress.

No production deployment, live migration, real member debit, live reward or Discord post occurred. All primary runtime files remain untouched; implementation lives in the isolated website and Quartermaster worktrees. Release must reconcile the primary repositories' other work first.

DONE: Playable expedition, living interactive map, shared action animations and generated artwork in the local review.
VERIFIED: Builds, unit/database/browser checks and 4-to-5-member finite pacing simulations; evidence in the delivery.
UNVERIFIED: Production release/authentication, physical mobile hardware and actual player cadence.
BLOCKED: No local development blocker. Production remains intentionally disabled.
NEXT: River reviews the expanded campaign before cosmetics/showcase and coordinated release work.
