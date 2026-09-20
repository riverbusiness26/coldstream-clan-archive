# Staff workspace redesign

Local implementation completed on 12 September 2026. Publication is not part of this change.

## What changed

The staff panel now has grouped navigation: Overview; a Review inbox for Stat reports, Gallery and Weekly content; People and records for Members, Events and attendance, and the Artwork library; Administration for Audit and Settings. The page heading describes the current section rather than repeating Admin Panel everywhere. Overview now presents four actual work queues and removes the unconnected new-volunteers placeholder.

Stat review is one master-detail workspace. Search by member or event, filter status and type, and choose oldest/newest order. Select one report to inspect its round totals, edit round values and view proof screenshots. Accept, Deny and Remove occur only in the selected report's decision area. Removal now has an explicit confirmation separate from denial.

Proof images have thumbnail failure messages, a native image-inspection dialog, and original-file links. The dialog supports native Escape behavior and returns focus through the browser's dialog behavior. A missing or failed screenshot is explicitly described rather than silently disappearing. Original proof storage URLs and the existing review/update handlers are retained.

Members remain the single place to set ranks, award medals and change detachments. Selection is explicit; the first member is no longer selected automatically on load. Checkboxes allow multiple members to receive an existing rank or medal through the unchanged batch handler. The action bar identifies the selected people. Current medals can now be removed directly from the member record. The dormant, unreachable Active assignments module has been removed, with visible wording changed to ranks, medals and member records.

Artwork creation, replacement, ordering, archival and deletion remain in the artwork library, with detachment definitions in its second tab. Rank thumbnails use bounded object containment. Weekly submissions now have Needs review, Approved, Archived and All records filters. Denial retains the existing delete-from-queue behavior. Settings presents the actual access information and links to working member/audit tools; unavailable integration controls are not portrayed as functional settings.

The visual treatment is deliberately plain: readable text, stable dark surfaces, restrained brass emphasis and adequately sized form controls. Responsive navigation has a dismissible backdrop. Report details stack below a bounded report list on narrow screens. Reduced-motion preferences disable the additional transitions and change status-message scrolling to an immediate movement.

## Files

- `site/src/views/Admin.tsx`: interface structure, selected-report state, proof dialog, filters and explicit member selection.
- `site/src/admin-redesign.css`: scoped staff-workspace styles, loaded with the Admin view.

No shared styles, other pages, SQL, authentication code, database policies, bot code or RPC signatures were changed in this lane.

## Verification

`npm run build --prefix site` passed TypeScript and Vite, 138 modules. At that verification point, the Admin chunk was approximately 76.09 kB JavaScript / 18.76 kB gzip and 19.77 kB CSS / 4.03 kB gzip. These values describe the current combined worktree build and may change as the parallel work is finalized.

`git diff --check -- site/src/views/Admin.tsx site/src/admin-redesign.css` returned exit 0 with no whitespace findings.

A source comparison with `git show HEAD:site/src/views/Admin.tsx` found no removed named handlers or RPC names. It confirmed exactly one `staff-review-workspace`, no remaining `stat-submitter-groups` duplicate review UI, and the retained `deploy_weekly_content` call. This is structural regression evidence, not proof that production permissions or mutations succeed.

The no-database preview includes one explicitly labelled example report with zero round values and no fabricated screenshot. It exists only when Supabase is unavailable in preview mode. The global preview banner states that no live member, upload or review is changed.

Root owns browser verification. Required visual checks are desktop/mobile navigation, all sidebar sections, artwork containment, report editing layout, batch member selection, and event forms. Real screenshot loading, storage permissions, save/reject/remove operations, audit writes and Discord round trips have not been tested against production.

## Preserved behavior and remaining risks

General record loading still calls `deploy_weekly_content`, by explicit coordination with the lead. Removing that call could change the existing publication schedule, so this visual-workspace change does not do so. Opening or refreshing the live staff view is therefore not guaranteed to be read-only. No live browser check was performed in this lane.

Admin event creation, editing, event list dates and start previews now consistently use Chicago time. The follow-up `website-admin-chicago-time` removes the device-local timestamp conversions and adds pure input/instant helpers to `calendarTime.ts` without changing its existing exports. Create and edit still call the same RPCs with the same parameters, but `event_starts_at` now comes from the validated Chicago conversion.

Invalid dates and nonexistent spring-forward times cannot be submitted. A repeated fall-back hour exposes an explicit first occurrence (CDT) / second occurrence (CST) selector. Opening an existing event preselects its stored occurrence so editing the title does not move its start by an hour. The preview catches conversion errors and displays guidance rather than throwing during rendering. Date/time precision remains minutes, matching the existing editor.

`node --experimental-strip-types --test site/tests/admin-event-time.test.mjs site/tests/calendar-time.test.mjs` passed all 19 tests. These cover CST/CDT, midnight, spring gaps, fall repeats, invalid dates, both repeated-hour edit round trips, unchanged existing calendar behavior, and identical results in UTC, London, Los Angeles and Tokyo host timezones. No live event was created, edited or posted to Discord.

The expanded command including `site/tests/combat-stats.test.mjs` passed 33/33 tests, verifying that the shared calendar helper additions did not change the combat-period boundaries. `npm run build --prefix site` then passed TypeScript and Vite with 141 modules. The earlier concurrent medal-helper type error was fixed by its owning lane before this successful rerun. Scoped `git diff --check` also returned exit 0. Browser form interaction remains the lead's local-preview check; these results do not verify a real event save.

Audit mutations remain the existing asynchronous calls. A successful member/stat change is not proof that the audit record was saved. The interface displays at most 75 audit entries but does not enforce server retention. The existing 50-event and 200-gallery query limits also remain; Overview explicitly describes its counts as loaded records rather than an unlimited historical inventory.

The next approval gate is the local staff-workspace review, followed by a separately scoped integration verification using approved test records. No publication, Discord actions or database edits have been performed.
