// Merges every source — Steam groups, Steam announcements, the FSE forum
// thread and the YouTube channels — into one community history dataset.
import { readFileSync, writeFileSync } from 'node:fs';

const groups = JSON.parse(readFileSync('data/steam-groups.json', 'utf8'));
const eras = JSON.parse(readFileSync('data/eras.json', 'utf8'));
const anns = JSON.parse(readFileSync('data/steam-announcements.json', 'utf8'));
const youtube = JSON.parse(readFileSync('data/youtube.json', 'utf8'));
const dossier = JSON.parse(readFileSync('data/dossier.json', 'utf8'));
const roster = JSON.parse(readFileSync('data/roster-announced.json', 'utf8'));

const cleanFounded = (f) => (f || '').split('div')[0].replace('/di', '').trim();
const statsBySlug = new Map(eras.groups.map((g) => [g.slug, g]));

// ---------------------------------------------------------------- eras
const ERA_NOTES = {
  '21stPApubliclinebattlegroup':
    'Where it starts. A public linebattle host for the 21st Pennsylvania, and the earliest record the community still has.',
  Midnightmercs:
    'The first Midnight Mercs group — the community proper, rather than a single regiment.',
  '2ndColdstream':
    'The Napoleonic Wars regiment, and the busiest era by a distance — this one group ran more events than every other combined.',
  MidnightMercss:
    'Midnight Mercs relaunched as an explicitly multi-gaming community, running alongside the regiment.',
  NoxViator:
    'The home base through the middle years — the place everyone gathered between games, rather than a unit that fielded its own events.',
  '2ndColdstreamOfficial':
    'Coldstream back on the field, running public linebattles through spring and summer 2020.',
  GoRoaRgg:
    'RoaR Gaming — the 2017 rebrand out of Nox Viator, and the era that carried the community through the late 2010s.',
  coldstreamgaming:
    'The current banner: Coldstream Gaming, a multi-game community carrying the est. 2011 date.',
};

const eraList = groups
  .map((g) => {
    const s = statsBySlug.get(g.slug) ?? {};
    return {
      slug: g.slug,
      name: g.name,
      founded: cleanFounded(g.founded),
      members: g.memberCount,
      namedMembers: g.namedMembers,
      headline: g.headline,
      summary: g.summary,
      announcements: s.announcements ?? 0,
      events: s.events ?? 0,
      first: s.first ?? null,
      last: s.last ?? null,
      topAuthors: s.topAuthors ?? [],
      note: ERA_NOTES[g.slug] ?? '',
      roster: g.members.map((m) => m.name),
    };
  })
  .sort((a, b) => new Date(a.founded) - new Date(b.founded));

// ---------------------------------------------------------------- the core
// Someone who turns up in several groups has followed the community across
// rebrands. That is the community's real membership.
const people = new Map();
for (const g of groups) {
  for (const m of g.members) {
    const key = (m.profile || m.name).toLowerCase();
    if (!people.has(key)) people.set(key, { name: m.name, profile: m.profile, eras: [] });
    const p = people.get(key);
    if (!p.eras.includes(g.name)) p.eras.push(g.name);
  }
}
const allPeople = [...people.values()];
const lifers = allPeople
  .filter((p) => p.eras.length > 1)
  .sort((a, b) => b.eras.length - a.eras.length || a.name.localeCompare(b.name));

// ---------------------------------------------------------------- events
const eventsByYear = eras.eventsByYear;

// Event calls per group per year, for the stacked view.
const EVENT_RE = /linebattle|line battle|\bevent\b|siege|tournament|scrim|match|campaign|raid|game ?night|movie night|practice|training|drill|starts in|starting now|tonight/i;
const perGroupYear = {};
for (const a of anns) {
  if (!EVENT_RE.test(a.title + ' ' + a.body)) continue;
  const year = (a.when.match(/(20\d\d)/) || [])[1];
  if (!year) continue;
  (perGroupYear[a.group] ||= {})[year] = (perGroupYear[a.group]?.[year] || 0) + 1;
}

// ---------------------------------------------------------------- intakes
// Forum intakes give dated joins — the only per-year roster evidence there is.
const intakes = new Map();
for (const r of roster) {
  const year = (r.announcedOn.match(/(20\d\d)/) || [])[1] ?? '?';
  if (!intakes.has(year)) intakes.set(year, []);
  intakes.get(year).push({ name: r.name, rank: r.rank, country: r.country, on: r.announcedOn });
}
const intakeYears = [...intakes.entries()]
  .sort()
  .map(([year, members]) => ({ year, members }));

// ---------------------------------------------------------------- media
const videos = youtube.flatMap((c) =>
  c.videos.map((v) => ({ ...v, channel: c.handle })),
);

const community = {
  generated: '2026-08-19',
  origin: {
    earliestGroup: eraList[0]?.name,
    earliestFounded: eraList[0]?.founded,
    claimedFounding: 'June 28, 2011',
    claimSource: 'Nox Viator Gaming group description',
    youtubeOldest: youtube[0]?.joined,
  },
  totals: {
    eras: eraList.length,
    steamMembers: groups.reduce((a, g) => a + g.memberCount, 0),
    distinctPeople: allPeople.length,
    lifers: lifers.length,
    announcements: eras.totals.announcements,
    events: eras.totals.events,
    forumPosts: dossier.stats.posts,
    forumPosters: dossier.stats.posters,
    videos: videos.length,
  },
  eras: eraList,
  lifers,
  eventsByYear,
  perGroupYear,
  intakeYears,
  rebrands: eras.rebrands,
  videos,
  forum: {
    url: dossier.source.url,
    timeline: dossier.timeline,
    titles: dossier.titles,
    activity: dossier.activity,
    milestones: dossier.milestones,
    command: [
      ['Lieutenant Colonel', 'Thomas'],
      ['Captain', 'Crawford'],
      ['Lieutenant', 'Crazy'],
      ['Regimental Serjeant-Major', 'Richardson'],
    ],
  },
};

writeFileSync('data/community.json', JSON.stringify(community, null, 2));

console.log('CLUB DATASET');
console.log(JSON.stringify(community.totals, null, 2));
console.log('\nERAS IN ORDER');
for (const e of eraList) {
  console.log(
    '  ' + (e.founded || '?').padEnd(20),
    e.name.padEnd(44),
    String(e.members).padStart(4) + ' members',
    String(e.events).padStart(4) + ' events',
  );
}
console.log('\nINTAKE YEARS:', intakeYears.map((i) => i.year + ' (' + i.members.length + ')').join(', '));
console.log('LIFERS (2+ eras):', lifers.length, '| deepest:', lifers[0]?.name, lifers[0]?.eras.length + ' eras');
