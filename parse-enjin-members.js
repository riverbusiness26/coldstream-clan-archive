// Parses a saved Enjin members page (Wayback capture) into a dated roster.
// Enjin's member table carries Display Name / Posts / Last Seen / Join Date,
// which is the only source we have that pairs a member with the date they
// actually joined.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node parse-enjin-members.js <path to members html>');
  process.exit(1);
}

const html = readFileSync(src, 'utf8');

// Rows are <tr>…</tr> with cells; strip scripts first so inline JS is ignored.
const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const rows = [];
for (const m of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1]));
  if (cells.length >= 4) rows.push(cells);
}

// A date cell looks like "Aug 12, 11" or "Sep 4, 11".
const DATE = /^[A-Z][a-z]{2} \d{1,2}, \d{2}$/;
const toIso = (d) => {
  const parsed = new Date(d.replace(/, (\d{2})$/, ', 20$1'));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const members = [];
for (const cells of rows) {
  const dates = cells.filter((c) => DATE.test(c));
  if (dates.length === 0) continue;
  const name = cells.find((c) => c && !DATE.test(c) && !/^\d+$/.test(c));
  if (!name || name.length > 40) continue;
  // Enjin orders the columns Last Seen then Join Date.
  const joined = dates.length > 1 ? dates[dates.length - 1] : dates[0];
  const lastSeen = dates.length > 1 ? dates[0] : null;
  members.push({
    name,
    joined: toIso(joined),
    joinedRaw: joined,
    lastSeen: lastSeen ? toIso(lastSeen) : null,
    posts: Number(cells.find((c) => /^\d+$/.test(c)) ?? 0),
  });
}

members.sort((a, b) => (a.joined ?? '').localeCompare(b.joined ?? ''));
writeFileSync('data/enjin-members.json', JSON.stringify(members, null, 2));

console.log(`Parsed ${members.length} members with join dates\n`);
const byYear = {};
for (const m of members) {
  const y = (m.joined ?? '?').slice(0, 4);
  byYear[y] = (byYear[y] || 0) + 1;
}
console.log('JOINS BY YEAR:', JSON.stringify(byYear));
console.log('\nEARLIEST 15:');
for (const m of members.slice(0, 15)) {
  console.log('  ' + (m.joined ?? '?') + '  ' + m.name.padEnd(24) + (m.posts ? m.posts + ' posts' : ''));
}
