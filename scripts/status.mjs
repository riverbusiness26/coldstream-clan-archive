// Ground truth, in one command: node scripts/status.mjs
//
// Why this exists. On 21 Aug two agents each wrote a "current state" section
// into HANDOFF.md and both were stale within hours: one said no Steam sign in
// had ever completed, which stopped being true about an hour later, and the
// other inherited that claim and had to correct it. A log records what was
// true when it was written. This asks the live systems instead.
//
// Run it at the start of a session, and again before writing any sentence
// that begins "currently" or "right now". No secrets: it uses the
// publishable key out of site/.env, which is public by design and already
// ships inside the browser bundle.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://coldstreamgaming.com';
const FNS = 'https://zcpbpcktinlqnxmqddzc.supabase.co/functions/v1';
const API = 'https://zcpbpcktinlqnxmqddzc.supabase.co/rest/v1';
const GH = 'https://api.github.com/repos/riverbusiness26/coldstream-clan-archive';

function anonKey() {
  const p = join(ROOT, 'site', '.env');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/VITE_SUPABASE_ANON_KEY=(.+)/);
  return m ? m[1].trim() : null;
}

const ok = (s) => `  OK    ${s}`;
const bad = (s) => `  CHECK ${s}`;
// For things this script genuinely could not determine, as opposed to things
// it determined to be wrong. Silence used to mean both, which is how the
// nightly backup sat unset while every line on screen read OK.
const note = (s) => `  NOTE  ${s}`;

// Which checkout am I. A second clone of this repo sat at the old pre-move
// path for a day carrying its own HANDOFF, its own claims and its own copy
// of this script, all of them confidently out of date. Path matching would
// break the next time River moves the folder, and he already has once, so
// this asks the checkout what it contains and what the remote has moved on
// to instead.
async function checkoutState() {
  const out = [];

  // ONBOARDING.md was deleted on 23 Aug and PROJECT.md replaced it. A tree
  // holding the old pair predates that and its briefing files are lying.
  if (!existsSync(join(ROOT, 'PROJECT.md')) || existsSync(join(ROOT, 'ONBOARDING.md'))) {
    out.push(bad('this checkout predates PROJECT.md, its briefing files are stale, run git pull --rebase before trusting anything in them'));
  } else {
    out.push(ok('briefing files are the current PROJECT.md set'));
  }

  let head = null;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    out.push(note('not a git checkout, cannot compare against the remote'));
    return out;
  }

  try {
    const res = await fetch(`${GH}/commits?per_page=1`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      out.push(note(`GitHub answered ${res.status}, cannot tell if this checkout is behind`));
      return out;
    }
    const [latest] = await res.json();
    if (!latest?.sha) {
      out.push(note('GitHub returned no commit, cannot tell if this checkout is behind'));
      return out;
    }
    if (latest.sha === head) {
      out.push(ok(`up to date with the remote at ${head.slice(0, 7)}`));
      return out;
    }
    // Ahead and behind are not the same problem and must not read the same.
    // Unpushed local work is normal mid-session. A tree that is behind is the
    // stale-clone failure this section exists to catch.
    let ahead = false;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', latest.sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
      ahead = true;
    } catch { /* remote commit is not an ancestor, so this tree is behind or diverged */ }
    if (ahead) {
      const n = execFileSync('git', ['rev-list', '--count', `${latest.sha}..HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim();
      out.push(note(`${n} local commit${n === '1' ? '' : 's'} not pushed yet, remote is at ${latest.sha.slice(0, 7)}`));
    } else {
      out.push(bad(`checkout is at ${head.slice(0, 7)}, remote has moved to ${latest.sha.slice(0, 7)}, run git pull --rebase before trusting this tree`));
    }
  } catch (e) {
    out.push(note(`could not reach GitHub: ${e.message}`));
  }
  return out;
}

// Every workflow, not just the backup.
//
// Three separate things were broken here in two days while every visible
// surface looked fine: the backup had failed 59 times, the docs described a
// workflow that did not exist, and the server status poller had been dead for
// a day. Each time the answer was one API call away and nobody made it. The
// first version of this section asked only about the backup, which is exactly
// the mistake that let the poller sit broken, so it asks about all of them
// now. Adding a workflow to .github/workflows is enough, there is no list
// here to keep in step.
const GH_HEADERS = { Accept: 'application/vnd.github+json' };

// A schedule that quietly stops firing is its own failure, distinct from a
// run that fails, and neither shows up anywhere a person looks.
//
// This is not a general cron parser and does not try to be. It reads the step
// syntax in the minute, hour and day fields, which is every shape this repo
// actually uses, and falls back to daily. The tolerance is deliberately
// generous: GitHub drops scheduled runs under load, especially frequent ones,
// so complaining at the first missed slot would cry wolf. The whole value of
// this script is that CHECK always means something, and the first version of
// this function called supabase-keepalive stalled because it read '17 6 */3'
// as daily when it runs every third day.
function expectedGapHours(cron) {
  const f = cron.trim().split(/\s+/);
  if (f.length < 5) return 26;
  const step = (s) => Number(s.match(/^\*\/(\d+)$/)?.[1]) || null;
  const [minute, hour, dayOfMonth] = f;
  if (step(minute)) return Math.max(0.5, (step(minute) / 60) * 6);
  if (step(hour)) return step(hour) * 3;
  if (step(dayOfMonth)) return step(dayOfMonth) * 24 + 6;
  return 26; // daily, with a couple of hours of slack for a busy queue
}

function cronOf(workflowPath) {
  const p = join(ROOT, workflowPath);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8').match(/cron:\s*'([^']+)'/)?.[1] ?? null;
}

async function workflowState() {
  let workflows;
  try {
    const res = await fetch(`${GH}/actions/workflows?per_page=100`, { headers: GH_HEADERS });
    if (!res.ok) return [note(`GitHub answered ${res.status}, workflow health unknown`)];
    workflows = (await res.json()).workflows ?? [];
  } catch (e) {
    return [note(`could not reach GitHub: ${e.message}`)];
  }

  // Skip GitHub's own generated ones, Pages and the like. They are not in the
  // repo, we cannot fix them here, and listing them buries ours.
  const ours = workflows.filter((w) => w.path.startsWith('.github/workflows/'));
  if (!ours.length) return [note('no workflows found in this repository')];

  const lines = await Promise.all(ours.map(async (w) => {
    const file = w.path.replace('.github/workflows/', '');
    try {
      if (w.state !== 'active') {
        // disabled_inactivity is GitHub switching off scheduled workflows in
        // a quiet repo. It looks identical to everything being fine.
        return bad(`${file} is ${w.state}, it is not running at all`);
      }
      const res = await fetch(`${GH}/actions/workflows/${file}/runs?per_page=1`, { headers: GH_HEADERS });
      if (!res.ok) return note(`${file}: GitHub answered ${res.status}`);
      const body = await res.json();
      const last = (body.workflow_runs ?? [])[0];
      if (!last) return note(`${file} has never run`);

      const ageHours = (Date.now() - new Date(last.updated_at).getTime()) / 3600000;
      const age = ageHours < 1 ? `${Math.round(ageHours * 60)}m ago` : `${Math.round(ageHours)}h ago`;
      const cron = cronOf(w.path);

      // A run still going has no conclusion yet, which is not a failure. The
      // first version called a queued run red, which is the cry wolf problem
      // this whole section is supposed to avoid.
      if (last.status !== 'completed') {
        return note(`${file} is ${last.status} right now, started ${age}`);
      }

      if (last.conclusion !== 'success') {
        // A count of successes matters more than the latest result. The
        // backup showed green nowhere and red nowhere, it just never ran
        // successfully, and only the total made that legible.
        const okRes = await fetch(`${GH}/actions/workflows/${file}/runs?status=success&per_page=1`, { headers: GH_HEADERS });
        const okBody = okRes.ok ? await okRes.json() : null;
        const wins = okBody?.total_count ?? null;
        const lastWin = okBody?.workflow_runs?.[0]?.updated_at;
        const history = wins === null ? ''
          : wins === 0 ? `, and has NEVER succeeded in ${body.total_count} runs`
          : `, last success was ${lastWin}`;
        const stakes = file === 'backup-database.yml' ? ' THE ARCHIVE IS NOT BACKED UP.' : '';
        return bad(`${file} last run ${last.conclusion ?? last.status} ${age}${history}.${stakes}`);
      }

      if (cron && ageHours > expectedGapHours(cron)) {
        return bad(`${file} last succeeded ${age} but its schedule is '${cron}', so the cron has stopped firing`);
      }
      return ok(`${file} succeeded ${age}${cron ? `, on '${cron}'` : ''}`);
    } catch (e) {
      return note(`${file}: ${e.message}`);
    }
  }));

  // Kept next to the workflow lines rather than in its own section, because
  // the green tick above is genuinely all we can see from here. The export
  // pushes to a separate private repository, since this one is public and
  // writing member identifiers or unapproved uploads here would turn a backup
  // into a data leak. DURABILITY.md claimed backup/ in this repo for a while
  // and it was wrong.
  lines.push(note('the backup lands in the private BACKUP_REPOSITORY, which this script cannot see. Read latest/_manifest.json there for row counts'));
  return lines;
}

async function siteState() {
  const out = [];
  try {
    const res = await fetch(SITE, { redirect: 'follow' });
    const html = await res.text();
    // Underscore belongs in this class. Vite hashes with a base64url alphabet,
    // so roughly half of all builds produce one, and without it this reported
    // "none found" as an OK line: the one check that proves the domain is
    // serving anything at all, quietly passing while telling you nothing.
    // Found by index-DQ_scNV2.js on 29 Aug.
    const bundle = html.match(/index-[A-Za-z0-9_-]+\.js/)?.[0];
    out.push(bundle
      ? ok(`domain serves ${bundle}`)
      : bad('domain served no bundle reference, so the root may be a stale or partial index.html'));
    out.push(html.includes('location.hostname')
      ? ok('www to apex guard present')
      : bad('www to apex guard MISSING, sessions will split across origins'));
  } catch (e) {
    out.push(bad(`domain unreachable: ${e.message}`));
  }
  return out;
}

// Sign in, since 4 Sep 2026: Discord is the identity and Steam is a link on a
// member row that already exists. This section used to check steam-auth alone,
// back when Steam was the way in.
//
// Each function is asked with no Authorization header, the way a signed out
// browser would. For the two that require a member, 401 is the healthy answer:
// the gateway refused before the function ran. 403 is the function's own "only
// accepts the Coldstream site" reply, which is only reachable if the gateway
// let an unauthenticated request through, so it means Verify JWT is off. That
// distinction is the whole reason this asks without a token: a curl carrying a
// key looks fine either way.
async function authState(key) {
  const out = [];

  for (const name of ['discord-member-sync', 'steam-link']) {
    try {
      const res = await fetch(`${FNS}/${name}`, { method: 'POST', redirect: 'manual' });
      if (res.status === 401) out.push(ok(`${name} is deployed and refuses an unsigned request`));
      else if (res.status === 404) out.push(bad(`${name} is not deployed`));
      else if (res.status === 403) out.push(bad(`${name} answered 403 with no token: Verify JWT is off`));
      else out.push(bad(`${name} returned ${res.status}`));
    } catch (e) {
      out.push(bad(`${name} unreachable: ${e.message}`));
    }
  }

  // steam-auth is the old Steam sign in. Nothing on the site has referenced it
  // since 4 Sep, and it should be taken out of service, because it does not
  // sign anybody in: it mints a fresh auth user and a fresh member row, which
  // is how one person ended up with two.
  //
  // How bad that is depends on whether 0030 has run, so this asks the database
  // before deciding. Before the merge a stray Steam sign in makes a duplicate,
  // which is untidy and already the state we are in. After it, the Steam ID
  // sits on the Discord row, so steam-auth finds that row and overwrites the
  // member's Discord name and avatar with their Steam persona, then fails at
  // the magic link because 0030 deleted the account it points at. Reporting
  // both of those as the same red line would be crying wolf for a fortnight.
  let merged = null;
  if (key) {
    try {
      const res = await fetch(`${API}/member?select=discord_id,steam_id64`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const rows = await res.json();
      if (Array.isArray(rows)) merged = !rows.some((r) => r.steam_id64 && !r.discord_id);
    } catch { /* leave it unknown rather than guessing */ }
  }

  try {
    const res = await fetch(`${FNS}/steam-auth`, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    const live = res.status === 302 && loc.includes('steamcommunity.com');
    if (res.status === 404) {
      out.push(ok('steam-auth is retired'));
    } else if (live && merged === true) {
      out.push(bad('steam-auth still redirects to Steam after the 0030 merge: a Steam sign in would now overwrite the member name and avatar, then fail. Retire it'));
    } else if (live && merged === false) {
      out.push(note('steam-auth still redirects to Steam. Harmless until 0030 runs, and must be retired in the same pass'));
    } else if (live) {
      out.push(note('steam-auth still redirects to Steam, and the merge state could not be read'));
    } else {
      out.push(bad(`steam-auth returned ${res.status}, which is neither retired nor working`));
    }
  } catch (e) {
    out.push(bad(`steam-auth unreachable: ${e.message}`));
  }

  return out;
}

async function dbState(key) {
  const out = [];
  if (!key) return [bad('site/.env not found, skipping database checks')];
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const res = await fetch(`${API}/member?select=display_name,role&order=created_at.desc`, { headers: h });
    const rows = await res.json();
    if (Array.isArray(rows)) {
      out.push(ok(`member table: ${rows.length} row${rows.length === 1 ? '' : 's'}`
        + (rows.length ? ` (${rows.slice(0, 5).map((r) => `${r.display_name}/${r.role}`).join(', ')})` : ', nobody has signed in yet')));
    } else {
      out.push(bad(`member read failed: ${JSON.stringify(rows).slice(0, 120)}`));
    }
  } catch (e) {
    out.push(bad(`member read threw: ${e.message}`));
  }
  // Tables the site depends on. A missing one means a page is quietly dead,
  // which is how the Join page's post path went unnoticed.
  for (const t of ['enlistment', 'gallery_item', 'event', 'shout', 'steam_group']) {
    try {
      const res = await fetch(`${API}/${t}?select=*&limit=1`, { headers: h });
      out.push(res.ok ? ok(`table ${t} exists`) : bad(`table ${t}: ${res.status}, migration not applied`));
    } catch {
      out.push(bad(`table ${t}: unreachable`));
    }
  }
  return out;
}

const sections = await Promise.all([
  checkoutState(), siteState(), authState(anonKey()), dbState(anonKey()), workflowState(),
]);
console.log('\nColdstream Gaming, live state\n');
// Checkout goes first on purpose: if this tree is stale, every other line
// below is being read out of the wrong repository.
console.log('Checkout');
sections[0].forEach((l) => console.log(l));
console.log('\nSite');
sections[1].forEach((l) => console.log(l));
console.log('\nSign in');
sections[2].forEach((l) => console.log(l));
console.log('\nDatabase');
sections[3].forEach((l) => console.log(l));
console.log('\nWorkflows');
sections[4].forEach((l) => console.log(l));
console.log('\nCHECK is a real finding, not a warning to ignore. NOTE means this');
console.log('script could not determine the answer, so go and find it yourself.\n');
