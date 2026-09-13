import '../shilling-coin.css';
import { useEffect, useId, useRef, useState } from 'react';
import type { CoinControls } from '../lib/shillingScene';

const artwork = `${import.meta.env.BASE_URL}quartermaster/shilling-refined-heritage-v3.webp`;

export default function ShillingCoin() {
  const surface = useRef<HTMLDivElement>(null);
  const controls = useRef<CoinControls | null>(null);
  const [ready, setReady] = useState(false);
  const helpId = useId();

  useEffect(() => {
    let live = true;
    // Keep the normal image while the optional renderer loads or if it fails.
    import('../lib/shillingScene').then(({ createCoinScene }) => {
      if (!live || !surface.current) return;
      controls.current = createCoinScene(surface.current, artwork,
        () => { if (live) setReady(true); },
        () => { if (live) setReady(false); });
    }).catch(() => { if (live) setReady(false); });
    return () => { live = false; controls.current?.dispose(); controls.current = null; };
  }, []);

  return <div className={`qm-interactive-coin${ready ? ' is-ready' : ''}`}>
    <div ref={surface} className="qm-coin-viewer" role="group"
      aria-label={ready ? 'Interactive gold Shilling. Use arrow keys to rotate and Home to reset.' : 'Gold Shilling with the Coldstream crest and Second to None motto'}
      aria-describedby={ready ? helpId : undefined} tabIndex={ready ? 0 : undefined}>
      <img className="qm-coin-fallback" src={artwork} width="960" height="960" alt="" draggable={false} />
    </div>
    {ready && <div className="qm-coin-tools"><span id={helpId}>Drag or swipe to turn</span><button type="button" onClick={() => controls.current?.reset()} aria-label="Reset coin view">Reset</button></div>}
  </div>;
}
