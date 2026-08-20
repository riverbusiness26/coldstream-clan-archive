// Tracks rank+name pairings over time so the command structure can be dated
// rather than reported as a single undated snapshot.
import { readFileSync, writeFileSync } from 'node:fs';
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));

const RANKS = [
  'Lieutenant Colonel', 'Regimental Serjeant-Major', 'Regimental Sergeant-Major',
  'Colonel', 'Major', 'Captain', 'Lieutenant', 'Ensign',
  'Serjeant-Major', 'Sergeant Major', 'Sergeant', 'Serjeant', 'Corporal',
  'Private', 'Recruit', 'Cadet', 'Reserve',
];

// Built with String.raw so the backslashes survive intact.
const RANK_RE = new RegExp(
  String.raw`\b(` + RANKS.join('|') + String.raw`)\s+([A-Z][A-Za-z0-9_.-]{1,20})`,
  'g',
);

const STOPWORDS = /^(The|And|We|Our|Of|In|A|I|If|It|You|He|She|They|To|For|At|On|My|His|Her|Is|Was|Be|All|So|But|As|That|This|Not|No|Yes|Are|Have|Has|Will|Would|Can|Could|Just|Also|Now|Then|When|Then|There|Here|What|Who|Why|How)$/i;

const parseDate = (s) => new Date(s.replace(/(\d+:\d+:\d+)\s*(am|pm)/i, '$1 $2'));
const people = new Map();

for (const p of posts) {
  for (const m of p.text.matchAll(RANK_RE)) {
    const [, rank, name] = m;
    if (STOPWORDS.test(name)) continue;
    const when = parseDate(p.date);
    const key = name.toLowerCase();
    if (!people.has(key)) people.set(key, { name, ranks: new Map() });
    const ranks = people.get(key).ranks;
    if (!ranks.has(rank) || when < ranks.get(rank).when) {
      ranks.set(rank, { rank, when, date: p.date, replyNo: p.replyNo });
    }
  }
}

const out = [...people.values()]
  .map((p) => ({
    name: p.name,
    mentions: p.ranks.size,
    ranks: [...p.ranks.values()].sort((a, b) => a.when - b.when)
      .map((s) => ({ rank: s.rank, firstSeen: s.date, replyNo: s.replyNo })),
  }))
  .sort((a, b) => b.ranks.length - a.ranks.length || a.name.localeCompare(b.name));

writeFileSync('data/command.json', JSON.stringify(out, null, 2));
console.log(`People seen with a rank: ${out.length}\n`);
console.log('PROMOTION TRAILS (more than one rank recorded):');
for (const p of out.filter((x) => x.ranks.length > 1).slice(0, 20)) {
  console.log('  ' + p.name.padEnd(16), p.ranks.map((r) => `${r.rank} (${r.firstSeen.replace(/,\s*\d+:.*/, '')})`).join('  ->  '));
}
