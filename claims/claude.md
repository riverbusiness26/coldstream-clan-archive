Holding: nothing

Last job: bumped checkout and setup-node to v5 across the three workflows,
verified green via House rules on ca1e336. Stopped short of v6/v7 because
checkout v6 changes the credential persistence the backup push relies on.
Found separately that server-status.yml has failed 25 times running since
23 Aug, at the poller step, unrelated to the bump. Not fixed, not mine.
Since:   2026-08-24
