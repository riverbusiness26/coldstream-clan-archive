// The front page: hero, real news from our old sites, chat room, stats,
// server strip. A noticeboard, not a marketing page.
import { news, people, eventStats, servers, GAME_NAMES } from '../lib/data';
import Shoutbox from '../components/Shoutbox';
import type { Me } from '../lib/auth';

export default function Home({ me, go }: { me: Me | null; go: (v: string) => void }) {
  const totalEvents = eventStats.reduce((n, e) => n + e.events, 0);
  const latest = news.filter((n) => n.body && n.body.trim()).slice(-4).reverse();

  return (
    <>
      <section className="hero">
        <img className="bg" src="/banner.jpg" alt="" />
        <div className="scrim" />
        <div className="in">
          <p>
            Welcome home. We've been at this since 2011, muskets to retakes and
            everything in between. Sign in, find your name, pull up a chair in
            the chat room.
          </p>
          <div className="cta">
            <button className="btn primary" onClick={() => go('members')}>The Roster</button>
            <button className="btn" onClick={() => go('servers')}>Servers</button>
            <button className="btn" onClick={() => go('archive')}>The Archive</button>
          </div>
        </div>
      </section>
      <div className="wrap">
        <main>
          <div className="module">
            <div className="mhead"><h3>News</h3><span className="sub">real posts from our own sites, oldest surviving to newest</span></div>
            {latest.length === 0 && (
              <div className="note">News seeding in progress: genuine posts from the old community sites land here.</div>
            )}
            {latest.map((n, i) => (
              <article className="post" key={i}>
                <h4>{n.title}</h4>
                <div className="meta">
                  {n.author ? <>posted by <b>{n.author}</b></> : 'community post'}
                  {n.date ? ` · ${n.date.slice(0, 10)}` : ''}
                  <span className="prov">from {n.site ?? 'a community site'} (archived capture)</span>
                </div>
                <p>{n.body.length > 400 ? n.body.slice(0, 400) + '…' : n.body}{n.truncated ? ' [capture ends here]' : ''}</p>
              </article>
            ))}
          </div>
          <div className="module">
            <div className="mhead"><h3>Servers</h3><span className="sub">what we'll be running</span></div>
            <div className="srv-grid">
              {servers.map((s) => (
                <div className="srv" key={s.server_key}>
                  <div className="srv-top">
                    <span className="srv-game"><span className="gtag">{s.game}</span>{GAME_NAMES[s.game] ?? s.game}</span>
                    <span className={'pill' + (s.online ? ' live' : '')}>{s.online ? `${s.players}/${s.max_players}` : 'SOON'}</span>
                  </div>
                  <div className="srv-name">{s.name}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
        <aside>
          <Shoutbox me={me} />
          <div className="module">
            <div className="mhead"><h3>The Numbers</h3></div>
            <div className="stats">
              <div className="stat"><div className="n">{people.length}</div><div className="l">members on the roll</div></div>
              <div className="stat"><div className="n">{totalEvents}</div><div className="l">events on record</div></div>
              <div className="stat"><div className="n">2011</div><div className="l">established</div></div>
              <div className="stat"><div className="n">15</div><div className="l">years running</div></div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
