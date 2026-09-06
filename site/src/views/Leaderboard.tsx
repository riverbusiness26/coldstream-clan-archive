import { useState } from 'react';
import { people } from '../lib/data';
import type { Me } from '../lib/auth';

const MODES = ['Overall', 'Public Servers Stats', 'Event Stats', 'Competitive Stats', 'Attendance'] as const;
const labels = ['MVPs', 'Kills', 'K/D', 'Attendance'] as const;
export default function Leaderboard({ me: _me }: { me: Me | null }) {
  const [mode, setMode] = useState<typeof MODES[number]>('Overall');
  const rows = people.slice(0, 10);
  return <div className="wrap solo leaderboard-page"><main>
    <div className="page-head"><p className="cg-eyebrow">Community standing</p><h1>Leaderboard</h1><p className="page-sub">Top Coldstream players, based on the records connected to this site.</p></div>
    <section className="module leaderboard-module"><div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">{MODES.map(item => <button type="button" key={item} className={mode===item?'active':''} onClick={() => setMode(item)}>{item}</button>)}</div><p className="note">{mode} rankings will populate when the Discord stat tracker is connected.</p><div className="leaderboard-podium">{rows.slice(0,3).map((p,i)=><a href={`#/member/${encodeURIComponent(p.key)}`} className={`leader-card place-${i+1}`} key={p.key}><span className="leader-place">{i+1}</span><b>{p.name}</b><small>Pending stats</small></a>)}</div><div className="leader-table">{rows.slice(3).map((p,i)=><a href={`#/member/${encodeURIComponent(p.key)}`} className="leader-row" key={p.key}><span>{i+4}</span><b>{p.name}</b>{labels.map(label=><span key={label}><strong>—</strong><small>{label}</small></span>)}</a>)}</div></section>
  </main></div>;
}
