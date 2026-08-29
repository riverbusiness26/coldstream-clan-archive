// Poll the community game servers and store their public tracker status.
//
// This runs in GitHub Actions. Browsers read the stored rows from Supabase
// instead of querying game ports directly, which keeps keys server side and
// avoids making every visitor hit the VPS.
import dgram from 'node:dgram';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_SERVERS = [
  {
    server_key: 'holdfast-dev',
    game: 'HOL',
    name: 'Coldstream Gaming Holdfast DEV',
    address: '40.160.84.169:20100',
    host: '40.160.84.169',
    query_port: 27018,
    protocol: 'source',
  },
  {
    server_key: 'valheim-dev',
    game: 'VAL',
    name: 'Coldstream Valheim DEV',
    address: '40.160.84.169:2456',
    host: '40.160.84.169',
    query_port: 2457,
    protocol: 'source',
  },
  {
    server_key: 'minecraft-dev',
    game: 'MC',
    name: 'Coldstream Minecraft DEV',
    address: '40.160.84.169:25565',
    host: '40.160.84.169',
    query_port: 25565,
    protocol: 'minecraft',
  },
];

function serversFromEnv() {
  if (!process.env.GAME_SERVERS_JSON) return DEFAULT_SERVERS;
  const parsed = JSON.parse(process.env.GAME_SERVERS_JSON);
  if (!Array.isArray(parsed)) throw new Error('GAME_SERVERS_JSON must be an array');
  return parsed;
}

// Closing a socket exactly once, however many ways the attempt ended.
//
// A dead host produces two events, not one: the 5 second timeout fires, and
// then the kernel's ICMP port-unreachable arrives at the socket that has
// already been closed. Calling close() a second time throws
// ERR_SOCKET_DGRAM_NOT_RUNNING from inside an event handler, which is an
// uncaught exception and takes the process with it.
function closeOnce(socket) {
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    try { socket.close(); } catch { /* already closing */ }
  };
}

function udpAsk(host, port, payload) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const close = closeOnce(socket);
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      close();
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`query timed out after 5 seconds (${host}:${port})`)),
      5000,
    );
    // on, not once: a late error after the promise has settled must still land
    // on a listener. An 'error' event with nothing listening is an uncaught
    // exception in Node, and this socket is talking to hosts that are down.
    socket.on('error', (error) => finish(reject, error));
    socket.on('message', (message) => finish(resolve, message));
    socket.send(payload, port, host);
  });
}

function readCString(buffer, offset) {
  const end = buffer.indexOf(0, offset);
  if (end < 0) throw new Error('malformed A2S response');
  return [buffer.toString('utf8', offset, end), end + 1];
}

function parseSourceInfo(packet) {
  if (packet.length < 6 || packet.readInt32LE(0) !== -1 || packet[4] !== 0x49) {
    throw new Error('server returned an unexpected A2S info response');
  }
  let at = 6;
  let name; let map;
  [name, at] = readCString(packet, at);
  [map, at] = readCString(packet, at);
  [, at] = readCString(packet, at);
  [, at] = readCString(packet, at);
  at += 2;
  if (packet.length < at + 3) throw new Error('truncated A2S info data');
  return { name, map, players: packet[at], maxPlayers: packet[at + 1] };
}

async function sourceInfo(server) {
  const header = Buffer.from([0xff, 0xff, 0xff, 0xff]);
  const query = Buffer.concat([header, Buffer.from('TSource Engine Query\0')]);
  let response = await udpAsk(server.host, server.query_port, query);
  if (response.length >= 9 && response.readInt32LE(0) === -1 && response[4] === 0x41) {
    response = await udpAsk(server.host, server.query_port, Buffer.concat([query, response.subarray(5, 9)]));
  }
  return parseSourceInfo(response);
}

function parseSourcePlayers(packet) {
  if (packet.length < 6 || packet.readInt32LE(0) !== -1 || packet[4] !== 0x44) {
    throw new Error('server returned an unexpected A2S player response');
  }
  let at = 6;
  const names = [];
  while (at < packet.length && names.length < 32) {
    at += 1;
    const nameAndOffset = readCString(packet, at);
    const name = nameAndOffset[0];
    at = nameAndOffset[1] + 8;
    if (name) names.push(name);
  }
  return names;
}

async function sourcePlayers(server) {
  const header = Buffer.from([0xff, 0xff, 0xff, 0xff]);
  const challenge = Buffer.concat([header, Buffer.from([0x55, 0xff, 0xff, 0xff, 0xff])]);
  const first = await udpAsk(server.host, server.query_port, challenge);
  if (first.length >= 9 && first.readInt32LE(0) === -1 && first[4] === 0x41) {
    const response = await udpAsk(server.host, server.query_port, Buffer.concat([header, Buffer.from([0x55]), first.subarray(5, 9)]));
    return parseSourcePlayers(response);
  }
  return parseSourcePlayers(first);
}

function writeVarInt(value) {
  const bytes = [];
  let current = value;
  do {
    let temp = current & 0x7f;
    current >>>= 7;
    if (current) temp |= 0x80;
    bytes.push(temp);
  } while (current);
  return Buffer.from(bytes);
}

function readVarIntFrom(buffer, state) {
  let value = 0;
  let position = 0;
  let current;
  do {
    if (state.offset >= buffer.length) throw new Error('truncated Minecraft response');
    current = buffer[state.offset++];
    value |= (current & 0x7f) << (7 * position);
    position += 1;
    if (position > 5) throw new Error('Minecraft varint is too large');
  } while ((current & 0x80) === 0x80);
  return value;
}

function mcPacket(id, payload) {
  const body = Buffer.concat([writeVarInt(id), payload]);
  return Buffer.concat([writeVarInt(body.length), body]);
}

function mcString(value) {
  const body = Buffer.from(value, 'utf8');
  return Buffer.concat([writeVarInt(body.length), body]);
}

function readExactly(socket, length) {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Minecraft status timed out after 5 seconds'));
    }, 5000);
    function cleanup() {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    }
    function onError(error) {
      cleanup();
      reject(error);
    }
    function onData(chunk) {
      data = Buffer.concat([data, chunk]);
      if (data.length >= length) {
        cleanup();
        resolve(data);
      }
    }
    socket.on('data', onData);
    socket.once('error', onError);
  });
}

// This is what has been failing server-status.yml every five minutes.
//
// The old version removed its listeners on a failed connect and left the
// socket itself alone. Two things followed from that, and the workflow logs
// read as neither.
//
// The poll finished and stored its rows perfectly well. Then the process
// would not exit, because a connecting socket holds the event loop open, and
// the kernel keeps retrying a TCP SYN for about two minutes before it gives
// up. That is the whole of the 133 second step: 15 seconds of work and two
// minutes of a socket nobody was waiting for any more.
//
// When the kernel finally gave up, the socket emitted 'error' with its error
// listener already removed. An unhandled 'error' event is an uncaught
// exception, so the run ended non zero having done its job correctly.
//
// `node scripts/poll-server-status.mjs` could never catch this: with no
// Supabase credentials the script prints and calls process.exit(0), which
// tears the socket down before it can bite. It only appears where the script
// runs to the end, which is only in Actions.
async function minecraftStatus(server) {
  const socket = net.createConnection({ host: server.host, port: server.query_port });
  socket.setNoDelay(true);
  // Whatever happens below, this socket is destroyed and keeps a listener for
  // an error that may arrive long after anybody cares about the answer.
  socket.on('error', () => { /* handled by whichever promise is waiting */ });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Minecraft connect timed out after 5 seconds'));
      }, 5000);
      function cleanup() {
        clearTimeout(timer);
        socket.off('connect', onConnect);
        socket.off('error', onError);
      }
      function onConnect() {
        cleanup();
        resolve();
      }
      function onError(error) {
        cleanup();
        reject(error);
      }
      socket.once('connect', onConnect);
      socket.once('error', onError);
    });

    return await minecraftHandshake(server, socket);
  } finally {
    socket.destroy();
  }
}

async function minecraftHandshake(server, socket) {
  const handshake = Buffer.concat([
    writeVarInt(763),
    mcString(server.host),
    Buffer.from([(server.query_port >> 8) & 0xff, server.query_port & 0xff]),
    writeVarInt(1),
  ]);
  socket.write(mcPacket(0, handshake));
  socket.write(mcPacket(0, Buffer.alloc(0)));

  const first = await readExactly(socket, 5);
  const state = { offset: 0 };
  const packetLength = readVarIntFrom(first, state);
  const already = first.subarray(state.offset);
  const rest = already.length >= packetLength ? already : Buffer.concat([already, await readExactly(socket, packetLength - already.length)]);
  socket.end();

  const packetState = { offset: 0 };
  const packetId = readVarIntFrom(rest, packetState);
  if (packetId !== 0) throw new Error('unexpected Minecraft status packet');
  const jsonLength = readVarIntFrom(rest, packetState);
  const json = rest.toString('utf8', packetState.offset, packetState.offset + jsonLength);
  const status = JSON.parse(json);
  const sample = Array.isArray(status.players?.sample) ? status.players.sample : [];
  return {
    name: server.name,
    map: status.version?.name ?? null,
    players: Number(status.players?.online ?? 0),
    maxPlayers: Number(status.players?.max ?? 0),
    playerNames: sample.map((player) => player?.name).filter(Boolean).slice(0, 32),
  };
}

async function pollServer(server) {
  const started = performance.now();
  if (server.protocol === 'minecraft') {
    const info = await minecraftStatus(server);
    return { ...info, latency_ms: Math.round(performance.now() - started) };
  }
  const info = await sourceInfo(server);
  let playerNames = [];
  try {
    playerNames = await sourcePlayers(server);
  } catch (error) {
    console.warn(`${server.server_key} player list unavailable: ${error.message}`);
  }
  return { ...info, playerNames, latency_ms: Math.round(performance.now() - started) };
}

async function statusFor(server) {
  try {
    const info = await pollServer(server);
    console.log(`${server.server_key} online: ${info.players}/${info.maxPlayers}`);
    return {
      server_key: server.server_key,
      game: server.game,
      name: info.name || server.name,
      address: server.address,
      map: info.map || null,
      players: info.players,
      max_players: info.maxPlayers,
      player_names: info.playerNames ?? [],
      online: true,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`${server.server_key} offline or unreachable: ${error.message}`);
    return {
      server_key: server.server_key,
      game: server.game,
      name: server.name,
      address: server.address,
      map: null,
      players: 0,
      max_players: 0,
      player_names: [],
      online: false,
      updated_at: new Date().toISOString(),
    };
  }
}

const statuses = await Promise.all(serversFromEnv().map(statusFor));

if (!supabaseUrl || !serviceKey) {
  console.log(JSON.stringify(statuses, null, 2));
  process.exit(0);
}

// Upsert, and survive a database that has not caught up with this script.
//
// 0020_server_player_tracker.sql adds server_status.player_names. If that
// migration has not been run, PostgREST rejects the whole batch with PGRST204
// and the workflow dies, so nothing gets stored at all: not the player names
// we cannot write, and not the counts and online flags we can. That is the
// wrong trade. Counts are the thing the site actually renders.
//
// So write the full row, and if the only objection is the column that is not
// there yet, drop that one field and write everything else. The names light up
// on their own the moment the migration lands, with no second deploy.
async function upsert(rows) {
  const response = await fetch(`${supabaseUrl}/rest/v1/server_status?on_conflict=server_key`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

let result = await upsert(statuses);

// PGRST204 is "column not found in the schema cache". Match on the column name
// too, so an unrelated schema drift still fails loudly instead of being
// silently retried into a half written row.
if (!result.ok && result.body.includes('PGRST204') && result.body.includes('player_names')) {
  console.warn(
    'server_status.player_names is missing, so player names are not being stored. ' +
      'Run site/db/0020_server_player_tracker.sql in the Supabase SQL editor. ' +
      'Storing counts and online state without it.',
  );
  result = await upsert(statuses.map(({ player_names, ...rest }) => rest));
}

if (!result.ok) throw new Error(`Supabase upsert failed (${result.status}): ${result.body}`);
console.log(`Stored tracker status: ${result.body}`);
