# Holdfast statistics

## What works

Coldstream-controlled servers can produce reliable player records keyed by Steam ID64.

The first version uses Holdfast's round-end scoreboard CSV:

```text
--scoreboardLogFilePath "logs_output/scoreboard.csv"
```

The import script reads that file, rejects rows without a 17-digit Steam ID64, and stores one record per player per session. Re-importing the same session key updates the same records instead of duplicating them.

```text
node scripts/ingest-holdfast-scoreboard.mjs logs_output/scoreboard.csv --session-key 2026-09-01-public-01
```

The command is a dry run by default. Add `--write` only after migration `site/db/0024_holdfast_activity.sql` has been applied and the service credentials are present on the server.

## What comes next

A server-only Holdfast script mod is the real-time version. It can use these official callbacks:

- `OnPlayerJoined` for Steam ID64, name and regiment tag
- `OnRoundDetails` for the server, map and round
- `OnPlayerKilledPlayer` for kills and deaths
- `OnScorableAction` for score
- `OnPlayerShoot` for shots fired
- `OnPlayerLeft` for time played

The mod should write newline-delimited JSON to a local spool file. A separate sidecar process should upload batches to Supabase. Keeping network access outside the mod avoids enabling `-allowRestrictedMods`, which disables Holdfast's restricted-mod protections for every mod on the server.

## Limits

There is no reliable global feed for a player's activity across unrelated Holdfast servers. Coldstream can track:

- its own public and event servers;
- partner servers that install the collector; and
- partner servers that provide compatible scoreboard logs.

Steam presence can show that a linked member is playing Holdfast, but it does not identify the server or provide per-session kills and deaths.

Before enabling writes, collect one real scoreboard CSV from the Coldstream server. Header names and whether Steam ID64 is included must be confirmed against the parser. Do not enable live writes until that sample passes locally.
