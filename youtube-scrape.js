// Pulls the video list off each YouTube channel by reading the ytInitialData
// blob the page ships with. No API key needed.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHANNELS = ['Official21stPA', '2ndColdstreamGuards',
  // member channels confirmed 2026-08-20 (see data/member-channels.json).
  // Note: @Zelkova1224 has 725 videos; the /videos page only surfaces recent
  // uploads, so its 2014-2015 community series needs an in-channel search
  // (/@Zelkova1224/search?query=coldstream) to enumerate fully.
  'Zelkova1224', 'cosmic_bean', 'williambinette', 'dewad'];
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const CACHE = 'data/youtube';
mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, key) {
  const file = join(CACHE, key);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  await sleep(1500);
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' } });
  const body = await res.text();
  writeFileSync(file, body);
  return body;
}

// Extract the ytInitialData JSON object by brace matching from its start.
function initialData(html) {
  const marker = 'ytInitialData = ';
  let i = html.indexOf(marker);
  if (i === -1) {
    const alt = 'ytInitialData"] = ';
    i = html.indexOf(alt);
    if (i === -1) return null;
    i += alt.length;
  } else {
    i += marker.length;
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Walk the tree collecting video entries. YouTube serves two shapes: the older
// videoRenderer (videoId + title.runs) and the current lockupViewModel
// (contentId + lockupMetadataViewModel). Handle both, iteratively — the tree is
// deep enough that recursion overflows the stack.
function collectVideos(root) {
  const out = [];
  const seen = new Set();
  const stack = [root];

  while (stack.length) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') continue;

    if (Array.isArray(node)) {
      for (const n of node) stack.push(n);
      continue;
    }

    // Current layout
    const lockup = node.lockupViewModel;
    if (lockup && typeof lockup.contentId === 'string' && !seen.has(lockup.contentId)) {
      const meta = lockup.metadata?.lockupMetadataViewModel;
      const title = meta?.title?.content ?? null;
      const parts = [];
      for (const row of meta?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
        for (const part of row.metadataParts ?? []) {
          if (part.text?.content) parts.push(part.text.content);
        }
      }
      if (title) {
        seen.add(lockup.contentId);
        out.push({
          videoId: lockup.contentId,
          title,
          views: parts.find((p) => /view/i.test(p)) ?? null,
          published: parts.find((p) => /ago|20\d\d/i.test(p)) ?? null,
          length: null,
        });
      }
    }

    // Legacy layout
    const id = node.videoId;
    if (typeof id === 'string' && !seen.has(id)) {
      const title = node.title?.runs?.[0]?.text ?? node.title?.simpleText ?? null;
      if (title) {
        seen.add(id);
        out.push({
          videoId: id,
          title,
          published: node.publishedTimeText?.simpleText ?? null,
          views: node.viewCountText?.simpleText ?? node.shortViewCountText?.simpleText ?? null,
          length: node.lengthText?.simpleText ?? null,
        });
      }
    }

    for (const key of Object.keys(node)) stack.push(node[key]);
  }
  return out;
}

function findText(node, key) {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findText(n, key);
      if (hit) return hit;
    }
    return null;
  }
  if (node[key]) {
    const v = node[key];
    if (typeof v === 'string') return v;
    if (v.simpleText) return v.simpleText;
    if (v.runs?.[0]?.text) return v.runs[0].text;
    if (v.content) return v.content;
  }
  for (const k of Object.keys(node)) {
    const hit = findText(node[k], key);
    if (hit) return hit;
  }
  return null;
}

const results = [];
for (const handle of CHANNELS) {
  const html = await get('https://www.youtube.com/@' + handle + '/videos', handle + '.videos.html');
  const about = await get('https://www.youtube.com/@' + handle + '/about', handle + '.about.html');

  const data = initialData(html);
  const videos = data ? collectVideos(data) : [];
  const aboutData = initialData(about);

  const channel = {
    handle,
    url: 'https://www.youtube.com/@' + handle,
    subscribers: findText(data, 'subscriberCountText'),
    description: (findText(aboutData, 'description') || '').slice(0, 600),
    joined: findText(aboutData, 'joinedDateText'),
    totalViews: findText(aboutData, 'viewCountText'),
    videoCount: videos.length,
    videos,
  };
  results.push(channel);

  console.log('\n== @' + handle + ' ==');
  console.log('  subscribers :', channel.subscribers || '(hidden)');
  console.log('  joined      :', channel.joined || '(not shown)');
  console.log('  total views :', channel.totalViews || '(not shown)');
  console.log('  videos found:', videos.length);
  for (const v of videos.slice(0, 12)) {
    console.log(
      '    ' + (v.published || '?').padEnd(18),
      (v.views || '?').padEnd(14),
      v.title.slice(0, 72),
    );
  }
}

writeFileSync('data/youtube.json', JSON.stringify(results, null, 2));
console.log('\nWrote data/youtube.json');
