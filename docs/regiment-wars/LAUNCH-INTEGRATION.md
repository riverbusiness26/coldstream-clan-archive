# Live launch boundary

Publication update, 20 September 2026: River approved publishing the completed practice mode with Work in progress and sample-currency labels. See `PUBLIC-PRACTICE-RELEASE.md`. The requirements below still apply before real-account, real-Shillings or multiplayer features can launch.

The local mockup is complete enough for playtesting. The live card-game economy and public multiplayer are not implemented or deployed. Do not enable the development-only tab on production merely by removing its guard.

## Merge alongside current work

Port the new Regiment Wars files after the active Quartermaster/profile task is ready. The only existing app files edited here are App.tsx (lazy route), Economy.tsx (development-only activity link plus its stylesheet), and vite.config.ts (standalone preview entry). Keep their small changes when reconciling with the current branch; never replace Quartermaster.tsx, profile components, economy data or global styles with copies from this worktree. The source checkout was already busy and the status tool found a newer remote revision; this branch intentionally stays based on the inspected local committed version.

## Authoritative service contract to implement

Keep game records separate from player-profile presentation. Authenticate using the website's existing member session and the current Shillings economy authority. Inspect the live economy adapter at integration time: older Supabase-only assumptions do not establish how the presently deployed Quartermaster service stores wallets.

| Operation | Required server behavior |
| --- | --- |
| GET self | Authenticated member's collection, purse read from existing authority, supplies, three decks, active battle, receipts and reports. Never accept a client member ID as identity. |
| POST starter | Unique member/set constraint. Grant fixed starter and initial deck once. Retries return the same receipt. |
| POST pack | Accept pack ID, expected catalogue version and idempotency key only. Validate availability and spendable purse, debit real Shillings, generate contents, grant inventory/supplies and store receipt atomically. Client never supplies price, odds, random seed or reward. |
| POST commission | Server-owned rarity/cost, uniqueness and supplies checks. Spend and grant atomically with a stable request key. |
| PUT deck | Ownership, identities, 10 infantry and 5 support, saved-name limits, revision check. Persist a deck draft; battle start requires a valid complete deck. |
| POST battle | Snapshot deck/card rules, support positioning and opponent; do not reference an editable active deck afterward. Store the AI decision privately before player submission. |
| POST order | Expected battle revision and idempotency key. Validate legal order and abilities, resolve both sides from the same state, persist result once. Client cannot submit opponent orders, damage, morale, victory or payouts. |
| POST withdraw | Finish active battle once, keep all cards, record report. |

For a pack request whose network result is unknown, retain and retry the same idempotency key or read the receipt. Never charge again to replay an animation. The animation is driven only by a stored successful receipt. Include kill switches, catalogue versioning, administrative audit records, purchase rate limits, isolation between members, and reconciliation against the existing wallet ledger.

Use one durable transaction boundary for purse, receipt and card grant. If the existing wallet is a separate service, design and test a reservation/settlement protocol first; do not combine an unaudited remote debit and unrelated card insert. No draft database migration is included because applying it to an assumed obsolete wallet schema would be misleading.

## Required public-release evidence

- Two authenticated test members cannot see or mutate each other's cards, decks or battles.
- Duplicate clicks, concurrent browser tabs, network loss, server restart and repeated request keys produce exactly one purchase/receipt and no negative purse.
- Starter is once per real member, not once per browser. Client-side edits cannot grant cards or currency.
- Pack RNG and actual sampled distribution agree with displayed slot odds. Final guaranteed slots and duplicate treatment are tested.
- Real debit/grant/receipt persist together; rollback restores both wallet and inventory consistently.
- Battle rules, catalogues and deck snapshots are immutable for an active battle. Stale/replayed orders cannot advance twice.
- Pending receipts can be reopened without a new purchase. Completed battles cannot reward twice. Do not add uncapped AI currency farming.
- Moderated names and final artwork are approved. Real-member card policy is decided separately.
- Final prices, supply conversion, card strengths, battle length and repeat-role limits pass a playtest. Only pack prices have been explicitly approved so far.
- Physical desktop/phone sound and interaction checks. The synthetic audio was exercised through the browser but its speaker output was not independently heard.
- Reconcile inherited dependency advisories before publishing. This install reported three advisories in the existing dependency graph; no unrelated dependencies were upgraded here.
- Remove standalone preview delivery from the live release or clearly isolate it. Enable the actual tab only when backed by the authoritative service. Keep profiles unchanged until their owning task is ready.

## Later decisions

Player-versus-player matchmaking, asynchronous timers, power limits, ranked rewards, trading, member identity cards, profile statistics and campaigns remain later scope. River selected AI first and a core-game-only mockup. A question about unrestricted versus power-limited PvP is pending and does not block this playtest.
