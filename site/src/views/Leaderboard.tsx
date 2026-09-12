import { useEffect, useState } from 'react';
import type { Me } from '../lib/auth';
import { supa } from '../lib/supa';
import '../leaderboard-podium.css';

const MODES = ['Overall', 'Public Servers Stats', 'Linebattle Stats', 'Competitive Stats', 'Attendance'] as const;
const labels = ['MVPs', 'Kills', 'K/D', 'Top 5s'] as const;
export default function Leaderboard({ me }: { me: Me | null }) {
  const [mode, setMode] = useState<typeof MODES[number]>('Overall');
  const [period, setPeriod] = useState<'Monthly' | 'All time'>('Monthly');
  const [liveRows, setLiveRows] = useState<{ member_id: string; name: string; discord_id: string | null; kills: number; deaths: number; mvps: number; top5: number; kdr: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setLiveRows([]);
    setLoading(false); setError(false);
    if (!supa || mode === 'Attendance') return;
    let cancelled = false;
    setLoading(true);
    const category = mode === 'Public Servers Stats' ? 'public_server' : mode === 'Linebattle Stats' ? 'public_linebattle' : mode === 'Competitive Stats' ? 'competitive' : null;
    const source = mode === 'Public Servers Stats' && period === 'Monthly' ? 'stat_leaderboard_public_server_month' : 'stat_leaderboard';
    Promise.all([
      supa.from(source).select('member_id,category,kills,deaths,mvps,top5,kdr').then((r) => category ? { ...r, data: (r.data ?? []).filter((row: any) => row.category === category) } : r),
      supa.from('member').select('id,display_name,discord_id'),
    ]).then(([stats, members]) => {
      if (cancelled) return;
      setLoading(false);
      if (stats.error || members.error) { setError(true); return; }
      const names = new Map((members.data ?? []).map((m: any) => [m.id, { name: m.display_name, discord_id: m.discord_id ?? null }]));
      const totals = new Map<string, any>();
      for (const row of (stats.data ?? []) as any[]) {
        const current = totals.get(row.member_id) || { member_id: row.member_id, kills: 0, deaths: 0, mvps: 0, top5: 0 };
        current.kills += Number(row.kills) || 0; current.deaths += Number(row.deaths) || 0; current.mvps += Number(row.mvps) || 0; current.top5 += Number(row.top5) || 0;
        current.kdr = current.deaths ? current.kills / current.deaths : current.kills;
        totals.set(row.member_id, current);
      }
      setLiveRows([...totals.values()].sort((a, b) => b.kills - a.kills || b.kdr - a.kdr || b.top5 - a.top5 || b.mvps - a.mvps).slice(0, 10).map((r) => ({ ...r, name: names.get(r.member_id)?.name || 'Discord member', discord_id: names.get(r.member_id)?.discord_id ?? null })));
    }).catch(() => { if (!cancelled) { setLoading(false); setError(true); } });
    return () => { cancelled = true; };
  }, [mode, period]);
  const rows = liveRows;
  return <div className="wrap solo leaderboard-page"><main>
    <div className="page-head"><p className="cg-eyebrow">Community standing</p><h1>Leaderboard</h1><p className="page-sub">Earned in the field. Ranked by approved kills and K/D, then Top 5s and MVPs.</p></div>
    <section className="module leaderboard-module"><div className="leaderboard-tabs" role="group" aria-label="Leaderboard category">{MODES.map(item => <button type="button" key={item} className={mode===item?'active':''} aria-pressed={mode===item} onClick={() => setMode(item)}>{item}</button>)}</div>{mode === 'Public Servers Stats' && <div className="hq-leader-period" role="group" aria-label="Public server period">{(['Monthly', 'All time'] as const).map(value => <button type="button" className="btn sm" aria-pressed={period === value} key={value} onClick={() => setPeriod(value)}>{value}</button>)}</div>}<p className="note">{liveRows.length ? `${mode} rankings from approved reports.` : `${mode} rankings will appear here after staff approve reports.`}</p>{rows.length ? <><div className="leaderboard-podium">{rows.slice(0,3).map((p,i)=>p.discord_id && me?.id === p.member_id ? <a href="#/profile" className={`leader-card place-${i+1}`} key={p.member_id}><span className="leader-badge" aria-hidden="true" /><span className="leader-place">{i+1}</span><b>{p.name}</b><small>{p.mvps} MVPs · {p.kills} kills · {p.kdr.toFixed(2)} K/D</small></a> : <article className={`leader-card place-${i+1}`} key={p.member_id} aria-label={`${p.name}, profile unavailable`}><span className="leader-badge" aria-hidden="true" /><span className="leader-place">{i+1}</span><b>{p.name}</b><small>{p.mvps} MVPs · {p.kills} kills · {p.kdr.toFixed(2)} K/D</small></article>)}</div><div className="leader-table">{rows.slice(3).map((p,i)=>p.discord_id && me?.id === p.member_id ? <a href="#/profile" className="leader-row" key={p.member_id}><span>{i+4}</span><b>{p.name}</b>{labels.map(label=><span key={label}><strong>{label==='MVPs'?p.mvps:label==='Kills'?p.kills:label==='K/D'?p.kdr.toFixed(2):p.top5}</strong><small>{label}</small></span>)}</a> : <article className="leader-row" key={p.member_id} aria-label={`${p.name}, profile unavailable`}><span>{i+4}</span><b>{p.name}</b>{labels.map(label=><span key={label}><strong>{label==='MVPs'?p.mvps:label==='Kills'?p.kills:label==='K/D'?p.kdr.toFixed(2):p.top5}</strong><small>{label}</small></span>)}</article>)}</div></> : <div className="command-empty" role="status">{loading ? 'Opening the approved results.' : error ? 'The results could not be opened. Try another category or refresh the page.' : mode === 'Attendance' ? 'Attendance rankings are not connected yet. Your recorded voice hours are available in your service record.' : 'No approved statistics are available for this category yet.'}</div>}</section>
  </main></div>;
}
