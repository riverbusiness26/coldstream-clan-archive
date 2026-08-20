// Site shell: masthead, the Enjin era module set in the nav, hash routing.
import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth';
import Home from './views/Home';
import Landing from './views/Landing';
import Members from './views/Members';
import Servers from './views/Servers';
import Archive from './views/Archive';
import Forums from './views/Forums';
import Gallery from './views/Gallery';

const NAV: [string, string, boolean][] = [
  ['home', 'Home', true],
  ['forums', 'Forums', true],
  ['members', 'Members', true],
  ['gallery', 'Gallery', true],
  ['enlist', 'Enlist Here', true],
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

export default function App() {
  const { me, signIn, signOut, demo } = useAuth();
  const [view, setView] = useState(location.hash.replace(/^#\/?/, '') || 'landing');

  useEffect(() => {
    const onHash = () => setView(location.hash.replace(/^#\/?/, '') || 'landing');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v: string) => { location.hash = '#/' + v; window.scrollTo(0, 0); };


  if (view === 'landing') {
    return (
      <>
        {demo && <div className="devbadge">DEMO BUILD · NO BACKEND YET</div>}
        <Landing me={me} go={go} signIn={signIn} />
        <footer>
          <span><b>Coldstream Gaming</b> · est. 2011</span>
          <span>films, screenshots and statistics come from the community archives</span>
        </footer>
      </>
    );
  }

  return (
    <>
      {demo && <div className="devbadge">DEMO BUILD · NO BACKEND YET</div>}
      <div className="estbar"><div className="in">
        <span>EST. <b>2011</b> · GAMING COMMUNITY · 15 YEARS RUNNING</span>
        <span><b>{me ? me.display_name.toUpperCase() : 'GUEST'}</b></span>
      </div></div>
      <header className="mast">
        <div className="in">
          <img className="crest" src="/logo.png?v=2" alt="CSG globe logo" />
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
            <a key={k} href={'#/' + k} className={view === k ? 'on' : undefined}>{label}</a>
          ))}
        </nav>
      </header>

      {view === 'home' && <Home me={me} go={go} />}
      {view === 'members' && <Members me={me} />}
      {view === 'servers' && <Servers />}
      {view === 'archive' && <Archive />}
      {view === 'forums' && <Forums me={me} signIn={signIn} />}
      {view === 'gallery' && <Gallery me={me} signIn={signIn} />}
      {view === 'enlist' && (
        <div className="wrap solo"><main><div className="module">
          <div className="mhead"><h3>Enlist Here</h3></div>
          <div className="note" style={{ fontSize: 13 }}>
            Sign in through Steam and you're in the door. If you've played with
            us before, your record links up on its own. The enlistment board
            for introductions opens with the forums.
          </div>
        </div></main></div>
      )}

      <footer>
        <span><b>Coldstream Gaming</b> · est. 2011</span>
        <span>roster, records and statistics come from the community archives, every entry labeled with its source</span>
      </footer>
    </>
  );
}
