import { useEffect, useState } from 'react';
import type { Me } from '../lib/auth';
import { supa } from '../lib/supa';

const MODES = ['Overall', 'Public Servers Stats', 'Event Stats', 'Competitive Stats', 'Attendance'] as const;
const labels = ['MVPs', 'Kills', 'K/D', 'Attendance'] as const;
export default function Leaderboard({ me: _me }: { me: Me | null }) {
  const [mode, setMode] = useState<typeof MODES[number]>('Overall');
  const [liveRows, setLiveRows] = useState<{ member_id: string; name: string; kills: number; deaths: number; mvps: number; top5: number; kdr: number }[]>([]);
  useEffect(() => {
    setLiveRows([]);
    if (!supa || mode === 'Attendance' || mode === 'Event Stats') return;
    const category = mode === 'Public Servers Stats' ? 'public_server' : mode === 'Competitive Stats' ? 'competitive' : null;
    Promise.all([
      supa.from('stat_leaderboard').select('member_id,category,kills,deaths,mvps,top5,kdr').then((r) => category ? { ...r, data: (r.data ?? []).filter((row: any) => row.category === category) } : r),
      supa.from('member').select('id,display_name'),
    ]).then(([stats, members]) => {
      const names = new Map((members.data ?? []).map((m: any) => [m.id, m.display_name]));
      const totals = new Map<string, any>();
      for (const row of (stats.data ?? []) as any[]) {
        const current = totals.get(row.member_id) || { member_id: row.member_id, kills: 0, deaths: 0, mvps: 0, top5: 0 };
        current.kills += Number(row.kills) || 0; current.deaths += Number(row.deaths) || 0; current.mvps += Number(row.mvps) || 0; current.top5 += Number(row.top5) || 0;
        current.kdr = current.deaths ? current.kills / current.deaths : current.kills;
        totals.set(row.member_id, current);
      }
      setLiveRows([...totals.values()].sort((a, b) => b.kdr - a.kdr || b.kills - a.kills).slice(0, 10).map((r) => ({ ...r, name: names.get(r.member_id) || 'Discord member' })));
    });
  }, [mode]);
  const rows = liveRows;
  return <div className="wrap solo leaderboard-page"><main>
    <div className="page-head"><p className="cg-eyebrow">Community standing</p><h1>Leaderboard</h1><p className="page-sub">Top Coldstream players, based on the records connected to this site.</p></div>
    <section className="module leaderboard-module"><div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">{MODES.map(item => <button type="button" key={item} className={mode===item?'active':''} onClick={() => setMode(item)}>{item}</button>)}</div><p className="note">{liveRows.length ? `${mode} rankings from approved reports.` : `${mode} rankings will appear here after staff approve reports.`}</p>{rows.length ? <><div className="leaderboard-podium">{rows.slice(0,3).map((p,i)=><a href={`#/member/${encodeURIComponent(p.member_id)}`} className={`leader-card place-${i+1}`} key={p.member_id}><span className="leader-place">{i+1}</span><b>{p.name}</b><small>{p.mvps} MVPs · {p.kills} kills · {p.kdr.toFixed(2)} K/D</small></a>)}</div><div className="leader-table">{rows.slice(3).map((p,i)=><a href={`#/member/${encodeURIComponent(p.member_id)}`} className="leader-row" key={p.member_id}><span>{i+4}</span><b>{p.name}</b>{labels.map(label=><span key={label}><strong>{label==='MVPs'?p.mvps:label==='Kills'?p.kills:label==='K/D'?p.kdr.toFixed(2):p.top5}</strong><small>{label}</small></span>)}</a>)}</div></> : <div className="command-empty">No approved statistics are available for this category yet.</div>}</section>
  </main></div>;
}
