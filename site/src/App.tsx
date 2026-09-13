// Site shell and hash routing.
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useAuth } from './lib/auth';
import Home from './views/Home';
import SiteShell from './components/SiteShell';
import Join from './views/Join';
import { AUTH_HASH, canonicalRoute, routeFromLocation, requiresMember, isStaff } from './lib/routing';
import { asset } from './lib/asset';
import Landing from './views/Landing';
import Gallery from './views/Gallery';
import Servers from './views/Servers';
const Archive = lazy(() => import('./views/Archive'));
const Calendar = lazy(() => import('./views/Calendar'));
const Leaderboard = lazy(() => import('./views/Leaderboard'));
const Admin = lazy(() => import('./views/Admin'));
const PlayerProfileMock = lazy(() => import('./views/PlayerProfileMock'));
const ProfileDesigns = lazy(() => import('./views/ProfileDesigns'));
const ArtworkReview = lazy(() => import('./views/ArtworkReview'));
const Profile = lazy(() => import('./views/Profile'));
const Economy = lazy(() => import('./views/Economy'));
const Roster = lazy(() => import('./components/Roster'));

// Routing is by hash, and coming back from authentication the session arrives in the
// hash too: Supabase hands back "#access_token=...&refresh_token=...". Without
// this the app would try to route to a view called "access_token=..." and land
// the user on a blank page the moment they signed in. The client reads those
// tokens and clears them itself, so all this has to do is not treat them as a
// route. An error handed back the same way is worth landing on Home for.

// The view is the first segment only. Anything after it belongs to the view:
// the gallery uses "#/gallery/<media id>" so a single picture can be linked,
// shared and reopened, and without this that whole URL would be read as the
// name of a view nobody has ever heard of and land on nothing.
function routeFromHash(): string {
  return routeFromLocation(location.hash, location.pathname);
}

// Whether this page load began with authentication handing back a session, or an
// error, in the fragment. It has to be read once at load, before anything
// else touches the URL: supabase-js consumes those tokens and then clears
// the fragment itself, and the empty fragment it leaves behind is
// indistinguishable from somebody arriving at the site cold.
const CAME_FROM_AUTH = AUTH_HASH.test(location.hash);
const AUTH_RETURN = sessionStorage.getItem('coldstream-auth-return') || '#/home';

export default function App() {
  const { me, signIn, signOut, refresh, demo, orphanSession, authReady, accessDenied } = useAuth();

  // Feedback the moment the session lands or the sign in fails.
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
      setToast({ kind: 'ok', text: 'Signed in through Discord as ' + me.display_name });
    }
    if (!me) wasMe.current = false;
  }, [me]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('login') === 'failed') {
      setToast({ kind: 'err', text: 'Discord sign in did not complete. Try again.', ms: 6000 });
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
    // Supabase reports its own failures in the fragment instead. Left alone
    // they tell the member nothing and stay stuck in the address bar.
    const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
    const err = frag.get('error_description') || frag.get('error_code') || frag.get('error');
    if (err) {
      awaitingHashCleanup.current = false;
      setToast({ kind: 'err', text: 'Discord sign in did not complete: ' + err.replace(/\+/g, ' '), ms: 8000 });
      history.replaceState(null, '', location.pathname + location.search + '#/home');
    }
  }, []);
  // A live session with no member row behind it. Say so, rather than showing
  // a signed-in person the guest view and no explanation.
  useEffect(() => {
    if (!orphanSession) return;
    setToast({ kind: 'err', text: 'Signed in through Discord, but your member record did not save. Try signing in again.', ms: 9000 });
  }, [orphanSession]);
  useEffect(() => {
    if (!accessDenied) return;
    setToast({ kind: 'err', text: 'Member access is required. Join us on Discord or contact staff if you should have access.', ms: 9000 });
  }, [accessDenied]);
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
        history.replaceState(null, '', location.pathname + location.search + AUTH_RETURN);
        setView(AUTH_RETURN.replace(/^#\/?/, '').split('/')[0] || 'home');
        sessionStorage.removeItem('coldstream-auth-return');
        return;
      }
      setView(routeFromHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v: string) => { location.hash = '#/' + v; window.scrollTo(0, 0); };


  // Keep old media links and new aliases on the same gallery deep-link contract.
  useEffect(() => {
    if (AUTH_HASH.test(location.hash)) return;
    const raw = location.hash.replace(/^#\/?/, '');
    const canonical = canonicalRoute(raw || location.pathname);
    if ((!raw || canonical !== raw) && canonical !== 'landing') {
      history.replaceState(null, '', location.pathname + location.search + '#/' + canonical);
      setView(routeFromHash());
    }
  }, [view]);

  useEffect(() => {
    if (authReady && me && (view === 'landing' || view === 'login')) go('home');
  }, [authReady, me, view]);

  useEffect(() => {
    const names: Record<string, string> = { landing: 'Second to none', home: 'Weekly brief', events: 'Events', leaderboard: 'Leaderboard', archive: 'Our History', gallery: 'Media', roster: 'Historical roster', profile: 'Service record', stores: "Quartermaster's Stores", admin: 'Staff command', join: 'Join', 'design/profile': 'Profile design review' };
    document.title = (names[view] || 'The record') + ' | Coldstream Gaming';
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [view]);

  const artworkReview = import.meta.env.DEV && demo && view === 'design/artwork';
  const locked = !me && requiresMember(view);
  const known = ['landing', 'home', 'members', 'gallery', 'events', 'leaderboard', 'servers', 'archive', 'admin', 'profile', 'stores', 'roster', 'join', 'login', 'progress'].includes(view) || view.startsWith('member/') || demo && view === 'design/profile';
  return <SiteShell me={me} signIn={signIn} signOut={signOut} view={view} demo={demo}>
    {toast && <div className={'toast ' + toast.kind} role="status" onClick={() => setToast(null)}>{toast.text}</div>}
    {!authReady ? <div className="hq-loading" role="status"><img src={asset('/crest.webp')} width="64" height="65" alt="" /><p>Opening the Coldstream.</p></div>
      : locked || view === 'login' ? <AccessGate view={view} signIn={signIn} />
      : <Suspense fallback={<div className="hq-loading" role="status">Opening the record.</div>}>
        {view === 'landing' && <Landing me={me} go={go} signIn={signIn} preview={demo} />}
        {view === 'home' && <Home me={me} go={go} signIn={signIn} signOut={signOut} embedded />}
        {view === 'join' && <Join signIn={signIn} />}
        {(view === 'archive' || view === 'members') && <Archive me={me} />}
        {view === 'servers' && <Servers />}
        {view === 'events' && <Calendar me={me} />}
        {view === 'leaderboard' && <Leaderboard me={me} />}
        {view === 'admin' && (isStaff(me?.role) ? <Admin me={me} signOut={signOut} /> : <div className="hq-access"><p className="hq-eyebrow">Staff command</p><h1>Staff access required.</h1><p>This area is for Discord-authorised admins and moderators.</p><a className="hq-button" href="#/home">Return to headquarters</a></div>)}
        {view === 'profile' && <PlayerProfileMock me={me} signIn={signIn} refresh={refresh} />}
        {view === 'stores' && me && <Economy demo={demo} />}
        {demo && view === 'design/profile' && <ProfileDesigns me={me} />}
        {artworkReview && <ArtworkReview />}
        {view.startsWith('member/') && <Profile personKey={decodeURIComponent(view.slice(7))} me={me} go={go} />}
        {view === 'gallery' && <Gallery me={me} signIn={signIn} />}
        {view === 'roster' && <main className="hq-roster wrap solo"><header className="page-head"><p className="cg-eyebrow">The names in the record</p><h1>Historical roster.</h1><p className="page-sub">Find a name, a game or the years recorded in our archive.</p></header><Roster /></main>}
        {view === 'progress' && <main className="hq-access"><p className="hq-eyebrow">Community work</p><h1>The progress board.</h1><a className="hq-button" href="/progress/">Open the progress board</a></main>}
        {!known && !artworkReview && <main className="hq-access"><p className="hq-eyebrow">Off the map</p><h1>This page is not in the record.</h1><a className="hq-button" href={me ? '#/home' : '#/landing'}>Return to the Coldstream</a></main>}
      </Suspense>}
  </SiteShell>;
}

function AccessGate({ view, signIn }: { view: string; signIn: () => void }) {
  const label: Record<string, string> = { home: 'Your weekly brief', events: 'The calendar', leaderboard: 'The leaderboard', profile: 'Your service record', stores: "Quartermaster's Stores", admin: 'Staff command', roster: 'The roster' };
  return <main className="hq-access"><img src={asset('/crest.webp')} width="140" height="143" alt="Coldstream crest" /><p className="hq-eyebrow">{label[view] || 'Member headquarters'}</p><h1>Your place<br />in the Coldstream.</h1><p>Sign in with Discord to see your rank, statistics, weekly brief and events.</p><button className="hq-button primary" onClick={signIn}>Continue with Discord</button><a className="hq-text-link" href="#/join">New here? Join the community →</a></main>;
}
