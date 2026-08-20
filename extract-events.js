// Pulls scheduled activity out of the thread: linebattles, trainings, and the
// regiments they were played against. Uses ownText so quoted announcements are
// not counted twice under whoever replied.
import { readFileSync, writeFileSync } from 'node:fs';

const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));
const clean = (t) =>
  t.replace(/\[img:[^\]]*\]/g, '').replace(/\[video:[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

const TIME = /\b\d{1,2}(?::\d{2})?\s*(?:PM|AM)\b[^.,\n]{0,24}/i;
const KIND = [
  [/private line ?battle/i, 'Private linebattle'],
  [/line ?battle|\bLB\b/i, 'Linebattle'],
  [/training|drill|practice/i, 'Training'],
  [/siege/i, 'Siege event'],
  [/\bevent\b/i, 'Event'],
];

const events = [];
for (const post of posts) {
  const text = clean(post.ownText);
  if (!text) continue;
  const announces = /(tonight|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}\/\d{2,4})/i.test(text);
  const timed = TIME.test(text);
  if (!announces && !timed) continue;

  const kind = KIND.find(([re]) => re.test(text));
  if (!kind) continue;

  events.push({
    replyNo: post.replyNo,
    postedOn: post.date,
    postedBy: post.author,
    kind: kind[1],
    time: (text.match(TIME) ?? [''])[0].trim(),
    when: (text.match(/\b(tonight|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i) ?? [''])[0],
    excerpt: text.slice(0, 240),
  });
}

writeFileSync('data/events.json', JSON.stringify(events, null, 2));

const byKind = {};
events.forEach((e) => (byKind[e.kind] = (byKind[e.kind] || 0) + 1));
console.log(`Event-bearing posts: ${events.length}`);
console.log('By kind:', JSON.stringify(byKind, null, 0));
console.log();

// Opponents named in private-linebattle notices
const OPP = /Regiment Name:\s*([^\n]+)/gi;
const opponents = new Set();
for (const p of posts) for (const m of p.text.matchAll(OPP)) opponents.add(clean(m[1]).slice(0, 60));
console.log('Opponents named in private LB notices:');
[...opponents].forEach((o) => console.log('  - ' + o));
