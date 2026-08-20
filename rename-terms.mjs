// One-off: rename the project's vocabulary from "club" to "gaming community",
// rename the files that carried the old word, and correct the era count from
// seven to eight now that RoaR Gaming is included.
//
// Safe to delete once run; kept in the first commit as a record of the change.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';

const FILE_RENAMES = [
  ['build-club.js', 'build-community.js'],
  ['build-club-page.js', 'build-community-page.js'],
  ['data/club.json', 'data/community.json'],
  ['coldstream-club.html', 'coldstream-community.html'],
];

// Order matters: longer, more specific phrases first.
const TEXT = [
  // era count corrections
  ['One club,<br />seven names', 'Eight eras,<br />one community'],
  ['The seven eras', 'The eight eras'],
  ['Seven Steam groups, in the order they were founded', 'Eight Steam groups, in the order they were founded'],
  ['Seven Steam groups (membership', 'Eight Steam groups (membership'],
  ['seven eras with group', 'eight eras with group'],
  ['the "One club, seven names" page', 'the "One community, eight names" page'],
  ['| **The main page.** Seven eras,', '| **The main page.** Eight eras,'],
  ['Club history · 2011 – 2020', 'Community history · 2011 – 2020'],
  ['Club history · 2011 to now', 'Community history · 2011 to now'],

  // paths and identifiers
  ["data/club.json", 'data/community.json'],
  ['build-club-page.js', 'build-community-page.js'],
  ['build-club.js', 'build-community.js'],
  ['coldstream-club.html', 'coldstream-community.html'],

  // prose
  ['club yearbook', 'community record'],
  ["the club's real membership", "the community's real membership"],
  ["the club's voice", "the community's voice"],
  ['the club ever made', 'the community ever made'],
  ['The club making a film', 'The community making a film'],
  ['what the club was actually for', 'what the community was actually for'],
  ['the club called people in', 'the community called people in'],
  ['the club had', 'the community had'],
  ['club history dataset', 'community history dataset'],
  ['club history project', 'gaming community archive'],
  ['club history', 'community history'],
  ['This is the club', 'This is the community'],
  ['the club.', 'the community.'],
  ['the club,', 'the community,'],
  ['the club ', 'the community '],
  ['a club', 'a community'],
  ['Club ', 'Community '],
  ['club.json', 'community.json'],
  ['const club =', 'const community ='],
  ['club.totals', 'community.totals'],
  ['(club.', '(community.'],
  [' club)', ' community)'],
];

const TARGETS = [
  'build-full-page.js',
  'build-community.js',
  'build-community-page.js',
  'build-dossier.js',
  'fetch-images.js',
  'HANDOFF.md',
  'README.md',
];

// 1. rename files
for (const [from, to] of FILE_RENAMES) {
  if (existsSync(from)) {
    renameSync(from, to);
    console.log(`renamed  ${from} -> ${to}`);
  }
}

// 2. rewrite text
let totalEdits = 0;
for (const file of TARGETS) {
  if (!existsSync(file)) continue;
  let src = readFileSync(file, 'utf8');
  const before = src;
  let edits = 0;
  for (const [from, to] of TEXT) {
    if (src.includes(from)) {
      const count = src.split(from).length - 1;
      src = src.split(from).join(to);
      edits += count;
    }
  }
  if (src !== before) {
    writeFileSync(file, src);
    console.log(`edited   ${file.padEnd(28)} ${edits} replacements`);
    totalEdits += edits;
  }
}

console.log(`\ntotal replacements: ${totalEdits}`);
