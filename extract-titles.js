// SMF stores the subject line with each reply, so the sequence of subjects
// across the thread is a record of how the regiment renamed itself over time.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dec = (s) => s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));
const dateOf = new Map(posts.map((p) => [p.msgId, { date: p.date, replyNo: p.replyNo }]));

const rows = [];
for (const f of readdirSync('data/raw').sort()) {
  const h = readFileSync('data/raw/' + f, 'utf8');
  for (const m of h.matchAll(/<h5 id="subject_(\d+)">\s*<a[^>]*>([^<]+)<\/a>/g)) {
    const meta = dateOf.get(+m[1]);
    if (!meta) continue;
    const subject = dec(m[2]).trim().replace(/^Re:\s*/, '');
    rows.push({ msgId: +m[1], subject, ...meta });
  }
}
rows.sort((a, b) => a.replyNo - b.replyNo);

// Keep only the points where the title actually changes.
const changes = [];
let prev = null;
for (const r of rows) {
  const norm = r.subject.replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  if (norm !== prev) {
    changes.push({ subject: norm, from: r.date, replyNo: r.replyNo });
    prev = norm;
  }
}

// Collapse one-off flickers (a single post carrying an old subject).
const solid = changes.filter((c, i) => {
  const next = changes[i + 1];
  return !next || next.replyNo - c.replyNo > 1;
});

writeFileSync('data/titles.json', JSON.stringify(solid, null, 2));
console.log(`Title changes recorded: ${solid.length}\n`);
for (const c of solid) {
  console.log('  ' + c.from.replace(/,\s*\d+:\d+:\d+\s*(am|pm)?/i, '').padEnd(22) + '#' + String(c.replyNo).padStart(4) + '  ' + c.subject);
}
