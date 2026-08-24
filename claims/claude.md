Holding: nothing

Last job: bumped actions/checkout and actions/setup-node from v4 to v5 in
backup-database.yml, house-rules.yml and server-status.yml. Both v5 tags run
node24, which closes the Node 20 deprecation. Stopped at v5 rather than the
current v7: checkout v6 moves persisted git credentials to a separate file
and the backup push depends on those. node-version 20 in house-rules is the
build Node, a separate decision, not changed.
Since:   2026-08-24
