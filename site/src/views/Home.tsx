// The front page: hero, real news from our old sites, chat room, stats,
// server strip. A noticeboard, not a marketing page.
import { useEffect, useState } from 'react';
import { news, people, eventStats, servers, GAME_NAMES } from '../lib/data';
import eventRecord from '../seed/event-record.json';
import { supa } from '../lib/supa';

interface Up { id: string; title: string; game: string | null; starts_at: string }
const DEMO_EVENTS_KEY = 'csg-demo-events-v1';

// The next event, front and centre: the thing the reference communities all
// surface first. Falls back to the record's most recent event so the module
// is never an empty box.
function NextEvent({ go }: { go: (v: string) => void }) {
  const [up, setUp] = useState<Up | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const load = async () => {
      if (!supa) {
        try {
          const all = JSON.parse(localStorage.getItem(DEMO_EVENTS_KEY) || '[]') as Up[];
          const next = all.filter((e) => new Date(e.starts_at).getTime() > Date.now())
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
          setUp(next);
        } catch { setUp(null); }
        return;
      }
      const { data } = await supa.from('event').select('id, title, game, starts_at')
        .gte('starts_at', new Date().toISOString()).order('starts_at').limit(1);
      setUp((data && data[0]) as Up ?? null);
    };
    load();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  void tick;
  const rec = eventRecord as { date: string; title: string; game: string }[];
  const lastPast = rec[rec.length - 1];
  if (!up) {
    return (
      <div className="module nextev">
        <div className="mhead"><h3>Next Event</h3><span className="sub">posted by admins and moderators</span></div>
        <div className="nextev-in">
          <div className="nextev-title">Nothing on the board yet</div>
          <div className="meta">The record's last dated event: <span className="gtag">{lastPast.game}</span>{lastPast.title} · {lastPast.date}</div>
          <button className="btn sm" onClick={() => go('events')}>Open the Events board</button>
        </div>
      </div>
    );
  }
  const ms = new Date(up.starts_at).getTime() - Date.now();
  const d = Math.floor(ms / 86400000), hr = Math.floor((ms % 86400000) / 3600000), mi = Math.floor((ms % 3600000) / 60000);
  const inTxt = ms <= 0 ? 'happening now' : d > 0 ? `in ${d}d ${hr}h` : hr > 0 ? `in ${hr}h ${mi}m` : `in ${mi}m`;
  return (
    <div className="module nextev">
      <div className="mhead"><h3>Next Event</h3><span className="sub">{new Date(up.starts_at).toLocaleString()}</span></div>
      <div className="nextev-in">
        <div className="nextev-title">{up.game && <span className="gtag">{up.game.toUpperCase().slice(0, 5)}</span>}{up.title}</div>
        <div className="nextev-count">{inTxt}</div>
        <button className="btn sm" onClick={() => go('events')}>Details on the Events board</button>
      </div>
    </div>
  );
}
import Shoutbox from '../components/Shoutbox';
import Discord from '../components/Discord';
import type { Me } from '../lib/auth';
import { asset } from '../lib/asset';

export default function Home({ me, go, signIn }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
  const totalEvents = eventStats.reduce((n, e) => n + e.events, 0);
  const latest = news.filter((n) => n.body && n.body.trim()).slice(-4).reverse();

  return (
    <>
      <section className="hero">
        <img className="bg" src={asset('/banner.jpg')} alt="" />
        <div className="scrim" />
        <div className="in">
          <p>
            Welcome home. We've been at this since 2011, muskets to retakes and
            everything in between. Sign in, find your name, pull up a chair in
            the chat room.
          </p>
          <div className="cta">
            <button className="btn primary" onClick={() => go('archive')}>The Roster</button>
            <button className="btn" onClick={() => go('servers')}>Servers</button>
            <button className="btn" onClick={() => go('archive')}>The Archive</button>
          </div>
        </div>
      </section>
      <div className="wrap">
        <main>
          <NextEvent go={go} />
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
          <Shoutbox me={me} signIn={signIn} />
          <Discord />
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
