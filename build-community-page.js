// Renders the community history page from data/community.json.
import { readFileSync, writeFileSync } from 'node:fs';

const c = JSON.parse(readFileSync('data/community.json', 'utf8'));

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Each brand family gets its own accent, so colour carries identity rather
// than decoration.
const FAMILY = {
  '21stPApubliclinebattlegroup': { key: 'union', label: '21st Pennsylvania' },
  Midnightmercs: { key: 'midnight', label: 'Midnight Mercs' },
  MidnightMercss: { key: 'midnight', label: 'Midnight Mercs' },
  '2ndColdstream': { key: 'scarlet', label: 'Coldstream' },
  '2ndColdstreamOfficial': { key: 'scarlet', label: 'Coldstream' },
  coldstreamgaming: { key: 'scarlet', label: 'Coldstream' },
  NoxViator: { key: 'nox', label: 'Nox Viator' },
};

const shortDate = (s) => String(s ?? '').replace(/,\s*\d+:\d+:\d+.*/, '');

// ------------------------------------------------------------------ eras
const eraCards = c.eras
  .map((e, i) => {
    const fam = FAMILY[e.slug] ?? { key: 'scarlet', label: '' };
    const span =
      e.first && e.last
        ? `${e.first} → ${e.last}`
        : e.first
          ? `from ${e.first}`
          : 'no announcements logged';
    const authors = e.topAuthors.length
      ? e.topAuthors.map((a) => `${esc(a.name)} <span class="dim">${a.n}</span>`).join(' · ')
      : '—';

    return `<article class="era era-${fam.key}">
      <div class="era-rail" aria-hidden="true"></div>
      <div class="era-main">
        <p class="era-founded mono">${esc(e.founded)}</p>
        <h3 class="era-name">${esc(e.name)}</h3>
        <p class="era-family mono">${esc(fam.label)}</p>
        <p class="era-note">${esc(e.note)}</p>
        ${e.headline ? `<p class="era-headline">“${esc(e.headline)}”</p>` : ''}
        <dl class="era-stats">
          <div><dt>Members</dt><dd>${e.members}</dd></div>
          <div><dt>Events run</dt><dd>${e.events}</dd></div>
          <div><dt>Announcements</dt><dd>${e.announcements}</dd></div>
        </dl>
        <p class="era-span mono">${esc(span)}</p>
        <p class="era-posters"><span class="mono label">Posted by</span> ${authors}</p>
        <details>
          <summary>Roster — ${e.roster.length} named</summary>
          <ul class="names">${e.roster.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </details>
      </div>
    </article>`;
  })
  .join('');

// ------------------------------------------------------------------ lifers
const tiers = [...new Set(c.lifers.map((p) => p.eras.length))].sort((a, b) => b - a);
const liferBlocks = tiers
  .map((n) => {
    const group = c.lifers.filter((p) => p.eras.length === n);
    return `<div class="tier">
      <h3 class="tier-head"><span class="tier-n mono">${n}</span> eras <span class="tier-count mono">${group.length} ${group.length === 1 ? 'person' : 'people'}</span></h3>
      <ul class="names wide">${group
        .map(
          (p) =>
            `<li title="${esc(p.eras.join(' · '))}">${esc(p.name)}</li>`,
        )
        .join('')}</ul>
    </div>`;
  })
  .join('');

// ------------------------------------------------------------------ intakes
const intakeBlocks = c.intakeYears
  .map(
    (y) => `<div class="intake">
      <h3 class="intake-head"><span class="year mono">${esc(y.year)}</span><span class="count mono">${y.members.length} joined</span></h3>
      <ul class="muster">
        ${y.members
          .map(
            (m) => `<li>
              <span class="rank mono">${esc(m.rank)}</span>
              <span class="who">${esc(m.name)}</span>
              <span class="mono when">${esc(shortDate(m.on))}</span>
            </li>`,
          )
          .join('')}
      </ul>
    </div>`,
  )
  .join('');

// ------------------------------------------------------------------ events chart
function eventsChart() {
  const years = ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020'];
  const vals = years.map((y) => c.eventsByYear[y] ?? 0);
  const peak = Math.max(...vals);
  const W = 900, H = 220, padL = 44, padR = 10, padT = 14, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = plotW / years.length;

  const bars = years
    .map((y, i) => {
      const v = vals[i];
      const h = v === 0 ? 0 : Math.max(3, (v / peak) * plotH);
      const x = padL + i * bw + bw * 0.2;
      const yy = padT + plotH - h;
      return `<g>
        <rect class="ebar${v === 0 ? ' ebar-zero' : ''}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${y}: ${v} events</title></rect>
        ${v > 0 ? `<text class="ebar-val mono" x="${(x + bw * 0.3).toFixed(1)}" y="${(yy - 6).toFixed(1)}" text-anchor="middle">${v}</text>` : ''}
        <text class="tick mono" x="${(x + bw * 0.3).toFixed(1)}" y="${H - padB + 20}" text-anchor="middle">${y}</text>
      </g>`;
    })
    .join('');

  const base = padT + plotH;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Events per year, peaking at ${peak} in 2012">
    <line class="axis" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}" />
    ${bars}
  </svg>`;
}

const rebrandRows = c.rebrands
  .map(
    (r) => `<tr>
      <td class="mono nowrap">${esc(r.iso)}</td>
      <td><strong>${esc(r.title)}</strong><span class="sub">${esc(r.body.slice(0, 170))}</span></td>
    </tr>`,
  )
  .join('');

const videoRows = c.videos
  .map(
    (v) => `<tr>
      <td><a href="https://www.youtube.com/watch?v=${esc(v.videoId)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a></td>
      <td class="mono nowrap">${esc(v.views ?? '—')}</td>
      <td class="mono nowrap">${esc(v.channel)}</td>
    </tr>`,
  )
  .join('');

const statStrip = [
  ['Eras', c.totals.eras],
  ['Years', '2011–2020'],
  ['People', c.totals.distinctPeople],
  ['Followed a rebrand', c.totals.lifers],
  ['Events run', c.totals.events],
  ['Announcements', c.totals.announcements.toLocaleString()],
  ['Forum posts', c.totals.forumPosts],
  ['Videos', c.totals.videos],
]
  .map(([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
  .join('');

// ------------------------------------------------------------------ document
const html = `<title>The Coldstream Lineage</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" />
<style>
  :root {
    --ground: #eef0f3;
    --raised: #f8f9fb;
    --sunk: #e4e7ec;
    --ink: #14181e;
    --ink-soft: #3d4854;
    --muted: #6b7683;
    --rule: #d2d8e0;
    --rule-soft: #e2e6ec;

    --scarlet: #b00f28;
    --union: #35547e;
    --midnight: #2f3568;
    --nox: #5a4788;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0f1318;
      --raised: #161b22;
      --sunk: #1b212a;
      --ink: #e8ecf1;
      --ink-soft: #b2bcc8;
      --muted: #7b8694;
      --rule: #262e39;
      --rule-soft: #1d242c;

      --scarlet: #e5384f;
      --union: #7ba3d8;
      --midnight: #8a92e0;
      --nox: #a48ce0;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0f1318;
    --raised: #161b22;
    --sunk: #1b212a;
    --ink: #e8ecf1;
    --ink-soft: #b2bcc8;
    --muted: #7b8694;
    --rule: #262e39;
    --rule-soft: #1d242c;

    --scarlet: #e5384f;
    --union: #7ba3d8;
    --midnight: #8a92e0;
    --nox: #a48ce0;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: Newsreader, Georgia, serif;
    font-size: 17.5px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .mono { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  .dim { color: var(--muted); }

  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px 100px; }
  .col { max-width: 66ch; }

  header.top { padding: 60px 0 26px; border-bottom: 2px solid var(--ink); margin-bottom: 12px; }
  .kicker {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
    color: var(--scarlet); margin: 0 0 16px;
  }
  h1 {
    font-family: "Saira Condensed", "Arial Narrow", sans-serif;
    font-weight: 700; font-size: clamp(42px, 8vw, 82px); line-height: .94;
    margin: 0 0 14px; letter-spacing: -.015em; text-wrap: balance;
  }
  .standfirst { font-size: clamp(18px, 2.3vw, 21px); color: var(--ink-soft); margin: 0; max-width: 60ch; }
  .standfirst strong { color: var(--ink); font-weight: 600; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); margin: 34px 0 0; }
  .stat { background: var(--raised); padding: 13px 15px; }
  .stat dt { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; }
  .stat dd { margin: 0; font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 25px; line-height: 1.1; font-variant-numeric: tabular-nums; }

  section { margin: 74px 0 0; }
  h2 { font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: clamp(28px, 4vw, 40px); line-height: 1.02; margin: 0 0 8px; text-wrap: balance; }
  h3 { font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 20px; margin: 0 0 8px; }
  .lede { color: var(--ink-soft); margin: 0 0 28px; max-width: 66ch; }
  p { margin: 0 0 15px; }
  a { color: var(--scarlet); }
  a:focus-visible, summary:focus-visible { outline: 2px solid var(--scarlet); outline-offset: 3px; }

  /* ---------- era spine ---------- */
  .eras { display: flex; flex-direction: column; gap: 18px; }
  .era { display: grid; grid-template-columns: 6px 1fr; background: var(--raised); border: 1px solid var(--rule); }
  .era-rail { background: var(--accent, var(--scarlet)); }
  .era-scarlet { --accent: var(--scarlet); }
  .era-union { --accent: var(--union); }
  .era-midnight { --accent: var(--midnight); }
  .era-nox { --accent: var(--nox); }
  .era-main { padding: 20px 24px 18px; }
  .era-founded { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--accent, var(--scarlet)); margin: 0 0 4px; font-weight: 500; }
  .era-name { font-size: clamp(22px, 3vw, 30px); margin: 0 0 2px; }
  .era-family { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
  .era-note { color: var(--ink-soft); margin: 0 0 10px; max-width: 62ch; }
  .era-headline { font-style: italic; color: var(--muted); margin: 0 0 12px; font-size: 15.5px; }
  .era-stats { display: flex; flex-wrap: wrap; gap: 26px; margin: 14px 0 12px; padding: 12px 0; border-top: 1px solid var(--rule-soft); border-bottom: 1px solid var(--rule-soft); }
  .era-stats div { min-width: 90px; }
  .era-stats dt { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0 0 2px; }
  .era-stats dd { margin: 0; font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 27px; line-height: 1; font-variant-numeric: tabular-nums; }
  .era-span { font-size: 12.5px; color: var(--muted); margin: 0 0 6px; }
  .era-posters { font-size: 14px; color: var(--ink-soft); margin: 0 0 12px; }
  .label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }

  details { border-top: 1px solid var(--rule-soft); padding-top: 10px; }
  summary { cursor: pointer; font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 16px; color: var(--ink-soft); }
  details[open] summary { margin-bottom: 10px; }

  ul.names { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 1px 14px; font-size: 14.5px; }
  ul.names li { padding: 2px 0; border-bottom: 1px solid var(--rule-soft); }
  ul.names.wide { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }

  /* ---------- lifers ---------- */
  .tier { margin: 0 0 26px; }
  .tier-head { display: flex; align-items: baseline; gap: 10px; border-bottom: 1px solid var(--rule); padding-bottom: 6px; margin-bottom: 10px; }
  .tier-n { color: var(--scarlet); font-size: 20px; font-weight: 500; }
  .tier-count { margin-left: auto; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

  /* ---------- intakes ---------- */
  .intake { margin: 0 0 24px; }
  .intake-head { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid var(--rule); padding-bottom: 6px; margin-bottom: 10px; }
  .intake-head .year { font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 26px; }
  .intake-head .count { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-left: auto; }
  ul.muster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2px 20px; }
  ul.muster li { display: flex; align-items: baseline; gap: 10px; padding: 3px 0; border-bottom: 1px solid var(--rule-soft); }
  .rank { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); min-width: 66px; }
  .who { font-weight: 600; }
  .when { margin-left: auto; font-size: 11.5px; color: var(--muted); }

  /* ---------- chart ---------- */
  .chartbox { border: 1px solid var(--rule); background: var(--raised); padding: 18px 14px 6px; }
  .chartbox svg { width: 100%; height: 220px; display: block; }
  .ebar { fill: var(--scarlet); }
  .ebar-zero { fill: var(--rule); }
  .ebar-val { fill: var(--ink-soft); font-size: 11px; }
  .axis { stroke: var(--rule); stroke-width: 1; }
  .tick { fill: var(--muted); font-size: 11px; }
  .caption { font-size: 13px; color: var(--muted); margin: 10px 0 0; }

  /* ---------- tables ---------- */
  .scroll { overflow-x: auto; border: 1px solid var(--rule); background: var(--raised); }
  table { border-collapse: collapse; width: 100%; font-size: 15px; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  th { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--rule); }
  tbody tr:last-child td { border-bottom: none; }
  td .sub { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }

  .note { border-left: 3px solid var(--scarlet); padding: 4px 0 4px 16px; color: var(--ink-soft); }

  footer { margin-top: 80px; padding-top: 22px; border-top: 2px solid var(--ink); font-size: 13.5px; color: var(--muted); }

  @media (max-width: 620px) {
    .era-main { padding: 16px 16px 14px; }
    .era-stats { gap: 18px; }
    body { font-size: 16.5px; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header class="top">
    <p class="kicker">Community history · 2011 to now</p>
    <h1>Eight eras,<br />one community</h1>
    <p class="standfirst">
      From a public linebattle group in April 2011 to Coldstream Gaming today — the same people, renamed
      again and again. <strong>${c.totals.distinctPeople} people</strong> passed through;
      <strong>${c.totals.lifers}</strong> of them followed the community through at least one rebrand.
    </p>
    <dl class="stats">${statStrip}</dl>
  </header>

  <section id="origin">
    <h2>Where it starts</h2>
    <div class="col">
      <p>The oldest thing still standing is the <strong>21stPA Public Linebattle Group</strong>, founded <strong>${esc(c.eras[0].founded)}</strong> — two days after the Official21stPA YouTube channel opened on 3 April 2011. Nine weeks later it was wound up: <em>"21stPA Is now disbanded, take the tags off please, Thanks."</em></p>
      <p>The <strong>est. 2011</strong> on the badge is not a rounding. Midnight Mercenarys was founded <strong>June 28, 2011</strong>, and the Nox Viator group still describes the community in its own words as <em>"a PC Gaming Community founded June 28, 2011"</em>. Three independent records agree.</p>
    </div>
  </section>

  <section id="eras">
    <h2>The eras</h2>
    <p class="lede">Eight Steam groups, in the order they were founded. Colour marks the brand family — Coldstream in scarlet, Midnight Mercs in indigo, Nox Viator in violet, the 21st in Union blue.</p>
    <div class="eras">${eraCards}</div>
  </section>

  <section id="core">
    <h2>The ones who stayed</h2>
    <p class="lede">${c.totals.lifers} people appear in more than one era's group. This is the community's real membership — the part that survived every rename.</p>
    ${liferBlocks}
  </section>

  <section id="intakes">
    <h2>Intakes by year</h2>
    <p class="lede">Dated joins, taken from the regiment's own welcome posts on the FSE forum. These are the only records that name a member <em>and</em> the day they joined.</p>
    ${intakeBlocks}
    <p class="note" style="margin-top:20px">The 2014 gap is real: nobody was formally welcomed that year. The forum thread went quiet, and a visitor asked outright, “Is this regiment still alive?”</p>
  </section>

  <section id="events">
    <h2>Events run</h2>
    <p class="lede">${c.totals.events} event calls across ${c.totals.announcements.toLocaleString()} Steam announcements — linebattles, sieges, tournaments, game nights and practices.</p>
    <div class="chartbox">${eventsChart()}</div>
    <p class="caption">Event announcements per year. 2014 and 2017–2019 are blank in this data, not necessarily in life — see the note on sources below.</p>

    <div class="scroll" style="margin-top:26px">
      <table>
        <thead><tr><th>Era</th><th>Events</th><th>Announcements</th><th>Active span</th></tr></thead>
        <tbody>
          ${c.eras
            .map(
              (e) => `<tr>
            <td><strong>${esc(e.name)}</strong></td>
            <td class="mono">${e.events}</td>
            <td class="mono">${e.announcements}</td>
            <td class="mono nowrap">${e.first ? esc(e.first + ' → ' + e.last) : '—'}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="caption">The Napoleonic Wars regiment ran more events than every other era combined — 529 of ${c.totals.events}.</p>
  </section>

  <section id="rebrands">
    <h2>The moments it changed name</h2>
    <p class="lede">Announcements that mark the end of one era and the start of the next.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Date</th><th>Announcement</th></tr></thead>
        <tbody>${rebrandRows}</tbody>
      </table>
    </div>
    <p class="col" style="margin-top:18px">The October 2017 notice points to an era this dataset does not yet cover: <strong>RoaR Gaming</strong>. Its Steam group is a separate page that has not been scraped — the most obvious next gap to fill.</p>
  </section>

  <section id="film">
    <h2>On film</h2>
    <p class="lede">${c.totals.videos} surviving videos across two channels, including league matches and the last Mount &amp; Musket linebattle.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Video</th><th>Views</th><th>Channel</th></tr></thead>
        <tbody>${videoRows}</tbody>
      </table>
    </div>
  </section>

  <section id="sources">
    <h2>Where this comes from, and what it misses</h2>
    <div class="col">
      <p>Eight Steam groups (membership, founding dates, and every announcement across ${c.totals.announcements.toLocaleString()} posts), the FSE forum thread (${c.totals.forumPosts} posts over 59 pages), and two YouTube channels. Everything was fetched once and cached, then analysed offline.</p>
      <p><strong>Known gaps.</strong> Steam does not publish the date a member joined a group, so per-era rosters are a snapshot of who is in the group <em>today</em>, not who was there at the time. Members with private profiles do not appear at all — that is why named rosters run short of the member counts. The RoaR Gaming era (from October 2017) has not been scraped. The TaleWorlds forum thread is behind a bot challenge and was left alone.</p>
      <p><strong>Event counts</strong> are announcements that call an event, not confirmed attendance. They are a good measure of how busy an era was, not of how many people turned up.</p>
    </div>
  </section>

  <footer>
    <p>Compiled 19 August 2026 from public Steam, FSE forum and YouTube records. Built for River.</p>
  </footer>
</div>
`;

writeFileSync('coldstream-community.html', html);
console.log(`Wrote coldstream-community.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  ${c.eras.length} eras, ${c.lifers.length} lifers, ${c.intakeYears.length} intake years, ${c.videos.length} videos`);
