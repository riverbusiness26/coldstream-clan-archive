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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://coldstreamgaming.com';
const FN = 'https://zcpbpcktinlqnxmqddzc.supabase.co/functions/v1/steam-auth';
const API = 'https://zcpbpcktinlqnxmqddzc.supabase.co/rest/v1';

function anonKey() {
  const p = join(ROOT, 'site', '.env');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/VITE_SUPABASE_ANON_KEY=(.+)/);
  return m ? m[1].trim() : null;
}

const ok = (s) => `  OK    ${s}`;
const bad = (s) => `  CHECK ${s}`;

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

const sections = await Promise.all([siteState(), authState(), dbState(anonKey())]);
console.log('\nColdstream Gaming, live state\n');
console.log('Site');
sections[0].forEach((l) => console.log(l));
console.log('\nSteam sign in');
sections[1].forEach((l) => console.log(l));
console.log('\nDatabase');
sections[2].forEach((l) => console.log(l));
console.log('\nAnything marked CHECK is a real finding, not a warning to ignore.\n');
