// Poll a Source-query-compatible server and store its public status.
//
// This runs in GitHub Actions, not in a visitor's browser. It has no game
// server credentials and only queries the same UDP endpoint used by game
// browser listings. SUPABASE_SERVICE_ROLE_KEY stays in Actions secrets.
import dgram from 'node:dgram';

const host = process.env.HOLDFAST_HOST;
const port = Number(process.env.HOLDFAST_QUERY_PORT ?? 27018);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!host) throw new Error('HOLDFAST_HOST is required');

const header = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const query = Buffer.concat([header, Buffer.from('TSource Engine Query\0')]);

function ask(payload) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`query timed out after 5 seconds (${host}:${port})`));
    }, 5000);
    socket.once('error', (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
    socket.once('message', (message) => {
      clearTimeout(timer);
      socket.close();
      resolve(message);
    });
    socket.send(payload, port, host);
  });
}

function readCString(buffer, offset) {
  const end = buffer.indexOf(0, offset);
  if (end < 0) throw new Error('malformed A2S response');
  return [buffer.toString('utf8', offset, end), end + 1];
}

function parseInfo(packet) {
  // Standard A2S_INFO packet: 0xffffffff, 'I', protocol, then C strings.
  if (packet.length < 6 || packet.readInt32LE(0) !== -1 || packet[4] !== 0x49) {
    throw new Error('server returned an unexpected A2S response');
  }
  let at = 6; // skip header, type, protocol
  let name; let map;
  [name, at] = readCString(packet, at);
  [map, at] = readCString(packet, at);
  [, at] = readCString(packet, at); // folder
  [, at] = readCString(packet, at); // game description
  at += 2; // app id
  if (packet.length < at + 3) throw new Error('truncated A2S player data');
  return { name, map, players: packet[at], maxPlayers: packet[at + 1] };
}

async function poll() {
  let response = await ask(query);
  // Some servers issue a four byte challenge before their info response.
  if (response.length >= 9 && response.readInt32LE(0) === -1 && response[4] === 0x41) {
    response = await ask(Buffer.concat([query, response.subarray(5, 9)]));
  }
  return parseInfo(response);
}

let status;
try {
  const info = await poll();
  status = {
    server_key: 'holdfast-dev', game: 'HOL', name: info.name || 'Coldstream Gaming Holdfast DEV',
    address: `${host}:20100`, map: info.map || null, players: info.players,
    max_players: info.maxPlayers, online: true, updated_at: new Date().toISOString(),
  };
  console.log(`Holdfast online: ${info.players}/${info.maxPlayers} on ${info.map || 'unknown map'}`);
} catch (error) {
  status = {
    server_key: 'holdfast-dev', game: 'HOL', name: 'Coldstream Gaming Holdfast DEV',
    address: `${host}:20100`, map: null, players: 0, max_players: 0,
    online: false, updated_at: new Date().toISOString(),
  };
  console.warn(`Holdfast offline or unreachable: ${error.message}`);
}

if (!supabaseUrl || !serviceKey) {
  console.log(JSON.stringify(status));
  process.exit(0);
}

const result = await fetch(`${supabaseUrl}/rest/v1/server_status?on_conflict=server_key`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify(status),
});
const body = await result.text();
if (!result.ok) throw new Error(`Supabase upsert failed (${result.status}): ${body}`);
console.log(`Stored tracker status: ${body}`);
