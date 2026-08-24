Holding: nothing

Last job: diagnosed the nightly backup failure. Run 32619460912 dies on step
2 of 6, the config guard, so the export has never executed. It needs three
settings, not the one DURABILITY.md claimed: two secrets plus the repository
variable BACKUP_REPOSITORY. Corrected DURABILITY.md, PROJECT.md and my own
status.mjs check, all of which had the same wrong assumption. Verified all 17
exported tables exist. Setting the three is River's, no agent should hold a
service role key. See the two 2026-08-23 entries in HANDOFF.
Since:   2026-08-23
