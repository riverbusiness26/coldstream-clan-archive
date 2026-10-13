# Coldstream Vault Break-in

## River's instruction

Build this separately from the live website. Opus 5.5 will refine the design and implement it. Do not enable it or deploy it without River's approval.

This is an interactive prototype, not a released game. It uses fictional members and balances. No account, Discord, database or API connection is present. The page's content security policy blocks network connections.

## Open it

On River's Windows PC, double-click **Open Preview.cmd**. Keep that window open while viewing the prototype. Close it when finished.

Or, with Node 20+ installed, run from this folder:

```powershell
node serve.mjs
```

Open http://127.0.0.1:4196/. If that port is occupied, set `PORT` to another unused port first. Opening index.html directly will not work because it uses browser modules.

## What is ready

- Own Pay Chest illustration, level, balance, upgrade confirmation and defenses.
- Searchable fictional targets with chest balance and Renown.
- Scout confirmation, spyglass consumption and defense report.
- Four selectable tools with owned counts and explained effects.
- Public-fact odds estimates, scout-based estimates and potential haul.
- Explicit spending confirmation and duplicate-click protection.
- Three-tumbler animation, success, motherlode, failure, smoke escape and tripwire outcomes.
- Cooldown, guardhouse, insufficient funds and uncertain-response states.
- Responsive layout, native keyboard-operable dialogs and reduced-motion styles.
- No duplicate real wallet. Demo balances exist only in memory and reset on reload.

The outcome selector deliberately forces sample results. It is a visual test harness, not real randomness or the production rules engine.

## Files for Opus

| File | Purpose |
| --- | --- |
| `OPUS-HANDOFF.md` | Implementation map, blockers and rollout checklist. Read this first. |
| `vault.mjs` | Mountable page with injected adapter and route cleanup. |
| `vault.css`, `vault-tokens.css` | Prototype styling and original CSS safe illustration. Scope these before production reuse. |
| `model.mjs` | Frontend odds estimates, eligibility, error labels and single-flight action gate. |
| `demo-adapter.mjs`, `preview.mjs` | Demo only. Never import into the production route. |
| `model.test.mjs` | Portable unit tests and publication-isolation check when run inside the repo. |
| `engine-check.mjs` | Offline tests against the existing engine directory, using fabricated accounts. |
| `VERIFICATION.md` | What was checked and what remains unverified. |

## Tests

```powershell
node --test model.test.mjs
node engine-check.mjs "C:\Users\thegr\Desktop\AI Projects\coldstream-unified-site-preview\server-src\quartermaster-website"
```

The second command requires the existing engine checkout. It reads engine code, economy configuration and item definitions. It never reads a database or a real wallet dump. The desktop ZIP does not contain that separate checkout.

## Git home

Repository: `https://github.com/riverbusiness26/coldstream-clan-archive`

Branch: `codex/vault-breakin-prototype`

Folder: `design/vault-breakin/`

Local repository: `C:\Users\thegr\Desktop\AI Projects\coldstream-website`

The repository's `.assetsignore` excludes `/design/`. No production entry point imports this feature. Do not merge or push to main as a shortcut to reviewing this prototype.
