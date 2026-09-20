# Selected Display case profile

Implemented locally on 12 September 2026. Not published. The visibility migration is a draft and has not been executed by this lane.

## Entry points

- `#/profile` keeps its existing authenticated route and props. `PlayerProfileMock` now wraps the shared `ProfileDisplayCase` component.
- A current Discord-linked member UUID opened through `Profile` uses the same display. Existing recovered-archive and older profile paths remain untouched.
- The root-controlled local `#/design/profile` route previews the exact shared component with twenty labelled reference patches. Its Hide/Show controls only change local React state. No rank or medal is being awarded.
- The original three layout alternatives remain available as the named `OriginalProfileConcepts` component for later review. They are not the selected route. Their optional record reader now also excludes medals without an explicit visible preference.

## Display behaviour

The familiar avatar remains beside the member name. The real shoulder-patch artwork sits straight on a restrained cloth display. Real rank name, effective date, note and rank history remain available. Missing art does not substitute an invented rank.

The medal display initially shows eight visible active awards. Show all medals expands the collection without an upper display cap; Show fewer returns to eight. The shelf wraps at narrower widths. Both modes exclude deliberately hidden, historical and unknown-preference records.

Owners and staff receive a separate Manage display section. It lists active awards with Hide/Show controls and retains earlier award records in a history disclosure. Hiding changes display preference only, not the award record. Medal details retain the catalogue description, award date and note. The role gate in the UI is convenience only; the backend RPC enforces owner/staff access.

## Real data and failure states

The shared reader uses `loadPersonnelDisplayRows` and `partitionMedals(rows, 8)`. The helper pages the member record and separately loads display preferences. Only `display_on_profile === true` reaches the visible shelf.

Without migration `0048_medal_profile_visibility.sql`, or after any failed preference read, medals stay out of the display. The rank and owner/staff award records remain accessible. Controls are disabled and Reload display settings offers a fresh read. A failed or uncertain save also closes the medal display until a fresh read confirms the actual preferences. The UI never claims success from an unconfirmed response, retries the mutation automatically, or deletes an award.

Real Hide/Show calls the audited `set_personnel_medal_visibility` RPC through `saveMedalVisibility`. State is updated only after the exact requested boolean is confirmed. The draft migration must be reviewed and applied through the root's release workflow before persistent controls can be considered ready on the live site.

Combat figures still use the existing approved-stat loader, all time. Voice hours retain their sample-derived source. Unavailable values display N/R rather than zero. Events-attended and contribution/feature totals remain explicitly unavailable until their actual aggregates are connected. No guessed counters were added.

The existing About editor and member wall remain mounted through `ProfileLive`. Current Discord-linked profiles pass no Steam link. Components are keyed to the member to prevent stale profile editor state when navigating between people.

## Verification and remaining work

- `node --test site/tests/profile-display.test.mjs site/tests/medal-visibility.test.mjs`: 32 tests passed. Coverage includes eight-plus-twelve expansion, hidden compact/overflow medals, all-hidden collections, unknown preferences, retained history, restoration and 250-award display partitioning. The backend tests additionally exercise paged reads and confirmed/failed RPC responses.
- `npm run build --prefix site`: TypeScript and Vite passed with 141 transformed modules, including the final failure-state refinement.
- Scoped whitespace/diff checks passed.
- Parent handles browser verification, including narrow screens, twenty-patch expansion, Hide/Show and focus details.
- No live migration, persisted RPC round trip, production deployment or real member edit was performed by this lane.
