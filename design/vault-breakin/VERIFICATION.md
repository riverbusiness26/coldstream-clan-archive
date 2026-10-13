# Verification, 13 October 2026

## Passed

From the website repository:

```powershell
node --check design/vault-breakin/vault.mjs
node --check design/vault-breakin/serve.mjs
node --test design/vault-breakin/model.test.mjs
node design/vault-breakin/engine-check.mjs "C:\Users\thegr\Desktop\AI Projects\coldstream-unified-site-preview\server-src\quartermaster-website"
git diff --check
```

- 16 unit tests passed, zero failed.
- 8 offline engine test groups passed, including 576 exact odds comparisons.
- Engine checks cover transfer, consumption, reseal, cooldown, notices, motherlode cap, dog payout, smoke, tripwire and atomic validation failures. Fabricated users only.
- Browser: target selection, tool selection, scout confirmation/consumption, spending confirmation, successful result and repeat-attempt block.
- Browser: smoke failure shows zero fine/no jail; tripwire overrides smoke; unknown response blocks attempts and upgrades.
- Browser: desktop rendering reviewed; mobile tested in a 390px iframe (375px available after scrollbar, 375px scroll width, no horizontal overflow). Target labels corrected after visual inspection.
- No browser error logs in the prototype tab at final inspection.
- Source scan found no credentials or private-key shapes in the package. No environment files or real account data included.
- `/design/` is excluded by the repository's existing `.assetsignore`. No live routes, bundles, API gates or seed items changed.

Standalone desktop copies run 15 tests and skip only the repository publication-exclusion check, because they are not inside the Git checkout.

## Not verified / not claimed

- No real wallet transaction, signed-in Vault route, public-target privacy probe, service deployment or Discord integration test.
- No database concurrency/retry test. The engine test is an in-memory rules check, not proof of multi-service transaction behavior.
- No physical phone, screen-reader session or browser reduced-motion emulation. Reduced-motion styles and a no-delay path are present, but need full accessibility review before release.
- Production website build was not run: this change is an isolated native-module prototype, not a production route. Existing website bundles were not rebuilt.
- The original engine checkout is separate and is not bundled. Opus must inspect its current revision before implementing.

## Manual review recipe

1. Open the preview. Choose Ash, select Lockpick, Scout, confirm. One spyglass is consumed, no entry fee.
2. Review break-in. Go back once to confirm cancellation spends nothing. Confirm next time. Success appears after the tumbler animation; repeat attempt is blocked by cooldown.
3. Set outcome to Caught (this resets demo state). Choose Flint, select Smoke bomb and confirm. Zero fine, no jail, entry still paid.
4. Set outcome to Tripwire. Repeat with Smoke bomb. It fails with a fine and 24-hour jail.
5. Set outcome to Connection lost. Confirm an attempt. Spending remains locked; no automatic retry occurs. Reset preview to start over.
6. Select Wren. The minimum chest balance blocks an attempt. Search for an absent name to see the empty result state.
7. Use Fortify your chest, confirm 700 Shillings. Demo chest pays first and advances from level 2 to 3.
8. Review `mobile-preview.html`. Use keyboard Tab, Space, Enter and Escape through tools and dialogs.

## Report back

DONE: Isolated Vault Break-in source, CSS safe art, fixture adapter, tests, screenshots and Opus handoff under design/vault-breakin. Desktop delivery contains the same files.
VERIFIED: node --test design/vault-breakin/model.test.mjs: 16 passed. engine-check.mjs: 8 groups and 576 odds vectors passed. Browser flows checked as listed above.
UNVERIFIED: Live transactions, privacy enforcement, deployment, cross-tab receipt recovery and physical-phone accessibility.
BLOCKED: Production release requires structured error/receipt recovery and public-projection review, then River's explicit rollout approval.
NEXT: Opus reads OPUS-HANDOFF.md, refines the prototype and prepares the gated integration.
