// Builds coldstream-site-preview.html — a self-contained, navigable design
// preview of the future community site (Phase 2: Steam login + forum +
// shoutbox). Every view is driven by the real datasets in data/: the
// announcements become Parade Ground threads, the 885-post FSE thread becomes
// the Barracks mega-thread, dated intakes fill the Enlistment Office, and the
// films fill the Archive. Nothing here is a backend — sign-in and the shoutbox
// are working local demos, clearly labelled.
//
// Usage: node build-site-preview.mjs   ->  coldstream-site-preview.html
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const community = read('data/community.json');
const annsRaw = read('data/steam-announcements.json');
const posts = read('data/posts.json');
const intakes = read('data/roster-announced.json');
const groups = read('data/steam-groups.json');
const images = read('data/images.json');
const recovered = read('data/roster-from-images.json');
const class2011 = read('data/enjin-members.json');
const knownNames = new Set(read('data/known-names.json').map((n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '')));

const ERA_ORDER = ['21stPApubliclinebattlegroup','Midnightmercs','2ndColdstream','MidnightMercss','NoxViator','GoRoaRgg','2ndColdstreamOfficial','coldstreamgaming'];
const ERA_SHORT = {
  '21stPApubliclinebattlegroup':'21stPA', 'Midnightmercs':'Midnight Mercenarys',
  '2ndColdstream':'2nd Coldstream Footguards', 'MidnightMercss':'Midnight Mercs MGC',
  'NoxViator':'Nox Viator', 'GoRoaRgg':'RoaR', '2ndColdstreamOfficial':'2nd Coldstream Guard',
  'coldstreamgaming':'Coldstream Gaming',
};

// ---- game tagging: every announcement, server and film carries a game tag.
// First-seen years come from the archives: Minecraft/CS:S/MW2/KF/L4D2/GMod
// game nights all appear in 2011 announcements; ArmA 2 / Rome TW / TF2 /
// Iron Front / N&S in 2012; CS:GO recruiting Feb 2013; DayZ/Rift/H&G 2013;
// RoaR ran CS:GO retakes, ESEA and FACEIT from 2017.
const GAMES = [
  ['BG2','Battlegrounds 2', 2011], ['NW','Mount & Blade: Warband', 2011],
  ['MC','Minecraft', 2011], ['CSS','Counter-Strike: Source', 2011],
  ['CS16','Counter-Strike 1.6', 2011], ['MW2','Modern Warfare 2', 2011],
  ['KF','Killing Floor', 2011], ['L4D2','Left 4 Dead 2', 2011],
  ['GMOD',"Garry's Mod", 2011], ['ARMA','ArmA 2', 2012],
  ['RTW','Rome: Total War', 2012], ['TF2','Team Fortress 2', 2012],
  ['IF44','Iron Front 1944', 2012], ['NS','North & South', 2012],
  ['CSGO','CS:GO', 2013], ['DAYZ','DayZ', 2013],
  ['PS2','Planetside 2', 2013], ['RUST','Rust', 2014],
];
const ERA_GAME = { '21stPApubliclinebattlegroup':'BG2', '2ndColdstream':'NW', '2ndColdstreamOfficial':'NW', 'GoRoaRgg':'CSGO' };
const inferGame = (text, group) => {
  const t = ' ' + String(text).toLowerCase() + ' ';
  const K = [
    ['minecraft','MC'], ['project mansion','MC'], ['project minecraft','MC'],
    ['cs:go','CSGO'], ['csgo','CSGO'], ['global offensive','CSGO'], ['retake','CSGO'], ['esea','CSGO'], ['faceit','CSGO'], ['10 man','CSGO'],
    ['counter-strike: source','CSS'], ['cs:s','CSS'], [' css ','CSS'],
    ['1.6','CS16'],
    ['north & south','NS'], ['north and south','NS'],
    ['arma','ARMA'], ['rust','RUST'], ['planetside','PS2'], ['dayz','DAYZ'],
    ['trouble in terrorist','GMOD'], [' ttt ','GMOD'], ['gmod','GMOD'], ["garry's",'GMOD'],
    ['rome','RTW'], ['team fortress','TF2'], [' tf2 ','TF2'],
    ['iron front','IF44'], ['killing floor','KF'], ['left 4 dead','L4D2'], [' l4d','L4D2'],
    ['musket','NW'], ['napoleonic','NW'], ['warband','NW'], ['groupfight','NW'],
  ];
  for (const [k, g] of K) if (t.includes(k)) return g;
  return ERA_GAME[group] || 'GEN';
};

// ------------------------------------------------------------- assemble DATA
const parseWhen = (w) => { const d = new Date(String(w||'').split('@')[0].trim()); return isNaN(d) ? 0 : d.getTime(); };
const anns = (Array.isArray(annsRaw) ? annsRaw : annsRaw.announcements)
  .map((a) => ({ id: a.id, t: a.title, w: a.when, a: a.author, g: a.group,
    b: String(a.body || '').replace(/\s+/g, ' ').trim().slice(0, 1200), ts: parseWhen(a.when) }))
  .map((a) => ({ ...a, gm: inferGame(a.t + ' ' + a.b, a.g) }))
  .sort((x, y) => y.ts - x.ts);

const forumPosts = posts.map((p) => ({ n: p.replyNo, a: p.author, d: p.date,
  g: p.memberGroup || '', pc: p.postCount || 0, b: String(p.ownText || '').trim().slice(0, 900) }));

const groupsArr = Array.isArray(groups) ? groups : Object.values(groups);
const rosterByEra = {};
for (const g of groupsArr) rosterByEra[g.slug] = (g.members || []).map((m) => m.name);

const videos = community.videos.map((v) => ({ id: v.videoId, t: v.title, vw: v.views,
  p: v.published, gm: /21st|tribute|militia/i.test(v.title) ? 'BG2' : inferGame(v.title, '2ndColdstream'),
  thumb: (images.youtube && (images.youtube[v.videoId] || {}).uri) || '' }));


const DATA = {
  totals: community.totals,
  eras: community.eras.map((e) => ({ slug: e.slug, name: e.name, founded: e.founded,
    members: e.members, events: e.events, announcements: e.announcements,
    first: e.first, last: e.last, headline: e.headline || '', summary: e.summary || '',
    short: ERA_SHORT[e.slug] || e.name })),
  eraOrder: ERA_ORDER, eraShort: ERA_SHORT,
  games: GAMES,
  anns, forumPosts, intakes,
  intakeYears: community.intakeYears,
  lifers: community.lifers,
  rosterByEra, videos,
  eventsByYear: community.eventsByYear,
  badges: Object.fromEntries(Object.entries(images.steam).map(([k, v]) => [k, v.uri])),
  recovered: {
    members: recovered.names.filter((n) => n.affiliation === 'member')
      .map((n) => ({ name: n.name, tag: n.tag, rank: n.rank, known: n.known, sightings: n.sightings.length, note: n.note || null })),
    othersCount: recovered.summary.otherRegiments,
  },
  class2011: class2011
    .slice().sort((a, b) => String(a.joined).localeCompare(String(b.joined)))
    .map((m) => ({ name: m.name, joined: m.joined, joinedRaw: m.joinedRaw, lastSeen: m.lastSeen, posts: m.posts,
      known: knownNames.has(String(m.name).toLowerCase().replace(/[^a-z0-9]+/g, '')) })),
};

// Brand assets (brand/, supplied by River 2026-08-20). The badge banner is the
// hero; the globe mark is the site logo; the guards star is a heritage accent.
const toUri = (buf, mime) => 'data:' + mime + ';base64,' + buf.toString('base64');
const HERO = toUri(await sharp('brand/csg-badge-banner.png')
  .resize(1600, null, { kernel: 'lanczos3' }).jpeg({ quality: 80 }).toBuffer(), 'image/jpeg');
const LOGO = toUri(await sharp('brand/csg-globe-black.png')
  .trim().resize(null, 160, { kernel: 'lanczos3' }).png().toBuffer(), 'image/png');
const STAR = toUri(await sharp('brand/coldstream-guards-star.jpg')
  .resize(220, null, { kernel: 'lanczos3' }).jpeg({ quality: 82 }).toBuffer(), 'image/jpeg');

// ------------------------------------------------------------------- the page
const html = `<title>Coldstream Gaming</title>
<style>
  :root{
    --ground:#1a1c1b; --panel:#232624; --raised:#2c302e; --line:#101211; --hi:#4b514d;
    --ink:#e9ebe7; --muted:#a2a8a2; --faint:#6f7570;
    --scarlet:#dfe2dd; --scarlet-deep:#9aa09b; --brass:#cfd3ce;
    --disp:"Tahoma","Verdana","Segoe UI",sans-serif;
    --body:"Tahoma","Verdana","Segoe UI",sans-serif;
    --mono:"Courier New",Courier,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--body);font-size:13px;line-height:1.6}
  a{color:inherit;text-decoration:none}
  img{max-width:100%}
  button{font-family:var(--body)}
  :focus-visible{outline:2px solid var(--brass);outline-offset:2px}

  .ribbon{position:fixed;top:14px;right:-44px;z-index:50;transform:rotate(38deg);background:var(--brass);color:#1a1408;font:600 11px/1 var(--mono);letter-spacing:.12em;padding:6px 48px;box-shadow:0 2px 10px rgba(0,0,0,.5);pointer-events:none}

  .estbar{background:#131514;border-bottom:1px solid var(--line);font:400 11.5px/1 var(--mono);color:var(--faint);letter-spacing:.08em}
  .estbar .in{max-width:1120px;margin:0 auto;padding:8px 20px;display:flex;gap:24px;flex-wrap:wrap;justify-content:space-between}
  .estbar b{color:var(--brass);font-weight:500}

  header.mast{background:linear-gradient(180deg,#2b2f2d,#1e2120);border-bottom:1px solid var(--line)}
  .mast .in{max-width:1120px;margin:0 auto;padding:18px 20px 0;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .crest{height:56px;width:auto;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))}
  .wordmark{flex:1 1 auto;min-width:220px}
  .wordmark h1{margin:0;font:700 clamp(22px,3.4vw,32px)/1.05 var(--disp);letter-spacing:.06em;color:var(--ink)}
  .wordmark h1 .red{color:var(--scarlet)}
  .wordmark p{margin:2px 0 0;font:400 12px/1.3 var(--mono);color:var(--muted);letter-spacing:.14em}
  .steam-btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(180deg,#1f2f47,#16233a);border:1px solid #3b4f74;border-radius:4px;color:#dfe8f5;padding:10px 16px;font:500 14px/1 var(--body);cursor:pointer;transition:filter .15s}
  .steam-btn:hover{filter:brightness(1.18)}
  .steam-btn svg{width:20px;height:20px;flex:none}
  nav.main{max-width:1120px;margin:14px auto 0;padding:0 20px;display:flex;gap:2px;flex-wrap:wrap}
  nav.main a{font:700 13px/1 var(--body);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);padding:12px 18px;border-bottom:3px solid transparent}
  nav.main a.on{color:var(--ink);border-color:var(--scarlet)}
  nav.main a:hover{color:var(--ink)}

  .hero{position:relative;border-bottom:1px solid var(--line);overflow:hidden}
  .hero .bg{position:absolute;inset:0;background:url("${HERO}") center 42%/cover no-repeat}
  .hero .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,28,27,.12) 0%,rgba(26,28,27,.18) 52%,rgba(26,28,27,.93) 80%,var(--ground) 100%)}
  .hero .in{position:relative;max-width:1120px;margin:0 auto;padding:min(38vw,440px) 20px 30px;text-align:center}
  .hero p{margin:0 auto;max-width:56ch;color:#d6cdbc;font-size:17.5px;text-shadow:0 1px 8px rgba(0,0,0,.8)}
  .hero .cta{margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center}
  .btn-red{display:inline-block;background:linear-gradient(180deg,var(--scarlet),var(--scarlet-deep));border:1px solid #d8556a;border-radius:4px;color:#fff;padding:11px 22px;font:700 14px/1 var(--body);letter-spacing:.05em;cursor:pointer}
  .btn-red:hover{filter:brightness(1.1)}
  .btn-ghost{display:inline-block;border:1px solid var(--line);border-radius:4px;color:var(--muted);padding:11px 18px;font:500 14px/1 var(--body);cursor:pointer;background:none}
  .btn-ghost:hover{color:var(--ink);border-color:var(--faint)}

  .wrap{max-width:1120px;margin:34px auto 0;padding:0 20px;display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:26px}
  .wrap.solo{grid-template-columns:1fr}
  @media (max-width:880px){.wrap{grid-template-columns:1fr}}

  .module{background:var(--panel);border:1px solid var(--line);border-radius:9px;overflow:hidden;box-shadow:0 6px 22px rgba(0,0,0,.28)}
  .module + .module{margin-top:26px}
  .mhead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:13px 18px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--raised),var(--panel))}
  .mhead h3{margin:0;font:700 13px/1 var(--disp);letter-spacing:.22em;text-transform:uppercase;color:var(--brass)}
  .mhead .sub{font:400 11px/1 var(--mono);color:var(--faint)}

  .post{padding:18px;border-bottom:1px solid var(--line)}
  .post:last-child{border-bottom:0}
  .post h4{margin:0 0 4px;font:700 18px/1.3 var(--body)}
  .post h4 a:hover,.rowlink:hover .fname{color:var(--scarlet)}
  .post .meta,.meta{font:400 11.5px/1.5 var(--mono);color:var(--faint)}
  .post .meta b,.meta b{color:var(--muted);font-weight:500}
  .post p{margin:8px 0 0;color:#cbc2b2}
  .tag{display:inline-block;font:500 10px/1 var(--mono);letter-spacing:.08em;color:var(--brass);border:1px solid #4a3d24;border-radius:3px;padding:3px 7px;margin-right:8px;vertical-align:1px}

  table.forum{width:100%;border-collapse:collapse}
  table.forum td{padding:13px 18px;border-bottom:1px solid var(--line);vertical-align:middle}
  table.forum tr:last-child td{border-bottom:0}
  tr.rowlink{cursor:pointer}
  tr.rowlink:hover td{background:rgba(198,47,66,.05)}
  .fico{width:34px;height:34px;border-radius:4px;background:var(--raised);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--scarlet);font:700 15px var(--disp)}
  .fname{font-weight:700}
  .fdesc{color:var(--muted);font-size:13.5px}
  .fstat{font:400 12px/1.5 var(--mono);color:var(--faint);text-align:right;white-space:nowrap}
  .flast{font:400 11.5px/1.5 var(--mono);color:var(--faint);white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}
  .flast b{color:var(--muted);font-weight:500}
  @media (max-width:640px){.flast{display:none}}

  .chips{display:flex;gap:8px;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--line)}
  .chip{font:500 11.5px/1 var(--mono);color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:7px 12px;cursor:pointer;background:none}
  .chip.on{color:var(--ink);border-color:var(--scarlet);background:rgba(198,47,66,.1)}
  .chip:hover{color:var(--ink)}

  .pager{display:flex;gap:8px;align-items:center;justify-content:center;padding:14px;border-top:1px solid var(--line);font:400 12px var(--mono);color:var(--faint)}
  .pager button{background:var(--raised);border:1px solid var(--line);border-radius:4px;color:var(--muted);font:500 12px var(--mono);padding:7px 12px;cursor:pointer}
  .pager button:disabled{opacity:.35;cursor:default}
  .pager button:not(:disabled):hover{color:var(--ink)}

  .crumb{font:400 12px/1 var(--mono);color:var(--faint);padding:0 0 14px}
  .crumb a{color:var(--muted)}
  .crumb a:hover{color:var(--ink)}

  .fpost{padding:16px 18px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px}
  .fpost:last-child{border-bottom:0}
  @media (max-width:640px){.fpost{grid-template-columns:1fr;gap:6px}}
  .fpa .n{font-weight:700}
  .fpa .g{font:400 10.5px/1.5 var(--mono);color:var(--brass)}
  .fpa .d{font:400 10.5px/1.5 var(--mono);color:var(--faint)}
  .fpb{color:#cbc2b2;font-size:15px;overflow-wrap:anywhere}
  .fpb .rn{font:400 10.5px/1 var(--mono);color:var(--faint);float:right;margin-left:10px}

  .shout-log{max-height:340px;overflow-y:auto;padding:6px 0}
  .shout{padding:8px 18px;display:flex;gap:10px}
  .shout .t{font:400 10px/2 var(--mono);color:var(--faint);flex:none;width:44px}
  .shout .m{font-size:14px;color:#cbc2b2;overflow-wrap:anywhere}
  .shout .m b{color:var(--ink);font-weight:700}
  .shout .m b.of{color:var(--brass)}
  .shout-in{display:flex;gap:8px;padding:12px 18px;border-top:1px solid var(--line);background:var(--raised)}
  .shout-in input{flex:1;min-width:0;background:var(--ground);border:1px solid var(--line);border-radius:4px;color:var(--ink);font:400 13px var(--body);padding:8px 10px}
  .shout-in input::placeholder{color:var(--faint)}
  .shout-in button{background:var(--raised);border:1px solid var(--line);border-radius:4px;color:var(--muted);font:700 12px var(--body);padding:0 14px;cursor:pointer}
  .shout-in button:not(:disabled):hover{color:var(--ink)}

  .roster{padding:10px 18px 14px;display:flex;flex-direction:column;gap:9px}
  .rrow{display:flex;align-items:center;gap:10px}
  .dot{width:8px;height:8px;border-radius:50%;background:#4f9e63;flex:none;box-shadow:0 0 6px rgba(79,158,99,.6)}
  .dot.idle{background:#a08a3c;box-shadow:none}
  .rname{font-weight:500;font-size:14.5px}
  .pips{margin-left:auto;font:400 10px/1 var(--mono);color:var(--brass);letter-spacing:.05em}

  .stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)}
  .stat{background:var(--panel);padding:14px 18px}
  .stat .n{font:500 22px/1.1 var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
  .stat .l{font:400 10.5px/1.4 var(--mono);color:var(--faint);letter-spacing:.08em;text-transform:uppercase}

  .eras{padding:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .era{text-align:center;cursor:pointer;background:none;border:none;padding:0}
  .era img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;border:1px solid var(--line);filter:saturate(.92)}
  .era .y{font:400 10.5px/1 var(--mono);color:var(--faint);margin-top:6px}
  .era.now img{border-color:var(--scarlet);box-shadow:0 0 0 1px var(--scarlet)}
  .era.now .y{color:var(--scarlet)}

  .login-blurb{padding:16px 18px;color:#cbc2b2;font-size:14px}
  .login-blurb .steam-btn{width:100%;justify-content:center;margin-bottom:12px}
  .login-blurb p{margin:0}
  .login-blurb .hint{margin-top:10px;font:400 11px/1.6 var(--mono);color:var(--faint)}
  .svcrec{margin-top:12px;border:1px solid #4a3d24;border-radius:5px;padding:12px 14px;background:rgba(201,163,92,.06)}
  .svcrec .who{font:700 15px var(--body);color:var(--ink)}
  .svcrec .role{font:400 10.5px/1.8 var(--mono);color:var(--brass);letter-spacing:.1em}
  .svcrec .es{font:400 11px/1.7 var(--mono);color:var(--muted)}

  .timeline{display:flex;flex-direction:column}
  .tl{display:grid;grid-template-columns:96px minmax(0,1fr);gap:18px;padding:20px 18px;border-bottom:1px solid var(--line)}
  .tl:last-child{border-bottom:0}
  .tl img{width:96px;height:96px;object-fit:cover;border-radius:6px;border:1px solid var(--line)}
  .tl h4{margin:0;font:700 20px/1.2 var(--body)}
  .tl .when{font:400 11px/1.8 var(--mono);color:var(--brass);letter-spacing:.08em}
  .tl p{margin:6px 0 0;color:#cbc2b2;font-size:15px;max-width:65ch}
  .tl .nums{margin-top:8px;font:400 11px/1.6 var(--mono);color:var(--faint)}

  .grid-names{padding:16px 18px;display:flex;gap:8px;flex-wrap:wrap}
  .nchip{font:400 12.5px/1 var(--body);color:#cbc2b2;border:1px solid var(--line);border-radius:4px;padding:7px 10px}
  .nchip .x{font:400 9.5px var(--mono);color:var(--brass);margin-left:6px}

  .media-grid{padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
  .vid{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--raised);display:block}
  .vid img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
  .vid .vt{padding:10px 12px 4px;font:700 13.5px/1.35 var(--body)}
  .vid .vm{padding:0 12px 12px;font:400 10.5px/1.6 var(--mono);color:var(--faint)}
  .vid:hover .vt{color:var(--scarlet)}

  .bars{padding:22px 18px 10px;display:flex;align-items:flex-end;gap:8px;height:240px}
  .bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px;min-width:0}
  .bar .col{width:100%;background:linear-gradient(180deg,var(--scarlet),var(--scarlet-deep));border-radius:3px 3px 0 0;min-height:2px}
  .bar.um .col{background:repeating-linear-gradient(45deg,#3a4356 0 6px,#2a3347 6px 12px)}
  .bar .v{font:500 11px var(--mono);color:var(--muted)}
  .bar .y{font:400 10px var(--mono);color:var(--faint)}
  .barnote{padding:0 18px 18px;font:400 12px/1.7 var(--mono);color:var(--faint)}
  .barnote b{color:var(--brass);font-weight:500}

  .srv-grid{padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
  .srv{border:1px solid var(--line);border-radius:9px;background:var(--raised);padding:16px}
  .srv-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .srv-game{font:400 10.5px/1 var(--mono);color:var(--faint);letter-spacing:.08em;text-transform:uppercase}
  .pill{font:600 9.5px/1 var(--mono);letter-spacing:.1em;border:1px solid var(--line);border-radius:99px;padding:4px 9px;color:var(--muted)}
  .pill.hot{color:var(--brass);border-color:#4a3d24;background:rgba(201,163,92,.08)}
  .srv-name{margin-top:10px;font:700 17px/1.2 var(--body)}
  .srv-meta{font:400 11px/1.8 var(--mono);color:var(--faint)}
  .srv p{margin:8px 0 0;color:#cbc2b2;font-size:14px}

  .heritage{display:flex;gap:16px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line);color:#cbc2b2;font-size:14.5px}
  .heritage img{width:72px;height:auto;border-radius:6px;flex:none}
  footer{max-width:1120px;margin:44px auto 0;padding:22px 20px 34px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;font:400 11.5px/1.7 var(--mono);color:var(--faint)}
  footer b{color:var(--muted);font-weight:500}

  .gtag{display:inline-block;font:bold 10px/1 var(--mono);letter-spacing:.04em;border:1px solid var(--hi);padding:2px 5px;margin-right:7px;color:var(--muted);vertical-align:1px;white-space:nowrap}
  /* ---- OG Steam VGUI skin overrides ---- */
  .module,.srv,.svcrec,.vid,.fico,.tl img,.era img,.heritage img,.nchip,.chip,.pill,
  .btn-red,.btn-ghost,.steam-btn,.pager button,.shout-in input,.shout-in button{border-radius:0}
  .module{border:1px solid;border-color:var(--hi) var(--line) var(--line) var(--hi);box-shadow:none;background:var(--panel)}
  .mhead{background:linear-gradient(180deg,#3a3f3c,#242826);border-bottom:1px solid var(--line)}
  .mhead h3{font:bold 12px/1 var(--body);letter-spacing:.1em;color:#eceeea;text-transform:uppercase}
  .btn-red,.btn-ghost,.steam-btn,.chip,.pager button,.shout-in button{background:linear-gradient(180deg,#3f4441,#2e3230);border:1px solid;border-color:var(--hi) var(--line) var(--line) var(--hi);color:var(--ink);font:bold 12px var(--body)}
  .btn-red{background:linear-gradient(180deg,#d9dcd7,#aeb3ae);color:#181a19}
  .btn-red:hover{filter:brightness(1.05)}
  .x-unused:hover,.btn-ghost:hover,.steam-btn:hover,.chip:hover{filter:brightness(1.12);color:#fff}
  .btn-red:active,.btn-ghost:active,.steam-btn:active,.chip:active,.pager button:active{border-color:var(--line) var(--hi) var(--hi) var(--line)}
  .chip.on{background:#111312;border-color:var(--line) var(--hi) var(--hi) var(--line);color:#f2f4f0}
  .steam-btn{color:#dfe8f5}
  nav.main a{font:bold 12px/1 var(--body)}
  nav.main a.on{color:#fff;border-color:#e9ebe7}
  .wordmark h1{font:bold clamp(20px,3vw,28px)/1.05 var(--body);letter-spacing:.04em}
  .post h4{font:bold 15px/1.35 var(--body)}
  .fname,.srv-name,.tl h4{font-weight:bold}
  .srv{background:var(--raised);border:1px solid;border-color:var(--line) var(--hi) var(--hi) var(--line)}
  .shout-in input{background:#333a2c;border:1px solid;border-color:var(--line) var(--hi) var(--hi) var(--line)}
  .stats,.bars{background:var(--panel)}
  .stat{background:var(--raised)}
  .dot{background:#8bc53f;box-shadow:0 0 4px rgba(139,197,63,.7)}
  .dot.idle{background:#9aa09b}
  .bar .col{background:linear-gradient(180deg,#cfd3ce,#8d938e)}
  .ribbon{background:#dfe2dd;color:#181a19}
</style>

<div class="ribbon">DESIGN&nbsp;PREVIEW</div>

<div class="estbar"><div class="in">
  <span>EST. <b>JUNE 2011</b> &nbsp;·&nbsp; EIGHT ERAS AND COUNTING</span>
  <span><b>${DATA.totals.distinctPeople}</b> MEMBERS ALL-TIME &nbsp;·&nbsp; <b>${DATA.totals.events}</b> EVENTS CALLED</span>
</div></div>

<header class="mast">
  <div class="in">
    <img class="crest" src="${LOGO}" alt="CSG globe logo">
    <div class="wordmark">
      <h1>COLDSTREAM <span class="red">GAMING</span></h1>
      <p>MULTI-GAMING COMMUNITY &nbsp;·&nbsp; EST. 2011</p>
    </div>
    <span id="auth-slot"></span>
  </div>
  <nav class="main" id="nav"></nav>
</header>

<div id="view"></div>

<footer>
  <span><b>Coldstream Gaming</b> · est. 2011</span>
  <span>preview build. stats, posts and rosters come straight from the community archives. Steam sign-in and the shoutbox go live once the real backend is up.</span>
</footer>

<script>
const DATA = ${JSON.stringify(DATA)};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (id) => document.getElementById(id);
const steamSVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:20px;height:20px;flex:none"><circle cx="12" cy="12" r="10" stroke="#9db6d8" stroke-width="1.6"/><circle cx="15.4" cy="8.6" r="3" fill="#9db6d8"/><circle cx="8.2" cy="15.6" r="2.2" stroke="#9db6d8" stroke-width="1.6"/><path d="M10.2 14.2 13.4 10.6" stroke="#9db6d8" stroke-width="1.6"/></svg>';

let signedIn = false;
let shouts = [
  {t:'21:02', n:'Crawford', of:true, m:'fall in, linebattle at 8. bring a recruit'},
  {t:'21:04', n:'Blaboon', m:"six eras and I still can't reload faster than Timmy"},
  {t:'21:05', n:'Timmy9000', m:'and you never will'},
  {t:'21:11', n:"NoxV ' DaviD", of:true, m:'retakes after the event, usual lobby'},
  {t:'21:18', n:'Gorf', m:'someone clip the last charge, that was film material'},
  {t:'21:23', n:'Capitulated Magik', of:true, m:'archive page is up. found myself in 2012. unreal'},
];

const NAV = [['home','Home'],['forums','Forums'],['servers','Servers'],['history','History'],['roster','Roster'],['media','Media'],['events','Events']];
const BOARDS = {
  parade:  {ico:'⚑', name:'The Parade Ground', desc:'Announcements and event calls from every era'},
  barracks:{ico:'☖', name:'The Barracks', desc:'General chat. The old regiment thread is in here, all 885 replies of it'},
  enlist:  {ico:'✎', name:'Enlistment Office', desc:'Announced joins, sorted by class year'},
  archive: {ico:'✦', name:'The Archive', desc:'All the videos we could still find'},
};

// ------------------------------------------------------------------ helpers
const route = () => (location.hash.replace(/^#\\/?/, '') || 'home').split('/');
const go = (h) => { location.hash = '#/' + h; };
const eraName = (slug) => DATA.eraShort[slug] || slug;
const annYear = (a) => { const m = String(a.w||'').match(/\\d{4}/); return m ? m[0] : ''; };

function renderAuth() {
  $('auth-slot').innerHTML = signedIn
    ? '<span class="meta" style="display:inline-flex;align-items:center;gap:10px">signed in as <b>RiveRcs</b><button class="btn-ghost" id="signout" style="padding:8px 12px">Sign out</button></span>'
    : '<button class="steam-btn" id="signin" aria-label="Sign in through Steam">' + steamSVG + 'Sign in through Steam</button>';
  const si = $('signin'), so = $('signout');
  if (si) si.onclick = () => { signedIn = true; renderAuth(); render(); };
  if (so) so.onclick = () => { signedIn = false; renderAuth(); render(); };
}

function renderNav(cur) {
  $('nav').innerHTML = NAV.map(([k, l]) =>
    '<a href="#/' + k + '"' + (cur === k || (cur === 'board' && k === 'forums') || (cur === 'thread' && k === 'forums') ? ' class="on"' : '') + '>' + l + '</a>').join('');
}

// -------------------------------------------------------------- home pieces
const loginModule = () => '<div class="module"><div class="mhead"><h3>Sign In</h3></div><div class="login-blurb">'
  + (signedIn
    ? '<div class="svcrec"><div class="who">RiveRcs · Crawford</div><div class="role">FOUNDER · COLONEL · EST. 2011</div><div class="es">service record: 8 of 8 eras · 672 event calls written<br>21stPA → Midnight Mercenarys → 2ndCS → MM MGC →<br>Nox Viator → RoaR → 2nd Coldstream Guard → Coldstream</div></div><p style="margin-top:10px">Members see this after signing in once. It pulls everything from the archive.</p><div class="hint">demo record. the live site reads it from your Steam ID.</div>'
    : '<button class="steam-btn" id="signin2">' + steamSVG + 'Sign in through Steam</button><p>Sign in with Steam to link your profile. All eight eras are in the archive, so if you ever played with us your record\\'s already in there.</p><div class="hint">no separate account needed. it uses your Steam profile.</div>')
  + '</div></div>';

const shoutModule = () => '<div class="module"><div class="mhead"><h3>Shoutbox</h3><span class="sub">' + (signedIn ? 'preview · local only' : 'sign in to shout') + '</span></div>'
  + '<div class="shout-log" id="shoutlog">' + shouts.map((s) =>
      '<div class="shout"><span class="t">' + esc(s.t) + '</span><span class="m"><b' + (s.of ? ' class="of"' : '') + '>' + esc(s.n) + '</b>: ' + esc(s.m) + '</span></div>').join('')
  + '</div><div class="shout-in"><input id="shoutin" maxlength="180" placeholder="' + (signedIn ? 'Shout as RiveRcs…' : 'Sign in to shout…') + '"' + (signedIn ? '' : ' disabled') + '><button id="shoutgo"' + (signedIn ? '' : ' disabled') + '>Send</button></div></div>';

const statsModule = () => { const t = DATA.totals; return '<div class="module"><div class="mhead"><h3>The Record</h3></div><div class="stats">'
  + [['315','members all-time'],[t.lifers,'lifers · 2+ eras'],[t.events,'events called'],[t.announcements.toLocaleString('en-US'),'announcements'],[t.videos,'films'],['2011','established']]
    .map(([n, l]) => '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>').join('') + '</div></div>'; };

const erasModule = () => '<div class="module"><div class="mhead"><h3>Eight Eras</h3><span class="sub">same crew since 2011</span></div><div class="eras">'
  + DATA.eraOrder.map((slug, i) => { const e = DATA.eras.find((x) => x.slug === slug); const y = e ? String(e.founded).match(/\\d{4}/)[0] : '';
      return '<button class="era' + (slug === 'coldstreamgaming' ? ' now' : '') + '" data-era="' + slug + '" title="' + esc(e ? e.name : slug) + '"><img src="' + DATA.badges[slug] + '" alt="' + esc(e ? e.name : slug) + '"><div class="y">' + (slug === 'coldstreamgaming' ? 'NOW' : y) + '</div></button>'; }).join('')
  + '</div></div>';

const onDuty = () => '<div class="module"><div class="mhead"><h3>On Duty</h3><span class="sub">launch mock</span></div><div class="roster">'
  + [['Crawford','FOUNDER · 8 ERAS',''],['Blaboon','6 ERAS',''],['Timmy9000','6 ERAS',''],["NoxV ' DaviD",'5 ERAS',' idle'],['Capitulated Magik','4 ERAS',''],['Ironhide650','4 ERAS',' idle'],['kavcav','3 ERAS','']]
    .map(([n, p, idle]) => '<div class="rrow"><span class="dot' + idle + '"></span><span class="rname">' + esc(n) + '</span><span class="pips">' + p + '</span></div>').join('') + '</div></div>';

const sidebar = () => '<aside>' + loginModule() + shoutModule() + onDuty() + statsModule() + erasModule() + '</aside>';

function heroHTML() {
  return '<section class="hero"><div class="bg"></div><div class="scrim"></div><div class="in">'
    + '<p>Welcome home. We\\'ve been at this since 2011, muskets to retakes and everything in between. 315 people have worn the tag. Sign in, find your name, pull up a chair in the shoutbox.</p>'
    + '<div class="cta"><button class="btn-red" data-go="history">Our History</button><button class="btn-ghost" data-go="roster">The Roster</button><button class="btn-ghost" data-go="servers">Servers</button></div>'
    + '</div></section>';
}

function homeView() {
  const latest = DATA.anns.filter((a) => a.ts > 0).slice(0, 4);
  const news = '<div class="module"><div class="mhead"><h3>Latest News</h3><span class="sub">from the announcement feed</span></div>'
    + latest.map((a) => '<article class="post"><h4><a href="#/thread/ann/' + a.id + '">' + esc(a.t) + '</a></h4>'
      + '<div class="meta"><span class="gtag">' + a.gm + '</span><span class="tag">' + esc(eraName(a.g).toUpperCase()) + '</span>posted by <b>' + esc(a.a) + '</b> · ' + esc(a.w) + '</div>'
      + (a.b && a.b !== '.' ? '<p>' + esc(a.b.slice(0, 220)) + (a.b.length > 220 ? '…' : '') + '</p>' : '') + '</article>').join('')
    + '</div>';
  const gamesMod = '<div class="module"><div class="mhead"><h3>Games We Play</h3><span class="sub">everything on the record since 2011</span></div><div class="grid-names">'
    + DATA.games.map((g) => '<span class="nchip"><span class="gtag">' + g[0] + '</span>' + esc(g[1]) + '<span class="x">SINCE ' + g[2] + '</span></span>').join('')
    + '</div></div>';
  const forums = '<div class="module"><div class="mhead"><h3>The Forums</h3><span class="sub">click a board to browse</span></div><table class="forum">'
    + boardRows() + '</table></div>';
  return heroHTML() + '<div class="wrap"><main>' + news + gamesMod + forums + '</main>' + sidebar() + '</div>';
}

function boardRows() {
  const last = DATA.anns.filter((a) => a.ts > 0)[0];
  const stats = {
    parade: [DATA.anns.length.toLocaleString('en-US') + ' threads', '<b>' + esc(last.a) + '</b><br>' + esc(last.t)],
    barracks: [DATA.forumPosts.length + ' replies', '<b>' + esc(DATA.forumPosts[DATA.forumPosts.length - 1].a) + '</b><br>the regiment thread'],
    enlist: [DATA.intakes.length + ' enlistments', '<b>Crawford</b><br>welcome the ' + Math.max(...Object.keys(DATA.intakeYears).map(Number)) + ' class'],
    archive: [DATA.videos.length + ' films', '<b>Official21stPA</b><br>the oldest video we still have'],
  };
  return Object.entries(BOARDS).map(([k, b]) =>
    '<tr class="rowlink" data-board="' + k + '"><td width="34"><div class="fico">' + b.ico + '</div></td>'
    + '<td><div class="fname">' + b.name + '</div><div class="fdesc">' + b.desc + '</div></td>'
    + '<td class="fstat">' + stats[k][0] + '</td><td class="flast">' + stats[k][1] + '</td></tr>').join('');
}

function forumsView() {
  const totalThreads = DATA.anns.length + 1 + Object.keys(DATA.intakeYears).length + 1;
  const totalPosts = DATA.anns.length + DATA.forumPosts.length + DATA.intakes.length + DATA.videos.length;
  const stats = '<div class="module"><div class="mhead"><h3>Forum Statistics</h3></div>'
    + '<div class="login-blurb meta" style="font-size:13px">'
    + totalThreads.toLocaleString('en-US') + ' threads &nbsp;·&nbsp; ' + totalPosts.toLocaleString('en-US') + ' posts &nbsp;·&nbsp; '
    + DATA.totals.distinctPeople + ' members all-time &nbsp;·&nbsp; most members in one era: 101'
    + '<br>records run from April 2011 to the present. everything on these boards comes from the community archives.</div></div>';
  return '<div class="wrap"><main><div class="module"><div class="mhead"><h3>The Forums</h3><span class="sub">click a board to browse</span></div><table class="forum">' + boardRows() + '</table></div>' + stats + '</main>' + sidebar() + '</div>';
}

function serversView() {
  const S = [
    { game: 'Garry\\'s Mod', code: 'GMOD', name: 'Coldstream TTT', slots: '24 slots', blurb: 'Trouble in Terrorist Town. Trust nobody, especially whoever\\'s camping the tester.', status: 'coming soon' },
    { code: 'CSS', game: 'Counter-Strike: Source', name: 'Coldstream CS:S', slots: '20 slots', blurb: 'Classic Source. Our first CS:S scrim was November 2011, so this one\\'s overdue.', status: 'coming soon' },
    { code: 'CS16', game: 'Counter-Strike 1.6', name: 'Coldstream 1.6', slots: '20 slots', blurb: 'The old warhorse. Original maps, original movement, no crosshair excuses.', status: 'coming soon' },
    { code: 'MC', game: 'Minecraft', name: 'Coldstream SMP', slots: '20 slots', blurb: 'Simple survival, nothing fancy. The first community Minecraft server went up in 2011 alongside the muskets. Project Mansion walked so this could run.', status: 'coming soon' },
  ];
  const pill = (s) => '<span class="pill' + (s === 'coming soon' ? ' hot' : '') + '">' + s.toUpperCase() + '</span>';
  const cards = S.map((s) =>
    '<div class="srv"><div class="srv-top"><span class="srv-game"><span class="gtag">' + s.code + '</span>' + s.game + '</span>' + pill(s.status) + '</div>'
    + '<div class="srv-name">' + s.name + '</div>'
    + '<div class="srv-meta">' + s.slots + ' · address TBA</div>'
    + '<p>' + s.blurb + '</p></div>').join('');
  return '<div class="wrap solo"><main><div class="module"><div class="mhead"><h3>Servers</h3><span class="sub">servers we\\'ll be running</span></div>'
    + '<div class="srv-grid">' + cards + '</div>'
    + '<div class="barnote">Addresses and connect buttons go live here as each server comes online. Want something else hosted? Post it in <a href="#/board/barracks" style="color:var(--brass)">the Barracks</a>.</div>'
    + '</div></main></div>';
}

// --------------------------------------------------------------- board views
let paradeFilter = 'all', paradePage = 0, barracksPage = 0;
function paradeView() {
  const pool = DATA.anns.filter((a) => paradeFilter === 'all' || a.g === paradeFilter);
  const PP = 20, pages = Math.max(1, Math.ceil(pool.length / PP));
  paradePage = Math.min(paradePage, pages - 1);
  const rows = pool.slice(paradePage * PP, paradePage * PP + PP).map((a) =>
    '<tr class="rowlink" data-thread="ann/' + a.id + '"><td><div class="fname"><span class="gtag">' + a.gm + '</span>' + esc(a.t) + '</div>'
    + '<div class="meta">by <b>' + esc(a.a) + '</b> · ' + esc(a.w || annYear(a)) + ' · ' + esc(eraName(a.g)) + '</div></td></tr>').join('');
  const chips = ['all', ...DATA.eraOrder].map((s) =>
    '<button class="chip' + (paradeFilter === s ? ' on' : '') + '" data-filter="' + s + '">' + (s === 'all' ? 'All eras' : esc(eraName(s))) + '</button>').join('');
  return '<div class="wrap solo"><main><div class="crumb"><a href="#/forums">Forums</a> / The Parade Ground</div>'
    + '<div class="module"><div class="mhead"><h3>⚑ The Parade Ground</h3><span class="sub">' + pool.length.toLocaleString('en-US') + ' announcements, straight from the archive</span></div>'
    + '<div class="chips">' + chips + '</div><table class="forum">' + rows + '</table>'
    + pager(paradePage, pages, 'parade') + '</div></main></div>';
}

function barracksView() {
  const PP = 20, pages = Math.ceil(DATA.forumPosts.length / PP);
  barracksPage = Math.min(barracksPage, pages - 1);
  const slice = DATA.forumPosts.slice(barracksPage * PP, barracksPage * PP + PP);
  const rows = slice.map((p) =>
    '<div class="fpost"><div class="fpa"><div class="n">' + esc(p.a) + '</div>'
    + (p.g ? '<div class="g">' + esc(p.g) + '</div>' : '')
    + (p.pc ? '<div class="d">Posts: ' + p.pc.toLocaleString('en-US') + '</div>' : '')
    + '<div class="d">' + esc(p.d) + '</div></div>'
    + '<div class="fpb"><span class="rn">#' + p.n + '</span>' + esc(p.b || '(image / formatting-only post)') + '</div></div>').join('');
  return '<div class="wrap solo"><main><div class="crumb"><a href="#/forums">Forums</a> / The Barracks / the regiment thread</div>'
    + '<div class="module"><div class="mhead"><h3>☖ The Regiment Thread</h3><span class="sub">885 replies · 2012–2016 · the same thread through every era</span></div>'
    + rows + pager(barracksPage, pages, 'barracks') + '</div></main></div>';
}

function enlistView(year) {
  const years = Object.keys(DATA.intakeYears).sort();
  if (!year) {
    const rows = years.map((y) => {
      const n = DATA.intakes.filter((i) => (i.announcedOn || '').includes(y)).length;
      return '<tr class="rowlink" data-thread="intake/' + y + '"><td width="34"><div class="fico">' + y.slice(2) + '</div></td>'
        + '<td><div class="fname">The Class of ' + y + '</div><div class="fdesc">' + n + ' announced enlistments</div></td>'
        + '<td class="fstat">' + n + ' members</td></tr>'; }).join('');
    return '<div class="wrap solo"><main><div class="crumb"><a href="#/forums">Forums</a> / Enlistment Office</div>'
      + '<div class="module"><div class="mhead"><h3>✎ Enlistment Office</h3><span class="sub">every announced join we have on record, sorted by year. nothing logged for 2014</span></div><table class="forum">' + rows + '</table></div></main></div>';
  }
  const list = DATA.intakes.filter((i) => (i.announcedOn || '').includes(year));
  const rows = list.map((i) =>
    '<div class="fpost"><div class="fpa"><div class="n">' + esc(i.name) + '</div><div class="g">' + esc(i.rank || '') + '</div><div class="d">' + esc(i.country || '') + '</div></div>'
    + '<div class="fpb">welcomed by <b>' + esc(i.announcedBy) + '</b> · ' + esc(i.announcedOn) + '</div></div>').join('');
  return '<div class="wrap solo"><main><div class="crumb"><a href="#/forums">Forums</a> / <a href="#/board/enlist">Enlistment Office</a> / Class of ' + esc(year) + '</div>'
    + '<div class="module"><div class="mhead"><h3>✎ The Class of ' + esc(year) + '</h3><span class="sub">' + list.length + ' announced enlistments</span></div>' + rows + '</div></main></div>';
}

function archiveView() {
  const grid = DATA.videos.map((v) =>
    '<a class="vid" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + '" target="_blank" rel="noopener">'
    + (v.thumb ? '<img src="' + v.thumb + '" alt="" loading="lazy">' : '')
    + '<div class="vt">' + esc(v.t) + '</div><div class="vm"><span class="gtag">' + v.gm + '</span>' + esc(v.vw || '') + (v.p ? ' · ' + esc(v.p) : '') + '</div></a>').join('');
  return '<div class="wrap solo"><main><div class="crumb"><a href="#/forums">Forums</a> / The Archive</div>'
    + '<div class="module"><div class="mhead"><h3>✦ The Archive</h3><span class="sub">' + DATA.videos.length + ' films still up · links open on YouTube</span></div>'
    + '<div class="media-grid">' + grid + '</div></div></main></div>';
}

function pager(page, pages, key) {
  return '<div class="pager"><button data-pg="' + key + ':first"' + (page === 0 ? ' disabled' : '') + '>« first</button>'
    + '<button data-pg="' + key + ':prev"' + (page === 0 ? ' disabled' : '') + '>‹ prev</button>'
    + '<span>page ' + (page + 1) + ' / ' + pages + '</span>'
    + '<button data-pg="' + key + ':next"' + (page >= pages - 1 ? ' disabled' : '') + '>next ›</button>'
    + '<button data-pg="' + key + ':last"' + (page >= pages - 1 ? ' disabled' : '') + '>last »</button></div>';
}

// -------------------------------------------------------------- thread view
function annThread(id) {
  const a = DATA.anns.find((x) => x.id === id);
  if (!a) return forumsView();
  return '<div class="wrap solo"><main><div class="crumb"><a href="#/forums">Forums</a> / <a href="#/board/parade">The Parade Ground</a> / thread</div>'
    + '<div class="module"><div class="mhead"><h3>' + esc(a.t) + '</h3><span class="sub">[' + a.gm + '] · ' + esc(eraName(a.g)) + '</span></div>'
    + '<div class="fpost"><div class="fpa"><div class="n">' + esc(a.a) + '</div><div class="g">OFFICER</div><div class="d">' + esc(a.w || '') + '</div></div>'
    + '<div class="fpb">' + esc(a.b && a.b !== '.' ? a.b : '(the original announcement body was a bare event call)') + '</div></div></div></main></div>';
}

// --------------------------------------------------------------- other views
function historyView() {
  const rows = DATA.eraOrder.map((slug) => { const e = DATA.eras.find((x) => x.slug === slug); if (!e) return '';
    return '<div class="tl"><img src="' + DATA.badges[slug] + '" alt=""><div>'
      + '<div class="when">' + esc(e.founded).toUpperCase() + (e.first ? ' · ACTIVE ' + esc(e.first).slice(0, 4) + '–' + esc(e.last).slice(0, 4) : '') + '</div>'
      + '<h4>' + esc(e.name) + '</h4>'
      + (e.headline ? '<p><i>' + esc(e.headline) + '</i></p>' : '')
      + (e.summary ? '<p>' + esc(e.summary) + '</p>' : '')
      + '<div class="nums">' + e.members + ' members on the rolls · ' + e.events + ' events · ' + e.announcements + ' announcements</div>'
      + '</div></div>'; }).join('');
  return '<div class="wrap solo"><main><div class="module"><div class="mhead"><h3>The History</h3><span class="sub">eight eras since 2011</span></div>'
    + '<div class="heritage"><img src="${STAR}" alt="Coldstream Guards star"><div>The name comes from the real Coldstream Guards, the oldest continuously serving regiment in the British Army. Loyalty, leadership, tradition. That was the idea in 2011 and it still is.</div></div>'
    + '<div class="timeline">' + rows + '</div></div></main></div>';
}

let rosterEra = 'lifers';
function rosterView() {
  const chips = '<button class="chip' + (rosterEra === 'lifers' ? ' on' : '') + '" data-rera="lifers">Lifers · 2+ eras</button>'
    + '<button class="chip' + (rosterEra === 'c2011' ? ' on' : '') + '" data-rera="c2011">Class of 2011</button>'
    + DATA.eraOrder.map((s) => '<button class="chip' + (rosterEra === s ? ' on' : '') + '" data-rera="' + s + '">' + esc(eraName(s)) + '</button>').join('')
    + '<button class="chip' + (rosterEra === 'recovered' ? ' on' : '') + '" data-rera="recovered">From the screenshots</button>';
  let body;
  if (rosterEra === 'lifers') {
    body = '<div class="grid-names">' + DATA.lifers.map((l) =>
      '<span class="nchip">' + esc(l.name) + '<span class="x">' + l.eras.length + ' ERAS</span></span>').join('') + '</div>';
  } else if (rosterEra === 'c2011') {
    body = '<div class="grid-names">' + DATA.class2011.map((m) =>
      '<span class="nchip" title="last seen ' + esc(m.lastSeen || '?') + ' · ' + m.posts + ' posts">' + esc(m.name)
      + '<span class="x">' + esc(m.joinedRaw || m.joined) + (m.known ? '' : ' · NEW') + '</span></span>').join('') + '</div>'
      + '<div class="barnote">The oldest dated roster we have. These join dates come from the community\\'s original Midnight Mercenarys site member table, saved by the Wayback Machine. Hover a name for last-seen and post count. NEW means the name shows up nowhere else in the records.</div>';
  } else if (rosterEra === 'recovered') {
    body = '<div class="grid-names">' + DATA.recovered.members.map((m) =>
      '<span class="nchip"' + (m.note ? ' title="' + esc(m.note) + '"' : '') + '>' + esc((m.rank ? m.rank + ' ' : '') + m.name)
      + '<span class="x">' + (m.known ? m.sightings + '×' : 'NEW') + '</span></span>').join('') + '</div>'
      + '<div class="barnote">These names came off scoreboards and kill feeds in old screenshots. Nothing went on the list unless it showed up at least twice. NEW means we had no other record of them. Another '
      + DATA.recovered.othersCount + ' players from other regiments got spotted too; those went into the event records.</div>';
  } else {
    const names = DATA.rosterByEra[rosterEra] || [];
    body = '<div class="grid-names">' + names.map((n) => '<span class="nchip">' + esc(n) + '</span>').join('') + '</div>'
      + '<div class="barnote">this is whoever\\'s on the Steam group roll today. Steam doesn\\'t show join dates, so for dates check the <a href="#/board/enlist" style="color:var(--brass)">Enlistment Office</a></div>';
  }
  const count = rosterEra === 'lifers' ? DATA.lifers.length : rosterEra === 'c2011' ? DATA.class2011.length : rosterEra === 'recovered' ? DATA.recovered.members.length : (DATA.rosterByEra[rosterEra] || []).length;
  return '<div class="wrap solo"><main><div class="module"><div class="mhead"><h3>The Roster</h3><span class="sub">' + count + ' names</span></div>'
    + '<div class="chips">' + chips + '</div>' + body + '</div></main></div>';
}

function eventsView() {
  const years = []; for (let y = 2011; y <= 2020; y++) years.push(String(y));
  const max = Math.max(...Object.values(DATA.eventsByYear));
  const bars = years.map((y) => { const v = DATA.eventsByYear[y] || 0;
    const um = (y === '2019' || y === '2014') && v === 0;
    return '<div class="bar' + (um ? ' um' : '') + '"><div class="v">' + (um ? '·' : v) + '</div><div class="col" style="height:' + (um ? 14 : Math.max(2, Math.round((v / max) * 170))) + 'px"></div><div class="y">' + y.slice(2) + '</div></div>'; }).join('');
  return '<div class="wrap solo"><main><div class="module"><div class="mhead"><h3>Events by Year</h3><span class="sub">' + DATA.totals.events + ' event calls on record</span></div>'
    + '<div class="bars">' + bars + '</div>'
    + '<div class="barnote"><b>2014:</b> no event calls or intakes are on record for that year. <b>2019:</b> shows empty because the community ran on FACEIT, ESEA, Twitch and Discord that year, and this feed only counts Steam announcements.</div>'
    + '</div></main></div>';
}

// ------------------------------------------------------------------- render
function render() {
  const [v, p1, p2] = route();
  renderNav(v);
  const el = $('view');
  if (v === 'home') el.innerHTML = homeView();
  else if (v === 'forums') el.innerHTML = forumsView();
  else if (v === 'board') el.innerHTML = p1 === 'parade' ? paradeView() : p1 === 'barracks' ? barracksView() : p1 === 'enlist' ? enlistView() : archiveView();
  else if (v === 'thread') el.innerHTML = p1 === 'ann' ? annThread(p2) : p1 === 'intake' ? enlistView(p2) : forumsView();
  else if (v === 'servers') el.innerHTML = serversView();
  else if (v === 'history') el.innerHTML = historyView();
  else if (v === 'roster') el.innerHTML = rosterView();
  else if (v === 'media') el.innerHTML = archiveView();
  else if (v === 'events') el.innerHTML = eventsView();
  else el.innerHTML = homeView();
  wire(el);
  window.scrollTo(0, 0);
}

function wire(el) {
  el.querySelectorAll('[data-board]').forEach((r) => r.onclick = () => go('board/' + r.dataset.board));
  el.querySelectorAll('[data-thread]').forEach((r) => r.onclick = () => go('thread/' + r.dataset.thread));
  el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.dataset.go));
  el.querySelectorAll('[data-era]').forEach((b) => b.onclick = () => go('history'));
  el.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { paradeFilter = b.dataset.filter; paradePage = 0; render(); });
  el.querySelectorAll('[data-rera]').forEach((b) => b.onclick = () => { rosterEra = b.dataset.rera; render(); });
  el.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => {
    const [key, op] = b.dataset.pg.split(':');
    const pool = key === 'parade' ? DATA.anns.filter((a) => paradeFilter === 'all' || a.g === paradeFilter).length : DATA.forumPosts.length;
    const pages = Math.max(1, Math.ceil(pool / 20));
    let pg = key === 'parade' ? paradePage : barracksPage;
    pg = op === 'first' ? 0 : op === 'prev' ? Math.max(0, pg - 1) : op === 'next' ? Math.min(pages - 1, pg + 1) : pages - 1;
    if (key === 'parade') paradePage = pg; else barracksPage = pg;
    render();
  });
  const si2 = el.querySelector('#signin2');
  if (si2) si2.onclick = () => { signedIn = true; renderAuth(); render(); };
  const sg = el.querySelector('#shoutgo'), sin = el.querySelector('#shoutin');
  if (sg && sin) {
    const send = () => { const m = sin.value.trim(); if (!m) return;
      const now = new Date(); const t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      shouts.push({ t, n: 'RiveRcs', of: true, m }); if (shouts.length > 30) shouts.shift();
      render(); const log = $('shoutlog'); if (log) log.scrollTop = log.scrollHeight; };
    sg.onclick = send;
    sin.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }
  const log = $('shoutlog'); if (log) log.scrollTop = log.scrollHeight;
}

window.addEventListener('hashchange', render);
renderAuth();
render();
</script>`;

writeFileSync('coldstream-site-preview.html', html);
console.log('Wrote coldstream-site-preview.html (' + (html.length / 1024).toFixed(1) + ' KB)');
console.log('  anns ' + DATA.anns.length + ' | forum posts ' + DATA.forumPosts.length + ' | intakes ' + DATA.intakes.length + ' | videos ' + DATA.videos.length + ' | lifers ' + DATA.lifers.length);
