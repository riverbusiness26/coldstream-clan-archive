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

// Ranks reach the record both spelled out and abbreviated depending on which
// source they came from, so "Rct" and "Recruit" were counting as two different
// ranks. Everything resolves to the full name the regiment used.
const RANK_NAMES = {
  col: 'Colonel', ltcol: 'Lieutenant Colonel', maj: 'Major',
  cpt: 'Captain', capt: 'Captain', lt: 'Lieutenant', ens: 'Ensign',
  rsm: 'Regimental Serjeant Major', csgt: 'Colour Serjeant', cgrd: 'Colour Serjeant',
  sjt: 'Serjeant', sgt: 'Serjeant',
  cpl: 'Corporal', kpl: 'Corporal', lcpl: 'Lance Corporal',
  chm: 'Chosen Man', rgl: 'Regular', pte: 'Private', pvt: 'Private',
  rct: 'Recruit', cdt: 'Cadet', cad: 'Cadet',
};
const rankName = (r) => {
  if (!r) return null;
  const k = norm(r);
  if (RANK_NAMES[k]) return RANK_NAMES[k];
  // Already spelled out: keep it, but in one consistent casing.
  const full = Object.values(RANK_NAMES).find((v) => norm(v) === k);
  return full ?? String(r).trim();
};

const entries = [];
const add = (e) => entries.push({ game: 'GEN', rank_or_class: null, year: null, steam_id64: null, notes: null, ...e, rank_or_class: rankName(e.rank_or_class), person_key: norm(e.person_name) });

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

// 5. Announcement authorship. Steam group membership carries no join date, so
// for anyone who ran a group the earliest announcement they posted is a far
// better first-year than the group's founding year. It only covers the handful
// who actually posted, but for those it is the strongest date in the archive.
const annsForAuthors = read('steam-announcements.json');
const authored = {};
for (const a of (Array.isArray(annsForAuthors) ? annsForAuthors : annsForAuthors.announcements)) {
  const name = String(a.author || '').trim();
  const y = yearOf(a.when);
  if (!name || name === '[deleted]' || !y) continue;
  const k = norm(name);
  const e = (authored[k] ||= { name, first: y, last: y, n: 0, groups: new Set() });
  e.n++;
  if (y < e.first) e.first = y;
  if (y > e.last) e.last = y;
  e.groups.add(a.group);
}
for (const a of Object.values(authored)) {
  add({
    person_name: a.name, year: a.first, source: 'steam',
    source_detail: `Posted ${a.n} announcement${a.n === 1 ? '' : 's'} to the community's Steam groups, `
      + (a.first === a.last ? `in ${a.first}` : `${a.first} to ${a.last}`),
    notes: `groups: ${[...a.groups].join(', ')}`,
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



// ---- the eras, with their event counts recomputed here.
//
// The research pass counted events with a rule that is no longer recoverable:
// it produced 627 across the eras and 529 for the regiment years, and neither
// can be reproduced from the announcements by any rule that can be written
// down. The site was showing 627 in its statistics while its own per-year bars
// added up to 362, which is the kind of thing this whole archive exists to not
// do. Events are counted here, once, by the same rule everything else uses:
// an announcement whose title announces an event.
//
// Everything else on an era is kept from the research file and verified: the
// announcement counts reproduce exactly, and founding dates and member counts
// come from the group pages rather than the feed.
const erasRaw = read('eras.json');
const eraEvents = {};
const eraByYear = {};
for (const a of (Array.isArray(anns) ? anns : anns.announcements)) {
  if (!EVENT_RX.test(a.title || '')) continue;
  const y = yearOf(a.when);
  eraEvents[a.group] = (eraEvents[a.group] || 0) + 1;
  if (y) {
    (eraByYear[a.group] ||= {});
    eraByYear[a.group][y] = (eraByYear[a.group][y] || 0) + 1;
  }
}

// Label, the games it played, and the line of context the numbers do not say.
const ERA_NOTES = {
  '21stPApubliclinebattlegroup': ['21stPA', 'Battlegrounds 2',
    'Public linebattles in Battlegrounds 2. A server, a bugle, and the first thirty names on the roll.'],
  'Midnightmercs': ['Midnight Mercs', 'Battlegrounds 2, Mount & Blade',
    'The first banner the community flew over itself, with the regiment underneath it.'],
  '2ndColdstream': ['2nd Coldstream Regiment of Footguards', 'Mount & Blade: Warband, Napoleonic Wars',
    'The regiment years. Rank structure, weekly drills, and more events called than any other stretch of the record. Second to None.'],
  'MidnightMercss': ['Midnight Mercenaries', 'multi-game',
    'The community side of the same years, running wider than the one game the regiment played.'],
  'NoxViator': ['Nox Viator', 'multi-game',
    'The community through the middle years, with the 2nd Coldstream still the regiment inside it.'],
  'GoRoaRgg': ['RoaR Gaming', 'Counter-Strike: Global Offensive',
    'The esports years. Dedicated CS:GO retake servers, 10 mans on FACEIT, and teams fielded in ESEA Open and ESEA Intermediate. A creator on the Steam Workshop named a USP skin "RoaR" and gave it to the org.'],
  '2ndColdstreamOfficial': ['2nd Coldstream Official', 'Mount & Blade: Warband, Napoleonic Wars',
    'The regiment name back over the door, and the old lines forming up again.'],
  'coldstreamgaming': ['Coldstream Gaming', 'multi-game',
    'Where we are now. Every game we feel like playing, our own servers coming back online, and this site to hold the rest of it.'],
};

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const isoFromFounded = (founded) => {
  const m = String(founded || '').match(/^(\w+) (\d+), (\d{4})$/);
  if (!m) return null;
  const mi = MONTHS_LONG.indexOf(m[1]);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
};

const erasOut = erasRaw.groups.map((g) => {
  const [label, game, note] = ERA_NOTES[g.slug] || [g.name, '', ''];
  return {
    slug: g.slug, name: g.name, label, game, note,
    founded: g.founded, foundedIso: isoFromFounded(g.founded),
    members: g.members, namedMembers: g.namedMembers,
    announcements: g.announcements,
    events: eraEvents[g.slug] || 0,
    first: g.first, last: g.last,
    byYear: eraByYear[g.slug] || {},
    topAuthors: (g.topAuthors || []).slice(0, 3),
  };
}).sort((a, b) => String(a.foundedIso).localeCompare(String(b.foundedIso)));

// ---- River, 2026-08-21 (revised same day): the timeline is two chapters,
// split at the 2013 rename, not at the 2015 stint.
//
// Chapter one, 2011 to 2012: Midnight Mercenaries and the 2nd Coldstream
// Regiment of Footguards ran as the same unit, and the Multi-Gaming group
// was a duplicate banner over the same community. One entry.
//
// Chapter two, 2013 to 2015: the gaming community renamed to Nox Viator
// and the 2nd Coldstream carried on as its sub-group, through the 2015
// summer the regiment formed back up and the website came back to life at
// coldstream.enjin.com. One entry, absorbing the standalone Nox Viator
// group entry AND everything the old groups posted from 2013 on.
//
// The split is by announcement year across the groups involved, so the
// totals still reconcile with the raw archive. Deleting this block and
// reseeding restores the one-group-one-entry timeline.
const MERGED_SLUGS = ['Midnightmercs', '2ndColdstream', 'MidnightMercss'];
const NOX_SLUG = 'NoxViator';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isoOfWhen = (w) => {
  const m = String(w || '').match(/^(\w{3}) (\d+), (\d{4})/);
  if (!m || MONTHS_SHORT.indexOf(m[1]) < 0) return null;
  return `${m[3]}-${String(MONTHS_SHORT.indexOf(m[1]) + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
};
const annList = Array.isArray(anns) ? anns : anns.announcements;
// Chapter one: the unit years. Chapter two: everything those groups posted
// from the 2013 rename on, plus the Nox Viator group's own feed.
const isUnitAnn = (a) => MERGED_SLUGS.includes(a.group) && (yearOf(a.when) ?? 0) <= 2012;
const isNoxAnn = (a) => a.group === NOX_SLUG
  || (MERGED_SLUGS.includes(a.group) && (yearOf(a.when) ?? 0) >= 2013);
const spanOf = (rows) => {
  const ds = rows.map((a) => isoOfWhen(a.when)).filter(Boolean).sort();
  return { first: ds[0] ?? null, last: ds[ds.length - 1] ?? null };
};
const topOf = (rows) => {
  const m = {};
  for (const a of rows) if (a.author) m[a.author] = (m[a.author] || 0) + 1;
  return Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 3)
    .map(([name, n]) => ({ name, n }));
};
const evByYear = (rows) => {
  const m = {};
  for (const a of rows) {
    if (!EVENT_RX.test(a.title || '')) continue;
    const y = yearOf(a.when);
    if (y) m[y] = (m[y] || 0) + 1;
  }
  return m;
};
const sumBy = (o) => Object.values(o).reduce((n, v) => n + v, 0);
const groupsIn = (rows) => [...new Set(rows.map((a) => a.group))];
const unitRows = annList.filter(isUnitAnn);
const noxRows = annList.filter(isNoxAnn);
const unitParts = erasOut.filter((e) => MERGED_SLUGS.includes(e.slug));
const noxPart = erasOut.find((e) => e.slug === NOX_SLUG);
const unitBy = evByYear(unitRows);
const noxBy = evByYear(noxRows);
const erasFinal = [
  ...erasOut.filter((e) => !MERGED_SLUGS.includes(e.slug) && e.slug !== NOX_SLUG),
  {
    slug: 'coldstreamregiment',
    sources: groupsIn(unitRows),
    name: 'Midnight Mercenaries / 2nd Coldstream Regiment of Footguards',
    label: 'Midnight Mercenaries / 2nd Coldstream',
    ran: '2011-2012',
    game: 'Battlegrounds 2, Mount & Blade: Warband, Napoleonic Wars',
    note: 'One unit, run 2011 to 2012: Midnight Mercenaries and the 2nd Coldstream Regiment of Footguards were the same unit, and the Multi-Gaming group was a duplicate banner over the same community. Rank structure, weekly drills, and the busiest single year the record holds. Second to None. The same names filled all three group pages, so the member count is the largest of the three groups rather than a sum.',
    founded: 'June 28, 2011',
    foundedIso: '2011-06-28',
    members: Math.max(...unitParts.map((e) => e.members)),
    namedMembers: Math.max(...unitParts.map((e) => e.namedMembers)),
    announcements: unitRows.length,
    events: sumBy(unitBy),
    ...spanOf(unitRows),
    byYear: unitBy,
    topAuthors: topOf(unitRows),
  },
  {
    slug: 'noxviatorcoldstream',
    sources: groupsIn(noxRows),
    name: 'Nox Viator / 2nd Coldstream',
    label: 'Nox Viator · 2nd Coldstream',
    ran: '2013-2015',
    game: 'multi-game, Mount & Blade: Warband, Napoleonic Wars',
    note: 'In 2013 the gaming community renamed to Nox Viator, and the 2nd Coldstream carried on as its sub-group through 2015: the regiment kept calling its events through the old group feeds, and in the summer of 2015 it formed back up in force, with the website coming back to life at coldstream.enjin.com, before going quiet again in the autumn.',
    founded: '2013',
    foundedIso: '2013-01-01',
    members: noxPart ? noxPart.members : 0,
    namedMembers: noxPart ? noxPart.namedMembers : 0,
    announcements: noxRows.length,
    events: sumBy(noxBy),
    ...spanOf(noxRows),
    byYear: noxBy,
    topAuthors: topOf(noxRows),
  },
].sort((a, b) => String(a.foundedIso).localeCompare(String(b.foundedIso)));

writeFileSync('src/seed/eras.json', JSON.stringify({
  eras: erasFinal,
  totals: {
    announcements: erasFinal.reduce((n, e) => n + e.announcements, 0),
    events: erasFinal.reduce((n, e) => n + e.events, 0),
  },
  eventsByYear: events.reduce((acc, e) => { acc[e.year] = (acc[e.year] || 0) + e.events; return acc; }, {}),
}, null, 1));
console.log(`eras: ${erasFinal.length} (two chapters split at the 2013 rename) | events recomputed: ${erasFinal.reduce((n, e) => n + e.events, 0)} (research file said ${erasRaw.totals.events})`);

// ---- the calendar's past, from the announcement record.
//
// 627 events were called between 2011 and 2020 and every one of them has a
// date. They are seeded as bundled data rather than database rows because they
// are archive, not diary: nobody can RSVP to 2012. The live table holds only
// what is still to come.
const MONTH_N = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
const whenToIso = (w) => {
  // "Jul 8, 2020 @ 4:39pm"
  const m = String(w || '').match(/^(\w{3})\s+(\d{1,2}),\s*(20\d\d)/);
  if (!m) return null;
  const mo = MONTH_N[m[1]];
  if (!mo) return null;
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
};

const pastEvents = [];
for (const a of (Array.isArray(anns) ? anns : anns.announcements)) {
  if (!EVENT_RX.test(a.title || '')) continue;
  const date = whenToIso(a.when);
  if (!date) continue;
  pastEvents.push({
    date,
    title: String(a.title || '').trim().slice(0, 160),
    game: inferGame((a.title || '') + ' ' + (a.body || ''), a.group),
    group: a.group,
    by: (a.author || '').trim() || null,
    source: `Steam group announcement, ${a.when}`,
  });
}
pastEvents.sort((x, y) => y.date.localeCompare(x.date));
writeFileSync('src/seed/events-past.json', JSON.stringify(pastEvents, null, 1));
console.log(`past events: ${pastEvents.length} (${pastEvents.at(-1)?.date} to ${pastEvents[0]?.date})`);

// ---- news from the old sites, extracted from Wayback captures.
// The news items were extracted from Wayback captures in a separate pass and
// the result is not in the archive's data directory. If the source file is not
// here, keep whatever is already seeded rather than writing an empty list over
// it: a rebuild on a machine without that file used to silently wipe the front
// page, and an empty file looks exactly like "there was no news".
let news = null;
const newsFile = join(ARCHIVE, 'data', 'news-from-old-sites.json');
if (existsSync(newsFile)) {
  news = JSON.parse(readFileSync(newsFile, 'utf8')).items || [];
} else if (existsSync('src/seed/news.json')) {
  news = JSON.parse(readFileSync('src/seed/news.json', 'utf8'));
  console.warn(`news: ${newsFile} not found, keeping the ${news.length} already seeded`);
} else {
  news = [];
}

// ---- servers.
const servers = [
  { server_key: 'ttt', game: 'GMOD', name: 'Coldstream TTT', address: 'TBA', online: false, players: 0, max_players: 24 },
  { server_key: 'css', game: 'CSS', name: 'Coldstream CS:S', address: 'TBA', online: false, players: 0, max_players: 20 },
  { server_key: 'cs16', game: 'CS16', name: 'Coldstream 1.6', address: 'TBA', online: false, players: 0, max_players: 20 },
  { server_key: 'mc', game: 'MC', name: 'Coldstream SMP', address: 'TBA', online: false, players: 0, max_players: 20 },
];

// ---- known aliases.
//
// One person can sit in the record under a Steam name, a forum handle and an
// in-game name, and the archive has no way to know they are the same person.
// Guessing would be worse than leaving them split, so this table only holds
// identities somebody has actually confirmed, and each one carries who
// confirmed it. Anything not listed here stays as separate rows.
//
// canonical key -> { name shown, the other keys, and where the link came from }
const ALIASES = [
  {
    key: 'river',
    name: 'RiveR',
    also: ['rivercs', 'crawford', 'colonelriver', '2ndcscolcrawford', 'colcrawford'],
    // Confirmed against the public Steam profile: this id resolves to the
    // persona "RiveR" with the vanity url /id/RiveRcs.
    steam_id64: '76561198044997257',
    why: 'Identified by River himself: Steam RiveRcs, forum handle Crawford, in-game Colonel River',
  },
];

const aliasOf = {};
const aliasWhy = {};
for (const a of ALIASES) {
  aliasWhy[a.key] = a.why;
  aliasOf[a.key] = a.key;
  for (const k of a.also) aliasOf[k] = a.key;
}
const canonical = (k) => aliasOf[k] || k;
const aliasName = Object.fromEntries(ALIASES.map((a) => [a.key, a.name]));
const aliasSteam = Object.fromEntries(ALIASES.filter((a) => a.steam_id64).map((a) => [a.key, a.steam_id64]));

// Fold the aliases into the entries themselves, so the database and the site
// agree, and note on each folded row which name it was originally filed under.
for (const e of entries) {
  const c = canonical(e.person_key);
  if (c === e.person_key) continue;
  e.notes = [e.notes, `filed under "${e.person_name}"; ${aliasWhy[c]}`].filter(Boolean).join('. ');
  e.person_key = c;
}

// A Steam group's member list carries the group's founding year, not a join
// date, so it is not evidence of when somebody turned up. An announcement is
// different: it files under the same source but its year comes from the post's
// own timestamp. Excluding the whole source threw the strongest dated evidence
// we have out with the weakest, and left the man who founded the community
// with no year at all.
const isGroupRoll = (e) => e.source === 'steam' && /^On the rolls of the/.test(e.source_detail || '');

// ---- people summary for the roster page: group entries by person and
// compute the years figure people are proud of.
const people = {};
for (const e of entries) {
  const p = (people[e.person_key] ||= { name: e.person_name, firstYear: null, datedYear: null, games: new Set(), ranks: [], steam_id64: null, entries: 0, aka: new Set() });
  p.entries++;
  if (aliasName[e.person_key]) p.name = aliasName[e.person_key];
  else if (String(e.person_name).length > String(p.name).length) p.name = e.person_name;
  p.aka.add(e.person_name);
  if (e.year && (!p.firstYear || e.year < p.firstYear)) p.firstYear = e.year;
  // Years-with-us only counts from a genuinely dated record. Steam group
  // membership carries the group's founding year, not a join date, so it
  // never feeds datedYear (River's call, HANDOFF 13b option 1).
  if (e.year && !isGroupRoll(e) && (!p.datedYear || e.year < p.datedYear)) p.datedYear = e.year;
  if (e.game && e.game !== 'GEN') p.games.add(e.game);
  if (e.rank_or_class) p.ranks.push(e.rank_or_class);
  if (e.steam_id64) p.steam_id64 = e.steam_id64;
}
// A confirmed Steam id beats anything inferred, and lets a signed-in member
// match their own row by id rather than by whatever name they use today.
for (const [k, id] of Object.entries(aliasSteam)) if (people[k]) people[k].steam_id64 = id;
// Site titles, shown on the roster and the profile. Display only: the
// database role still governs permissions.
const TITLES = { river: 'Owner and Founder' };

const peopleOut = Object.entries(people).map(([key, p]) => ({
  key,
  title: TITLES[key] || null,
  name: p.name, firstYear: p.firstYear, datedYear: p.datedYear, games: [...p.games],
  rank: p.ranks[p.ranks.length - 1] || null, steam_id64: p.steam_id64, entries: p.entries,
  aka: [...p.aka].filter((n) => n !== p.name),
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

// Gallery: the archived screenshots, exported to public/gallery.
//
// Picked by hand rather than by filter. An automatic pass over the vision
// results pulls in the narrow chat crops that were posted as drama evidence,
// with names blacked out by whoever posted them: they are screenshots by kind,
// but they are not gallery pieces, and two of them displaced real ones.
//
// Captions are written. The automatic version cut the vision description at
// the first full stop, which produced captions like "Mount & Blade" nine times
// over and one that stopped mid-word.
//
// Keys are the sha1 of the original URL, which is what img-manifest records as
// its hash, so a picture keeps the same filename across rebuilds.
const { default: sharp } = await import('sharp');
const manifest = JSON.parse(readFileSync(join(ARCHIVE, 'data', 'img-manifest.json'), 'utf8'));
const vision = JSON.parse(readFileSync(join(ARCHIVE, 'data', 'vision-pass-result.json'), 'utf8'));
const byUrl = Object.fromEntries(manifest.map((m) => [m.url, m]));
const extracted = Object.fromEntries(vision.extraction.map((x) => [x.hash, x]));

const PICKS = [
  { u: 'http://images.akamai.steamusercontent.com/ugc/449582819873540392/D115A21BE458370B305DA32F3DD09300E9EAC7B4/',
    cap: 'A French Guard line stands at attention, colours up, officer on the left.' },
  { u: 'https://i.imgur.com/6x2u6mI.jpg', date: '2015-06',
    cap: 'A training event where all nineteen players on the field wore the 2ndCS tag. The French side was empty.' },
  { u: 'https://i.imgur.com/y6LcTwx.jpg', date: '2014-05',
    cap: 'Down the firing line from the ranks. Posted with one word: "Soon".' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-11-30_00003.jpg',
    cap: 'A single rank of redcoats stretched across the treeline, regimental colour flying at the centre.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-11-30_00004.jpg',
    cap: 'Bayonets levelled, colour raised, the enemy line just visible on the right.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-12-01_00001-1.jpg',
    cap: 'The line formed up inside the walls of the training fort.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-12-01_00002.jpg',
    cap: 'Same session, same courtyard: the ranks at attention while two officers face them down.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-12-04_00005.jpg',
    cap: 'Twenty men kneeling in a double line behind the palisade, one officer standing at the end.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-11-17_00004.jpg',
    cap: 'End of round on Austria against France, two points apiece, with the regiment on the Austrian side.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-11-18_00002.jpg',
    cap: 'Five to nothing on US1, and the whole Prussian side down.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/2012-11-18_00001.jpg',
    cap: 'The kill feed from that same November night on the public servers.' },
  { u: 'http://i891.photobucket.com/albums/ac116/Ashton366/Pubstomp.png',
    cap: 'Pubstomp. A full page of kill feed from a public server, with our tags running all the way down it.' },
];

// A Steam screenshot carries the day it was taken in its own filename.
const dateFromName = (u) => {
  const m = u.match(/\/(20\d\d)-([01]\d)-([0-3]\d)_\d/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

mkdirSync('public/gallery', { recursive: true });
const galleryOut = [];
for (const pick of PICKS) {
  const m = byUrl[pick.u];
  if (!m) { console.warn('gallery: no manifest entry for', pick.u); continue; }
  const out = `gallery/${m.hash.slice(0, 10)}.jpg`;
  await sharp(join(ARCHIVE, 'data/img', m.hash))
    .resize(1600, null, { withoutEnlargement: true })
    .jpeg({ quality: 84 }).toFile(join('public', out));
  const meta = await sharp(join('public', out)).metadata();
  const date = dateFromName(pick.u) ?? pick.date ?? null;
  galleryOut.push({
    src: '/' + out,
    w: meta.width, h: meta.height,
    caption: pick.cap,
    date,
    year: date ? Number(date.slice(0, 4)) : null,
    game: 'Mount & Blade: Warband, Napoleonic Wars',
    // Everyone the vision passes could read in the shot, ours and theirs both.
    who: (extracted[m.hash]?.confirmed ?? []).map((c) => c.name),
    source: pick.u,
  });
}
writeFileSync('src/seed/gallery.json', JSON.stringify(galleryOut, null, 1));

// ---- the rank ladder.
//
// The regiment's own rank insignia, recovered from its site. Twelve ranks in
// three tiers, which is exactly the three section headers that sat alongside
// them in the same album: Officers, Non-Commissioned Officers, Enlisted.
//
// Colonel is not here. River held it and there is no insignia for it in the
// archive, so rather than draw one, the ladder shows what survives.
const RANKS = [
  { abbr: 'LtCol', name: 'Lieutenant Colonel', tier: 'Officers', file: 'LtColLieutenantColonel.png' },
  { abbr: 'Cpt', name: 'Captain', tier: 'Officers', file: 'CptCaptain.png' },
  { abbr: 'Lt', name: 'Lieutenant', tier: 'Officers', file: 'LtLieutenant.png' },
  { abbr: 'Ens', name: 'Ensign', tier: 'Officers', file: 'EnsEnsign.png' },
  { abbr: 'RSM', name: 'Regimental Serjeant Major', tier: 'Non-Commissioned Officers', file: 'RsmRegimentalSerjeantMajor.png' },
  { abbr: 'CSgt', name: 'Colour Serjeant', tier: 'Non-Commissioned Officers', file: 'CsgtColourSerjeant.png' },
  { abbr: 'Sjt', name: 'Serjeant', tier: 'Non-Commissioned Officers', file: 'SjtSerjeant.png' },
  { abbr: 'Cpl', name: 'Corporal', tier: 'Non-Commissioned Officers', file: 'CplCorporal.png' },
  { abbr: 'ChM', name: 'Chosen Man', tier: 'Enlisted', file: 'ChmChosenMan.png' },
  { abbr: 'Rgl', name: 'Regular', tier: 'Enlisted', file: 'RglRegular.png' },
  { abbr: 'Pte', name: 'Private', tier: 'Enlisted', file: 'PtePrivate.png' },
  { abbr: 'Rct', name: 'Recruit', tier: 'Enlisted', file: 'RctRecruit.png' },
];

mkdirSync('public/ranks', { recursive: true });
const ranksOut = [];
for (const r of RANKS) {
  const m = manifest.find((x) => x.url.endsWith('/' + r.file));
  if (!m) { console.warn('ranks: no image for', r.file); continue; }
  const out = `ranks/${r.abbr.toLowerCase()}.png`;
  await sharp(join(ARCHIVE, 'data/img', m.hash))
    .resize(null, 420, { withoutEnlargement: true })
    .png({ compressionLevel: 9 }).toFile(join('public', out));
  const rm = await sharp(join('public', out)).metadata();
  ranksOut.push({ ...r, src: '/' + out, w: rm.width, h: rm.height, source: m.url });
}
writeFileSync('src/seed/ranks.json', JSON.stringify(ranksOut, null, 1));
console.log(`ranks: ${ranksOut.length} of ${RANKS.length}`);
console.log(`films: ${films.length} (top: ${films[0]?.title} · ${films[0]?.viewsText}) | gallery: ${galleryOut.length}`);

// ---- per-person profile stats and the dated event list (Robert side,
// HANDOFF 17). Append-only: reads the structures above, adds two seed files.
{
  const galleryShots = JSON.parse(readFileSync('src/seed/gallery.json', 'utf8'));
  const annsAll = (Array.isArray(anns) ? anns : anns.announcements);

  // forum posts and announcements authored, keyed by normalized name
  const postCounts = {};
  for (const p of read('posts.json')) { const k = norm(p.author); postCounts[k] = (postCounts[k] || 0) + 1; }
  const annCounts = {};
  for (const a of annsAll) { const k = norm(a.author); annCounts[k] = (annCounts[k] || 0) + 1; }

  // screenshots each person appears in
  const shotIndex = {};
  galleryShots.forEach((s, i) => {
    for (const w of s.who || []) (shotIndex[norm(w)] ||= []).push(i);
  });

  const profileStats = {};
  for (const p of Object.values(people)) {
    const k = norm(p.name);
    const akaKeys = [...new Set([k, ...[...(p.aka || [])].map(norm)])];
    let fp = 0, ac = 0; const shots = new Set();
    for (const kk of akaKeys) {
      fp += postCounts[kk] || 0;
      ac += annCounts[kk] || 0;
      for (const i of shotIndex[kk] || []) shots.add(i);
    }
    if (fp || ac || shots.size) profileStats[k] = { forumPosts: fp, announcements: ac, shots: [...shots] };
  }
  writeFileSync('src/seed/profile-stats.json', JSON.stringify(profileStats, null, 1));

  // the dated event record for the calendar
  const eventList = [];
  for (const a of annsAll) {
    if (!EVENT_RX.test(a.title || '')) continue;
    const d = new Date(String(a.when || '').split('@')[0].trim());
    if (isNaN(d)) continue;
    eventList.push({
      date: d.toISOString().slice(0, 10),
      title: String(a.title).slice(0, 140),
      game: inferGame((a.title || '') + ' ' + (a.body || ''), a.group),
      author: a.author || null,
      group: a.group,
    });
  }
  eventList.sort((x, y) => x.date.localeCompare(y.date));
  writeFileSync('src/seed/event-record.json', JSON.stringify(eventList, null, 1));
  console.log(`profile stats: ${Object.keys(profileStats).length} people | event record: ${eventList.length} dated events`);
}
