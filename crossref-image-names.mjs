// Cross-references names recovered from images (vision pass) against every
// name already known from text sources (Steam rosters, forum authors,
// announced intakes, command posts). Writes data/roster-from-images.json.
//
// Usage: node crossref-image-names.mjs <workflow-result.json>
import { readFileSync, writeFileSync } from 'node:fs';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const lev = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

const known = JSON.parse(readFileSync('data/known-names.json', 'utf8'));
const knownNorm = new Map(); // norm -> original(s)
for (const k of known) {
  const n = norm(k);
  if (n.length < 2) continue;
  if (!knownNorm.has(n)) knownNorm.set(n, []);
  knownNorm.get(n).push(k);
}

const match = (raw) => {
  const n = norm(raw);
  if (n.length < 2) return { status: 'too-short' };
  if (knownNorm.has(n)) return { status: 'known', as: knownNorm.get(n)[0] };
  if (n.length >= 4)
    for (const [kn, orig] of knownNorm) {
      if (kn.length >= 4 && (kn.includes(n) || n.includes(kn)))
        return { status: 'likely-known', as: orig[0], via: 'containment' };
    }
  if (n.length >= 5)
    for (const [kn, orig] of knownNorm) {
      if (lev(n, kn) <= 1) return { status: 'near-match', as: orig[0], via: 'edit-distance-1' };
    }
  return { status: 'new' };
};

const result = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const manifest = JSON.parse(readFileSync('data/img-manifest.json', 'utf8'));
const byHash = Object.fromEntries(manifest.map((m) => [m.hash, m]));

const out = { generated: new Date().toISOString(), sourceImages: [], names: [] };
const seen = new Map(); // norm -> entry (dedupe across images, keep all sightings)

for (const img of result.extraction) {
  const m = byHash[img.hash] || {};
  out.sourceImages.push({
    hash: img.hash, kind: img.kind, description: img.description,
    url: m.url || null, context: (m.ctx || [])[0] || null,
    confirmed: img.confirmed.length, unconfirmed: img.unconfirmed.length,
  });
  for (const [bucket, list] of [['confirmed', img.confirmed], ['unconfirmed', img.unconfirmed]]) {
    for (const nm of list) {
      const n = norm(nm.name);
      if (n.length < 2) continue;
      if (!seen.has(n)) {
        const mt = match(nm.name);
        seen.set(n, { name: nm.name, rank: nm.rank || null, match: mt, sightings: [] });
        out.names.push(seen.get(n));
      }
      seen.get(n).sightings.push({
        image: img.hash, kind: img.kind, bucket, reads: `${nm.reads}/${nm.of}`,
        rank: nm.rank || null, note: nm.note || null,
      });
    }
  }
}

out.names.sort((a, b) => a.name.localeCompare(b.name));
const tally = {};
for (const n of out.names) tally[n.match.status] = (tally[n.match.status] || 0) + 1;
out.summary = {
  images: out.sourceImages.length,
  distinctNames: out.names.length,
  ...tally,
  caveat: 'Names read from images by a vision pass; each confirmed name agreed across >=2 independent transcriptions. Ranks are as shown in the image at that moment in time.',
};
writeFileSync('data/roster-from-images.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary, null, 1));
console.log('\nNEW names (not in any text source):');
for (const n of out.names.filter((x) => x.match.status === 'new'))
  console.log(` + ${n.name}${n.rank ? ' (' + n.rank + ')' : ''} — ${n.sightings.length} sighting(s), ${n.sightings[0].bucket}`);
console.log('\nNear-matches (possible OCR variants of known names):');
for (const n of out.names.filter((x) => x.match.status === 'near-match' || x.match.status === 'likely-known'))
  console.log(` ~ ${n.name} -> ${n.match.as} (${n.match.via})`);
