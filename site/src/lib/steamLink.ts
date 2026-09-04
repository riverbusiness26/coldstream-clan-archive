// Linking a Steam account to a member who is already signed in.
//
// Steam is not a way in to this site. Discord is the identity, and this only
// ever attaches a game identity to a member row that already exists, so that
// the Steam presence tracker and the recovered archive have something to match
// a member against. Nothing here can create an account.
//
// The round trip is a browser navigation, which means the session cannot ride
// along in a header. It does not need to: the browser comes back to the site,
// supabase-js restores the session from storage as it always does, and only
// then is the assertion handed to the function with the member's own token.
// Whoever holds that token is the member the function writes to, so the
// assertion never has to say who it belongs to.
import { supa } from './supa';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

// Steam names the site it is about to return you to, and it takes that name
// from openid.realm, so the realm has to be this origin and return_to has to
// sit underneath it. That is the same reason /steam-return/ exists at all,
// rather than Steam returning straight to the Supabase function: members were
// being told that a supabase.co address was not affiliated with Valve.
const returnTo = () => `${location.origin}/steam-return/?link=1`;

export function beginSteamLink(): void {
  const q = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo(),
    'openid.realm': location.origin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  location.href = `${STEAM_OPENID}?${q}`;
}

// The assertion arrives in the query string rather than the fragment, which is
// what keeps it clear of the hash router and of the Supabase tokens that also
// land in the fragment on a sign in return.
export function pendingSteamAssertion(): string | null {
  const q = location.search.replace(/^\?/, '');
  return q.includes('openid.mode=') ? q : null;
}

// A spent assertion is worth nothing and Steam will refuse it a second time,
// so it comes out of the address bar as soon as it has been read. Without this
// a reload looks like a failed link rather than a finished one.
export function clearSteamAssertion(): void {
  history.replaceState(null, '', location.pathname + location.hash);
}

interface LinkResult { ok: boolean; steam_id64?: string | null; error?: string }

async function call(body: Record<string, unknown>): Promise<LinkResult> {
  if (!supa) return { ok: false, error: 'Steam linking needs the live site.' };
  const { data, error } = await supa.functions.invoke('steam-link', { body });
  // A non 2xx reply carries the reason in its body, and invoke reports it only
  // as "non-2xx status", so the useful sentence has to be read back out.
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json() as LinkResult;
        if (parsed?.error) return { ok: false, error: parsed.error };
      } catch { /* fall through to the generic message */ }
    }
    return { ok: false, error: 'Steam linking did not complete. Try again.' };
  }
  return (data ?? { ok: false, error: 'Steam linking returned nothing.' }) as LinkResult;
}

export const completeSteamLink = (params: string) => call({ params });
export const unlinkSteam = () => call({ action: 'unlink' });
