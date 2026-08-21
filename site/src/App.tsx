// Site shell: masthead, the Enjin era module set in the nav, hash routing.
import { useEffect, useState, useRef } from 'react';
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
import Members from './views/Members';
import Profile from './views/Profile';
import Calendar from './views/Calendar';
import Servers from './views/Servers';
import Archive from './views/Archive';
import Gallery from './views/Gallery';
import Enlist from './views/Enlist';
import { asset } from './lib/asset';

const NAV: [string, string, boolean][] = [
  ['home', 'Home', true],
  ['members', 'Members', true],
  ['gallery', 'Gallery', true],
  ['enlist', 'Join', true],
  ['events', 'Events', true],
  ['servers', 'Servers', true],
  ['archive', 'The Archive', true],
];

// Routing is by hash, and coming back from Steam the session arrives in the
// hash too: Supabase hands back "#access_token=...&refresh_token=...". Without
// this the app would try to route to a view called "access_token=..." and land
// the user on a blank page the moment they signed in. The client reads those
// tokens and clears them itself, so all this has to do is not treat them as a
// route. An error handed back the same way is worth landing on Home for.
const AUTH_HASH = /(^|[#&])(access_token|refresh_token|provider_token|error_description|error_code)=/;

function routeFromHash(): string {
  const h = location.hash;
  if (AUTH_HASH.test(h)) return 'home';
  return h.replace(/^#\/?/, '') || 'landing';
}

export default function App() {
  const { me, signIn, signOut, demo } = useAuth();

  // Feedback the moment the session lands or the sign in fails.
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const wasMe = useRef(false);
  useEffect(() => {
    if (me && !wasMe.current) {
      wasMe.current = true;
      setToast({ kind: 'ok', text: 'Signed in through Steam as ' + me.display_name });
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
    if (!me) wasMe.current = false;
  }, [me]);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('login')) {
      setToast({ kind: 'err', text: 'Steam sign in did not complete. Try again.' });
      const t = setTimeout(() => setToast(null), 6000);
      history.replaceState(null, '', location.pathname + location.hash);
      return () => clearTimeout(t);
    }
  }, []);
  const [view, setView] = useState(routeFromHash);

  useEffect(() => {
    const onHash = () => setView(routeFromHash());
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

  return (
    <>
      {demo && <div className="devbadge">DEMO BUILD · NO BACKEND YET</div>}
      {toast && <div className={'toast ' + toast.kind}>{toast.text}</div>}
      <div className="estbar"><div className="in">
        <span>EST. <b>2011</b> · GAMING COMMUNITY · 15 YEARS RUNNING</span>
        <DiscordPulse />
        <span><b>{me ? me.display_name.toUpperCase() : 'GUEST'}</b></span>
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
                    <a href={'https://steamcommunity.com/profiles/' + me.steam_id64} target="_blank" rel="noopener">View Steam profile</a>
                    <button onClick={signOut}>Sign out</button>
                  </span>
                )}
              </span>
            </span>
          ) : (
            <button className="steam-btn compact" onClick={signIn} aria-label="Sign in with Steam">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" /></svg>
              <span>Sign in with Steam</span>
            </button>
          )}
        </div>
        <nav className="main">
          {NAV.map(([k, label]) => (
            <a key={k} href={'#/' + k} className={view === k || (k === 'members' && view.startsWith('member/')) ? 'on' : undefined}>{label}</a>
          ))}
        </nav>
      </header>

      {view === 'home' && <Home me={me} go={go} />}
      {!['home','members','gallery','enlist','events','servers','archive'].includes(view) && !view.startsWith('member/') && <Home me={me} go={go} />}
      {view === 'members' && <Members me={me} />}
      {view.startsWith('member/') && <Profile personKey={decodeURIComponent(view.slice(7))} me={me} go={go} />}
      {view === 'events' && <Calendar me={me} />}
      {view === 'servers' && <Servers />}
      {view === 'archive' && <Archive />}
      {view === 'gallery' && <Gallery me={me} signIn={signIn} />}
      {view === 'enlist' && <Enlist me={me} signIn={signIn} />}

      <footer className="bigfoot">
        <div className="fcol">
          <b>Coldstream Gaming</b>
          <span className="meta">A gaming community, est. 2011.<br/>Fifteen years of battles, servers<br/>and names worth remembering.</span>
        </div>
        <div className="fcol">
          <b>Site</b>
          <a href="#/members">The Roster</a>
          <a href="#/gallery">Gallery</a>
          <a href="#/events">Events</a>
          <a href="#/archive">The Archive</a>
        </div>
        <div className="fcol">
          <b>Community</b>
          <a href="https://discord.gg/75sfq5VPY" target="_blank" rel="noopener">Discord</a>
          <a href="https://steamcommunity.com/groups/coldstreamgaming" target="_blank" rel="noopener">Steam Group</a>
          <a href="#/servers">Game Servers</a>
          <a href="#/enlist">Join</a>
        </div>
        <div className="fcol">
          <b>The Record</b>
          <span className="meta">Roster, records and statistics come<br/>from the community archives, every<br/>entry labeled with its source.<br/><br/>Powered by Steam. Not associated<br/>with Valve Corp.</span>
        </div>
      </footer>
    </>
  );
}
