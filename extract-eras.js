// Turns the Steam announcements into an event log and an era timeline.
import { readFileSync, writeFileSync } from 'node:fs';

const anns = JSON.parse(readFileSync('data/steam-announcements.json', 'utf8'));
const groups = JSON.parse(readFileSync('data/steam-groups.json', 'utf8'));

// "Jul 8, 2020 @ 4:39pm" -> Date. Keep the date half; the time never parses
// reliably because Steam writes "4:39pm" with no space before the meridiem.
function parseWhen(when) {
  if (!when) return null;
  const datePart = when.split('@')[0].trim();
  const withYear = /\d{4}/.test(datePart) ? datePart : datePart + ', ' + new Date().getFullYear();
  const d = new Date(withYear);
  return Number.isNaN(d.getTime()) ? null : d;
}

for (const a of anns) {
  const d = parseWhen(a.when);
  a.iso = d ? d.toISOString().slice(0, 10) : null;
  a.year = d ? d.getFullYear() : null;
}

// An announcement counts as an event call if it announces something happening.
const EVENT = /linebattle|line battle|\bevent\b|siege|tournament|scrim|match|campaign|raid|game ?night|movie night|practice|training|drill|starts in|starting now|tonight/i;
const REBRAND = /rebrand|renam|new group|new name|merge|moving to|new community|new era|closing|shutting|disband/i;

const events = anns.filter((a) => EVENT.test(a.title + ' ' + a.body));
const rebrands = anns.filter((a) => REBRAND.test(a.title));

// --- per group -----------------------------------------------------------
const byGroup = new Map();
for (const g of groups) {
  byGroup.set(g.slug, {
    slug: g.slug,
    name: g.name,
    founded: (g.founded || '').split('div')[0].replace('/di', '').trim(),
    members: g.memberCount,
    namedMembers: g.namedMembers,
    announcements: 0,
    events: 0,
    first: null,
    last: null,
    byYear: {},
    topAuthors: {},
  });
}
for (const a of anns) {
  const g = byGroup.get(a.group);
  if (!g) continue;
  g.announcements++;
  if (EVENT.test(a.title + ' ' + a.body)) {
    g.events++;
    if (a.year) g.byYear[a.year] = (g.byYear[a.year] || 0) + 1;
  }
  if (a.iso) {
    if (!g.first || a.iso < g.first) g.first = a.iso;
    if (!g.last || a.iso > g.last) g.last = a.iso;
  }
  if (a.author) g.topAuthors[a.author] = (g.topAuthors[a.author] || 0) + 1;
}

const groupStats = [...byGroup.values()].map((g) => ({
  ...g,
  topAuthors: Object.entries(g.topAuthors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => ({ name, n })),
}));
groupStats.sort((a, b) => new Date(a.founded) - new Date(b.founded));

// --- events per year across the whole community --------------------------
const eventsByYear = {};
for (const a of events) if (a.year) eventsByYear[a.year] = (eventsByYear[a.year] || 0) + 1;

writeFileSync(
  'data/eras.json',
  JSON.stringify(
    {
      groups: groupStats,
      eventsByYear,
      totals: { announcements: anns.length, events: events.length, rebrands: rebrands.length },
      rebrands: rebrands
        .filter((r) => r.iso)
        .sort((a, b) => a.iso.localeCompare(b.iso))
        .map((r) => ({ iso: r.iso, group: r.group, title: r.title, body: r.body.slice(0, 400), author: r.author })),
    },
    null,
    2,
  ),
);

console.log('EVENT CALLS PER GROUP');
for (const g of groupStats) {
  console.log(
    '  ' + g.name.padEnd(44),
    String(g.events).padStart(4) + ' events /' + String(g.announcements).padStart(4) + ' posts ',
    (g.first || '?') + ' -> ' + (g.last || '?'),
  );
}
console.log('\nEVENTS PER YEAR (whole community)');
Object.entries(eventsByYear)
  .sort()
  .forEach(([y, c]) => console.log('  ' + y, String(c).padStart(4), '#'.repeat(Math.ceil(c / 4))));

console.log('\nERA MARKERS (rebrands, closures, merges)');
for (const r of JSON.parse(readFileSync('data/eras.json', 'utf8')).rebrands) {
  console.log('  ' + r.iso, r.group.padEnd(24), r.title.slice(0, 70));
}
