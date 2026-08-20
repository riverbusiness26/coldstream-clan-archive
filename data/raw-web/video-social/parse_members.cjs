const fs = require('fs');
const file = process.argv[2];
const h = fs.readFileSync(file, 'utf8');
const blocks = h.split(/<div class="member_block /).slice(1);
blocks.forEach(b => {
  const rank = (b.match(/rank_icon" title="([^"]+)"/) || [])[1] || '';
  const url = (b.match(/href="(https:\/\/steamcommunity\.com\/(?:id|profiles)\/[^"]+)"/) || [])[1] || '';
  const name = (b.match(/class="linkFriend"[^>]*>([^<]*)</) || [])[1] || '';
  const status = (b.match(/friendSmallText">([^<]*)</) || [])[1] || '';
  console.log([name, rank, url.replace('https://steamcommunity.com/',''), status.trim()].join(' | '));
});
