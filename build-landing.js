// Builds the public landing page. Self-contained: every image is embedded as a
// data URI so the page works offline and cannot break when a host disappears.
import { readFileSync, writeFileSync } from 'node:fs';

const IMG = JSON.parse(readFileSync('data/images.json', 'utf8'));
const community = JSON.parse(readFileSync('data/community.json', 'utf8'));

const forumImg = (needle) => {
  const hit = Object.entries(IMG.forum).find(([url]) => url.includes(needle));
  return hit ? hit[1].uri : null;
};
const thumb = (id) => IMG.youtube[id]?.uri ?? null;

// Most-watched first. Their own footage is the hero.
const HERO_VIDEO = '8AU7hzl8w5M';

const FILMS = [
  ['8AU7hzl8w5M', "Friday linebattle highlights", '1.1K views'],
  ['OnesY-EczqY', 'Against the 8th Regiment of Foot', '740 views'],
  ['tfK1U75rrQQ', 'Player spotlight, Gooner', '645 views'],
  ['gS2xlbD6b4k', 'League week one vs 3eVolt', '426 views'],
];

const SHOTS = [
  ['2012-11-18_00001', 'Sunday training, November 2012'],
  ['2012-11-30_00003', 'Line drill, November 2012'],
  ['2012-12-01_00002', 'The night before the 19th IJA match'],
  ['2012-12-04_00005', 'Formation training, December 2012'],
  ['2013-01-11_00002', 'Still drilling weekly, January 2013'],
  ['2012-11-17_00004', 'Two days before the first intake'],
];

const STATS = [
  ['15', 'Years running', 'Since 2011'],
  ['627', 'Events called', 'Linebattles, sieges, game nights'],
  ['315', 'Members', 'Through the doors since day one'],
  ['32', 'Films', 'Recorded on our own servers'],
];

// Anchored on what was being played, not on what we were called.
const TIMELINE = [
  ['2011', 'Battlegrounds 2', 'A public linebattle group called [21stPA]. A server full of people lining up with muskets was the whole appeal.'],
  ['2012', 'Napoleonic Wars', 'The 2nd Coldstream Regiment of Footguards. Years of drilling lines, running events and shooting at each other in formation.'],
  ['2017', 'Counter-Strike', 'Retake and deathmatch servers that stayed full, a ten-man group, and teams in ESEA Open and Intermediate.'],
  ['Today', 'Coldstream Gaming', 'Whatever the group is on this month. The games change, the dudes mostly do not.'],
];

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const statCards = STATS.map(
  ([n, label, sub]) => `<div class="stat">
      <div class="stat-n" data-count="${n}">${esc(n)}</div>
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-sub">${esc(sub)}</div>
    </div>`,
).join('');

const timelineItems = TIMELINE.map(
  ([year, game, body]) => `<li class="beat">
      <div class="beat-year">${esc(year)}</div>
      <div class="beat-body">
        <h3>${esc(game)}</h3>
        <p>${esc(body)}</p>
      </div>
    </li>`,
).join('');

const filmCards = FILMS.map(([id, title, views]) => {
  const t = thumb(id);
  return `<a class="film" href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noopener noreferrer">
      <div class="film-media">${t ? `<img src="${t}" alt="" loading="lazy" />` : ''}<span class="play" aria-hidden="true"></span></div>
      <div class="film-meta"><span class="film-title">${esc(title)}</span><span class="film-views">${esc(views)}</span></div>
    </a>`;
}).join('');

const shotTiles = SHOTS.map(([file, caption]) => {
  const uri = forumImg(file);
  if (!uri) return '';
  return `<figure class="shot"><img src="${uri}" alt="${esc(caption)}" loading="lazy" /><figcaption>${esc(caption)}</figcaption></figure>`;
}).join('');

const heroPoster = thumb(HERO_VIDEO);
const mark = forumImg('Y9nRAW7');

const html = `<title>Coldstream Gaming</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" />
<style>
  :root {
    --ink: #0a0c0f;
    --ink-2: #12161c;
    --ink-3: #1a2029;
    --bone: #e8eaed;
    --muted: #8a94a2;
    --line: #232a34;
    --scarlet: #c8102e;
    --scarlet-hi: #e63950;
    --brass: #b08d4f;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--ink);
    color: var(--bone);
    font-family: Barlow, system-ui, sans-serif;
    font-size: 17px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  img { max-width: 100%; display: block; }
  a { color: inherit; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 28px; }

  .eyebrow {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; letter-spacing: .24em; text-transform: uppercase;
    color: var(--brass); margin: 0 0 18px;
  }

  /* ---------- hero ---------- */
  .hero { position: relative; min-height: 88vh; display: grid; align-items: center; overflow: hidden; border-bottom: 1px solid var(--line); }
  .hero-bg { position: absolute; inset: 0; z-index: 0; }
  .hero-bg img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(.35) contrast(1.05); }
  .hero-bg iframe { position: absolute; top: 50%; left: 50%; width: 100vw; height: 56.25vw; min-height: 100%; min-width: 177.77vh; transform: translate(-50%, -50%); border: 0; pointer-events: none; }
  .hero-scrim { position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(180deg, rgba(10,12,15,.72) 0%, rgba(10,12,15,.58) 45%, rgba(10,12,15,.96) 100%); }
  .hero-inner { position: relative; z-index: 2; padding: 120px 0 90px; }
  .hero-mark { width: 92px; margin-bottom: 26px; opacity: .95; }
  h1 {
    font-family: "Saira Condensed", "Arial Narrow", sans-serif;
    font-weight: 700; font-size: clamp(52px, 9vw, 116px); line-height: .9;
    letter-spacing: -.01em; margin: 0 0 20px; text-wrap: balance;
  }
  .hero-line { font-size: clamp(18px, 2.2vw, 23px); color: var(--bone); max-width: 46ch; margin: 0 0 14px; }
  .hero-sub { font-size: 16px; color: var(--muted); max-width: 52ch; margin: 0 0 34px; }
  .cta-row { display: flex; flex-wrap: wrap; gap: 14px; }
  .btn {
    display: inline-flex; align-items: center; gap: 9px;
    font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 17px;
    letter-spacing: .04em; text-transform: uppercase; text-decoration: none;
    padding: 13px 26px; border: 1px solid var(--line); color: var(--bone);
    background: rgba(18,22,28,.7); transition: border-color .18s, background .18s, transform .18s;
  }
  .btn:hover { border-color: var(--muted); transform: translateY(-1px); }
  .btn-primary { background: var(--scarlet); border-color: var(--scarlet); }
  .btn-primary:hover { background: var(--scarlet-hi); border-color: var(--scarlet-hi); }
  .btn:focus-visible { outline: 2px solid var(--scarlet-hi); outline-offset: 3px; }

  /* ---------- stats ---------- */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); border-top: 1px solid var(--line); }
  .stat { padding: 40px 28px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .stat:last-child { border-right: none; }
  .stat-n {
    font-family: "Saira Condensed", sans-serif; font-weight: 700;
    font-size: clamp(46px, 6vw, 70px); line-height: 1; color: var(--scarlet-hi);
    font-variant-numeric: tabular-nums; margin-bottom: 8px;
  }
  .stat-label { font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 19px; letter-spacing: .02em; }
  .stat-sub { font-size: 14px; color: var(--muted); margin-top: 3px; }

  section { padding: 92px 0; border-bottom: 1px solid var(--line); }
  h2 {
    font-family: "Saira Condensed", sans-serif; font-weight: 700;
    font-size: clamp(34px, 5vw, 54px); line-height: 1; margin: 0 0 16px; text-wrap: balance;
  }
  .lede { font-size: 18px; color: var(--muted); max-width: 60ch; margin: 0 0 46px; }

  /* ---------- timeline ---------- */
  ol.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
  .beat { display: grid; grid-template-columns: 150px 1fr; gap: 32px; padding: 30px 0; border-top: 1px solid var(--line); }
  .beat:last-child { border-bottom: 1px solid var(--line); }
  .beat-year {
    font-family: "Saira Condensed", sans-serif; font-weight: 700; font-size: 34px;
    color: var(--brass); line-height: 1; font-variant-numeric: tabular-nums;
  }
  .beat-body h3 { font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 26px; margin: 0 0 7px; }
  .beat-body p { margin: 0; color: var(--muted); max-width: 62ch; }

  /* ---------- films ---------- */
  .films { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
  .film { text-decoration: none; display: block; }
  .film-media { position: relative; aspect-ratio: 16/9; background: var(--ink-2); border: 1px solid var(--line); overflow: hidden; }
  .film-media img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(.3); transition: filter .22s, transform .5s; }
  .film:hover .film-media img { filter: grayscale(0); transform: scale(1.035); }
  .play { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform: translate(-40%, -50%);
    border-left: 20px solid var(--bone); border-top: 12px solid transparent; border-bottom: 12px solid transparent; }
  .film-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-top: 11px; }
  .film-title { font-family: "Saira Condensed", sans-serif; font-weight: 600; font-size: 18px; }
  .film-views { font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--muted); white-space: nowrap; }

  /* ---------- shots ---------- */
  .shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
  figure.shot { margin: 0; border: 1px solid var(--line); background: var(--ink-2); }
  figure.shot img { aspect-ratio: 16/10; object-fit: cover; width: 100%; filter: grayscale(.25); transition: filter .22s; }
  figure.shot:hover img { filter: grayscale(0); }
  figure.shot figcaption { padding: 11px 14px; font-size: 14px; color: var(--muted); border-top: 1px solid var(--line); }

  /* ---------- join ---------- */
  .join { text-align: center; padding: 110px 0; border-bottom: none; }
  .join h2 { margin-bottom: 14px; }
  .join p { color: var(--muted); max-width: 48ch; margin: 0 auto 34px; }
  .join .cta-row { justify-content: center; }

  footer { padding: 38px 0 60px; color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; }

  @media (max-width: 720px) {
    .beat { grid-template-columns: 1fr; gap: 8px; }
    .stat { border-right: none; }
    .hero-inner { padding: 90px 0 70px; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    * { transition: none !important; animation: none !important; }
  }
</style>

<header class="hero">
  <div class="hero-bg">
    ${heroPoster ? `<img src="${heroPoster}" alt="" />` : ''}
    <iframe title="Coldstream Gaming footage" src="https://www.youtube-nocookie.com/embed/${HERO_VIDEO}?autoplay=1&mute=1&loop=1&playlist=${HERO_VIDEO}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1" allow="autoplay; encrypted-media" tabindex="-1" aria-hidden="true"></iframe>
  </div>
  <div class="hero-scrim"></div>
  <div class="hero-inner wrap">
    ${mark ? `<img class="hero-mark" src="${mark}" alt="Coldstream Gaming" />` : ''}
    <p class="eyebrow">Est. 2011 · North America</p>
    <h1>Coldstream<br />Gaming</h1>
    <p class="hero-line">Fifteen years, a lot of games, and largely the same dudes.</p>
    <p class="hero-sub">We started lining up with muskets in 2011 and never really stopped. We have never cared how good you are. Get in voice, have a laugh, and you will fit in fine.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="#join">Join the community</a>
      <a class="btn" href="#history">Our history</a>
    </div>
  </div>
</header>

<div class="stats wrap" style="padding:0">${statCards}</div>

<section id="history">
  <div class="wrap">
    <p class="eyebrow">What we have played</p>
    <h2>Fifteen years of it</h2>
    <p class="lede">Every one of these is a game the community actually lived in, with servers, events and a schedule. Not a list of titles we tried once.</p>
    <ol class="timeline">${timelineItems}</ol>
  </div>
</section>

<section id="film">
  <div class="wrap">
    <p class="eyebrow">On tape</p>
    <h2>Our own footage</h2>
    <p class="lede">Recorded on our own servers, on our own nights. The oldest of these is fourteen years old and still up.</p>
    <div class="films">${filmCards}</div>
  </div>
</section>

<section id="shots">
  <div class="wrap">
    <p class="eyebrow">From the archive</p>
    <h2>Nights that got photographed</h2>
    <p class="lede">Screenshots our members posted at the time, each one dated. This is what a training night looked like in 2012.</p>
    <div class="shots">${shotTiles}</div>
  </div>
</section>

<section class="join" id="join">
  <div class="wrap">
    <p class="eyebrow">Enlist</p>
    <h2>Come and play</h2>
    <p>No tryouts, no skill checks. Hop into the Discord, get in voice, and see whether you like us.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="https://discord.gg/75sfq5VPY" target="_blank" rel="noopener noreferrer">Join our Discord</a>
      <a class="btn" href="https://steamcommunity.com/groups/coldstreamgaming" target="_blank" rel="noopener noreferrer">Steam group</a>
    </div>
  </div>
</section>

<footer class="wrap">
  <span>Coldstream Gaming · Loyalty · Leadership · Tradition</span>
  <span class="mono">Est. 2011 · North America</span>
</footer>

<script>
  (function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var nums = document.querySelectorAll('.stat-n');
    if (reduce || !('IntersectionObserver' in window)) return;

    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || seen.has(e.target)) return;
        seen.add(e.target);
        var el = e.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (isNaN(target)) return;
        var start = performance.now();
        var dur = 900;
        function tick(now) {
          var p = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });

    nums.forEach(function (n) { io.observe(n); });
  })();
</script>
`;

writeFileSync('coldstream-landing.html', html);
console.log(`Wrote coldstream-landing.html (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`  hero video : ${HERO_VIDEO} (poster ${heroPoster ? 'embedded' : 'MISSING'})`);
console.log(`  films      : ${FILMS.filter(([id]) => thumb(id)).length}/${FILMS.length} with thumbnails`);
console.log(`  screenshots: ${SHOTS.filter(([f]) => forumImg(f)).length}/${SHOTS.length} embedded`);
