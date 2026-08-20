// Scrapes every Steam group announcement: title, date, author, body.
// These are the community's own event log — linebattle calls, tournaments,
// server news and, crucially, the rebrand notices that mark each era.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GROUPS = JSON.parse(readFileSync('data/steam-groups.json', 'utf8')).map((g) => g.slug);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const CACHE = 'data/steam/ann';
const DELAY = 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(CACHE, { recursive: true });

async function get(url, key) {
  const file = join(CACHE, key);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  await sleep(DELAY);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.text();
      writeFileSync(file, body);
      return body;
    } catch (err) {
      if (attempt >= 3) return '';
      await sleep(DELAY * 2 * attempt);
    }
  }
}

const ENT = [
  ['&amp;', '&'], ['&quot;', '"'], ['&#39;', "'"], ['&lt;', '<'], ['&gt;', '>'],
  ['&nbsp;', ' '], ['&hellip;', '...'], ['&mdash;', '-'], ['&ndash;', '-'],
];
function decode(s) {
  let out = s;
  for (const [a, b] of ENT) out = out.split(a).join(b);
  return out;
}

// Strip tags without regex escapes (the shell mangles backslashes).
function text(html) {
  let out = '';
  let depth = 0;
  for (const ch of html) {
    if (ch === '<') depth++;
    else if (ch === '>') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return decode(out).split(/\s+/).join(' ').trim();
}

function between(src, start, end, from = 0) {
  const a = src.indexOf(start, from);
  if (a === -1) return null;
  const b = src.indexOf(end, a + start.length);
  if (b === -1) return null;
  return { value: src.slice(a + start.length, b), end: b };
}

function parseListing(html) {
  const out = [];
  let i = 0;
  for (;;) {
    const block = html.indexOf('<div class="announcement">', i);
    if (block === -1) break;
    const next = html.indexOf('<div class="announcement">', block + 10);
    const chunk = html.slice(block, next === -1 ? undefined : next);
    i = next === -1 ? html.length : next;

    const titleHref = between(chunk, 'class="large_title" href="', '"');
    const titleTxt = between(chunk, 'class="large_title"', '</a>');
    const byline = between(chunk, 'class="announcement_byline">', '</div>');
    const body = between(chunk, 'class="bodytext"', '</div>');

    if (!titleTxt) continue;
    const titleClean = text(titleTxt.value.slice(titleTxt.value.indexOf('>') + 1));
    const bylineRaw = byline ? text(byline.value) : '';
    // "Oct 15, 2017 @ 6:37pm - RiveR"
    const dashAt = bylineRaw.lastIndexOf(' - ');
    const when = dashAt === -1 ? bylineRaw : bylineRaw.slice(0, dashAt).trim();
    const who = dashAt === -1 ? '' : bylineRaw.slice(dashAt + 3).trim();

    out.push({
      id: (titleHref && titleHref.value.split('/').pop()) || '',
      title: titleClean,
      when,
      author: who,
      body: body ? text(body.value.slice(body.value.indexOf('>') + 1)).slice(0, 1200) : '',
    });
  }
  return out;
}

function totalPages(html) {
  let max = 1;
  let i = 0;
  for (;;) {
    const hit = between(html, 'announcements/listing?p=', '"', i);
    if (!hit) break;
    const n = Number(hit.value);
    if (Number.isFinite(n) && n > max) max = n;
    i = hit.end;
  }
  return max;
}

const all = [];
for (const slug of GROUPS) {
  const first = await get(
    'https://steamcommunity.com/groups/' + slug + '/announcements/listing',
    slug + '.p1.html',
  );
  if (!first) {
    console.log(slug.padEnd(30), 'no announcements page');
    continue;
  }
  const pages = totalPages(first);
  const items = parseListing(first);

  for (let p = 2; p <= pages; p++) {
    const html = await get(
      'https://steamcommunity.com/groups/' + slug + '/announcements/listing?p=' + p,
      slug + '.p' + p + '.html',
    );
    if (!html) break;
    items.push(...parseListing(html));
  }

  items.forEach((a) => (a.group = slug));
  all.push(...items);
  console.log(slug.padEnd(30), String(items.length).padStart(4) + ' announcements over ' + pages + ' pages');
}

writeFileSync('data/steam-announcements.json', JSON.stringify(all, null, 2));
console.log('\nTotal announcements: ' + all.length);
