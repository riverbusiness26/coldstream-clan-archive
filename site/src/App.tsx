// Site shell: masthead, the Enjin era module set in the nav, hash routing.
import { useEffect, useState } from 'react';
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
  ['enlist', 'Enlist Here', true],
  ['events', 'Events', true],
  ['servers', 'Servers', true],
  ['archive', 'The Archive', true],
];

const steamSvg = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="#9db6d8" strokeWidth="1.6" />
    <circle cx="15.4" cy="8.6" r="3" fill="#9db6d8" />
    <circle cx="8.2" cy="15.6" r="2.2" stroke="#9db6d8" strokeWidth="1.6" />
    <path d="M10.2 14.2 13.4 10.6" stroke="#9db6d8" strokeWidth="1.6" />
  </svg>
);

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
      </>
    );
  }

  return (
    <>
      {demo && <div className="devbadge">DEMO BUILD · NO BACKEND YET</div>}
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
              {me.avatar_url && <img src={me.avatar_url} alt="" />}
              signed in as <b>{me.display_name}</b>
              <button className="btn" onClick={signOut}>Sign out</button>
            </span>
          ) : (
            <button className="steam-btn" onClick={signIn}>{steamSvg}Sign in through Steam</button>
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
          <a href="#/enlist">Enlist Here</a>
        </div>
        <div className="fcol">
          <b>The Record</b>
          <span className="meta">Roster, records and statistics come<br/>from the community archives, every<br/>entry labeled with its source.</span>
        </div>
      </footer>
    </>
  );
}
