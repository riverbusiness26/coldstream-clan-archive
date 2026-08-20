#!/bin/bash
URL="$1"; SLUG="$2"
curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
  "$URL/videos" -o "yt-channel-$SLUG-videos.html"
node - "$SLUG" << 'JSEOF'
const fs = require('fs');
const slug = process.argv[2];
const html = fs.readFileSync(`yt-channel-${slug}-videos.html`, 'utf8');
const m = html.match(/var ytInitialData = ({.*?});<\/script>/s);
if (!m) { console.log('NO ytInitialData'); process.exit(0); }
const data = JSON.parse(m[1]);
const out = [];
function walk(o) {
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o && typeof o === 'object') {
    const v = o.richItemRenderer?.content?.videoRenderer || o.gridVideoRenderer || o.videoRenderer;
    if (v && v.videoId) {
      const title = (v.title?.runs || []).map(r => r.text).join('') || v.title?.simpleText || '';
      out.push(`${v.videoId} | ${title} | ${v.publishedTimeText?.simpleText || ''} | ${v.viewCountText?.simpleText || ''}`);
    }
    if (o.lockupViewModel) {
      const l = o.lockupViewModel;
      const title = l.metadata?.lockupMetadataViewModel?.title?.content || '';
      let meta = [];
      try {
        l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows
          .forEach(r => (r.metadataParts || []).forEach(p => { if (p.text?.content) meta.push(p.text.content) }));
      } catch (e) {}
      out.push(`${l.contentId} | ${title} | ${meta.join(' · ')}`);
    }
    Object.values(o).forEach(walk);
  }
}
walk(data);
if (!out.length) console.log('(no videos found on page)');
[...new Set(out)].slice(0, 50).forEach(l => console.log(l));
JSEOF
