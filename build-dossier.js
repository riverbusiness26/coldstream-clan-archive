// Assembles every extracted slice into one dossier the HTML page renders from.
import { readFileSync, writeFileSync } from 'node:fs';

const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));
const roster = JSON.parse(readFileSync('data/roster-announced.json', 'utf8'));
const command = JSON.parse(readFileSync('data/command.json', 'utf8'));
const events = JSON.parse(readFileSync('data/events.json', 'utf8'));

const parseDate = (s) => new Date(s.replace(/(\d+:\d+:\d+)\s*(am|pm)/i, '$1 $2'));
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const clean = (t) => t.replace(/\[img:[^\]]*\]/g, '').replace(/\[video:[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

// --- posters -------------------------------------------------------------
const byAuthor = new Map();
for (const p of posts) {
  const when = parseDate(p.date);
  if (!byAuthor.has(p.author)) {
    byAuthor.set(p.author, { name: p.author, posts: 0, first: when, last: when, blurb: '', group: '', authorId: p.authorId });
  }
  const a = byAuthor.get(p.author);
  a.posts++;
  if (when < a.first) a.first = when;
  if (when > a.last) a.last = when;
  if (p.blurb && !a.blurb) a.blurb = p.blurb;
  if (p.memberGroup && !a.group) a.group = p.memberGroup;
}
const posters = [...byAuthor.values()]
  .map((a) => ({ ...a, first: a.first.toISOString().slice(0, 10), last: a.last.toISOString().slice(0, 10) }))
  .sort((a, b) => b.posts - a.posts);

// --- activity timeline ---------------------------------------------------
const months = new Map();
for (const p of posts) {
  const k = monthKey(parseDate(p.date));
  months.set(k, (months.get(k) ?? 0) + 1);
}
const timeline = [...months.entries()].sort().map(([month, count]) => ({ month, count }));

// --- media ---------------------------------------------------------------
const videos = new Set();
for (const p of posts) {
  for (const m of p.text.matchAll(/youtube\.com\/(?:embed\/|watch\?v=)([A-Za-z0-9_-]{11})/g)) videos.add(m[1]);
  for (const m of p.text.matchAll(/youtu\.be\/([A-Za-z0-9_-]{11})/g)) videos.add(m[1]);
}

// --- events, deduped by (kind, date) -------------------------------------
const seenEv = new Set();
const eventList = [];
for (const e of events) {
  const key = e.kind + '|' + e.postedOn.slice(0, 12) + '|' + e.time;
  if (seenEv.has(key)) continue;
  seenEv.add(key);
  eventList.push(e);
}

// --- milestones ----------------------------------------------------------
const milestone = (replyNo, label) => {
  const p = posts.find((x) => x.replyNo === replyNo);
  return p && { replyNo, label, date: p.date, author: p.author, excerpt: clean(p.ownText).slice(0, 220) };
};
const milestones = [
  milestone(0, 'Recruitment thread opened on FSE'),
  milestone(72, 'First intake announced — 14 recruits'),
  milestone(78, 'Roster moved to the second post'),
  milestone(117, 'First private linebattle arranged (19th Imperial Japanese Army)'),
  milestone(170, 'Rules and command structure published'),
  milestone(434, 'Public dispute over declined private linebattles'),
  milestone(652, 'June 2015 relaunch — 8 cadets plus returning veterans'),
  milestone(872, 'Final revival bump'),
  milestone(878, 'Crawford on the regiment\u2019s come-and-go rhythm'),
].filter(Boolean);

// --- how the regiment renamed itself -------------------------------------
const titles = JSON.parse(readFileSync('data/titles.json', 'utf8'));

// --- what the regiment actually did, by year ------------------------------
const ACTIVITY = {
  Linebattle: /line ?battle/i,
  'Training / drill': /\btraining\b|\bdrill\b|melee practice/i,
  'Siege event': /siege/i,
  'Native event': /\bnative\b/i,
  'Gaming night': /gaming night/i,
  'Movie night': /movie night/i,
  'Video release': /video will be up|new video|uploaded|youtube\.com/i,
};
const YEARS = ['2012', '2013', '2014', '2015', '2016'];
const yearOf = (p) => (p.date.match(/(\d{4})/) || [])[1];
const activity = Object.entries(ACTIVITY).map(([label, re]) => ({
  label,
  counts: YEARS.map((y) => posts.filter((p) => yearOf(p) === y && re.test(p.ownText)).length),
}));

const dossier = {
  years: YEARS,
  titles,
  activity,
  source: {
    title: '2nd (Coldstream) Regiment of Foot Guards',
    url: 'https://www.fsegames.eu/forum/index.php?topic=443.0',
    forum: 'Flying Squirrel Entertainment (FSE) — Regiments board',
    game: 'Mount & Blade: Warband — Napoleonic Wars',
    pages: 59,
    scrapedPosts: posts.length,
    views: 139456,
    opened: posts[0].date,
    lastPost: posts[posts.length - 1].date,
  },
  stats: {
    posts: posts.length,
    posters: posters.length,
    announcedMembers: roster.length,
    rankedPeople: command.length,
    eventPosts: eventList.length,
    videos: videos.size,
  },
  roster,
  command,
  posters,
  timeline,
  events: eventList,
  milestones,
  videos: [...videos],
};

writeFileSync('data/dossier.json', JSON.stringify(dossier, null, 2));
console.log('Dossier written.');
console.log(JSON.stringify(dossier.stats, null, 2));
console.log('\nActivity peaks:');
timeline.filter((t) => t.count > 25).forEach((t) => console.log('  ' + t.month, String(t.count).padStart(4), '#'.repeat(Math.round(t.count / 5))));
