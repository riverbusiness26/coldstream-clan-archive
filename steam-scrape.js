// Scrapes the Steam groups behind each era of the community: metadata, full
// member roster (with persona names), announcements and events.
//
// Everything is cached under data/steam/ so re-runs cost Steam nothing.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GROUPS = [
  '2ndColdstreamOfficial',
  'coldstreamgaming',
  'MidnightMercss',
  'Midnightmercs',
  'NoxViator',
  '21stPApubliclinebattlegroup',
  '2ndColdstream',
  'GoRoaRgg',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const CACHE = 'data/steam';
const DELAY = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(CACHE, { recursive: true });

async function get(url, cacheKey) {
  const file = join(CACHE, cacheKey);
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
      if (attempt >= 3) {
        console.log('    failed: ' + url + ' (' + err.message + ')');
        return '';
      }
      await sleep(DELAY * 2 * attempt);
    }
  }
}

// --- tiny tag readers (no regex escapes; the shell mangles backslashes) ----
function tag(xml, name) {
  const open = '<' + name + '>';
  const close = '</' + name + '>';
  const i = xml.indexOf(open);
  if (i === -1) return '';
  const j = xml.indexOf(close, i);
  if (j === -1) return '';
  return xml.slice(i + open.length, j).replace('<![CDATA[', '').replace(']]>', '').trim();
}

function allTags(xml, name) {
  const open = '<' + name + '>';
  const close = '</' + name + '>';
  const out = [];
  let i = 0;
  for (;;) {
    const a = xml.indexOf(open, i);
    if (a === -1) break;
    const b = xml.indexOf(close, a);
    if (b === -1) break;
    out.push(xml.slice(a + open.length, b).replace('<![CDATA[', '').replace(']]>', '').trim());
    i = b + close.length;
  }
  return out;
}

const stripTags = (s) =>
  s
    .split('<')
    .map((chunk, i) => (i === 0 ? chunk : chunk.slice(chunk.indexOf('>') + 1)))
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Member persona names live in the HTML member pages, 50 per page — far
// cheaper than one profile request per member.
function membersFromHtml(html) {
  const out = [];
  const marker = 'class="linkFriend"';
  let i = 0;
  for (;;) {
    const a = html.indexOf(marker, i);
    if (a === -1) break;
    const close = html.indexOf('</a>', a);
    const gt = html.indexOf('>', a);
    if (close === -1 || gt === -1) break;
    const name = stripTags(html.slice(gt + 1, close));
    // the href sits just before the class attribute
    const hrefStart = html.lastIndexOf('href="', a);
    const hrefEnd = html.indexOf('"', hrefStart + 6);
    const href = hrefStart === -1 ? '' : html.slice(hrefStart + 6, hrefEnd);
    if (name) out.push({ name, profile: href });
    i = close;
  }
  return out;
}

function foundedFrom(html) {
  // Group overview carries a "Founded" line in the stats block.
  const i = html.indexOf('Founded');
  if (i === -1) return '';
  return stripTags(html.slice(i, i + 120)).replace('Founded', '').trim().split('  ')[0];
}

const results = [];

for (const slug of GROUPS) {
  console.log('\n== ' + slug + ' ==');

  const xml = await get(
    'https://steamcommunity.com/groups/' + slug + '/memberslistxml/?xml=1',
    slug + '.members.xml',
  );
  if (!xml) continue;

  const details = xml.slice(xml.indexOf('<groupDetails>'), xml.indexOf('</groupDetails>'));
  const meta = {
    slug,
    groupID64: tag(xml, 'groupID64'),
    name: tag(details, 'groupName'),
    headline: tag(details, 'headline'),
    summary: stripTags(tag(details, 'summary')),
    memberCount: Number(tag(details, 'memberCount') || 0),
    membersInGame: Number(tag(details, 'membersInGame') || 0),
    membersOnline: Number(tag(details, 'membersOnline') || 0),
    totalPages: Number(tag(xml, 'totalPages') || 1),
  };

  const ids = allTags(xml, 'steamID64');
  for (let p = 2; p <= meta.totalPages; p++) {
    const more = await get(
      'https://steamcommunity.com/groups/' + slug + '/memberslistxml/?xml=1&p=' + p,
      slug + '.members.' + p + '.xml',
    );
    ids.push(...allTags(more, 'steamID64'));
  }

  // Persona names via the paginated HTML member list.
  const roster = [];
  const pages = Math.max(1, Math.ceil(meta.memberCount / 50));
  for (let p = 1; p <= pages; p++) {
    const html = await get(
      'https://steamcommunity.com/groups/' + slug + '/members?p=' + p,
      slug + '.members.p' + p + '.html',
    );
    if (!html) break;
    if (p === 1) meta.founded = foundedFrom(html);
    const batch = membersFromHtml(html);
    roster.push(...batch);
    if (batch.length === 0) break;
  }

  // De-duplicate while keeping order.
  const seen = new Set();
  const members = roster.filter((m) => {
    const k = m.profile || m.name;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  meta.steamIds = ids.length;
  meta.namedMembers = members.length;
  results.push({ ...meta, members });

  console.log('  name        :', meta.name);
  console.log('  members     :', meta.memberCount, '| ids fetched:', ids.length, '| names:', members.length);
  console.log('  founded     :', meta.founded || '(not on page)');
  console.log('  headline    :', meta.headline.slice(0, 90));
  console.log('  summary     :', meta.summary.slice(0, 150));
}

writeFileSync('data/steam-groups.json', JSON.stringify(results, null, 2));
console.log('\nWrote data/steam-groups.json for ' + results.length + ' groups');
