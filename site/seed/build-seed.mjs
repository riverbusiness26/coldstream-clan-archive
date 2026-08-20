// Builds the seed data for the community site from the archive repo.
// Reads ../coldstream-research/data and writes src/seed/*.json plus
// db/0002_seed.sql for the real database.
//
// Every roster entry carries a source_detail provenance label. Nothing is
// invented: each row traces to a dataset in the archive.
//
// Usage: node seed/build-seed.mjs [path-to-archive-repo]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVE = process.argv[2] || '../coldstream-research';
const read = (f) => JSON.parse(readFileSync(join(ARCHIVE, 'data', f), 'utf8'));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const yearOf = (s) => { const m = String(s || '').match(/(20\d\d)/); return m ? Number(m[1]) : null; };

// Era defaults for the game a Steam group mostly played.
const ERA_GAME = {
  '21stPApubliclinebattlegroup': 'BG2', '2ndColdstream': 'NW',
  '2ndColdstreamOfficial': 'NW', 'GoRoaRgg': 'CSGO',
};
const GROUP_YEAR = {
  '21stPApubliclinebattlegroup': 2011, 'Midnightmercs': 2011, '2ndColdstream': 2012,
  'MidnightMercss': 2012, 'NoxViator': 2013, 'GoRoaRgg': 2017,
  '2ndColdstreamOfficial': 2020, 'coldstreamgaming': 2020,
};

const entries = [];
const add = (e) => entries.push({ game: 'GEN', rank_or_class: null, year: null, steam_id64: null, notes: null, ...e, person_key: norm(e.person_name) });

// 1. Enjin member table: the oldest dated joins we have.
for (const m of read('enjin-members.json')) {
  add({
    person_name: m.name, year: yearOf(m.joined), source: 'enjin',
    source_detail: `Midnight Mercenaries site member table, joined ${m.joinedRaw || m.joined} (Wayback capture)`,
  });
}

// 2. Forum intake announcements 2012 to 2015, with ranks.
for (const r of read('roster-announced.json')) {
  add({
    person_name: r.name, rank_or_class: r.rank || null, game: 'NW', year: yearOf(r.announcedOn),
    source: 'forum',
    source_detail: `Welcomed by ${r.announcedBy} on the regiment forum thread, ${r.announcedOn}`,
  });
}

// 3. Steam group rosters: current membership of each group.
const groups = read('steam-groups.json');
for (const g of (Array.isArray(groups) ? groups : Object.values(groups))) {
  for (const m of g.members || []) {
    const idMatch = String(m.profile || '').match(/\/profiles\/(\d{17})/);
    add({
      person_name: m.name, steam_id64: idMatch ? idMatch[1] : null,
      game: ERA_GAME[g.slug] || 'GEN', year: GROUP_YEAR[g.slug] || null,
      source: 'steam',
      source_detail: `On the rolls of the ${g.name} Steam group (join date not recorded by Steam)`,
    });
  }
}

// 4. Names recovered from screenshots by the vision passes.
const rec = read('roster-from-images.json');
for (const n of rec.names.filter((x) => x.affiliation === 'member')) {
  add({
    person_name: n.name, rank_or_class: n.rank || null, game: 'NW',
    source: 'screenshot',
    source_detail: `Read from archived scoreboards and kill feeds (${n.sightings.length} sightings, multi-pass verified)` + (n.note ? `. ${n.note}` : ''),
    notes: n.alsoReadAs ? `also read as ${n.alsoReadAs.join(', ')}` : null,
  });
}

// ---- events per year and per game, from the announcement record.
const anns = read('steam-announcements.json');
const EVENT_RX = /linebattle|line battle|event|scrim|match|tournament|10 man|groupfight|practice/i;
const inferGame = (t, g) => {
  const s = ' ' + String(t).toLowerCase() + ' ';
  if (/minecraft/.test(s)) return 'MC';
  if (/cs:go|csgo|retake|esea|faceit|10 man/.test(s)) return 'CSGO';
  if (/cs:s|counter-strike: source| css /.test(s)) return 'CSS';
  if (/arma/.test(s)) return 'ARMA';
  if (/rust/.test(s)) return 'RUST';
  if (/north (&|and) south/.test(s)) return 'NS';
  if (/ttt|gmod|garry/.test(s)) return 'GMOD';
  if (/musket|napoleonic|warband|groupfight/.test(s)) return 'NW';
  return ERA_GAME[g] || 'GEN';
};
const eventStats = {};
for (const a of (Array.isArray(anns) ? anns : anns.announcements)) {
  if (!EVENT_RX.test(a.title || '')) continue;
  const y = yearOf(a.when);
  if (!y) continue;
  const gm = inferGame((a.title || '') + ' ' + (a.body || ''), a.group);
  const k = y + ':' + gm;
  eventStats[k] = (eventStats[k] || 0) + 1;
}
const events = Object.entries(eventStats)
  .map(([k, n]) => ({ year: Number(k.split(':')[0]), game: k.split(':')[1], events: n }))
  .sort((a, b) => a.year - b.year || b.events - a.events);

// ---- news from the old sites, extracted from Wayback captures.
let news = [];
const newsFile = join(ARCHIVE, 'data', 'news-from-old-sites.json');
if (existsSync(newsFile)) {
  news = JSON.parse(readFileSync(newsFile, 'utf8')).items || [];
}

// ---- servers.
const servers = [
  { server_key: 'ttt', game: 'GMOD', name: 'Coldstream TTT', address: 'TBA', online: false, players: 0, max_players: 24 },
  { server_key: 'css', game: 'CSS', name: 'Coldstream CS:S', address: 'TBA', online: false, players: 0, max_players: 20 },
  { server_key: 'cs16', game: 'CS16', name: 'Coldstream 1.6', address: 'TBA', online: false, players: 0, max_players: 20 },
  { server_key: 'mc', game: 'MC', name: 'Coldstream SMP', address: 'TBA', online: false, players: 0, max_players: 20 },
];

// ---- people summary for the roster page: group entries by person and
// compute the years figure people are proud of.
const people = {};
for (const e of entries) {
  const p = (people[e.person_key] ||= { name: e.person_name, firstYear: null, games: new Set(), ranks: [], steam_id64: null, entries: 0 });
  p.entries++;
  if (String(e.person_name).length > String(p.name).length) p.name = e.person_name;
  if (e.year && (!p.firstYear || e.year < p.firstYear)) p.firstYear = e.year;
  if (e.game && e.game !== 'GEN') p.games.add(e.game);
  if (e.rank_or_class) p.ranks.push(e.rank_or_class);
  if (e.steam_id64) p.steam_id64 = e.steam_id64;
}
const peopleOut = Object.values(people).map((p) => ({
  name: p.name, firstYear: p.firstYear, games: [...p.games],
  rank: p.ranks[p.ranks.length - 1] || null, steam_id64: p.steam_id64, entries: p.entries,
})).sort((a, b) => (a.firstYear || 9999) - (b.firstYear || 9999) || a.name.localeCompare(b.name));

// ---- write
mkdirSync('src/seed', { recursive: true });
writeFileSync('src/seed/roster.json', JSON.stringify({ entries, people: peopleOut }, null, 1));
writeFileSync('src/seed/events.json', JSON.stringify(events, null, 1));
writeFileSync('src/seed/news.json', JSON.stringify(news, null, 1));
writeFileSync('src/seed/servers.json', JSON.stringify(servers, null, 1));

// SQL seed for the real database.
const q = (v) => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
let sql = '-- Generated by seed/build-seed.mjs. Roster provenance included on every row.\n';
for (const e of entries) {
  sql += `insert into roster_entry (person_name, person_key, steam_id64, game, rank_or_class, year, source, source_detail, notes) values (${q(e.person_name)}, ${q(e.person_key)}, ${q(e.steam_id64)}, ${q(e.game)}, ${q(e.rank_or_class)}, ${e.year ?? 'null'}, ${q(e.source)}, ${q(e.source_detail)}, ${q(e.notes)});\n`;
}
for (const s of servers) {
  sql += `insert into server_status (server_key, game, name, address, players, max_players, online) values (${q(s.server_key)}, ${q(s.game)}, ${q(s.name)}, ${q(s.address)}, 0, ${s.max_players}, false);\n`;
}
for (const n of news) {
  sql += `insert into news_item (title, body, author, original_date, source_site, source_url) values (${q(n.title)}, ${q(n.body)}, ${q(n.author)}, ${n.date ? q(n.date.slice(0, 10)) : 'null'}, ${q(n.site)}, ${q(n.sourceUrl || null)});\n`;
}
writeFileSync('db/0002_seed.sql', sql);

console.log(`roster entries: ${entries.length} | distinct people: ${peopleOut.length}`);
console.log(`event stat rows: ${events.length} | news items: ${news.length} | servers: ${servers.length}`);

// ---- films and gallery for the landing page.
const parseViews = (v) => {
  const m = String(v || '').match(/([\d.,]+)\s*([KM])?/i);
  if (!m) return 0;
  let n = Number(m[1].replace(/,/g, ''));
  if (/k/i.test(m[2] || '')) n *= 1000;
  if (/m/i.test(m[2] || '')) n *= 1000000;
  return Math.round(n);
};
const yt = read('youtube.json');
const films = [];
for (const ch of yt) {
  for (const v of ch.videos || []) {
    films.push({
      id: v.videoId, title: v.title, views: parseViews(v.views),
      viewsText: v.views || '', published: v.published || '',
      channel: ch.handle, channelUrl: ch.url,
    });
  }
}
films.sort((a, b) => b.views - a.views);
writeFileSync('src/seed/films.json', JSON.stringify(films, null, 1));

// Gallery: export the best archived screenshots to public/gallery.
const { default: sharp } = await import('sharp');
const manifest = JSON.parse(readFileSync(join(ARCHIVE, 'data', 'img-manifest.json'), 'utf8'));
const vision = JSON.parse(readFileSync(join(ARCHIVE, 'data', 'vision-pass-result.json'), 'utf8'));
const kindOf = Object.fromEntries(vision.allImages.map((i) => [i.hash, i]));
const shots = manifest
  .filter((m) => (kindOf[m.hash]?.kind === 'screenshot') && m.width >= 800)
  .filter((m) => !/blackout|kill-feed \/ chat log/i.test(kindOf[m.hash]?.description || ''))
  .sort((a, b) => b.width * b.height - a.width * a.height)
  .slice(0, 12);
mkdirSync('public/gallery', { recursive: true });
const galleryOut = [];
for (const m of shots) {
  const info = kindOf[m.hash];
  const yearM = JSON.stringify(m.ctx || []).match(/(20\d\d)/);
  const out = `gallery/${m.hash.slice(0, 10)}.jpg`;
  await sharp(join(ARCHIVE, 'data/img', m.hash)).resize(1200, null, { withoutEnlargement: true })
    .jpeg({ quality: 82 }).toFile(join('public', out));
  galleryOut.push({
    src: '/' + out,
    caption: String(info.description || '').split(/[.:]/)[0].slice(0, 110),
    year: yearM ? Number(yearM[1]) : null,
  });
}
writeFileSync('src/seed/gallery.json', JSON.stringify(galleryOut, null, 1));
console.log(`films: ${films.length} (top: ${films[0]?.title} · ${films[0]?.viewsText}) | gallery: ${galleryOut.length}`);
