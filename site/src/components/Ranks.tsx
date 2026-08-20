// The rank ladder, from the regiment's own insignia.
//
// Twelve ranks in the three tiers the regiment used, with the actual badges
// off its site rather than anything drawn for this page. Collapsed by default
// so it sits above the roster without pushing it down the screen.
import { useState } from 'react';
import ranksSeed from '../seed/ranks.json';
import { asset } from '../lib/asset';

interface Rank {
  abbr: string;
  name: string;
  tier: string;
  src: string;
  w: number;
  h: number;
  source: string;
}

const RANKS = ranksSeed as Rank[];
const TIERS = ['Officers', 'Non-Commissioned Officers', 'Enlisted'];

export default function Ranks({ held }: { held?: Set<string> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="module">
      <div className="mhead">
        <h3>The Ranks</h3>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : `Show all ${RANKS.length}`}
        </button>
      </div>
      {!open && (
        <div className="note">
          The regiment ran twelve ranks, from Recruit to Lieutenant Colonel.
          These are its own insignia, recovered from the old site.
        </div>
      )}
      {open && (
        <>
          {TIERS.map((tier) => {
            const rows = RANKS.filter((r) => r.tier === tier);
            if (rows.length === 0) return null;
            return (
              <div className="rank-tier" key={tier}>
                <div className="rank-tier-name">{tier}</div>
                <div className="rank-row">
                  {rows.map((r) => (
                    <figure className={'rank' + (held?.has(r.name) ? ' held' : '')} key={r.abbr}>
                      <img src={asset(r.src)} alt={`${r.name} insignia`} width={r.w} height={r.h} />
                      <figcaption>
                        <span className="rank-abbr">{r.abbr}</span>
                        <span className="rank-name">{r.name}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="note">
            Colonel is not on the ladder because no insignia for it survives in
            the archive, and drawing one would make it something other than a
            record. River held it.
            <span className="prov">
              source: rank insignia from the regiment's own site, recovered from
              Photobucket
            </span>
          </div>
        </>
      )}
    </div>
  );
}
