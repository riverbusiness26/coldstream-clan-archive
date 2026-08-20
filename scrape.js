// Scrapes an SMF forum topic into raw HTML pages on disk.
// Polite by design: one request at a time, delay between them, cached so a
// re-run costs the server nothing.
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOPIC = 443;
const PER_PAGE = 15;
const BASE = 'https://www.fsegames.eu/forum/index.php';
const RAW = 'data/raw';
const DELAY_MS = 1500;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(offset, attempt = 1) {
  const url = `${BASE}?topic=${TOPIC}.${offset}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('id="forumposts"')) throw new Error('no forumposts block');
    return html;
  } catch (err) {
    if (attempt >= 4) throw err;
    const backoff = DELAY_MS * 2 ** attempt;
    console.log(`  retry ${attempt} for offset ${offset} (${err.message}), waiting ${backoff}ms`);
    await sleep(backoff);
    return fetchPage(offset, attempt + 1);
  }
}

// Discover how many pages the topic actually has, rather than assuming.
async function discoverLastOffset() {
  const html = await fetchPage(0);
  const offsets = [...html.matchAll(new RegExp(`topic=${TOPIC}\.(\d+)`, 'g'))].map((m) => +m[1]);
  const expand = html.match(/expandPages\(this,[^)]*?,\s*\d+,\s*(\d+),\s*(\d+)\)/);
  const fromExpand = expand ? +expand[1] : 0;
  return { html, last: Math.max(fromExpand, ...offsets) };
}

mkdirSync(RAW, { recursive: true });

const { html: first, last } = await discoverLastOffset();
const offsets = [];
for (let o = 0; o <= last; o += PER_PAGE) offsets.push(o);
console.log(`Topic ${TOPIC}: ${offsets.length} pages (offsets 0..${last})`);

writeFileSync(join(RAW, 'page_0000.html'), first);

let fetched = 1;
let cached = 0;
for (const offset of offsets.slice(1)) {
  const file = join(RAW, `page_${String(offset).padStart(4, '0')}.html`);
  if (existsSync(file) && readFileSync(file, 'utf8').includes('id="forumposts"')) {
    cached++;
    continue;
  }
  await sleep(DELAY_MS);
  const html = await fetchPage(offset);
  writeFileSync(file, html);
  fetched++;
  if (fetched % 10 === 0) console.log(`  ${fetched} fetched (offset ${offset})`);
}

console.log(`Done. ${fetched} fetched, ${cached} already cached, ${offsets.length} total.`);
