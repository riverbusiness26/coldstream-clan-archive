# Medal database preflight, 12 September 2026

River approved proceeding with the functional integration, without publishing the website.

## Live read-only finding

The authenticated Supabase SQL dashboard for project `zcpbpcktinlqnxmqddzc`, coldstream-gaming, main PRODUCTION was inspected. No application data, schema or permissions were changed. The dashboard saved the diagnostic query as its normal private query metadata.

- `personnel_assignment.display_on_profile` does not exist.
- `record_personnel_audit()` matches the catalogue-delete-safe 0026 implementation.
- `personnel_assignment_audit` is enabled and invokes that function.
- `personnel_audit.entity` and `entity_id` already exist.
- `trim_personnel_audit()` and `personnel_audit_keep_latest` do not exist.
- The audit table contains **374 rows**, not a capped 75.

The initial read-only query deliberately resolved the expected retention function and failed with 42883 because it was missing. A safe catalogue inspection then confirmed the definitions above. Migration 0048 was not run against production; it must abort without its retention prerequisite.

Do not replay the entire 0042 migration to repair this. Its staff-editor replacement is unrelated. Prepare and verify a focused retention installation, taking concurrency into account, after approval. Trimming the current snapshot to 75 would remove 299 older audit entries. Recount immediately before acting. Save a verified private export outside this public repository first; ask River for confirmation before the irreversible live trim.

## Isolated PostgreSQL execution

Added `site/tests/medal-database-check.mjs`. It executes the actual 0048 migration in a disposable in-memory PostgreSQL engine, using the catalogue/assignment/audit DDL from 0024, the audit function from 0026 and retention from 0042. The auth/member fixture is deliberately minimal. This is not a complete Supabase replica or a production RLS test.

PGlite was installed with scripts disabled into a unique Windows temporary folder, not the site's dependencies. [Official setup/API reference](https://pglite.dev/docs/).

Run with Node and the path to a separately installed `@electric-sql/pglite/dist/index.js`:

```text
node site/tests/medal-database-check.mjs <installed-module-path>
```

Result: **13 PostgreSQL execution checks passed**, exit 0:

1. Missing retention aborts migration and rolls back its new column.
2. Migration applies and re-applies.
3. Owner hide returns false and writes exactly one detailed audit entry.
4. Repeated hide writes no new audit.
5. Re-applying preserves the saved preference.
6. Moderator and admin may change another member's medal display.
7. Applicant and reserve owners may change their own display.
8. Banned and discharged owners are denied.
9. Other members, guests, unlinked identities and anon are denied without audit changes.
10. Rank, removed award, unknown ID and null inputs are rejected.
11. Retiring catalogue artwork does not revoke an earned medal.
12. An audit insert failure rolls back the visibility change.
13. Ninety sequential toggles retain 75 audit rows and all award records.

The first fixture run stopped on an enum/text parameter typing error in test seeding; explicit casts corrected it. The migration itself required no change. This single-connection test does not prove concurrent retention, full Supabase policies, browser session permissions or live persistence.

## Original next action

Obtain approval to export and trim the existing live audit log. Then install a focused, tested retention prerequisite, apply 0048 and verify metadata plus controlled role paths without altering real member awards as test data. Publication and missing profile aggregates remain pending.

## Approved application completed, 12 September 2026

This section supersedes the initial preflight status above. River explicitly approved the private backup, removal of the oldest 299 audit entries and enforcement of the 75-entry limit.

- Exported all 374 audit rows in a single aggregate CSV result. Verified declared count, parsed count, unique IDs and project identity. No audit contents were copied into this repository.
- Private backup: `C:/Users/thegr/Coldstream Private Backups/audit-2026-09-12-1126/personnel-audit-before-trim.csv`.
- Source and backup SHA256 matched: `CF75653A9F51E70E9468DD8711E81EBB100C4E31433163B8E0EA8585579A424D`.
- Applied `site/db/0048_audit_retention_prerequisite.sql`, guarded by the database export fingerprint. It installs a private serialization guard and statement-level retention triggers without replaying unrelated 0042 changes.
- Live result after commit: exactly 75 audit rows, with IDs matching the newest 75 in the backup. The 299 removed entries are recoverable from the private export, not through a product undo button.
- Applied `site/db/0048_medal_profile_visibility.sql`. Live result: 75 audit rows, zero null display preferences, authenticated RPC execute permission true and anonymous execute permission false.
- No real member awards were toggled as test data. No website publication or bot restart occurred.

The isolated runner now uses the focused retention prerequisite instead of 0042. It passes **15 PostgreSQL execution checks**, including missing-backup refusal and denial of member access to the retention guard. The separate medal visibility/profile helper suite passes **32 tests**. `git diff --check` passed.

Additional rollback-only live owner/staff tests were not performed: the dashboard tab became unavailable before those checks. Isolated role checks are not a substitute for full hosted RLS/session verification. Concurrent connections and the end-to-end browser save flow remain unverified.

Next: verify the live owner/staff medal-display flow, then connect the missing profile aggregates. The website remains unpublished.
