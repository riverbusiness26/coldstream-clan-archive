# Opus 5.5 handoff: Vault Break-in

## Scope and authority

River wants this finished far enough for you to refine and implement. This delivery is isolated in website Git and as a desktop folder/ZIP. It is NOT authorization to enable server actions, change live balances, post to Discord or deploy. Keep the canonical Quartermaster purse, chest, inventory and receipts. No shadow wallet, purchasable regimental ranks or medals.

Git adoption: the prototype implementation is commit `ace5d173b0902fab5851eb167245b2cd1cf1f4c2`. Another worker's shop commit (`f014569`) appeared on the shared branch during this session and was preserved. Do not merge the whole branch blindly. Review or copy only `design/vault-breakin/`, or cherry-pick the prototype commit and this handoff note as appropriate. The desktop package contains only this Vault work.

## Reference review, 13 October 2026

Read-only inspection of the signed-in live Paybook, Games and Shop established:

- Paybook already shows the member's equipped appearance, earned title, Renown, collection, game records and upgradeable Pay Chest.
- Vault level numbering is **0 to 8**, not 1 to 9. This prototype matches it.
- Games is called **The Mess Hall**. Vault Break-in should become a separate table there, not replace Steal or the Supply-wagon Heist.
- **Steal targets the Wallet. Vault Break-in targets the Pay Chest.** State this distinction prominently before rollout. Review all old claims that the Pay Chest is completely safe.
- Shop has Supply crates, Profile looks, Titles, Field kit and Pay tickets. Extend Field kit with vault tools and vault defenses, rather than build another store.
- Keep the existing warm serif headings, charcoal/navy panels, brass accents and crimson actions. Use equipped frames/emblems when displaying real targets. The prototype's initials are deliberate fictional placeholders.

No live purchases, games, upgrades or other writes were made during this review. Do not copy River's balances or account details into fixtures.

## Where the real implementation lives

Website Git checkout: `C:\Users\thegr\Desktop\AI Projects\coldstream-website` (remote is named `coldstream-clan-archive`). The newer editable source workspace is **not Git**:

`C:\Users\thegr\Desktop\AI Projects\coldstream-unified-site-preview`

Read that workspace's `LIVE-INTEGRATION.md` again before implementation. Source and live services can change independently. Do not overwrite newer work from this snapshot.

Relevant paths relative to that workspace:

- `server-src/quartermaster-website/src/engine/armory.js`: existing vault engine.
- `server-src/quartermaster-website/src/service/api.js`: member action allow-list and target verification.
- `server-src/quartermaster-website/src/service/storage.js`: atomic transaction and request receipts.
- `server-src/quartermaster-website/src/service/adapter.js`: response wrappers and member projections.
- `server-src/quartermaster-website/data/seed.json` and `server-src/quartermaster-main/data/seed.json`: disabled tools/defenses.
- `dist/site-integrations.mjs`: the ONE existing authenticated client and action transport.
- `dist/looks.mjs`, `dist/looks.css`: shared equipped-look rendering.
- `dist/shop-page.mjs`, `dist/paybook-page.mjs`, `dist/games-arcade.mjs`, `dist/mess-social.mjs`, `dist/app.js`, `dist/index.html`: future integration points.

Engine `armory.js` SHA-256 at verification:
`6508BF69150E7D0B6C5E731530013FB0DE3C72565FC4D2966C5CF9FA31E3D64F`

## Adapter contract

`mountVault(root, adapter, { initialTargetId })` returns `{ refresh, destroy }`.

- `adapter.read()` resolves to the **wallet snapshot**, not `{wallet: snapshot}`.
- `adapter.action(name, args)` resolves to `{message, snapshot, game}`.
- Supply `previewOnly: true` only for the demo. It labels confirmations explicitly.
- Call `destroy()` on route exit. It removes listeners/timers and ignores late async responses.

Actions:

| Name | Arguments | Result |
| --- | --- | --- |
| `vault_scout` | `{targetDiscordId}` | `game.intel` |
| `vault_crack` | `{targetDiscordId, tools: ['lockpick', ...]}` | `game.success`, chance, dog, alarm, loadout, target, amount/motherlode or fine/smoke/jailUntil |
| `vault_upgrade` | `{}` | New vault level/name plus fresh snapshot |

Read from `siteIntegrations.getState().wallet` and refresh through the existing integration. Do NOT create another Supabase client or import its module from the browser console. The demo has no production adapter on purpose.

Snapshot fields used: `profile.discordId/purse/chest`, `inventory[] {slug,qty}`, `cooldowns.vault`, `armory.card.vault`, `armory.tiers`, `armory.rules`, `armory.nextVault`, `armory.defences`, `armory.jailUntil`, `armory.vaultAlerts`, `armory.feed`, `leaderboard[] {discordId,displayName,chest,vaultLevel,renownLevel,frame,emblem}`.

Scout returns `{targetDiscordId,name,vaultLevel,vaultName,chestBand,guardDogs,tripwire,renownLevel,resealedUntil}`. Never expose target inventory or compute hidden defenses from a public projection. Scout reports are point-in-time information, not a promise.

## Critical integration work before enabling

1. **Request identity and uncertain responses.** The current `siteIntegrations.action()` creates a new UUID per call and drops structured error codes when throwing. Preserve a stable request ID for each confirmed intent, retain the server error code, and reconcile a lost response using the same receipt. Storage already keys receipts by actor/request ID and fingerprint. A new action after a timeout could double-spend. This prototype never automatically retries, and locks spending after an unknown response. Its in-memory lock is not a production cross-tab/refresh solution. Build that through the canonical transport, not a separate client.
2. **Public projection privacy.** Source inspection of `adapter.js` shows inspection of another member starts from a complete snapshot and only strips `ledger`, `forageAlerts`, `cooldowns` and `game`. That can expose inventory/armory defenses and private alerts, defeating paid scouting. Verify the actual route and use an explicit allow-listed public Paybook projection before enabling break-ins. This finding was not exploited or tested against another live member.
3. **Server gates and membership.** Keep `vault_scout` and `vault_crack` OFF until approved. The API must authenticate actor identity, verify current target membership and protection, enforce freeze/self-target rules, and set `targetImmune` itself. Never accept immunity or odds from browser input.
4. **Atomicity and concurrency.** Engine simulation passed, but this is not a multi-service database test. Verify row locking, one receipt per request, target and actor changes committed together, concurrent attempts, duplicate deliveries and restart recovery against test accounts.
5. **Constants and clock.** Frontend uses actual snapshot tiers/entry/minimum/cooldown, but haul/fine/jail descriptions still reflect current engine defaults. Expose authoritative versioned presentation rules or validate them before mount. Use server time for eligibility displays. Client checks are advisory only.

## Engine rules preserved

- Base chances for levels 0..8: 9%, 7.5%, 6.2%, 5%, 4%, 3.1%, 2.3%, 1.6%, 1%.
- Lockpick adds 2.5 percentage points; skeleton key lowers effective tier by three; powder multiplies odds by 1.5 and maximum haul fraction by 1.4.
- Renown reduces odds by 1.2% per level above 1, capped at 30% reduction.
- Engine clamps public odds to 0.5%..30%, THEN a dog multiplies by 0.6. Do not clamp again after the dog. Tripwire guarantees failure.
- A successful haul is 45%..100% of the effective tier's maximum fraction. 5% of successes double the haul. Absolute caps: half the chest and 2,500 Shillings.
- Entry 20; cooldown 3 hours. Successful target resealed 24 hours.
- Failure fine is 12% of the remaining purse, minimum 5, maximum 60, limited by available purse. Ordinary jail 8 hours; tripwire jail 24 hours.
- Smoke avoids ordinary fine and jail, NOT tripwire penalties. Entry and selected tools are still spent. Each dog/tripwire triggers automatically from inventory and is consumed.
- The engine, not the animation or demo adapter, resolves the outcome and records both members' balances, notices and feed.

## Suggested implementation order

1. Review this standalone preview with River. Refine art, copy and density.
2. Resolve transport/receipt and public-projection blockers above. Add service-level tests.
3. Scope CSS to the new route before embedding: the prototype currently includes global body/button/header styles. Reuse host tokens/fonts and the existing `looks.mjs` renderer for framed portraits/emblems.
4. Add `#vault` and `#vault/<discordId>` routing with an explicit feature flag. Mount/destroy correctly; handle deleted/ineligible targets and delayed wallet loads.
5. Add a Mess Hall game card and Paybook links. Show break-in stats from `card.breakins` (attempts, successes, stolen, caught, defended, lost, biggest). Do not invent new activity XP or levels without a decision.
6. Prepare Field kit groups `vault_tool` and `vault_defence`. The seven slugs are lockpick, spyglass, smoke_bomb, powder_keg, skeleton_key, guard_dog, tripwire. Preserve existing price/stack rules. Do not activate the main/bot seed unintentionally or promise Discord support before that service is verified.
7. Test with isolated test accounts and explicit approval for any real-account write. Re-test desktop/mobile, keyboard, reduced motion, uncertain response, multi-tab and stale scout conditions.
8. Ask River for rollout approval. Capture fresh live source, backups and rollback. Only then enable tools/actions and publish the integrated route.

## Prototype limitations

This is not drop-in production code. Target looks are initials; CSS safe is original vector-like placeholder art; no sounds were added. Watch reports support real-shaped data but demo fixtures are quiet. Demo outcomes are forced and do not model all persistent server effects. No links to live accounts, no production authentication, no deployment changes. No source-engine files, credentials, environment files or account dumps are included in the desktop ZIP.

## Short prompt River can give you

Read START-HERE.md, OPUS-HANDOFF.md and VERIFICATION.md. Refine this Coldstream Vault Break-in prototype using the existing website's Paybook, Shop and Games systems. Preserve the single Quartermaster wallet. Fix the listed integration blockers and prepare production implementation, but ask before enabling the game or deploying. Do not use the demo adapter for real balances.
