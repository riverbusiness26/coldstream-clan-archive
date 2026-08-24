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
const FN = 'https://zcpbpcktinlqnxmqddzc.supabase.co/functions/v1/steam-auth';
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

// The archive is the one thing here that cannot be recollected if lost, and
// the backup workflow existing is not the same as the backup running. It
// needs the SUPABASE_SERVICE_ROLE_KEY repository secret, which no script can
// read, so this checks the only thing that proves the secret is set: whether
// a run has ever actually succeeded.
async function backupState() {
  const out = [];
  try {
    const res = await fetch(`${GH}/actions/workflows/backup-database.yml/runs?per_page=1`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      out.push(note(`GitHub answered ${res.status}, backup state unknown`));
      return out;
    }
    const all = await res.json();
    const runs = all.workflow_runs ?? [];
    if (!runs.length) {
      out.push(bad('nightly backup has never run, the SUPABASE_SERVICE_ROLE_KEY repository secret is almost certainly still unset'));
      return out;
    }
    // A green last run is not enough. This workflow failed 59 times in a row
    // without anyone noticing, because nothing ever asked it how it went, so
    // the count that matters is how many times it has ever actually worked.
    const okRes = await fetch(`${GH}/actions/workflows/backup-database.yml/runs?status=success&per_page=1`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    const wins = okRes.ok ? (await okRes.json()).total_count : null;
    if (wins === 0) {
      out.push(bad(`nightly backup has run ${all.total_count} times and has NEVER succeeded, last was ${runs[0].conclusion ?? runs[0].status} on ${runs[0].updated_at}. The archive is not backed up.`));
    } else if (runs[0].conclusion === 'success') {
      out.push(ok(`nightly backup last succeeded ${runs[0].updated_at}`));
    } else {
      out.push(bad(`nightly backup last finished as ${runs[0].conclusion ?? runs[0].status} on ${runs[0].updated_at}`
        + (wins === null ? '' : `, ${wins} successful run${wins === 1 ? '' : 's'} in its history`)));
    }
  } catch (e) {
    out.push(note(`could not reach GitHub: ${e.message}`));
  }
  // Deliberately not looking for backup/ in this checkout. The export pushes
  // to a separate private repository, because this one is public and writing
  // member identifiers or unapproved uploads here would turn the backup into
  // a data leak. DURABILITY.md said backup/ for a while and it was wrong.
  out.push(note('the export lands in the private BACKUP_REPOSITORY, which this script cannot see, so a green run above is the only proof it worked'));
  return out;
}

async function siteState() {
  const out = [];
  try {
    const res = await fetch(SITE, { redirect: 'follow' });
    const html = await res.text();
    const bundle = html.match(/index-[A-Za-z0-9-]+\.js/)?.[0] ?? 'none found';
    out.push(ok(`domain serves ${bundle}`));
    out.push(html.includes('location.hostname')
      ? ok('www to apex guard present')
      : bad('www to apex guard MISSING, sessions will split across origins'));
  } catch (e) {
    out.push(bad(`domain unreachable: ${e.message}`));
  }
  return out;
}

async function authState() {
  const out = [];
  try {
    // No auth header, the way a browser asks. 302 to Steam is healthy, 401
    // means Verify JWT came back on and every member is locked out while a
    // curl carrying the anon key still looks fine.
    const res = await fetch(FN, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    if (res.status === 302 && loc.includes('steamcommunity.com')) {
      out.push(ok('steam-auth redirects to Steam'));
      const realm = decodeURIComponent(loc).match(/openid\.realm=([^&]+)/)?.[1];
      if (realm) out.push(ok(`Steam shows the realm as ${realm}`));
    } else if (res.status === 401) {
      out.push(bad('steam-auth returns 401: Verify JWT is ON, sign in is broken for browsers'));
    } else {
      out.push(bad(`steam-auth returned ${res.status}`));
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
  checkoutState(), siteState(), authState(), dbState(anonKey()), backupState(),
]);
console.log('\nColdstream Gaming, live state\n');
// Checkout goes first on purpose: if this tree is stale, every other line
// below is being read out of the wrong repository.
console.log('Checkout');
sections[0].forEach((l) => console.log(l));
console.log('\nSite');
sections[1].forEach((l) => console.log(l));
console.log('\nSteam sign in');
sections[2].forEach((l) => console.log(l));
console.log('\nDatabase');
sections[3].forEach((l) => console.log(l));
console.log('\nBackups');
sections[4].forEach((l) => console.log(l));
console.log('\nCHECK is a real finding, not a warning to ignore. NOTE means this');
console.log('script could not determine the answer, so go and find it yourself.\n');
