// Downloads every surviving image the community made — forum banners, rank
// insignia, in-game screenshots, Steam group avatars, YouTube thumbnails —
// then resizes each to a sensible size and writes a data-URI manifest.
//
// Data URIs matter: the published page must not depend on Photobucket or
// imgur still being up in ten years, and the artifact viewer blocks remote
// images outright.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const RAW = 'data/img';
mkdirSync(RAW, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Hash the whole URL. A truncated encoding collides: every Photobucket image
// shares a 50-character prefix, so prefix-based keys map them all to one file
// and each "distinct" image comes back as whichever was fetched first.
const key = (u) => createHash('sha1').update(u).digest('hex');

async function download(url) {
  const file = join(RAW, key(url));
  if (existsSync(file)) return readFileSync(file);
  await sleep(250);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(file, buf);
    return buf;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sources
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8'));
const club = JSON.parse(readFileSync('data/club.json', 'utf8'));

const forumUrls = new Set();
for (const p of posts) {
  for (const m of p.text.matchAll(/\[img:([^\]]+)\]/g)) {
    const u = m[1].trim();
    if (/^https?:/i.test(u) && !/fsegames\.eu|Smileys|ip\.gif/i.test(u)) forumUrls.add(u);
  }
}

// Steam group avatars come out of the cached member XML.
const steamAvatars = {};
for (const f of readdirSync('data/steam').filter((x) => x.endsWith('.members.xml'))) {
  const xml = readFileSync(join('data/steam', f), 'utf8');
  const slug = f.replace('.members.xml', '');
  const a = xml.indexOf('<avatarFull>');
  if (a === -1) continue;
  const b = xml.indexOf('</avatarFull>', a);
  steamAvatars[slug] = xml.slice(a + 12, b).replace('<![CDATA[', '').replace(']]>', '').trim();
}

const ytThumbs = {};
for (const v of club.videos) ytThumbs[v.videoId] = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

// ---------------------------------------------------------------- encode
// Category drives the target width, so a rank pip is not stored at banner size.
function categorise(url) {
  if (/Flags\//i.test(url)) return { cat: 'flag', width: 44 };
  if (/TS%20Ranks|TSRecruit|TSCadet|TSPrivate|TSCaptain|TSEnsign|TSColdstream/i.test(url))
    return { cat: 'pip', width: 40 };
  if (/(LtCol|LtLieutenant|CptCaptain|EnsEnsign|Csgt|Rsm|CplCorporal|SjtSerjeant|RctRecruit|PtePrivate|ChmChosenMan|RglRegular)/i.test(url))
    return { cat: 'insignia', width: 300 };
  if (/(Ranks-|Rules-|History-|Officers|Non-Commissioned|Enlisted-|ApplyToJoin|ContactUs|2ndYoutube|Pubstomp)/i.test(url))
    return { cat: 'header', width: 620 };
  if (/\d{4}-\d{2}-\d{2}_\d+|screen\d|steamusercontent|steampowered/i.test(url))
    return { cat: 'screenshot', width: 900 };
  return { cat: 'graphic', width: 760 };
}

async function encode(buf, width, preferJpeg) {
  const img = sharp(buf, { animated: false }).rotate();
  const meta = await img.metadata();
  const target = Math.min(width, meta.width || width);
  const pipeline = img.resize({ width: target, withoutEnlargement: true });
  if (preferJpeg) {
    const out = await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return { mime: 'image/jpeg', data: out };
  }
  const out = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
  // Fall back to JPEG when PNG is heavy and there is no transparency.
  if (out.length > 90_000 && !meta.hasAlpha) {
    const jpg = await sharp(buf).resize({ width: target, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    if (jpg.length < out.length) return { mime: 'image/jpeg', data: jpg };
  }
  return { mime: 'image/png', data: out };
}

const manifest = { forum: {}, steam: {}, youtube: {}, stats: {} };
let bytes = 0;
let ok = 0;
let failed = 0;

async function add(bucket, id, url, opts) {
  const buf = await download(url);
  if (!buf) {
    failed++;
    return;
  }
  try {
    const { cat, width } = opts ?? categorise(url);
    const preferJpeg = /jpe?g/i.test(url) || cat === 'screenshot' || cat === 'thumb';
    const { mime, data } = await encode(buf, width, preferJpeg);
    manifest[bucket][id] = { uri: `data:${mime};base64,${data.toString('base64')}`, cat, bytes: data.length, src: url };
    bytes += data.length;
    ok++;
  } catch {
    failed++;
  }
}

console.log('Forum images...');
for (const u of forumUrls) await add('forum', u, u);

console.log('Steam group avatars...');
for (const [slug, u] of Object.entries(steamAvatars)) await add('steam', slug, u, { cat: 'avatar', width: 184 });

console.log('YouTube thumbnails...');
for (const [id, u] of Object.entries(ytThumbs)) await add('youtube', id, u, { cat: 'thumb', width: 480 });

manifest.stats = { ok, failed, totalBytes: bytes, totalMB: +(bytes / 1024 / 1024).toFixed(2) };
writeFileSync('data/images.json', JSON.stringify(manifest));

console.log('\nembedded:', ok, '| failed:', failed, '| total:', manifest.stats.totalMB, 'MB');
const byCat = {};
for (const bucket of ['forum', 'steam', 'youtube'])
  for (const v of Object.values(manifest[bucket])) byCat[v.cat] = (byCat[v.cat] || 0) + 1;
console.log('by category:', JSON.stringify(byCat));
