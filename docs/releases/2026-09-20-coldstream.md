# Coldstream combined release, 20 September 2026

River authorized publishing all completed Coldstream website work, with visible work-in-progress labels on Living Campaign, Regiment Wars and Coldstream TV. TV must have no main-site menu links.

## Included

- Shillings overhaul, permanent collectible equipment, activity progression and titles, generated store artwork, shared game updates and admin-managed jukebox.
- Living Campaign: seven destinations, three phases each, ten encounters, member decisions, all camp facilities, shared animated 3D map, zoom/drag and clear company paths. Shillings confirmation now uses a dark green background with readable text.
- Regiment Wars: public solo practice, sample currency only, fifteen-slot drag/drop deck builder, pack opening, collection, battles and help. Saves remain local to the browser; real account cards, real-currency purchases and multiplayer are unfinished.
- TV is separately published at its own subdomain. The WIP public programme guide is available; broadcasting and the private Programme Desk are not hosted. No main-site TV link was added.

## Validation

The production website build and 171 tests pass. The integrated campaign browser suite passes 18 checks, including two viewers, shared motion, ballot changes, paid quotes, keyboard/pointer map controls, responsive layouts and zero accessibility findings in checked campaign views. A separate production build smoke verifies navigation, the anonymous Shillings access gate, card practice and the actual Content Security Policy. Jukebox audio from the Supabase origin is explicitly allowed by media-src. Card fonts use existing local assets.

The combined service passes 122 tests, 14 adapter checks, 19 economy database checks, 18 campaign database/HTTP checks and 6 expedition database checks. Fresh campaigns use five expected participants and a four-person contribution gate. Existing frozen campaign targets remain unchanged. Fully free daily-use simulations with four or five members take about a month; this is simulated pacing, not a guaranteed completion date.

The admin jukebox migration was applied and recorded as 20260920010000. Read-back confirms a private 25 MB audio bucket, row-level security, no anonymous read/RPC access, no direct member writes and restrictive storage guards. No real tracks were uploaded or published for testing. The existing 75-entry audit retention is installed.

## Release boundaries

The primary dirty website checkout and local review campaigns are preserved. A separate release checkout combines the newest remote main and completed work. The backend uses the existing authoritative purse, ledger and database; synthetic review accounts are excluded. Production campaign activation is explicit and main-guild only. Test guild configuration remains separate.

No real member gameplay, debit, reward, profile assignment, Discord announcement or test music publication is used as a release check. Signed-in production member flows and actual music playback with supplied content remain to be checked by the user. Static/browser checks and server authentication boundaries are verified separately.

The generated Three.js chunk retains its existing size warning. Campaign cosmetics, further encounters/world detail, real-account card collections/PvP and the TV broadcast pipeline remain WIP.

The live domain is attached to the existing coldstream-clan-archive Worker with static assets. This was verified through the live custom-domain mapping and Worker version metadata. Git main updates the source and GitHub Pages mirror; the existing Wrangler configuration publishes the production Worker. The prior Pages-only deployment note was outdated. TV uses a separate static Worker/custom domain, version a83437bb-c0de-42a6-97d8-60365af9e861. Backend rollout retains the old release, environment backups and a database dump; rollback must not erase live balances.

Backend release 20260920T055243Z is installed with both units healthy. Existing 704 ledger entries and 646 receipts were preserved, and the main-only campaign is initialized at population 5. All 28 command definitions were read back in the two already-enabled guilds. No Discord announcement was sent.
