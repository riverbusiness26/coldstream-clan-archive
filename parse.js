// Turns the cached SMF pages into structured post records.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = 'data/raw';

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°', middot: '·',
};

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Convert post HTML to readable text, keeping the structure that carries meaning:
// line breaks, list items, quote attributions, spoiler contents, links and images.
function toText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<div class="sp-head"[^>]*>[\s\S]*?<\/div>/gi, '\n[spoiler]\n')
      .replace(/<div class="sp-foot"[^>]*>[\s\S]*?<\/div>/gi, '\n[/spoiler]\n')
      .replace(/<div class="quoteheader"[\s\S]*?Quote from:\s*([^<]*)[\s\S]*?<\/div>/gi, '\n[quote: $1]\n')
      .replace(/<iframe[^>]*src="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi, ' [video:$1] ')
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, ' [img:$1] ')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) => {
        const label = text.replace(/<[^>]+>/g, '').trim();
        return label && !href.includes(label) ? `${label} <${href}>` : `<${href}>`;
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<td[^>]*>/gi, '\t')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
}

const grab = (src, re) => (src.match(re) || [])[1];

// Remove quoted material so a reply is attributed only to what its author wrote.
// Quotes nest, so peel innermost blockquotes until none are left.
function stripQuotes(html) {
  let out = html;
  const innermost = /<blockquote[^>]*>(?:(?!<blockquote)[\s\S])*?<\/blockquote>/i;
  for (let i = 0; i < 20 && innermost.test(out); i++) out = out.replace(innermost, ' ');
  return out
    .replace(/<div class="quoteheader">[\s\S]*?<\/div>\s*<\/div>/gi, ' ')
    .replace(/<div class="quotefooter">[\s\S]*?<\/div>\s*<\/div>/gi, ' ');
}

function parsePage(html, file) {
  const posts = [];
  // Each post begins at a post_wrapper; slice between them.
  const parts = html.split('<div class="post_wrapper">').slice(1);

  for (const part of parts) {
    const block = part.split('<span class="botslice">')[0];

    const msgId = grab(block, /<div class="inner" id="msg_(\d+)"/);
    if (!msgId) continue;

    const authorId = grab(block, /action=profile;u=(\d+)/);

    // Read the name from the poster column only. Guests (deleted accounts) render
    // a bare <h4>Name</h4> with no profile link, so searching the whole post block
    // would fall through and capture the subject line as the author.
    const posterBlock = block.split('<div class="postarea">')[0];
    const h4 = grab(posterBlock, /<h4>([\s\S]*?)<\/h4>/) ?? '';
    const author = decode(h4.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || 'unknown';

    const dateRaw =
      grab(block, /<strong>\s*on:\s*<\/strong>\s*([^<]+?)\s*&#187;/) ??
      grab(block, /Reply #\d+ on:\s*<\/strong>\s*([^<]+?)\s*&#187;/);

    const replyNo = grab(block, /Reply #(\d+) on:/);

    // The body is the content of the inner div, but it contains nested divs, so a
    // lazy match to the first </div> truncates it. Slice to whichever trailing
    // marker comes first instead — the footer ("Last Edit", "Logged") and the
    // poster's signature both sit outside the post proper and must not be counted.
    const open = `<div class="inner" id="msg_${msgId}">`;
    let bodyHtml = block.slice(block.indexOf(open) + open.length);
    for (const marker of [
      '<div class="moderatorbar">',
      '<div class="signature"',
      '<div class="under_message">',
      '<span class="botslice">',
    ]) {
      const cut = bodyHtml.indexOf(marker);
      if (cut !== -1) bodyHtml = bodyHtml.slice(0, cut);
    }
    bodyHtml = bodyHtml.replace(/(?:\s*<\/div>)+\s*$/, '');

    // Signatures sit outside the post body but carry rank and regiment tags,
    // which are useful evidence for reconstructing the roster.
    const sigHtml = grab(block, /<div class="signature"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>|$)/) ?? '';

    posts.push({
      msgId: +msgId,
      replyNo: replyNo ? +replyNo : 0,
      page: +(file.match(/page_(\d+)/)[1]) / 15 + 1,
      author,
      authorId: authorId ? +authorId : null,
      memberGroup: decode(grab(block, /<li class="membergroup">([^<]*)<\/li>/) ?? '').trim(),
      postCount: +(grab(block, /<li class="postcount">Posts:\s*([\d,]+)/) ?? '0').replace(/,/g, ''),
      blurb: decode(grab(block, /<li class="blurb">([^<]*)<\/li>/) ?? '').trim(),
      date: (dateRaw ? decode(dateRaw) : '').trim(),
      text: toText(bodyHtml),
      length: toText(bodyHtml).length,
      // What this author actually wrote, with quoted material removed.
      ownText: toText(stripQuotes(bodyHtml)),
      quotesOthers: /<blockquote/i.test(bodyHtml),
      signature: toText(sigHtml).slice(0, 600),
    });
  }
  return posts;
}

const files = readdirSync(RAW).filter((f) => f.endsWith('.html')).sort();
const all = [];
for (const f of files) all.push(...parsePage(readFileSync(join(RAW, f), 'utf8'), f));

all.sort((a, b) => a.replyNo - b.replyNo || a.msgId - b.msgId);
writeFileSync('data/posts.json', JSON.stringify(all, null, 2));

const authors = new Set(all.map((p) => p.author));
const undated = all.filter((p) => !p.date).length;
console.log(`Parsed ${all.length} posts from ${files.length} pages`);
console.log(`Distinct posters: ${authors.size}`);
console.log(`Posts missing a date: ${undated}`);
console.log(`Date range: ${all[0]?.date}  ->  ${all[all.length - 1]?.date}`);
console.log(`Empty bodies: ${all.filter((p) => p.length === 0).length}`);
