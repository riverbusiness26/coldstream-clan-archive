import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { normalizeScoreboard } from './lib/holdfast-scoreboard.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith('--') && !process.argv[process.argv.indexOf(arg) - 1]?.startsWith('--'));
if (!fileArg) {
  console.error('Usage: node scripts/ingest-holdfast-scoreboard.mjs <scoreboard.csv> --session-key <key> [--server-key <key>] [--map <name>] [--ended-at <ISO>] [--write]');
  process.exit(1);
}

const file = resolve(fileArg);
const players = normalizeScoreboard(await readFile(file, 'utf8'));
const sessionKey = option('session-key') ?? basename(file).replace(/\.[^.]+$/, '');
const session = {
  external_key: sessionKey,
  source: 'scoreboard_csv',
  server_key: option('server-key'),
  map_name: option('map'),
  ended_at: option('ended-at'),
  metadata: { source_file: basename(file) },
};

if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ mode: 'dry-run', session, players }, null, 2));
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.SB_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required with --write');

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=representation',
};

const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/holdfast_session?on_conflict=external_key`, {
  method: 'POST', headers, body: JSON.stringify(session),
});
if (!sessionResponse.ok) throw new Error(`Session upsert failed (${sessionResponse.status}): ${await sessionResponse.text()}`);
const [storedSession] = await sessionResponse.json();
if (!storedSession?.id) throw new Error('Session upsert returned no id');

const playerRows = players.map((player) => ({ ...player, session_id: storedSession.id }));
const playerResponse = await fetch(`${supabaseUrl}/rest/v1/holdfast_player_session?on_conflict=session_id,steam_id64`, {
  method: 'POST', headers, body: JSON.stringify(playerRows),
});
if (!playerResponse.ok) throw new Error(`Player upsert failed (${playerResponse.status}): ${await playerResponse.text()}`);
console.log(`Stored ${players.length} Holdfast player records for ${sessionKey}`);
