// Pulls roster entries out of the announcement posts. Each entry renders as
//   [img:.../Flags/<country>.png]  <Rank> <Name>  [img:.../TS<Rank>.png]
// Members get re-announced inside quotes, so the same name appears several
// times; we keep the earliest sighting as the join date.
import { readFileSync, writeFileSync } from 'node:fs';

const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));

// Drive off the rank word rather than the flag: at least one member was
// announced with a custom flag image, which a Flags/*.png pattern silently skips.
const RANKS =
  'Recruit|Cadet|Private|Corporal|Sergeant|Ensign|Lieutenant|Captain|Major|Colonel|Reserve|Drummer|Fifer';
const LINE = new RegExp(
  `\\[img:([^\\]]*)\\]\\s*(${RANKS})\\s+([^\\[\\n]+?)\\s*\\[img:[^\\]]*\\]`,
  'g',
);

const COUNTRY = {
  'United-States-of-America-Flag': 'United States',
  CanadianFlag: 'Canada',
  UKFlag: 'United Kingdom',
  AuFlag: 'Australia',
};

const parseDate = (s) => new Date(s.replace(/(\d+:\d+:\d+)\s*(am|pm)/i, '$1 $2'));

const found = new Map();

for (const post of posts) {
  for (const m of post.text.matchAll(LINE)) {
    const [, flagSrc, rank, rawName] = m;
    const name = rawName.trim();
    if (!name || name.length > 40) continue;

    const flagKey = (flagSrc.match(/Flags\/([A-Za-z0-9_\-]+)\.png/) ?? [])[1] ?? '';
    const iconRank = rank;
    const flag = flagKey;

    const key = name.toLowerCase();
    const record = {
      name,
      rank,
      iconRank,
      country: COUNTRY[flag] ?? flag,
      announcedOn: post.date,
      announcedBy: post.author,
      replyNo: post.replyNo,
      when: parseDate(post.date),
    };
    const prior = found.get(key);
    if (!prior || record.when < prior.when) found.set(key, record);
  }
}

const roster = [...found.values()].sort((a, b) => a.when - b.when);
roster.forEach((r) => delete r.when);
writeFileSync('data/roster-announced.json', JSON.stringify(roster, null, 2));

console.log(`Distinct members announced: ${roster.length}\n`);
for (const r of roster) {
  console.log(
    `  ${r.announcedOn.replace(/,\s*\d+:.*/, '').padEnd(20)} ${r.rank.padEnd(10)} ${r.name.padEnd(20)} ${r.country}`,
  );
}
