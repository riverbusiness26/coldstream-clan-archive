import { useEffect, useState } from 'react';
import { people } from '../lib/data';
import type { Me } from '../lib/auth';
import { supa } from '../lib/supa';

const MODES = ['Overall', 'Public Servers Stats', 'Event Stats', 'Competitive Stats', 'Attendance'] as const;
const labels = ['MVPs', 'Kills', 'K/D', 'Attendance'] as const;
export default function Leaderboard({ me: _me }: { me: Me | null }) {
  const [mode, setMode] = useState<typeof MODES[number]>('Overall');
  const [liveRows, setLiveRows] = useState<{ member_id: string; name: string; kills: number; deaths: number; mvps: number; top5: number; kdr: number }[]>([]);
  useEffect(() => { if (!supa) return; const category = mode === 'Public Servers Stats' ? 'public_server' : mode === 'Competitive Stats' ? 'competitive' : mode === 'Event Stats' ? 'event' : 'public_linebattle'; Promise.all([supa.from('stat_leaderboard').select('member_id,kills,deaths,mvps,top5,kdr').eq('category', category).order('kdr', { ascending: false }).limit(10), supa.from('member').select('id,display_name')]).then(([stats, members]) => { const names = new Map((members.data ?? []).map((m: any) => [m.id, m.display_name])); setLiveRows(((stats.data ?? []) as any[]).map(r => ({ ...r, name: names.get(r.member_id) || 'Discord member' }))); }); }, [mode]);
  const rows = liveRows.length ? liveRows : people.slice(0, 10).map(p => ({ member_id: p.key, name: p.name, kills: 0, deaths: 0, mvps: 0, top5: 0, kdr: 0 }));
  return <div className="wrap solo leaderboard-page"><main>
    <div className="page-head"><p className="cg-eyebrow">Community standing</p><h1>Leaderboard</h1><p className="page-sub">Top Coldstream players, based on the records connected to this site.</p></div>
    <section className="module leaderboard-module"><div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">{MODES.map(item => <button type="button" key={item} className={mode===item?'active':''} onClick={() => setMode(item)}>{item}</button>)}</div><p className="note">{liveRows.length ? `${mode} rankings from approved reports.` : `${mode} rankings will populate when approved reports are available.`}</p><div className="leaderboard-podium">{rows.slice(0,3).map((p,i)=><a href={p.kills ? `#/member/${encodeURIComponent(p.member_id)}` : undefined} className={`leader-card place-${i+1}`} key={p.member_id}><span className="leader-place">{i+1}</span><b>{p.name}</b><small>{p.mvps} MVPs · {p.kills} kills · {p.kdr.toFixed(2)} K/D</small></a>)}</div><div className="leader-table">{rows.slice(3).map((p,i)=><a href={p.kills ? `#/member/${encodeURIComponent(p.member_id)}` : undefined} className="leader-row" key={p.member_id}><span>{i+4}</span><b>{p.name}</b>{labels.map(label=><span key={label}><strong>{label==='MVPs'?p.mvps:label==='Kills'?p.kills:label==='K/D'?p.kdr.toFixed(2):p.top5}</strong><small>{label}</small></span>)}</a>)}</div></section>
  </main></div>;
}
