#!/bin/bash
# usage: yt_search.sh "query" slug
Q="$1"; SLUG="$2"
ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$Q")
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
  "https://www.youtube.com/results?search_query=$ENC" -o "yt-search-$SLUG.html"
node - "$SLUG" << 'JSEOF'
const fs = require('fs');
const slug = process.argv[2];
const html = fs.readFileSync(`yt-search-${slug}.html`, 'utf8');
const m = html.match(/var ytInitialData = ({.*?});<\/script>/s);
if (!m) { console.log('NO ytInitialData'); process.exit(0); }
const data = JSON.parse(m[1]);
const out = [];
function walk(o) {
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o && typeof o === 'object') {
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      const title = (v.title?.runs || []).map(r => r.text).join('');
      const ch = (v.ownerText?.runs || []).map(r => r.text).join('');
      const date = v.publishedTimeText?.simpleText || '';
      out.push(`${v.videoId} | ${title} | ${ch} | ${date}`);
    }
    if (o.channelRenderer) {
      const c = o.channelRenderer;
      out.push(`CH:${c.channelId} | ${c.title?.simpleText || ''}`);
    }
    Object.values(o).forEach(walk);
  }
}
walk(data);
out.slice(0, 30).forEach(l => console.log(l));
JSEOF
