# Medal display preferences

Status: local implementation and draft migration, 12 September 2026. No SQL was applied to Supabase. No site was published.

## Product contract

An earned medal has two separate states:

- The award record, including its date, note and any later removal, remains intact.
- The profile display preference decides whether an active award appears in the display case.

Hiding is not revocation, deletion or a privacy boundary. The existing personnel read policies and grants are unchanged. Owner/staff controls may list intentionally hidden medals in the member record, but the display case and its expanded overflow must never include them. Historical awards belong in the record, not the current display.

The selected display-case UI uses eight medals before its expandable overflow, as specified in the newer profile implementation brief. The reusable partition helper defaults to ten when a caller does not supply a limit. Passing eight preserves the same visibility rules.

## Files and responsibilities

- `site/db/0048_medal_profile_visibility.sql`: an unexecuted, transactional migration.
- `site/src/lib/medalVisibility.ts`: paged reads, capability/error states, medal grouping and confirmed RPC saves.
- `site/tests/medal-visibility.test.mjs`: 24 offline tests against the actual helper plus static SQL contract checks.
- The profile designer owns the display-case UI and route integration. This task does not change views, profile artwork, admin controls or authentication.

## Database draft

The migration adds `public.personnel_assignment.display_on_profile boolean not null default true` with `IF NOT EXISTS`. Existing awards remain shown on a successfully migrated database unless the member or staff explicitly hides them.

The new `set_personnel_medal_visibility(target_assignment uuid, visible_on_profile boolean)` function returns the resulting boolean. It has a fixed `public, pg_temp` search path and schema-qualified application relations/functions. Execute is revoked from PUBLIC and anon, then granted to authenticated. No base-table permissions or RLS policies are widened.

Server checks:

1. Both inputs must be non-null.
2. `auth.uid()`, `current_member_id()` and `current_member_role()` must resolve. SQL nulls are rejected explicitly.
3. The actor's member row must match `auth.uid()` and have applicant, active or reserve status. Banned/discharged actors are denied this new mutation, even with a staff role. These enum values are defined in 0027. The existing identity helpers do not check status; this is an explicit guard for the new function, not a claim that every existing feature already applies it.
4. The caller must own the award or be a moderator/admin.
5. The locked assignment must be an unremoved medal and reference a medal catalogue item. A rank or historical award cannot be toggled. A catalogue item archived from future use may still be an active earned award; its `active` flag does not invalidate that member's medal.
6. Repeating the stored value returns it without issuing UPDATE, so no audit entry is added for a no-op.

The existing `personnel_assignment_audit` trigger already audits every UPDATE. The migration narrowly extends `record_personnel_audit()` for a medal update where only `display_on_profile` changes. That branch writes one `personnel.medal_visibility` entry with actor, member, item, record ID and before/after visibility. It returns immediately, avoiding a duplicate generic audit entry. The generic path retains 0026's catalogue-deletion handling and existing action names for other changes.

The existing `personnel_audit_keep_latest` trigger and `trim_personnel_audit()` from 0042 are not replaced or disabled. Their 75-row retention behavior remains in effect. Migration preflight requires both assignment auditing and retention triggers to exist and be enabled; otherwise the transaction aborts. Audit insert failure also rolls back the preference change.

## Frontend contract

```ts
loadPersonnelDisplayRows(db, memberId): Promise<{
  rows: PersonnelDisplayRow[];
  visibilityAvailable: boolean;
  visibilityStatus: 'available' | 'unavailable' | 'error';
  visibilityError: string | null;
}>
```

Each row includes `id`, `member_id`, `item_id`, `item_kind`, `assigned_at`, `removed_at`, `note` and `display_on_profile: boolean | null`. Rows are newest first with a stable ID tie-breaker.

The original personnel fields and medal preferences are read separately. Both reads use member filtering and ID keyset pages of 250, including historical records. This avoids the API's default row cap. A failed later page does not silently return a truncated result. Invalid/non-advancing responses fail safely.

| Read result | Rank/history record | Medal display | Controls |
| --- | --- | --- | --- |
| Both reads succeed | Available | Only explicit `true` awards | Available to an authorized owner/staff UI |
| Missing column or stale schema cache | Base fields remain available | All medal flags `null`; nothing inferred visible | Disabled; capability unavailable |
| Permission/network/malformed/incomplete preference response | Base fields remain available | All medal flags `null`; no partial display | Disabled; reload error |
| Base personnel read fails | Helper throws a readable error | No guessed partial record | No success state |

A missing-column response is deliberately not treated as `true`. A stale schema cache can produce the same error even after members have hidden medals. Assuming defaults would undo their display choice in the UI. The owner/staff record can still explain that awards are present while preferences are unavailable.

```ts
partitionMedals(rows, limit): {
  visible,    // active + explicitly shown, first limit
  overflow,   // remaining active + explicitly shown
  hidden,     // active + explicitly hidden
  unknown,    // active + unreadable preference
  historical, // removed medals, regardless of display flag
}
```

The function preserves caller order and never mutates the record. It ignores ranks. “Show all” is strictly `visible + overflow`, never `hidden`, `unknown` or `historical`.

```ts
saveMedalVisibility(db, assignmentId, visible): Promise<boolean>
```

The only write is the new RPC. It returns success only when the server returns the exact requested boolean, including `false` after a hide. An error, missing response or mismatched value throws a readable message. There is no direct table write, automatic retry, localStorage persistence or optimistic assertion of success. After an uncertain response, reload before retrying: the server may have committed even if the response did not reach the browser.

## Verification performed

- `node --test site/tests/medal-visibility.test.mjs`: 24 tests passed, 0 failed.
- `npm run build --prefix site`: exit 0; TypeScript passed and Vite built 138 modules. This is local build proof only.
- Coverage includes 1,003 awards over five pages per read, exact page boundaries, stalled pages, both missing-column codes, failed later pages, malformed data, historical/hidden/unknown partitioning, overflow exclusion, RPC-only saving, successful false responses and uncertain failures.
- The SQL tests check the draft's transaction, defaults, unchanged grants/RLS/retention, null-safe authority checks, fixed search path, row lock, active-medal restriction, no-op ordering and single-audit path. These checks do not execute PostgreSQL and do not prove runtime permissions.
- No `psql`/`postgres` command was available in PATH and no PGlite package was found in the site's dependencies. No dependency was installed and no database connection was opened.

## Required checks before publishing

Use a disposable database or a reviewed rollback-only transaction with fixture accounts before any live apply. Re-check the actual target schema, migrations and current trigger definitions first; local files are not proof of live state.

| Case | Required evidence |
| --- | --- |
| Apply and re-apply 0048 | Both succeed; column boolean, NOT NULL, default true; existing preferences survive |
| Authenticated owner, active/reserve/applicant | Own active medal can hide/show; exact boolean returned |
| Moderator and admin | Can change another member's active medal |
| Guest, auth without member row, banned/discharged actor | Denied, no assignment update and no new visibility audit |
| Ordinary member targeting another member | Denied, no change |
| Null ID or value, unknown ID, rank, removed award | Rejected, no change |
| Archived catalogue medal with active award | Preference remains editable; earned record remains intact |
| Real hide/show | One detailed audit row per changed value; no second generic row |
| Repeated hide/show | Zero additional audit rows |
| Forced audit insert failure | Preference UPDATE rolls back with the audit failure |
| Concurrent owner/staff toggles | Row lock serializes results and audit before/after values |
| Existing item create/update/delete and rank/award edits | Existing generic audit behavior remains intact, including deleted-item foreign keys |
| Audit retention | After enough changes, latest 75 remain; test concurrent writes as well as sequential writes |
| Grants and RLS | New RPC executable by authenticated, not anon/PUBLIC; base-table grants/policies unchanged |
| Browser reload, owner versus another viewer | Hidden medal remains in member record but absent from display and expanded overflow |

No member data or awards need deletion for these tests. Prefer fixtures and rollback. The script itself is wrapped in a transaction so a migration failure does not leave half the feature installed.

## Rollback and deployment boundary

Before applying, capture the current trigger-function definition and schema in the normal protected backup process. If the migration fails before COMMIT, roll back its transaction. If a deployed UI must be backed out later, keep the preference column and its saved values; disabling controls or reverting the UI is safer than dropping user choices. Any database reversal needs a separate reviewed migration. Do not execute the whole old 0026 file merely to restore its function: that historical file also contains a targeted deletion unrelated to this feature.

Next step: root reviews the draft and the integrated profile, then obtains approval for database application and controlled permission/rollback checks. Local tests and a successful site build are not publication or live-database proof.
