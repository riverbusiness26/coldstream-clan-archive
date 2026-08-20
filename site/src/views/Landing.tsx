// The front door: a cinematic landing page. Most viewed films run muted in
// the background, the history rides up front, then statistics, highlights,
// and the films themselves. Everything on it comes
// from the archives; nothing is stock.
import { useEffect, useRef, useState } from 'react';
import films from '../seed/films.json';
import { people, eventStats } from '../lib/data';
import type { Me } from '../lib/auth';
import { asset } from '../lib/asset';

interface Film { id: string; title: string; views: number; viewsText: string; published: string; channel: string }

const FILMS = films as Film[];
// The hero background: the most watched film in the archive, and the best
// looking footage we have.
const HERO_FILM = FILMS[0];

// Seconds to skip at the head of each background film. These old uploads open
// on smoke, title cards and intro sequences that fight the hero text, so each
// starts once the actual footage does. Tune per video id; anything unlisted
// uses the default.
const BG_START_DEFAULT = 10;
const BG_START_AT: Record<string, number> = {
  '8AU7hzl8w5M': 18, // Friday LB Highlights, opens on a long smoke intro
};
const startAt = (id: string) => BG_START_AT[id] ?? BG_START_DEFAULT;

function useCountUp(target: number, ms = 1200) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setV(target); return; }
    let raf = 0; let started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      started = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, ms]);
  return { v, ref };
}

function Big({ n, label }: { n: number; label: string }) {
  const { v, ref } = useCountUp(n);
  return (
    <div className="land-stat" ref={ref}>
      <div className="n">{v.toLocaleString('en-US')}</div>
      <div className="l">{label}</div>
    </div>
  );
}

const HIGHLIGHTS: { title: string; body: string; tag: string }[] = [
  { tag: 'NW', title: '529 events in one stretch', body: 'The 2nd Coldstream Regiment of Footguards called 529 events between 2012 and 2015, more than every other stretch of the record combined.' },
  { tag: '2012', title: '"Fall in" · 203 times', body: 'The two words that started every event night. Counted across the announcement archive, they are the voice of the community.' },
  { tag: '2012', title: 'Thirty strong in one line', body: '"Very nice to see 30 of us there." One line from an April 2012 battle report, and the reason the roster runs so deep.' },
  { tag: 'CSGO', title: 'ESEA teams and packed retakes', body: 'The community fielded ESEA Open and Intermediate teams and ran retake servers that stayed full, with 10 mans on FACEIT.' },
  { tag: '2011', title: 'Fourteen years on the roll', body: 'Members like Blaboon and Timmy9000 appear in the record year after year since the beginning. Years are what we count here.' },
  { tag: 'NW', title: 'Our own ground since 2012', body: 'The community has run its own servers since 2ndColdstream_TDM in 2012. The next generation is on the Servers page.' },
];

export default function Landing({ me, go, signIn }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
  const [bgReady, setBgReady] = useState(false);
  const totalEvents = eventStats.reduce((n, e) => n + e.events, 0);

  // One film, mounted once. The hero used to rotate through four every 24
  // seconds, but each switch remounted the iframe, which made YouTube reload
  // the player: a black flash, then buffering, every time. A single steady
  // background reads as intentional instead of glitchy, and it is lighter.
  const bg = HERO_FILM;

  return (
    <div className="land">
      <section className="land-hero">
        {/* Loads as a soft blurred field, then pulls into focus once the video
            is genuinely playing. The poster sits underneath so the hero never
            shows a black box while YouTube buffers, and both layers sharpen
            together so the handover is invisible. */}
        <div className={`land-video${bgReady ? ' ready' : ''}`} aria-hidden="true">
          <img className="fallback" src={asset('/hero-fallback.jpg')} alt="" />
          <iframe
            className={bgReady ? 'ready' : ''}
            src={`https://www.youtube-nocookie.com/embed/${bg.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${bg.id}&modestbranding=1&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&start=${startAt(bg.id)}`}
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            title=""
            onLoad={() => setTimeout(() => setBgReady(true), 1900)}
          />
        </div>
        <div className="land-scrim" />
        <div className="land-hero-in">
          <img className="land-logo" src={asset('/logo.png?v=2')} alt="Coldstream Gaming" />
          <h1>COLDSTREAM GAMING</h1>
          <p className="land-sub">A gaming community, est. 2011. Fifteen years of battles, servers and names worth remembering.</p>
          <div className="land-cta">
            <button className="btn primary" onClick={() => go('home')}>Enter the Site</button>
            <button className="btn" onClick={() => go('members')}>The Roster</button>
            {!me && <button className="btn" onClick={signIn}>Sign in through Steam</button>}
          </div>
          <div className="land-nowplaying">background: {bg.title} · {bg.viewsText}</div>
        </div>
      </section>

      <section className="land-band">
        <h2>The Story</h2>
        <div className="land-story">
          <div className="land-era">
            <div className="y">2011</div>
            <h3>21stPA</h3>
            <p>Public linebattles in Battlegrounds 2. A server, a bugle, and the first thirty names on the roll.</p>
          </div>
          <div className="land-era">
            <div className="y">2012</div>
            <h3>2nd Coldstream Regiment of Footguards</h3>
            <p>The regiment years in Mount &amp; Blade: Warband. Rank structure, weekly drills, hundreds of events, and the motto: Second to None.</p>
          </div>
          <div className="land-era">
            <div className="y">Today</div>
            <h3>Coldstream Gaming</h3>
            <p>The same community, every game we feel like playing, and our own servers coming online. Sign in and your history finds you.</p>
          </div>
        </div>
      </section>

      <section className="land-band alt">
        <div className="land-stats">
          <Big n={people.length} label="members on the roll" />
          <Big n={totalEvents} label="events on record" />
          <Big n={FILMS.length} label="films preserved" />
          <Big n={15} label="years running" />
        </div>
      </section>

      <section className="land-band">
        <h2>The Record</h2>
        <div className="land-cards">
          {HIGHLIGHTS.map((h) => (
            <div className="land-card" key={h.title}>
              <span className="gtag">{h.tag}</span>
              <h3>{h.title}</h3>
              <p>{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-band alt">
        <h2>The Films</h2>
        <div className="land-films">
          {FILMS.slice(0, 8).map((f) => (
            <a className="film" key={f.id} href={`https://www.youtube.com/watch?v=${f.id}`} target="_blank" rel="noopener">
              <img src={`https://i.ytimg.com/vi/${f.id}/hqdefault.jpg`} alt="" loading="lazy" />
              <div className="ft">{f.title}</div>
              <div className="fm">{f.viewsText}{f.published ? ` · ${f.published}` : ''}</div>
            </a>
          ))}
        </div>
        <div className="land-more">
          <button className="btn" onClick={() => go('archive')}>Everything else lives in The Archive</button>
        </div>
      </section>

    </div>
  );
}
