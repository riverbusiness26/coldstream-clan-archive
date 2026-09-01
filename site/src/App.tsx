// Site shell: masthead, the Enjin era module set in the nav, hash routing.
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useAuth } from './lib/auth';

// The always visible pulse: how many of us are online right now, pinned to
// the status bar the way the big communities pin their player counts.
function DiscordPulse() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let dead = false;
    const load = () => fetch('https://discord.com/api/guilds/669723836165521413/widget.json')
      .then((r) => r.json())
      .then((j) => { if (!dead) setN(j.presence_count ?? null); })
      .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  if (n === null) return <a href="https://discord.gg/75sfq5VPY" target="_blank" rel="noopener" className="pulse">JOIN THE DISCORD</a>;
  return <a href="https://discord.gg/75sfq5VPY" target="_blank" rel="noopener" className="pulse"><span className="pdot" /> <b>{n}</b> ONLINE NOW · JOIN US</a>;
}
import Home from './views/Home';
import Landing from './views/Landing';
import Servers from './views/Servers';
import Gallery from './views/Gallery';
const Archive = lazy(() => import('./views/Archive'));
const Profile = lazy(() => import('./views/Profile'));
const Admin = lazy(() => import('./views/Admin'));
import SteamButton from './components/SteamButton';
import { asset } from './lib/asset';
import steamKeys from './seed/steam-keys.json';

// Where a member's own profile lives. Roster people are addressed by key,
// and anybody who joined since the archive was compiled by Steam id.
const KEYS = steamKeys as Record<string, string>;
const profileHref = (steamId: string) => '#/member/' + (KEYS[steamId] ?? 'steam:' + steamId);

const NAV: [string, string, boolean][] = [
  ['home', 'Home', true],
  ['gallery', 'Gallery', true],
  ['servers', 'Servers', true],
  ['archive', 'Archive', true],
];

// Routing is by hash, and coming back from Steam the session arrives in the
// hash too: Supabase hands back "#access_token=...&refresh_token=...". Without
// this the app would try to route to a view called "access_token=..." and land
// the user on a blank page the moment they signed in. The client reads those
// tokens and clears them itself, so all this has to do is not treat them as a
// route. An error handed back the same way is worth landing on Home for.
const AUTH_HASH = /(^|[#&])(access_token|refresh_token|provider_token|error|error_description|error_code)=/;

// The view is the first segment only. Anything after it belongs to the view:
// the gallery uses "#/gallery/<media id>" so a single picture can be linked,
// shared and reopened, and without this that whole URL would be read as the
// name of a view nobody has ever heard of and land on nothing.
function routeFromHash(): string {
  const h = location.hash;
  if (AUTH_HASH.test(h)) return 'home';
  return h.replace(/^#\/?/, '').split('/')[0] || 'landing';
}

// Whether this page load began with Steam handing back a session, or an
// error, in the fragment. It has to be read once at load, before anything
// else touches the URL: supabase-js consumes those tokens and then clears
// the fragment itself, and the empty fragment it leaves behind is
// indistinguishable from somebody arriving at the site cold.
const CAME_FROM_AUTH = AUTH_HASH.test(location.hash);

export default function App() {
  const { me, signIn, signOut, demo, orphanSession } = useAuth();

  // Feedback the moment the session lands or the sign in fails.
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string; ms?: number } | null>(null);

  // Dismissal belongs to the toast, not to whatever raised it. Keyed on the
  // toast object, so a new message restarts the clock and an unrelated
  // re-render cannot cancel it.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ms ?? 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const authReturn = useRef(CAME_FROM_AUTH);
  const awaitingHashCleanup = useRef(CAME_FROM_AUTH);
  const wasMe = useRef(false);
  useEffect(() => {
    // Only announce a sign in that actually just happened. Announcing it on
    // every page load with a stored session made the toast meaningless.
    if (me && !wasMe.current) {
      wasMe.current = true;
      if (!authReturn.current) return;
      setToast({ kind: 'ok', text: 'Signed in through Steam as ' + me.display_name });
    }
    if (!me) wasMe.current = false;
  }, [me]);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('login')) {
      setToast({ kind: 'err', text: 'Steam sign in did not complete. Try again.', ms: 6000 });
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
    // Supabase reports its own failures in the fragment instead. Left alone
    // they tell the member nothing and stay stuck in the address bar.
    const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
    const err = frag.get('error_description') || frag.get('error_code') || frag.get('error');
    if (err) {
      awaitingHashCleanup.current = false;
      setToast({ kind: 'err', text: 'Steam sign in did not complete: ' + err.replace(/\+/g, ' '), ms: 8000 });
      history.replaceState(null, '', location.pathname + location.search + '#/home');
    }
  }, []);
  // A live session with no member row behind it. Say so, rather than showing
  // a signed-in person the guest view and no explanation.
  useEffect(() => {
    if (!orphanSession) return;
    setToast({ kind: 'err', text: 'Signed in through Steam, but your member record did not save. Try signing in again.', ms: 9000 });
  }, [orphanSession]);
  const [view, setView] = useState(routeFromHash);

  useEffect(() => {
    const onHash = () => {
      // The tokens normally arrive on a fresh page load, but they can also
      // land on a page that is already open, so the flag is set here too
      // rather than only at boot.
      if (AUTH_HASH.test(location.hash)) {
        authReturn.current = true;
        awaitingHashCleanup.current = true;
        setView('home');
        return;
      }
      // supabase-js clears the token fragment the moment it has the session,
      // and that arrives here as a hashchange to an empty hash, which routes
      // to the landing splash. Dumping a member on the video the instant they
      // sign in is the one thing this must not do, so a sign in return is
      // carried through to Home instead.
      if (awaitingHashCleanup.current && !location.hash.replace(/^#\/?/, '')) {
        awaitingHashCleanup.current = false;
        history.replaceState(null, '', location.pathname + location.search + '#/home');
        setView('home');
        return;
      }
      setView(routeFromHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v: string) => { location.hash = '#/' + v; window.scrollTo(0, 0); };


  if (view === 'landing') {
    return (
      <>
        <Landing me={me} go={go} signIn={signIn} />
        {toast && <div className={'toast ' + toast.kind}>{toast.text}</div>}
      </>
    );
  }

  // Home owns its full shell. The supplied direction has a purpose-built
  // navigation bar and footer, so wrapping it in the archive masthead would
  // duplicate both landmarks and break the one-page composition.
  if (view === 'home') {
    return (
      <>
        <Home me={me} go={go} signIn={signIn} />
        {toast && <div className={'toast ' + toast.kind}>{toast.text}</div>}
      </>
    );
  }

  return (
    <>
      {demo && <div className="devbadge">DEMO BUILD · NO BACKEND YET</div>}
      {toast && (
        <div className={'toast ' + toast.kind} onClick={() => setToast(null)}
          role="status" title="Click to dismiss">{toast.text}</div>
      )}
      <div className="estbar"><div className="in">
        <span>EST. <b>2011</b> · GAMING COMMUNITY · 15 YEARS RUNNING</span>
        <DiscordPulse />
      </div></div>
      <header className="mast">
        <div className="in">
          <img className="crest" src={asset('/logo.png?v=2')} alt="CSG globe logo" />
          <div className="wordmark">
            <h1>COLDSTREAM GAMING</h1>
            <p>MULTI-GAMING COMMUNITY · EST. 2011</p>
          </div>
          {me ? (
            <span className="who">
              <span className="acct">
                <button className="acctbtn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
                  {me.avatar_url && <img src={me.avatar_url} alt="" />}
                  <b>{me.display_name}</b>
                  <span className="caret">▾</span>
                </button>
                {menuOpen && (
                  <span className="acctmenu" onClick={() => setMenuOpen(false)}>
                    <span className="acctmenu-head">Signed in through Steam</span>
                    <a href={profileHref(me.steam_id64)}>Visit profile</a>
                    {(me.role === 'moderator' || me.role === 'admin') && (
                      <a href="#/admin">Admin Panel</a>
                    )}
                    <button onClick={signOut}>Sign out</button>
                  </span>
                )}
              </span>
            </span>
          ) : (
            <SteamButton me={me} signIn={signIn} />
          )}
        </div>
        <nav className="main">
          {NAV.map(([k, label]) => (
            <a key={k} href={'#/' + k} className={view === k || (k === 'archive' && (view === 'members' || view.startsWith('member/'))) ? 'on' : undefined}>{label}</a>
          ))}
        </nav>
      </header>

      {!['home','members','gallery','events','servers','archive','admin'].includes(view) && !view.startsWith('member/') && <Home me={me} go={go} signIn={signIn} />}
      <Suspense fallback={<div className="wrap solo"><main><div className="module"><div className="note">Opening the record room.</div></div></main></div>}>
      {view.startsWith('member/') && <Profile personKey={decodeURIComponent(view.slice(7))} me={me} go={go} />}
      {view === 'servers' && <Servers />}
      {/* The roster moved into the Archive; old #/members links still land there. */}
      {(view === 'archive' || view === 'members' || view === 'events') && <Archive me={me} />}
      {view === 'admin' && <Admin me={me} />}
      </Suspense>
      {view === 'gallery' && <Gallery me={me} signIn={signIn} />}

      <footer className="bigfoot">
        <div className="fcol">
          <b>Coldstream Gaming</b>
          <span className="meta">A gaming community, est. 2011.<br/>Fifteen years of battles, servers<br/>and names worth remembering.</span>
        </div>
        <div className="fcol">
          <b>Site</b>
          <a href="#/archive">The Roster</a>
          <a href="#/gallery">Gallery</a>
          <a href="#/archive">Events</a>
          <a href="#/archive">The Archive</a>
        </div>
        <div className="fcol">
          <b>Community</b>
          <a href="https://discord.gg/75sfq5VPY" target="_blank" rel="noopener">Discord</a>
          <a href="https://steamcommunity.com/groups/coldstreamgaming" target="_blank" rel="noopener">Steam Group</a>
          <a href="#/servers">Game Servers</a>
        </div>
        <div className="fcol">
          <b>The Record</b>
          <span className="meta">Roster, records and statistics come<br/>from the community archives, every<br/>entry labeled with its source.<br/><br/>Powered by Steam. Not associated<br/>with Valve Corp.</span>
        </div>
      </footer>
    </>
  );
}
