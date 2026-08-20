#!/bin/bash
# usage: yt_video.sh VIDEOID slug
VID="$1"; SLUG="$2"
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
  "https://www.youtube.com/watch?v=$VID" -o "yt-video-$SLUG.html"
node - "$SLUG" << 'JSEOF'
const fs = require('fs');
const slug = process.argv[2];
const html = fs.readFileSync(`yt-video-${slug}.html`, 'utf8');
let m = html.match(/var ytInitialPlayerResponse = ({.*?});(?:var |<\/script>)/s);
if (m) {
  try {
    const p = JSON.parse(m[1]);
    const d = p.videoDetails || {};
    const mf = p.microformat?.playerMicroformatRenderer || {};
    console.log('TITLE:', d.title);
    console.log('CHANNEL:', d.author, '| chId:', d.channelId);
    console.log('PUBLISHED:', mf.publishDate, '| UPLOADED:', mf.uploadDate);
    console.log('VIEWS:', d.viewCount, '| LENGTH:', d.lengthSeconds, 's');
    console.log('DESC:');
    console.log((d.shortDescription || '').slice(0, 1500));
  } catch(e) { console.log('parse error', e.message); }
} else { console.log('NO playerResponse (video may be dead)'); }
JSEOF
