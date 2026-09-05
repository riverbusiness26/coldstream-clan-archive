// Site shell and hash routing.
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useAuth } from './lib/auth';
import Home, { AccountStrip, SiteFooter, SiteNav } from './views/Home';
import Landing from './views/Landing';
import Gallery from './views/Gallery';
const Archive = lazy(() => import('./views/Archive'));
const Profile = lazy(() => import('./views/Profile'));
const Admin = lazy(() => import('./views/Admin'));
const PlayerProfileMock = lazy(() => import('./views/PlayerProfileMock'));

// Routing is by hash, and coming back from authentication the session arrives in the
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


  if (view === 'landing' || !authReady || !me) {
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
        <Home me={me} go={go} signIn={signIn} signOut={signOut} />
        {toast && <div className={'toast ' + toast.kind}>{toast.text}</div>}
      </>
    );
  }

  return (
    <div className="cg-home cg-site">
      {demo && <div className="devbadge">DEMO BUILD · NO BACKEND YET</div>}
      {toast && (
        <div className={'toast ' + toast.kind} onClick={() => setToast(null)}
          role="status" title="Click to dismiss">{toast.text}</div>
      )}
      <SiteNav active={view === 'gallery' ? 'Media' : view === 'player-profile' ? 'Community' : view === 'archive' || view === 'members' || view.startsWith('member/') ? 'Our History' : ''} />

      <AccountStrip me={me} signIn={signIn} signOut={signOut} />

      <div className="cg-page-stage">
      {!['home','members','gallery','events','servers','archive','admin','player-profile'].includes(view) && !view.startsWith('member/') && <Home me={me} go={go} signIn={signIn} signOut={signOut} />}
      <Suspense fallback={<div className="wrap solo"><main><div className="module"><div className="note">Opening the record room.</div></div></main></div>}>
      {view.startsWith('member/') && <Profile personKey={decodeURIComponent(view.slice(7))} me={me} go={go} />}
      {/* The roster moved into the Archive; old #/members links still land there. */}
      {(view === 'archive' || view === 'members' || view === 'events') && <Archive me={me} />}
      {view === 'admin' && <Admin me={me} signOut={signOut} />}
      {view === 'player-profile' && <PlayerProfileMock me={me} signIn={signIn} refresh={refresh} />}
      </Suspense>
      {view === 'gallery' && <Gallery me={me} signIn={signIn} />}
      </div>

      <SiteFooter />
    </div>
  );
}
