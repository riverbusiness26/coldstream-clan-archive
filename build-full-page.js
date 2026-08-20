// The full record: every era, roster, event count and the films that document
// them. Renders from data/community.json + data/youtube.json.
import { readFileSync, writeFileSync } from 'node:fs';

const c = JSON.parse(readFileSync('data/community.json', 'utf8'));
const anns = JSON.parse(readFileSync('data/steam-announcements.json', 'utf8'));
const IMG = JSON.parse(readFileSync('data/images.json', 'utf8'));

// Images are embedded as data URIs: Photobucket and imgur have already lost
// ten of these, and the artifact viewer refuses remote images anyway.
const forumImg = (needle) => {
  const hit = Object.entries(IMG.forum).find(([url]) => url.includes(needle));
  return hit ? hit[1].uri : null;
};
const steamImg = (slug) => IMG.steam[slug]?.uri ?? null;
const thumbImg = (videoId) => IMG.youtube[videoId]?.uri ?? null;

// The regiment's own rank ladder, seniority first, matched to its insignia art.
const RANK_LADDER = [
  ['LtColLieutenantColonel', 'Lieutenant Colonel', 'officers'],
  ['CptCaptain', 'Captain', 'officers'],
  ['LtLieutenant', 'Lieutenant', 'officers'],
  ['EnsEnsign', 'Ensign', 'officers'],
  ['RsmRegimentalSerjeantMajor', 'Regimental Serjeant-Major', 'ncos'],
  ['CsgtColourSerjeant', 'Colour Serjeant', 'ncos'],
  ['SjtSerjeant', 'Serjeant', 'ncos'],
  ['CplCorporal', 'Corporal', 'ncos'],
  ['ChmChosenMan', 'Chosen Man', 'enlisted'],
  ['RglRegular', 'Regular', 'enlisted'],
  ['PtePrivate', 'Private', 'enlisted'],
  ['RctRecruit', 'Recruit', 'enlisted'],
];

// Screenshots that carry their own date in the filename, with what the written
// record says was happening that day.
const SHOTS = [
  ['2012-11-17_00004', '17 Nov 2012', 'Two days before the first fourteen recruits were welcomed.'],
  ['2012-11-18_00001', '18 Nov 2012', 'Sunday training — "Try to make Sundays training."'],
  ['2012-11-18_00002', '18 Nov 2012', 'The same session, second angle.'],
  ['2012-11-30_00003', '30 Nov 2012', 'The day after a linebattle; another was called for Friday.'],
  ['2012-11-30_00004', '30 Nov 2012', 'Line drill in the same week.'],
  ['2012-12-01_00001-1', '1 Dec 2012', '"Great event, we’ve got a linebattle tomorrow @ 4PM Central."'],
  ['2012-12-01_00002', '1 Dec 2012', 'The night before the 19th IJA match.'],
  ['2012-12-04_00005', '4 Dec 2012', 'Formation training — "we’ll be going over quite a few formations."'],
  ['2013-01-11_00002', '11 Jan 2013', 'Into the new year, the regiment still drilling weekly.'],
];

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const shortDate = (s) => String(s ?? '').replace(/,\s*\d+:\d+:\d+.*/, '');
const findVideo = (needle) => c.videos.find((v) => v.title.includes(needle));

const FAMILY = {
  '21stPApubliclinebattlegroup': { key: 'union', label: '21st Pennsylvania' },
  Midnightmercs: { key: 'midnight', label: 'Midnight Mercs' },
  MidnightMercss: { key: 'midnight', label: 'Midnight Mercs' },
  '2ndColdstream': { key: 'scarlet', label: 'Coldstream' },
  '2ndColdstreamOfficial': { key: 'scarlet', label: 'Coldstream' },
  coldstreamgaming: { key: 'scarlet', label: 'Coldstream' },
  NoxViator: { key: 'nox', label: 'Nox Viator' },
  GoRoaRgg: { key: 'roar', label: 'RoaR Gaming' },
};

// ---------------------------------------------------------------- featured film
// Each pick is tied to something the records actually show.
const FEATURED = [
  {
    match: '21st Regiment of Pennsylvania Tribute',
    era: '2011 · 21st Pennsylvania',
    heading: 'The oldest thing that survives',
    body:
      'The Official21stPA channel opened on 3 April 2011 — two days before the 21stPA Public Linebattle Group was founded on Steam. Nothing older exists in the archive — this is the earliest surviving trace of the community, and the first of its eight eras.',
  },
  {
    match: 'Last MM LB event',
    era: '2012 · the migration',
    heading: 'The last Mount & Musket linebattle',
    body:
      'Filmed as the unit left Mount & Musket for Napoleonic Wars. Mount & Musket is still named in 15 announcements during 2012 and 6 more in 2013, so the old mod did not die overnight — but this is the farewell to it, and the point the Coldstream name takes over.',
  },
  {
    match: 'To be a 2nd Coldstream Footguard',
    era: '2012 · identity',
    heading: 'The recruitment film',
    body:
      'The regiment selling itself. This is the era when the FSE forum thread was titled “Recruiting NA Players” and the first fourteen recruits were welcomed in a single post on 19 November 2012.',
  },
  {
    match: 'RWL Week 1',
    era: '2012 · competitive',
    heading: 'League debut — 2ndCS vs 3eVolt',
    body:
      'Week one of a Regimental Warfare League season. Beyond the public linebattles, the regiment fielded a competitive side against other named units — the closest thing the community had to a fixture list.',
  },
  {
    match: 'vs. 8th Regiment of Foot',
    era: '2012 · head to head',
    heading: 'Against the 8th Regiment of Foot, 20 October 2012',
    body:
      'One of the few videos carrying its own date. It sits three weeks before the FSE recruitment thread opened on 12 November 2012 — proof the regiment was already running events well before it advertised on the forum.',
  },
  {
    match: 'Tuesday Siege Event 5-22',
    era: '2012 · siege night',
    heading: 'Tuesday siege night, 22 May 2012',
    body:
      'Part of a recurring siege series. The Steam announcements from that same week are pure artillery: “Artillery Training at 8 Est. TONIGHT DON’T FORGET!”, then “ARTY TRAINING NOW FALL INTO SERVER!”, and best of all — “Want to get shot at by a cannon? Get on teamspeak, We need you!”',
  },
  {
    match: 'Friday LB Highlights',
    era: '2012 · peak',
    heading: 'The most-watched thing the community ever made',
    body:
      'At 1.1K views this is the high-water mark of the channel — more than double any other upload. It comes from the busiest stretch in the community’s history: 324 event calls went out in 2012 alone.',
  },
  {
    match: 'December 6th/7th Linebattles',
    era: '2012 · cross-referenced',
    heading: 'The December linebattles, filmed and announced',
    body:
      'This one can be matched to the paperwork. On 7 December 2012 the forum thread carried “Linebattle tomorrow @ 7PM Central / 8PM Eastern”, while the Steam group was calling members in with “Fall into teamspeak lads, training before the linebattle starting soon!”',
  },
  {
    match: 'Player Spotlight',
    era: '2012 · the people',
    heading: 'Player spotlight — Gooner',
    body:
      'The community making a film about one of its own members rather than about a battle. At 645 views it outperformed nearly every linebattle recording, which says something about what the community was actually for.',
  },
  {
    match: 'Public Linebattle 7/16/20',
    era: '2020 · the revival',
    heading: 'Back again, eight years later',
    body:
      'The 2020 revival under the 2nd Coldstream Guard group, which ran 18 events between April and July. The language had changed with the platform: “fall into teamspeak” became “We’re starting boys, hop into discord!”',
  },
];

const featuredCards = FEATURED.map((f, i) => {
  const v = findVideo(f.match);
  if (!v) return '';
  const thumb = thumbImg(v.videoId);
  return `<article class="film">
    <div class="film-media">
      <div class="ytbox" data-video="${esc(v.videoId)}">
        ${thumb ? `<img class="ythumb" src="${thumb}" alt="" loading="lazy" />` : ''}
        <button class="ytplay" type="button" aria-label="Play ${esc(v.title)}">
          <span class="tri" aria-hidden="true"></span>
        </button>
      </div>
    </div>
    <div class="film-text">
      <p class="film-era mono">${esc(f.era)}</p>
      <h3>${esc(f.heading)}</h3>
      <p class="film-title mono">${esc(v.title)} · ${esc(v.views ?? '')}</p>
      <p>${f.body}</p>
      <p class="film-link"><a href="https://www.youtube.com/watch?v=${esc(v.videoId)}" target="_blank" rel="noopener noreferrer">Watch on YouTube →</a></p>
    </div>
  </article>`;
}).join('');

// ---------------------------------------------------------------- eras
const eraCards = c.eras
  .map((e) => {
    const fam = FAMILY[e.slug] ?? { key: 'scarlet', label: '' };
    const span = e.first ? `${e.first} → ${e.last}` : 'no announcements logged';
    return `<article class="era era-${fam.key}">
      <div class="era-rail" aria-hidden="true"></div>
      <div class="era-main">
        ${steamImg(e.slug) ? `<img class="era-badge" src="${steamImg(e.slug)}" alt="${esc(e.name)} group badge" loading="lazy" />` : ''}
        <p class="era-founded mono">${esc(e.founded)}</p>
        <h3 class="era-name">${esc(e.name)}</h3>
        <p class="era-family mono">${esc(fam.label)}</p>
        <p class="era-note">${esc(e.note)}</p>
        <dl class="era-stats">
          <div><dt>Members</dt><dd>${e.members}</dd></div>
          <div><dt>Events</dt><dd>${e.events}</dd></div>
          <div><dt>Announcements</dt><dd>${e.announcements}</dd></div>
        </dl>
        <p class="era-span mono">${esc(span)}</p>
        <details>
          <summary>Roster — ${e.roster.length} named</summary>
          <ul class="names">${e.roster.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </details>
      </div>
    </article>`;
  })
  .join('');

// ---------------------------------------------------------------- lifers
const tiers = [...new Set(c.lifers.map((p) => p.eras.length))].sort((a, b) => b - a);
const liferBlocks = tiers
  .map((n) => {
    const group = c.lifers.filter((p) => p.eras.length === n);
    return `<div class="tier">
      <h3 class="tier-head"><span class="tier-n mono">${n}</span> eras <span class="tier-count mono">${group.length}</span></h3>
      <ul class="names wide">${group.map((p) => `<li title="${esc(p.eras.join(' · '))}">${esc(p.name)}</li>`).join('')}</ul>
    </div>`;
  })
  .join('');

// ---------------------------------------------------------------- intakes
const intakeBlocks = c.intakeYears
  .map(
    (y) => `<div class="intake">
      <h3 class="intake-head"><span class="year">${esc(y.year)}</span><span class="count mono">${y.members.length} joined</span></h3>
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

// ---------------------------------------------------------------- games played
const GAMES = [
  ['Napoleonic Wars / Warband', /napoleonic|warband/i],
  ['Mount & Musket', /mount ?& ?musket/i],
  ['North & South', /north ?& ?south/i],
  ['ArmA', /\barma\b/i],
  ['CS:GO', /cs:?go|counter.?strike/i],
  ['Planetside 2', /planetside/i],
  ['Minecraft', /minecraft/i],
  ['Rust', /\brust\b/i],
];
const GAME_YEARS = ['2011', '2012', '2013', '2014', '2015', '2016'];
const yearOfAnn = (a) => (a.when.match(/(20\d\d)/) || [])[1];
const gameRows = GAMES.map(([label, re]) => {
  const cells = GAME_YEARS.map((y) => {
    const n = anns.filter((a) => yearOfAnn(a) === y && re.test(a.title + ' ' + a.body)).length;
    return `<td class="mono num${n ? '' : ' zero'}">${n || '·'}</td>`;
  }).join('');
  return `<tr><td>${esc(label)}</td>${cells}</tr>`;
}).join('');

// ---------------------------------------------------------------- events chart
function eventsChart() {
  const years = ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020'];
  const vals = years.map((y) => c.eventsByYear[y] ?? 0);
  const peak = Math.max(...vals);
  const W = 900, H = 210, padL = 20, padR = 10, padT = 22, padB = 38;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = plotW / years.length;
  const base = padT + plotH;

  const bars = years
    .map((y, i) => {
      const v = vals[i];
      const h = v === 0 ? 0 : Math.max(3, (v / peak) * plotH);
      const x = padL + i * bw + bw * 0.22;
      const yy = base - h;
      return `<g>
        <rect class="ebar${v === 0 ? ' ebar-zero' : ''}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw * 0.56).toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${y}: ${v} events</title></rect>
        ${v > 0 ? `<text class="ebar-val mono" x="${(x + bw * 0.28).toFixed(1)}" y="${(yy - 6).toFixed(1)}" text-anchor="middle">${v}</text>` : ''}
        <text class="tick mono" x="${(x + bw * 0.28).toFixed(1)}" y="${base + 20}" text-anchor="middle">${y}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Event calls per year, peaking at ${peak} in 2012">
    <line class="axis" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}" />${bars}
  </svg>`;
}

// ---------------------------------------------------------------- forum ledger
function forumChart() {
  const t = c.forum.timeline;
  const counts = new Map(t.map((x) => [x.month, x.count]));
  const [sy, sm] = t[0].month.split('-').map(Number);
  const [ey, em] = t[t.length - 1].month.split('-').map(Number);
  const series = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    series.push({ y, m, key, count: counts.get(key) ?? 0 });
  }
  const peak = Math.max(...series.map((s) => s.count));
  const W = 900, H = 180, padL = 34, padR = 8, padT = 12, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = plotW / series.length;
  const base = padT + plotH;

  const bars = series
    .map((s, i) => {
      const h = s.count === 0 ? 0 : Math.max(2, (s.count / peak) * plotH);
      const x = padL + i * bw + bw * 0.16;
      return `<rect class="fbar${s.count === 0 ? ' fbar-zero' : ''}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${h.toFixed(1)}"><title>${s.key}: ${s.count} posts</title></rect>`;
    })
    .join('');
  const ticks = series
    .map((s, i) =>
      s.m === 1 || i === 0
        ? `<text class="tick mono" x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${base + 18}" text-anchor="middle">${s.y}</text>`
        : '',
    )
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Forum posts per month, peaking at ${peak}">
    <line class="axis" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}" />${bars}${ticks}
  </svg>`;
}

const commandRows = c.forum.command
  .map(([rank, name]) => `<tr><td class="mono">${esc(rank)}</td><td><strong>${esc(name)}</strong></td></tr>`)
  .join('');

const RULES = [
  'Never teamkill; if it was an accident, apologise at once.',
  'When permission to speak is in effect, ask before speaking.',
  'Never type while in line, at training, or in a linebattle — it slows everyone down.',
  'Try your best and follow orders. Running from battle or a command is punished.',
  'Always work as a team. If you decide you do not need teamwork, leave the regiment.',
  'Do not retaliate against teamkillers; report them to an admin.',
];

const archiveRows = c.videos
  .map(
    (v) => `<tr>
      <td><a href="https://www.youtube.com/watch?v=${esc(v.videoId)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a></td>
      <td class="mono nowrap">${esc(v.views ?? '—')}</td>
      <td class="mono nowrap">${esc(v.channel)}</td>
    </tr>`,
  )
  .join('');

// ---------------------------------------------------------------- rank ladder
const GROUP_LABEL = { officers: 'Officers', ncos: 'Non-commissioned officers', enlisted: 'Enlisted' };
const ladderBlocks = ['officers', 'ncos', 'enlisted']
  .map((tier) => {
    const rows = RANK_LADDER.filter(([, , t]) => t === tier)
      .map(([file, label]) => {
        const uri = forumImg(file);
        return `<li>
          ${uri ? `<img src="${uri}" alt="${esc(label)} insignia" loading="lazy" />` : '<span class="noimg"></span>'}
          <span class="rank-label">${esc(label)}</span>
        </li>`;
      })
      .join('');
    return `<div class="ladder-tier">
      <h3>${esc(GROUP_LABEL[tier])}</h3>
      <ul class="ladder">${rows}</ul>
    </div>`;
  })
  .join('');

// ---------------------------------------------------------------- screenshots
const shotCards = SHOTS.map(([file, when, caption]) => {
  const uri = forumImg(file);
  if (!uri) return '';
  return `<figure class="shot">
    <img src="${uri}" alt="In-game screenshot, ${esc(when)}" loading="lazy" />
    <figcaption><span class="mono">${esc(when)}</span> ${esc(caption)}</figcaption>
  </figure>`;
}).join('');

const bannerUri = forumImg('Y9nRAW7');

const statStrip = [
  ['Eras', c.totals.eras],
  ['People', c.totals.distinctPeople],
  ['Stayed through a rebrand', c.totals.lifers],
  ['Events called', c.totals.events],
  ['Announcements', c.totals.announcements.toLocaleString()],
  ['Forum posts', c.totals.forumPosts],
  ['Films', c.totals.videos],
  ['Since', 'June 2011'],
]
  .map(([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
  .join('');

// ---------------------------------------------------------------- document
const html = `<title>The Coldstream Lineage</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" />
<style>
  :root {
    --ground: #eef0f3; --raised: #f8f9fb; --sunk: #e4e7ec;
    --ink: #14181e; --ink-soft: #3d4854; --muted: #6b7683;
    --rule: #d2d8e0; --rule-soft: #e2e6ec;
    --scarlet: #b00f28; --union: #35547e; --midnight: #2f3568; --nox: #5a4788; --roar: #9a6a12;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0f1318; --raised: #161b22; --sunk: #1b212a;
      --ink: #e8ecf1; --ink-soft: #b2bcc8; --muted: #7b8694;
      --rule: #262e39; --rule-soft: #1d242c;
      --scarlet: #e5384f; --union: #7ba3d8; --midnight: #8a92e0; --nox: #a48ce0; --roar: #d9a441;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0f1318; --raised: #161b22; --sunk: #1b212a;
    --ink: #e8ecf1; --ink-soft: #b2bcc8; --muted: #7b8694;
    --rule: #262e39; --rule-soft: #1d242c;
    --scarlet: #e5384f; --union: #7ba3d8; --midnight: #8a92e0; --nox: #a48ce0; --roar: #d9a441;
  }

  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink); font-family: Newsreader, Georgia, serif; font-size: 17.5px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  .num { text-align: right; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px 100px; }
  .col { max-width: 66ch; }

  header.top { padding: 60px 0 26px; border-bottom: 2px solid var(--ink); }
  .kicker { font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--scarlet); margin: 0 0 16px; }
  h1 { font-family: "Saira Condensed", "Arial Narrow", sans-serif; font-weight: 700; font-size: clamp(42px, 8vw, 82px); line-height: .94; margin: 0 0 14px; letter-spacing: -.015em; text-wrap: balance; }
  .standfirst { font-size: clamp(18px, 2.3vw, 21px); color: var(--ink-soft); margin: 0; max-width: 62ch; }
  .standfirst strong { color: var(--ink); font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); margin: 34px 0 0; }
  .stat { background: var(--raised); padding: 13px 15px; }
  .stat dt { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; }
  .stat dd { margin: 0; font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 25px; line-height: 1.1; font-variant-numeric: tabular-nums; }

  section { margin: 76px 0 0; }
  h2 { font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: clamp(28px, 4vw, 40px); line-height: 1.02; margin: 0 0 8px; text-wrap: balance; }
  h3 { font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 20px; margin: 0 0 8px; }
  .lede { color: var(--ink-soft); margin: 0 0 28px; max-width: 66ch; }
  p { margin: 0 0 15px; }
  a { color: var(--scarlet); }
  a:focus-visible, summary:focus-visible, .ytplay:focus-visible { outline: 2px solid var(--scarlet); outline-offset: 3px; }

  /* ---- film ---- */
  .films { display: flex; flex-direction: column; gap: 34px; }
  .film { display: grid; grid-template-columns: minmax(280px, 460px) 1fr; gap: 26px; align-items: start; }
  .film-media { border: 1px solid var(--rule); background: var(--sunk); }
  .ytbox { position: relative; aspect-ratio: 16 / 9; width: 100%; display: grid; place-items: center; background:
     radial-gradient(circle at 50% 45%, rgba(255,255,255,.06), transparent 60%), var(--sunk); }
  .ytbox iframe { width: 100%; height: 100%; border: 0; display: block; }
  .ytplay { appearance: none; border: 1px solid var(--rule); background: var(--raised); width: 66px; height: 46px; border-radius: 8px; cursor: pointer; display: grid; place-items: center; }
  .ytplay:hover { border-color: var(--scarlet); }
  .tri { width: 0; height: 0; border-left: 16px solid var(--scarlet); border-top: 10px solid transparent; border-bottom: 10px solid transparent; margin-left: 3px; }
  .film-era { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--scarlet); margin: 0 0 6px; }
  .film-title { font-size: 12.5px; color: var(--muted); margin: 0 0 10px; }
  .film-link { margin: 10px 0 0; font-size: 15px; }

  .banner { display: block; width: 100%; max-width: 760px; height: auto; margin: 0 0 26px; border: 1px solid var(--rule); background: var(--sunk); }
  .ythumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ytbox .ytplay { position: relative; z-index: 1; box-shadow: 0 2px 10px rgba(0,0,0,.35); }

  /* ---- rank ladder ---- */
  .ladders { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 26px; margin-top: 14px; }
  .ladder-tier h3 { border-bottom: 1px solid var(--rule); padding-bottom: 6px; margin-bottom: 12px; }
  ul.ladder { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  ul.ladder li { display: flex; align-items: center; gap: 12px; }
  ul.ladder img { width: 74px; height: auto; background: var(--sunk); border: 1px solid var(--rule-soft); padding: 3px; }
  .noimg { width: 74px; height: 30px; background: var(--sunk); border: 1px solid var(--rule-soft); }
  .rank-label { font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 16px; }

  /* ---- screenshots ---- */
  .shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  figure.shot { margin: 0; border: 1px solid var(--rule); background: var(--raised); }
  figure.shot img { display: block; width: 100%; height: auto; }
  figure.shot figcaption { padding: 10px 13px; font-size: 14px; color: var(--ink-soft); border-top: 1px solid var(--rule-soft); }
  figure.shot figcaption .mono { color: var(--scarlet); font-size: 12px; margin-right: 6px; }

  .era-badge { float: right; width: 62px; height: 62px; margin: 0 0 10px 14px; border: 1px solid var(--rule); background: var(--sunk); }

  /* ---- eras ---- */
  .eras { display: flex; flex-direction: column; gap: 18px; }
  .era { display: grid; grid-template-columns: 6px 1fr; background: var(--raised); border: 1px solid var(--rule); }
  .era-rail { background: var(--accent, var(--scarlet)); }
  .era-scarlet { --accent: var(--scarlet); } .era-union { --accent: var(--union); }
  .era-midnight { --accent: var(--midnight); } .era-nox { --accent: var(--nox); } .era-roar { --accent: var(--roar); }
  .era-main { padding: 20px 24px 18px; }
  .era-founded { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--accent, var(--scarlet)); margin: 0 0 4px; font-weight: 500; }
  .era-name { font-size: clamp(22px, 3vw, 30px); margin: 0 0 2px; }
  .era-family { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
  .era-note { color: var(--ink-soft); margin: 0 0 10px; max-width: 62ch; }
  .era-stats { display: flex; flex-wrap: wrap; gap: 26px; margin: 14px 0 12px; padding: 12px 0; border-top: 1px solid var(--rule-soft); border-bottom: 1px solid var(--rule-soft); }
  .era-stats dt { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0 0 2px; }
  .era-stats dd { margin: 0; font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 27px; line-height: 1; font-variant-numeric: tabular-nums; }
  .era-span { font-size: 12.5px; color: var(--muted); margin: 0 0 6px; }

  details { border-top: 1px solid var(--rule-soft); padding-top: 10px; }
  summary { cursor: pointer; font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 16px; color: var(--ink-soft); }
  details[open] summary { margin-bottom: 10px; }
  ul.names { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 1px 14px; font-size: 14.5px; }
  ul.names li { padding: 2px 0; border-bottom: 1px solid var(--rule-soft); }
  ul.names.wide { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }

  .tier { margin: 0 0 26px; }
  .tier-head { display: flex; align-items: baseline; gap: 10px; border-bottom: 1px solid var(--rule); padding-bottom: 6px; margin-bottom: 10px; }
  .tier-n { color: var(--scarlet); font-size: 20px; font-weight: 500; }
  .tier-count { margin-left: auto; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

  .intake { margin: 0 0 24px; }
  .intake-head { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid var(--rule); padding-bottom: 6px; margin-bottom: 10px; }
  .intake-head .year { font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 26px; }
  .intake-head .count { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-left: auto; }
  ul.muster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2px 20px; }
  ul.muster li { display: flex; align-items: baseline; gap: 10px; padding: 3px 0; border-bottom: 1px solid var(--rule-soft); }
  .rank { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); min-width: 66px; }
  .who { font-weight: 600; }
  .when { margin-left: auto; font-size: 11.5px; color: var(--muted); }

  .chartbox { border: 1px solid var(--rule); background: var(--raised); padding: 18px 14px 6px; }
  .chartbox svg { width: 100%; display: block; }
  .ebar { fill: var(--scarlet); } .ebar-zero { fill: var(--rule); }
  .fbar { fill: var(--ink-soft); } .fbar-zero { fill: var(--rule); }
  .ebar-val { fill: var(--ink-soft); font-size: 11px; }
  .axis { stroke: var(--rule); stroke-width: 1; }
  .tick { fill: var(--muted); font-size: 11px; }
  .caption { font-size: 13px; color: var(--muted); margin: 10px 0 0; }

  .scroll { overflow-x: auto; border: 1px solid var(--rule); background: var(--raised); }
  table { border-collapse: collapse; width: 100%; font-size: 15px; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  th { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--rule); }
  tbody tr:last-child td { border-bottom: none; }
  td .sub { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }
  td.zero { color: var(--muted); }
  .seq { color: var(--scarlet); font-size: 12px; }

  ol.rules { margin: 0; padding-left: 22px; }
  ol.rules li { margin: 0 0 9px; padding-left: 6px; }
  ol.rules li::marker { font-family: "IBM Plex Mono", monospace; font-size: 13px; color: var(--scarlet); }

  blockquote.call { margin: 0 0 12px; padding: 10px 16px; background: var(--raised); border-left: 3px solid var(--scarlet); font-style: italic; color: var(--ink-soft); }
  .note { border-left: 3px solid var(--scarlet); padding: 4px 0 4px 16px; color: var(--ink-soft); }
  footer { margin-top: 80px; padding-top: 22px; border-top: 2px solid var(--ink); font-size: 13.5px; color: var(--muted); }

  @media (max-width: 780px) { .film { grid-template-columns: 1fr; gap: 16px; } }
  @media (max-width: 620px) { .era-main { padding: 16px; } body { font-size: 16.5px; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header class="top">
    ${bannerUri ? `<img class="banner" src="${bannerUri}" alt="2nd Coldstream Regiment of Foot Guards banner" />` : ''}
    <p class="kicker">Community history · 2011 – 2020</p>
    <h1>Eight eras,<br />one community</h1>
    <p class="standfirst">
      From a public linebattle group in April 2011 to Coldstream Gaming today — eight eras, one community, the same people throughout.
      <strong>${c.totals.distinctPeople} people</strong> passed through; <strong>${c.totals.lifers}</strong> followed the
      community through at least one rebrand; <strong>${c.totals.events} events</strong> were called.
    </p>
    <dl class="stats">${statStrip}</dl>
  </header>

  <section id="origin">
    <h2>Where it starts</h2>
    <div class="col">
      <p>The oldest surviving thing in the lineage is the <strong>Official21stPA</strong> YouTube channel, opened <strong>3 April 2011</strong> — two days before the 21stPA Public Linebattle Group appeared on Steam. It is the earliest surviving trace of the community, and the opening of the first era.</p>
      <p>The <strong>est. 2011</strong> on the badge holds up. Midnight Mercenarys was founded <strong>28 June 2011</strong>, and the Nox Viator group still describes the community in its own words as <em>“a PC Gaming Community founded June 28, 2011.”</em> Three separate records, one year.</p>
      <p>The community has not always told the same story about the month, though. RoaR Gaming's description claims <em>“a PC Gaming Community founded December, 2011”</em> — six months later than Nox Viator says. The Steam group founding dates favour the earlier claim: the 21stPA group existed in April 2011 and Midnight Mercenarys in June.</p>
    </div>
  </section>

  <section id="film">
    <h2>The films, and what they were</h2>
    <p class="lede">Ten recordings that document a specific moment, with what the written records say was happening around them. Press play to load the video.</p>
    <div class="films">${featuredCards}</div>
  </section>

  <section id="eras">
    <h2>The eight eras</h2>
    <p class="lede">Every Steam group in the order it was founded. Colour marks the brand family — Coldstream in scarlet, Midnight Mercs in indigo, Nox Viator in violet, the 21st in Union blue.</p>
    <div class="eras">${eraCards}</div>
  </section>

  <section id="core">
    <h2>The ones who stayed</h2>
    <p class="lede">${c.totals.lifers} people appear in more than one era's group — the people who carried the community from one era into the next. Hover a name to see which eras.</p>
    ${liferBlocks}
  </section>

  <section id="intakes">
    <h2>Intakes by year</h2>
    <p class="lede">Dated joins from the regiment's own welcome posts. These are the only records naming a member <em>and</em> the day they were sworn in.</p>
    ${intakeBlocks}
    <p class="note">Intakes are recorded where the regiment posted a formal welcome. 2012, 2013 and 2015 each have one; other years the community grew through Steam and voice chat, which leave no dated roll.</p>
  </section>

  <section id="played">
    <h2>What we played</h2>
    <p class="lede">Games named in the Steam announcements. The community was never single-game — Minecraft shows up in 2011, alongside the muskets.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Game</th>${GAME_YEARS.map((y) => `<th class="num">${y}</th>`).join('')}</tr></thead>
        <tbody>${gameRows}</tbody>
      </table>
    </div>
    <p class="caption">Announcements mentioning each title. A dot means no mention that year.</p>
  </section>

  <section id="callin">
    <h2>“Fall into teamspeak”</h2>
    <p class="lede">How the community called people in — and how that changed. TeamSpeak appears in 567 announcements between 2011 and 2016; Discord takes over from 2016.</p>
    <blockquote class="call">“Everyone fall into teamspeak, regimental training starting!” <span class="mono">— 30 Dec 2012</span></blockquote>
    <blockquote class="call">“Want to get shot at by a cannon? Get on teamspeak, We need you!” <span class="mono">— 28 May 2012</span></blockquote>
    <blockquote class="call">“Forget it, I'm beyond pissed. We'll talk about this attendance.” <span class="mono">— 27 May 2012</span></blockquote>
    <blockquote class="call">“We're starting boys, hop into discord!” <span class="mono">— 28 Jun 2020</span></blockquote>
    <p class="col">The phrase <em>“fall in”</em> was used 203 times. It is the closest thing the community has to a catchphrase, and it disappears exactly when TeamSpeak does.</p>
  </section>

  <section id="events">
    <h2>Events called</h2>
    <p class="lede">${c.totals.events} event calls across ${c.totals.announcements.toLocaleString()} announcements — linebattles, sieges, tournaments, practices and game nights.</p>
    <div class="chartbox">${eventsChart()}</div>
    <p class="caption">2014 and 2017–2019 are blank in this data, not necessarily in life — see sources.</p>
    <div class="scroll" style="margin-top:26px">
      <table>
        <thead><tr><th>Era</th><th class="num">Events</th><th class="num">Announcements</th><th>Active span</th></tr></thead>
        <tbody>${c.eras
          .map(
            (e) => `<tr><td><strong>${esc(e.name)}</strong></td><td class="mono num">${e.events}</td><td class="mono num">${e.announcements}</td><td class="mono nowrap">${e.first ? esc(e.first + ' → ' + e.last) : '—'}</td></tr>`,
          )
          .join('')}</tbody>
      </table>
    </div>
    <p class="caption">The Napoleonic Wars regiment ran 529 of the ${c.totals.events} — more than every other era combined.</p>
  </section>

  <section id="regiment">
    <h2>The Napoleonic regiment, in detail</h2>
    <p class="lede">The 2012–2016 era left the deepest paper trail: 885 posts over 59 pages of the FSE forum.</p>
    <div class="chartbox">${forumChart()}</div>
    <p class="caption">Forum posts per month, Nov 2012 – Mar 2016. Pale marks are silent months.</p>

    <h3 style="margin-top:34px">Command, December 2012</h3>
    <div class="scroll">
      <table><thead><tr><th>Rank</th><th>Name</th></tr></thead><tbody>${commandRows}</tbody></table>
    </div>

    <h3 style="margin-top:34px">Standing orders</h3>
    <ol class="rules">${RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>

    <h3 style="margin-top:34px">The rank ladder</h3>
    <p class="col">The regiment drew its own insignia — twelve ranks from Recruit to Lieutenant Colonel. These images were hosted on Photobucket and have survived thirteen years; they are embedded here so they cannot be lost again.</p>
    <div class="ladders">${ladderBlocks}</div>

    <h3 style="margin-top:38px">The one fully documented match</h3>
    <div class="scroll">
      <table><tbody>
        <tr><td class="mono">Opponent</td><td><strong>19th Imperial Japanese Army (19thIJA)</strong></td></tr>
        <tr><td class="mono">Date</td><td>Sunday, 2 December 2012, 6PM Central / 7PM Eastern</td></tr>
        <tr><td class="mono">Server</td><td class="mono">2ndColdstream_Public</td></tr>
        <tr><td class="mono">Strength</td><td>15 v 15</td></tr>
      </tbody></table>
    </div>
  </section>

  <section id="shots">
    <h2>Nights that got photographed</h2>
    <p class="lede">Screenshots posted to the thread, each dated in its own filename — so they can be matched to what was being organised that week.</p>
    <div class="shots">${shotCards}</div>
  </section>

  <section id="archive">
    <h2>Full film archive</h2>
    <p class="lede">All ${c.totals.videos} surviving videos across both channels.</p>
    <div class="scroll">
      <table><thead><tr><th>Video</th><th class="num">Views</th><th>Channel</th></tr></thead><tbody>${archiveRows}</tbody></table>
    </div>
  </section>

  <section id="sources">
    <h2>Sources, and what is missing</h2>
    <div class="col">
      <p>Eight Steam groups (membership, founding dates and all ${c.totals.announcements.toLocaleString()} announcements), the FSE forum thread (${c.totals.forumPosts} posts over 59 pages), and two YouTube channels. Everything fetched once, cached, analysed offline.</p>
      <p><strong>Known gaps.</strong> Steam does not publish when a member joined a group, so era rosters show who is in the group now, not who was there then — the dated intakes are the only true point-in-time roster. Private profiles do not appear at all, which is why named rosters run short of member counts. RoaR Gaming (from October 2017) is unscraped. The TaleWorlds thread sits behind a bot challenge and was left alone.</p>
      <p><strong>Event counts</strong> are announcements calling an event, not attendance records. They measure how busy an era was, not how many turned up.</p>
    </div>
  </section>

  <footer>
    <p>Compiled 19 August 2026 from public Steam, FSE forum and YouTube records. Built for River.</p>
  </footer>
</div>

<script>
  // Load YouTube only when asked, so the page stays light and nothing is
  // requested until a reader chooses to watch.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.ytplay');
    if (!btn) return;
    var box = btn.closest('.ytbox');
    var id = box && box.getAttribute('data-video');
    if (!id) return;
    var frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    frame.title = 'YouTube video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    box.innerHTML = '';
    box.appendChild(frame);
  });
</script>
`;

writeFileSync('coldstream-full.html', html);
console.log(`Wrote coldstream-full.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  featured films: ${FEATURED.filter((f) => findVideo(f.match)).length}/${FEATURED.length}`);
console.log(`  eras ${c.eras.length}, lifers ${c.lifers.length}, intakes ${c.intakeYears.length}, archive ${c.videos.length}`);
