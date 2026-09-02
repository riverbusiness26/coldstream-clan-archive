const HEADER_ALIASES = {
  steam_id64: ['steamid64', 'steam64', 'steamid', 'steam id', 'steam id64', 'platformid'],
  player_name: ['playername', 'player name', 'name', 'player'],
  regiment: ['regiment', 'regimenttag', 'regiment tag', 'tag'],
  kills: ['kills', 'kill'],
  deaths: ['deaths', 'death'],
  assists: ['assists', 'assist'],
  team_kills: ['teamkills', 'team kills', 'team_kills', 'tks'],
  score: ['score', 'points'],
  shots_fired: ['shotsfired', 'shots fired', 'shots'],
  shots_hit: ['shotshit', 'shots hit', 'hits'],
  seconds_played: ['secondsplayed', 'seconds played', 'playtime', 'timeplayed', 'time played'],
};

const cleanHeader = (value) => value.trim().toLowerCase().replace(/^\ufeff/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.replace(/\r$/, ''));
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (quoted) throw new Error('CSV ends inside a quoted field');
  return rows;
}

function integer(value, fallback = 0) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number.parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalInteger(value) {
  if (value == null || String(value).trim() === '') return null;
  return integer(value, null);
}

export function normalizeScoreboard(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Scoreboard CSV has no player rows');

  const headers = rows[0].map(cleanHeader);
  const index = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    index[field] = headers.findIndex((header) => aliases.includes(header));
  }
  if (index.steam_id64 < 0) {
    throw new Error(`No Steam ID64 column found. Headers: ${rows[0].join(', ')}`);
  }

  const players = [];
  for (const values of rows.slice(1)) {
    const raw = Object.fromEntries(rows[0].map((header, i) => [header, values[i] ?? '']));
    const get = (field) => index[field] < 0 ? '' : values[index[field]] ?? '';
    const steamId = String(get('steam_id64')).trim();
    if (!/^\d{17}$/.test(steamId)) continue;
    players.push({
      steam_id64: steamId,
      player_name: String(get('player_name')).trim() || null,
      regiment: String(get('regiment')).trim() || null,
      kills: Math.max(0, integer(get('kills'))),
      deaths: Math.max(0, integer(get('deaths'))),
      assists: Math.max(0, integer(get('assists'))),
      team_kills: Math.max(0, integer(get('team_kills'))),
      score: integer(get('score')),
      shots_fired: optionalInteger(get('shots_fired')),
      shots_hit: optionalInteger(get('shots_hit')),
      seconds_played: optionalInteger(get('seconds_played')),
      raw_record: raw,
    });
  }

  if (players.length === 0) throw new Error('No rows contained a valid 17-digit Steam ID64');
  return players;
}
