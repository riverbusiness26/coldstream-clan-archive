// Which other Napoleonic Wars regiments show up in this thread, and how often.
import { readFileSync, writeFileSync } from 'node:fs';
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));
const corpus = posts.map((p) => p.text).join('\n');

// Ordinal-style unit names (19th IJA, 87th, 1stKGL) and bracketed clan tags.
const PATTERNS = [
  /\b(\d{1,3}(?:st|nd|rd|th)\s?[A-Z][A-Za-z&'.\-]{1,24}(?:\s[A-Z][A-Za-z&'.\-]{1,18}){0,3})/g,
  /\[(\d{1,3}[a-zA-Z]{1,8})\]/g,
];

const counts = new Map();
for (const re of PATTERNS) {
  for (const m of corpus.matchAll(re)) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    if (/^\d+(st|nd|rd|th)$/i.test(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
}

const ranked = [...counts.entries()]
  .filter(([, c]) => c >= 2)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);

writeFileSync('data/regiments-mentioned.json', JSON.stringify(Object.fromEntries(ranked), null, 2));
console.log('OTHER UNITS MENTIONED (>=2 times):');
ranked.forEach(([n, c]) => console.log('  ' + String(c).padStart(3), n));
