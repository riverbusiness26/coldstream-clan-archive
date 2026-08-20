// Renders the dossier into a single self-contained HTML page.
// Regenerate any time the extraction changes:  node build-page.js
import { readFileSync, writeFileSync } from 'node:fs';

const d = JSON.parse(readFileSync('data/dossier.json', 'utf8'));

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const shortDate = (s) => String(s).replace(/,\s*\d+:\d+:\d+\s*(am|pm)?/i, '');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---------------------------------------------------------------- timeline
// Fill every month across the span, including the silent ones. The gaps are
// the point: this regiment's history is a series of revivals.
function fullTimeline() {
  const counts = new Map(d.timeline.map((t) => [t.month, t.count]));
  const [sy, sm] = d.timeline[0].month.split('-').map(Number);
  const [ey, em] = d.timeline[d.timeline.length - 1].month.split('-').map(Number);
  const out = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ year: y, month: m, key, count: counts.get(key) ?? 0 });
  }
  return out;
}

const series = fullTimeline();
const peak = Math.max(...series.map((s) => s.count));

// Eras derived from the activity data itself, not imposed on it.
const ERAS = [
  { from: '2012-11', to: '2013-03', label: 'Formation', note: 'Thread opens, first intake, weekly linebattles' },
  { from: '2013-04', to: '2013-12', label: 'Thinning out', note: 'Attendance falls away through the year' },
  { from: '2014-01', to: '2014-12', label: 'Dormant', note: 'Occasional bumps; “is this regiment still alive?”' },
  { from: '2015-06', to: '2015-08', label: 'Relaunch', note: 'Eight cadets sworn in, veterans return' },
  { from: '2016-03', to: '2016-03', label: 'Last bump', note: 'A final thread revival' },
];

function chart() {
  const W = 1000, H = 260, padL = 46, padR = 12, padT = 16, padB = 44;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = plotW / series.length;

  const bars = series
    .map((s, i) => {
      const h = s.count === 0 ? 0 : Math.max(2, (s.count / peak) * plotH);
      const x = padL + i * bw;
      const y = padT + plotH - h;
      const cls = s.count === 0 ? 'bar bar-zero' : 'bar';
      const title = `${MONTHS[s.month - 1]} ${s.year}: ${s.count} post${s.count === 1 ? '' : 's'}`;
      return `<rect class="${cls}" x="${(x + bw * 0.16).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${esc(title)}</title></rect>`;
    })
    .join('');

  // Year ticks at each January (plus the first month).
  const ticks = series
    .map((s, i) => {
      if (!(s.month === 1 || i === 0)) return '';
      const x = padL + i * bw + bw / 2;
      return `<text class="tick" x="${x.toFixed(1)}" y="${H - padB + 20}" text-anchor="middle">${s.year}</text>`;
    })
    .join('');

  const gridVals = [0, Math.round(peak / 2), peak];
  const grid = gridVals
    .map((v) => {
      const y = padT + plotH - (v / peak) * plotH;
      return `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" />
        <text class="tick" x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Posts per month from November 2012 to March 2016, peaking at ${peak} in December 2012" preserveAspectRatio="none">
    ${grid}${bars}${ticks}
  </svg>`;
}

// ---------------------------------------------------------------- sections
const statCards = [
  ['Posts read', d.stats.posts.toLocaleString()],
  ['Forum pages', d.source.pages],
  ['People who posted', d.stats.posters],
  ['Members announced', d.stats.announcedMembers],
  ['Thread views', d.source.views.toLocaleString()],
  ['Span', 'Nov 2012 – Mar 2016'],
]
  .map(
    ([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`,
  )
  .join('');

const eraRows = ERAS.map((e) => {
  const inEra = series.filter((s) => s.key >= e.from && s.key <= e.to);
  const total = inEra.reduce((a, b) => a + b.count, 0);
  return `<tr>
    <td class="mono nowrap">${esc(e.from)} → ${esc(e.to)}</td>
    <td><strong>${esc(e.label)}</strong><span class="sub">${esc(e.note)}</span></td>
    <td class="mono num">${total}</td>
  </tr>`;
}).join('');

// Roster grouped by the intake that announced it.
const intakes = new Map();
for (const r of d.roster) {
  const key = shortDate(r.announcedOn);
  if (!intakes.has(key)) intakes.set(key, []);
  intakes.get(key).push(r);
}
const rosterBlocks = [...intakes.entries()]
  .map(
    ([date, members]) => `<div class="intake">
      <h3 class="intake-head"><span class="mono date">${esc(date)}</span><span class="count">${members.length} named</span></h3>
      <ul class="muster">
        ${members
          .map(
            (m) => `<li>
              <span class="rank rank-${esc(m.rank.toLowerCase())}">${esc(m.rank)}</span>
              <span class="who">${esc(m.name)}</span>
              <span class="mono country">${esc(m.country || '—')}</span>
            </li>`,
          )
          .join('')}
      </ul>
    </div>`,
  )
  .join('');

// Command: verified from the regiment's own info post, not regex guesswork.
const COMMAND_DEC_2012 = [
  ['Lieutenant Colonel', 'Thomas'],
  ['Captain', 'Crawford'],
  ['Lieutenant', 'Crazy'],
  ['Regimental Serjeant-Major', 'Richardson'],
];
const commandRows = COMMAND_DEC_2012.map(
  ([rank, name]) => `<tr><td class="mono">${esc(rank)}</td><td><strong>${esc(name)}</strong></td></tr>`,
).join('');

const promotions = d.command.filter((p) => p.ranks.length > 1 && p.name !== 'George');
const promoRows = promotions
  .map(
    (p) => `<tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td class="trail">${p.ranks
        .map((r) => `<span class="step"><span class="mono">${esc(r.rank)}</span><span class="sub">${esc(shortDate(r.firstSeen))}</span></span>`)
        .join('<span class="arrow" aria-hidden="true">→</span>')}</td>
    </tr>`,
  )
  .join('');

const milestoneItems = d.milestones
  .map(
    (m) => `<li>
      <div class="ms-date mono">${esc(shortDate(m.date))}</div>
      <div class="ms-body">
        <h4>${esc(m.label)}</h4>
        <p class="quote">${esc(m.excerpt)}</p>
        <p class="attr mono">— ${esc(m.author)}, reply #${m.replyNo}</p>
      </div>
    </li>`,
  )
  .join('');

const RULES = [
  'Never teamkill; if it was an accident, apologise at once.',
  'When permission to speak is in effect, ask before speaking.',
  'Never type while in line, at training, or in a linebattle — it slows everyone down.',
  'Try your best and follow orders. Running from battle or a command is punished.',
  'Always work as a team. If you decide you do not need teamwork, leave the regiment.',
  'Do not retaliate against teamkillers; report them to an admin.',
];
const ruleItems = RULES.map((r) => `<li>${esc(r)}</li>`).join('');

const eventKinds = {};
for (const e of d.events) eventKinds[e.kind] = (eventKinds[e.kind] || 0) + 1;
const kindRows = Object.entries(eventKinds)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="mono num">${v}</td></tr>`)
  .join('');

const eventRows = d.events
  .slice(0, 40)
  .map(
    (e) => `<tr>
      <td class="mono nowrap">${esc(shortDate(e.postedOn))}</td>
      <td class="nowrap">${esc(e.kind)}</td>
      <td class="mono nowrap">${esc(e.time || e.when || '—')}</td>
      <td class="excerpt">${esc(e.excerpt.slice(0, 150))}</td>
    </tr>`,
  )
  .join('');

// The renames are a genuine sequence, so they are numbered; everything else
// on this page is dated rather than numbered.
const titleItems = d.titles
  .map(
    (t, i) => `<li>
      <span class="seq mono">${String(i + 1).padStart(2, '0')}</span>
      <span class="t-date mono">${esc(shortDate(t.from))}</span>
      <span class="t-name">${esc(t.subject)}</span>
    </li>`,
  )
  .join('');

const activityHead = d.years.map((y) => `<th class="num">${esc(y)}</th>`).join('');
const activityRows = d.activity
  .map(
    (a) => `<tr><td>${esc(a.label)}</td>${a.counts
      .map((c) => `<td class="mono num${c === 0 ? ' zero' : ''}">${c || '·'}</td>`)
      .join('')}</tr>`,
  )
  .join('');

const posterRows = d.posters
  .map(
    (p) => `<tr>
      <td><strong>${esc(p.name)}</strong>${p.group === 'Guest' ? ' <span class="tag">deleted account</span>' : ''}</td>
      <td class="mono num">${p.posts}</td>
      <td class="mono nowrap">${esc(p.first)}</td>
      <td class="mono nowrap">${esc(p.last)}</td>
      <td class="blurb">${esc(p.blurb)}</td>
    </tr>`,
  )
  .join('');

const videoItems = d.videos
  .map(
    (v) =>
      `<li><a class="mono" href="https://www.youtube.com/watch?v=${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a></li>`,
  )
  .join('');

// ---------------------------------------------------------------- document
const html = `<title>Coldstream Regimental Record</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;700&family=Spectral:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" />
<style>
  :root {
    --ground: #eceef1;
    --raised: #f6f7f9;
    --ink: #171b21;
    --ink-soft: #414b57;
    --muted: #6d7885;
    --rule: #cfd5dd;
    --rule-soft: #dfe4ea;
    --scarlet: #b00f28;
    --brass: #8a6d2f;
    --bar: #2f3944;
    --bar-zero: #c6ccd4;
    --shadow: 0 1px 2px rgba(16, 20, 25, .06);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #101419;
      --raised: #161b22;
      --ink: #e7ebf0;
      --ink-soft: #b3bdc9;
      --muted: #7d8896;
      --rule: #262e38;
      --rule-soft: #1e252d;
      --scarlet: #e2364f;
      --brass: #c2a05c;
      --bar: #93a2b3;
      --bar-zero: #232b34;
      --shadow: none;
    }
  }
  :root[data-theme="dark"] {
    --ground: #101419;
    --raised: #161b22;
    --ink: #e7ebf0;
    --ink-soft: #b3bdc9;
    --muted: #7d8896;
    --rule: #262e38;
    --rule-soft: #1e252d;
    --scarlet: #e2364f;
    --brass: #c2a05c;
    --bar: #93a2b3;
    --bar-zero: #232b34;
    --shadow: none;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: Spectral, Georgia, "Times New Roman", serif;
    font-size: 17px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }

  .mono { font-family: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums; }
  .num { text-align: right; }
  .nowrap { white-space: nowrap; }

  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px 96px; }
  .col { max-width: 68ch; }

  /* ---------- masthead ---------- */
  header.masthead {
    border-bottom: 2px solid var(--ink);
    padding: 56px 0 20px;
    margin-bottom: 40px;
  }
  .eyebrow {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--scarlet);
    margin: 0 0 14px;
  }
  h1 {
    font-family: "Saira Condensed", "Arial Narrow", sans-serif;
    font-weight: 700;
    font-size: clamp(38px, 7vw, 68px);
    line-height: .96;
    letter-spacing: -.01em;
    margin: 0 0 6px;
    text-wrap: balance;
  }
  .motto {
    font-family: Spectral, Georgia, serif;
    font-style: italic;
    font-size: clamp(17px, 2.4vw, 22px);
    color: var(--ink-soft);
    margin: 0 0 22px;
  }
  .motto b { font-style: normal; font-weight: 600; color: var(--brass); }
  .source-line { font-size: 14px; color: var(--muted); margin: 0; }
  .source-line a { color: var(--ink-soft); }

  /* ---------- stats ---------- */
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: 1px;
    background: var(--rule);
    border: 1px solid var(--rule);
    margin: 34px 0 0;
  }
  .stat { background: var(--raised); padding: 14px 16px; }
  .stat dt {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10.5px;
    letter-spacing: .13em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 4px;
  }
  .stat dd {
    margin: 0;
    font-family: "Saira Condensed", sans-serif;
    font-weight: 700;
    font-size: 26px;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  /* ---------- sections ---------- */
  section { margin: 68px 0 0; scroll-margin-top: 24px; }
  h2 {
    font-family: "Saira Condensed", sans-serif;
    font-weight: 700;
    font-size: clamp(26px, 3.6vw, 36px);
    line-height: 1.05;
    margin: 0 0 6px;
    text-wrap: balance;
  }
  .lede { color: var(--ink-soft); margin: 0 0 26px; }
  h3 {
    font-family: "Saira Condensed", sans-serif;
    font-weight: 700;
    font-size: 21px;
    margin: 34px 0 10px;
  }
  p { margin: 0 0 16px; }
  a { color: var(--scarlet); }
  a:focus-visible, summary:focus-visible { outline: 2px solid var(--scarlet); outline-offset: 3px; }

  /* ---------- chart ---------- */
  .ledger {
    border: 1px solid var(--rule);
    background: var(--raised);
    padding: 20px 16px 8px;
    margin: 0 0 20px;
  }
  .ledger svg { width: 100%; height: 260px; display: block; }
  .bar { fill: var(--bar); }
  .bar-zero { fill: var(--bar-zero); }
  .grid { stroke: var(--rule); stroke-width: 1; }
  .tick {
    fill: var(--muted);
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
  }
  .caption { font-size: 13.5px; color: var(--muted); margin: 0 0 30px; }

  /* ---------- tables ---------- */
  .scroll { overflow-x: auto; border: 1px solid var(--rule); background: var(--raised); }
  table { border-collapse: collapse; width: 100%; font-size: 15px; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  th {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10.5px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
    border-bottom: 1px solid var(--rule);
    white-space: nowrap;
  }
  tbody tr:last-child td { border-bottom: none; }
  td .sub { display: block; font-size: 13px; color: var(--muted); }
  .excerpt { color: var(--ink-soft); font-size: 14px; min-width: 260px; }
  .blurb { color: var(--muted); font-size: 13.5px; font-style: italic; }
  .tag {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--muted);
    border: 1px solid var(--rule);
    padding: 1px 5px;
    white-space: nowrap;
  }

  /* ---------- muster ---------- */
  .intake { margin: 0 0 26px; }
  .intake-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule);
  }
  .intake-head .date { font-size: 14px; font-family: "IBM Plex Mono", monospace; font-weight: 500; }
  .intake-head .count {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  ul.muster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr)); gap: 2px 18px; }
  ul.muster li { display: flex; align-items: baseline; gap: 9px; padding: 3px 0; }
  .rank {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
    border-left: 2px solid var(--rule);
    padding-left: 7px;
    min-width: 86px;
  }
  .rank-captain, .rank-lieutenant { color: var(--brass); border-left-color: var(--brass); }
  .rank-private, .rank-reserve { border-left-color: var(--muted); }
  .rank-cadet, .rank-recruit { border-left-color: var(--rule); }
  .who { font-weight: 600; }
  .country { font-size: 12px; color: var(--muted); margin-left: auto; }

  /* ---------- milestones ---------- */
  ol.milestones { list-style: none; margin: 0; padding: 0; }
  ol.milestones > li {
    display: grid;
    grid-template-columns: 168px 1fr;
    gap: 20px;
    padding: 18px 0;
    border-top: 1px solid var(--rule-soft);
  }
  ol.milestones > li:first-child { border-top: 1px solid var(--rule); }
  .ms-date { font-size: 13px; color: var(--muted); padding-top: 3px; }
  .ms-body h4 { font-family: "Saira Condensed", sans-serif; font-size: 19px; margin: 0 0 6px; font-weight: 700; }
  .quote {
    margin: 0 0 6px;
    color: var(--ink-soft);
    border-left: 2px solid var(--scarlet);
    padding-left: 12px;
    font-size: 15px;
  }
  .attr { font-size: 12px; color: var(--muted); margin: 0; }

  /* ---------- promotions ---------- */
  .trail { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .step .mono { font-size: 13px; }
  .step .sub { font-size: 12px; }
  .arrow { color: var(--muted); }

  /* ---------- rules ---------- */
  ol.titles { list-style: none; margin: 0; padding: 0; }
  ol.titles li {
    display: grid;
    grid-template-columns: 34px 150px 1fr;
    gap: 14px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px solid var(--rule-soft);
  }
  ol.titles li:last-child { border-bottom: none; }
  .seq { color: var(--scarlet); font-size: 12px; }
  .t-date { font-size: 13px; color: var(--muted); }
  .t-name { font-weight: 600; font-size: 15.5px; }
  td.zero { color: var(--muted); }

  ol.rules { margin: 0; padding-left: 22px; }
  ol.rules li { margin: 0 0 9px; padding-left: 6px; }
  ol.rules li::marker { font-family: "IBM Plex Mono", monospace; font-size: 13px; color: var(--scarlet); }

  details {
    border: 1px solid var(--rule);
    background: var(--raised);
    padding: 12px 16px;
    margin: 16px 0 0;
  }
  summary {
    cursor: pointer;
    font-family: "Saira Condensed", sans-serif;
    font-weight: 700;
    font-size: 18px;
  }
  details[open] summary { margin-bottom: 12px; }

  ul.links { list-style: none; margin: 0; padding: 0; }
  ul.links li { padding: 7px 0; border-bottom: 1px solid var(--rule-soft); }
  ul.links li:last-child { border-bottom: none; }
  ul.vids { columns: 3 120px; gap: 14px; list-style: none; margin: 0; padding: 0; font-size: 13px; }

  .note {
    border-left: 3px solid var(--brass);
    padding: 2px 0 2px 16px;
    color: var(--ink-soft);
    font-size: 15.5px;
  }

  footer {
    margin-top: 76px;
    padding-top: 22px;
    border-top: 2px solid var(--ink);
    font-size: 13.5px;
    color: var(--muted);
  }

  @media (max-width: 640px) {
    ol.milestones > li { grid-template-columns: 1fr; gap: 6px; }
    ol.titles li { grid-template-columns: 30px 1fr; row-gap: 2px; }
    ol.titles .t-name { grid-column: 1 / -1; }
    .ledger { padding: 14px 8px 4px; }
    body { font-size: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
</style>

<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">Regimental record · reconstructed from the forum archive</p>
    <h1>2nd (Coldstream)<br />Regiment of Foot Guards</h1>
    <p class="motto"><b>Nulli Secundus</b> — Second to None</p>
    <p class="source-line">
      Every figure below comes from all ${d.source.pages} pages of
      <a href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">FSE topic 443</a>,
      the regiment's recruitment thread for <em>${esc(d.source.game)}</em>,
      scraped and parsed in full on 19 August 2026.
    </p>
    <dl class="stats">${statCards}</dl>
  </header>

  <section id="rhythm">
    <h2>A regiment that came and went</h2>
    <p class="lede col">The thread ran three and a half years, but not continuously. Activity arrives in bursts separated by months of silence — and the members knew it. "Yearly revive I see," one outsider posted in 2016.</p>

    <div class="ledger">${chart()}</div>
    <p class="caption">Posts per month, November 2012 – March 2016. Pale marks are months with no posts at all. Peak: ${peak} posts in December 2012.</p>

    <div class="scroll">
      <table>
        <thead><tr><th>Period</th><th>Era</th><th class="num">Posts</th></tr></thead>
        <tbody>${eraRows}</tbody>
      </table>
    </div>

    <p class="note" style="margin-top:22px">
      Asked in 2016 why the regiment kept disappearing, its founder answered plainly:
      "We come and go as we please, you've got to be insane to actually play this game 3-4 times a week for several years."
    </p>
  </section>

  <section id="muster">
    <h2>Muster roll</h2>
    <p class="lede col">${d.stats.announcedMembers} members were formally announced in the thread, grouped here by the intake that welcomed them. Rank and nationality are taken from the announcement posts themselves.</p>
    ${rosterBlocks}
  </section>

  <section id="command">
    <h2>Command</h2>
    <p class="lede col">The regiment published its command structure on 3 December 2012, alongside its standing orders.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Rank</th><th>Name</th></tr></thead>
        <tbody>${commandRows}</tbody>
      </table>
    </div>

    <h3>Recorded promotions</h3>
    <p class="col">Only four members appear in the thread at more than one rank. Crawford — posting later as <em>Colonel River</em> — founded the regiment and stayed with it to the last post.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Member</th><th>Rank over time</th></tr></thead>
        <tbody>${promoRows}</tbody>
      </table>
    </div>
  </section>

  <section id="orders">
    <h2>Standing orders</h2>
    <p class="lede col">Six rules, posted 3 December 2012 and unchanged thereafter.</p>
    <ol class="rules">${ruleItems}</ol>
  </section>

  <section id="events">
    <h2>Events and opponents</h2>
    <p class="lede col">${d.events.length} posts announce or discuss scheduled activity. Trainings ran roughly thirty minutes before each linebattle; linebattles themselves were usually 7PM Central / 8PM Eastern.</p>

    <div class="scroll">
      <table>
        <thead><tr><th>Activity</th><th class="num">Posts</th></tr></thead>
        <tbody>${kindRows}</tbody>
      </table>
    </div>

    <h3>The one fully documented match</h3>
    <p class="col">A single private linebattle is recorded in full, in the regiment's own notice format:</p>
    <div class="scroll">
      <table>
        <tbody>
          <tr><td class="mono">Opponent</td><td><strong>19th Imperial Japanese Army (19thIJA)</strong></td></tr>
          <tr><td class="mono">Date</td><td>Sunday, 2 December 2012, 6PM Central / 7PM Eastern</td></tr>
          <tr><td class="mono">Server</td><td class="mono">2ndColdstream_Public</td></tr>
          <tr><td class="mono">Strength</td><td>15 v 15</td></tr>
        </tbody>
      </table>
    </div>

    <details>
      <summary>First 40 scheduling posts</summary>
      <div class="scroll">
        <table>
          <thead><tr><th>Posted</th><th>Kind</th><th>Time</th><th>Excerpt</th></tr></thead>
          <tbody>${eventRows}</tbody>
        </table>
      </div>
    </details>
  </section>

  <section id="names">
    <h2>Twelve names in three years</h2>
    <p class="lede col">Every reply on an SMF forum stores the thread's title as it stood at that moment, so the thread carries its own renaming history. Read in order, it is the clearest record of what the regiment was trying to be.</p>
    <ol class="titles">${titleItems}</ol>
    <p class="note" style="margin-top:24px">
      Three moves matter. <strong>September 2014</strong>: recruitment closes to <em>Invite Only</em>, days after the founder complains of "kids joining and leaving 30 minutes later".
      <strong>1 July 2015</strong>: the <em>2nd</em> is dropped, and the unit stops being a numbered regiment.
      <strong>20 March 2016</strong>: on the last active day, the thread is renamed <em>Nox Viator Gaming</em> — a general gaming brand rather than a Napoleonic regiment.
      That name appears nowhere in the posts themselves and left no trace elsewhere on the web, so it never took. The thread stands today under its original name, last edited by its founder on 10 May 2017.
    </p>
  </section>

  <section id="activity">
    <h2>What they actually did</h2>
    <p class="lede col">The regiment did not simply fade — it changed shape. In 2012 it was a drill-and-linebattle unit. By the 2015 relaunch, Native events and sieges outnumbered linebattles, and the calendar had movie nights on it.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Activity</th>${activityHead}</tr></thead>
        <tbody>${activityRows}</tbody>
      </table>
    </div>
    <p class="caption">Posts mentioning each activity, counted from author text only. A dot means no mention that year.</p>
    <p class="col">By July 2015 the schedule included melee practice, siege events, Mount &amp; Blade Native nights, gaming nights at 5PM Central, and movie nights every Monday and Tuesday. That is the shape of a general gaming community rather than a single-game regiment — the same shape Coldstream Gaming has today.</p>

    <h3>Under attack</h3>
    <p class="col">Twice in July 2015 the regiment's infrastructure was targeted. On 1 July its TeamSpeak was knocked offline mid-event; on 4 July the founder warned members about a visitor threatening to DDoS the TeamSpeak and game servers outright.</p>
  </section>

  <section id="milestones">
    <h2>Milestones</h2>
    <p class="lede col">Nine moments that shaped the thread, quoted from the posts that record them.</p>
    <ol class="milestones">${milestoneItems}</ol>
  </section>

  <section id="people">
    <h2>Everyone who posted</h2>
    <p class="lede col">${d.stats.posters} distinct accounts posted in the thread — members, applicants, allies, and rivals alike. Five are now deleted accounts, showing as guests.</p>
    <details>
      <summary>Full list, most active first</summary>
      <div class="scroll">
        <table>
          <thead><tr><th>Account</th><th class="num">Posts</th><th>First</th><th>Last</th><th>Forum blurb</th></tr></thead>
          <tbody>${posterRows}</tbody>
        </table>
      </div>
    </details>
  </section>

  <section id="footprint">
    <h2>Wider footprint</h2>
    <p class="lede col">The thread was one surface of a larger operation.</p>
    <ul class="links">
      <li><strong>Steam group</strong> — <a href="https://steamcommunity.com/groups/2ndColdstream" target="_blank" rel="noopener noreferrer">2nd Coldstream Regiment of Footguards</a>, founded <strong>19 January 2012</strong>, 90 members. It predates this thread by ten months.</li>
      <li><strong>TeamSpeak</strong> — <span class="mono">2ndcs.ts3.privateserverhost.com</span>, posted to the Steam group in September 2015.</li>
      <li><strong>YouTube</strong> — the <span class="mono">2ndColdstreamGuards</span> channel, linked from the second post as the regiment's video archive.</li>
      <li><strong>Game server</strong> — <span class="mono">2ndColdstream_Public</span>, used for private linebattles.</li>
      <li><strong>Earlier life</strong> — a 2014 visitor wrote "I remember this regiment, I was in it in MM", placing the unit in <em>Mount &amp; Musket</em> before Napoleonic Wars. That is consistent with the "est. 2011" on the modern CSG badge, which predates both the Steam group and this thread.</li>
    </ul>

    <h3>Not to be confused with</h3>
    <p class="col">"Coldstream" was a popular name in this community, and at least four other units used it. This record covers only the North American regiment at topic 443, whose Steam group is <span class="mono">2ndColdstream</span>.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Unit</th><th>Where</th><th>Distinguishing detail</th></tr></thead>
        <tbody>
          <tr><td><strong>2nd Coldstream Guards [EU]</strong></td><td class="mono">FSE topic 207</td><td>European; marked <em>Disbanded</em></td></tr>
          <tr><td><strong>2nd Coldstream Guards (Queens Royal Regiment) [EU]</strong></td><td class="mono">FSE topic 36519</td><td>Separate European unit</td></tr>
          <tr><td><strong>2nd Coldstream Regiment of Foot Guards</strong></td><td class="mono">Steam “2ndcold”</td><td>UK-based, founded 28 Apr 2012; successors “3te” and “17e”</td></tr>
          <tr><td><strong>2nd Coldstream Guards Mount and Musket</strong></td><td class="mono">Steam “2ndColdstreamMM”</td><td>German-language, founded 2 Sep 2013</td></tr>
        </tbody>
      </table>
    </div>

    <h3>Video archive</h3>
    <p class="col">${d.videos.length} distinct YouTube videos are linked or embedded across the thread.</p>
    <ul class="vids mono">${videoItems}</ul>
  </section>

  <section id="method">
    <h2>Method and limits</h2>
    <div class="col">
      <p>All ${d.source.pages} pages were fetched once, cached to disk, and parsed offline; nothing was re-requested during analysis. Quoted material is stripped before attributing text to an author, so a reply is never credited with the words it quotes.</p>
      <p><strong>What this record cannot see.</strong> The regiment kept much of its identity in images — rank charts, roster banners, signatures, and the header graphics are all hosted pictures, many on Photobucket links that no longer resolve. Names inside those images are unreadable to a text scrape. The ${d.stats.announcedMembers} members listed here are those written as text in announcement posts; the true roster was larger.</p>
      <p><strong>Where numbers come from.</strong> Post counts, dates, and accounts are exact. Event counts are keyword-derived and indicate discussion of an activity, not confirmed attendance. Rank pairings were verified against the regiment's own command post rather than accepted from pattern matching — a first pass wrongly read Colonel George Monck, from the historical section, as a serving officer.</p>
    </div>
  </section>

  <footer>
    <p>Compiled from ${d.stats.posts.toLocaleString()} forum posts spanning ${esc(shortDate(d.source.opened))} – ${esc(shortDate(d.source.lastPost))}. Source: <a href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">fsegames.eu topic 443</a>.</p>
  </footer>
</div>
`;

writeFileSync('coldstream-record.html', html);
console.log(`Wrote coldstream-record.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  ${series.length} months charted, peak ${peak}`);
console.log(`  ${d.roster.length} roster entries in ${intakes.size} intakes`);
console.log(`  ${promotions.length} promotion trails, ${d.posters.length} posters, ${d.videos.length} videos`);
