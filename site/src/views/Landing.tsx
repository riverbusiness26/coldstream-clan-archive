// The front door, and nothing but the front: the community's own battle
// footage runs full screen, the mark and the name sit over it, and one
// button leads inside. Every statistic that used to live here moved to
// The Archive, where numbers belong.
//
// The player double buffers a curated three film sequence: the next film
// starts hidden a few seconds early, crossfades in, and only then is the
// old one unmounted, so there is never a black flash or a spinner. On
// machines with reduced motion set (Windows animation settings off), the
// video still plays: it is the page. Only the cycling and the fades are
// dropped there, so one steady film loops instead.
import { useEffect, useState } from 'react';
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';

const SEGMENTS = [
  // Friday LB Highlights: skip the smoke intro, hold the opening volley while
  // the kill feed fills, and hand over on the film's own scene cut at 0:40.
  { id: '8AU7hzl8w5M', start: 18, dur: 22 },
  // RWL Week 1 vs 3eVolt, the centrepiece, cut to River's spec: opens on
  // the video's own fade from black at 4:12, the column walking up on their
  // backs, the volley, the rout, ending on the "won the round!" banner.
  { id: 'gS2xlbD6b4k', start: 252, dur: 82 },
  // After Hours, July 2020: the Planetside 2 era, the TR squad staged in
  // the red glow before the night op. River asked for this one in the loop.
  { id: 'vOk5eMxv7Dc', start: 5, dur: 25 },
  // vs the 8th Regiment of Foot, October 2012: close quarters in the trees.
  { id: 'OnesY-EczqY', start: 45, dur: 35 },
];
const PRELOAD_S = 7;
const FADE_MS = 1400;

const segSrc = (seg: { id: string; start: number; dur: number }, loop: boolean) =>
  `https://www.youtube-nocookie.com/embed/${seg.id}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&start=${seg.start}` +
  (loop ? `&loop=1&playlist=${seg.id}` : `&end=${seg.start + seg.dur + 30}`);

export default function Landing({ go }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
  const [bgReady, setBgReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const [nextUp, setNextUp] = useState<number | null>(null);
  const [live, setLive] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Reduced motion machines run the same sequence; the CSS drops the
    // crossfade there so swaps are clean cuts, and no film ever reaches
    // its own end card.
    const seg = SEGMENTS[current];
    const t1 = setTimeout(() => setNextUp((current + 1) % SEGMENTS.length), (seg.dur - PRELOAD_S) * 1000);
    const t2 = setTimeout(() => setLive((current + 1) % SEGMENTS.length), seg.dur * 1000);
    const t3 = setTimeout(() => {
      setCurrent((current + 1) % SEGMENTS.length);
      setNextUp(null);
    }, seg.dur * 1000 + FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [current, nonce]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setNextUp(null);
        setNonce((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const slots: { seg: number; on: boolean }[] = [{ seg: current, on: true }];
  if (nextUp !== null) slots.push({ seg: nextUp, on: live === nextUp });

  return (
    <div className="land">
      <section className="land-hero cinema">
        <div className={`land-video${bgReady ? ' ready' : ''}`} aria-hidden="true">
          <img className="fallback" src={asset('/hero-fallback.jpg')} alt="" />
          {slots.map((slot) => (
            <iframe
              key={`${slot.seg}-${nonce}`}
              className={(slot.seg === current ? bgReady : slot.on) ? 'ready' : ''}
              src={segSrc(SEGMENTS[slot.seg], false)}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              title=""
              // 4.3s: outlasts the title overlay YouTube paints on the first
              // seconds of every embed, so the footage fades in clean.
              onLoad={slot.seg === current && !bgReady ? () => setTimeout(() => setBgReady(true), 4300) : undefined}
            />
          ))}
        </div>
        <div className="land-scrim" />
        <div className="land-lockup">
          <img className="land-logo" src={asset('/logo.png?v=2')} alt="" />
          <h1>COLDSTREAM GAMING</h1>
          <div className="land-est">EST. 2011</div>
          <div className="land-motto">The games changed. We did not.</div>
          <button className="btn primary land-enter" onClick={() => go('home')}>Enter the Site</button>
        </div>
      </section>
    </div>
  );
}
