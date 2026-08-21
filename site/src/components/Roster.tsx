// The roster, now a room in the Archive. Every person in the record since
// 2011: when they were in the group (the span of their dated records), the
// events they called, and the games they played with us. Filterable by year
// and game, provenance one click away, and deliberately not connected to
// Steam sign-in.
import { Fragment, useMemo, useState } from 'react';
import { people, rosterEntries, GAME_NAMES } from '../lib/data';
import statsSeed from '../seed/profile-stats.json';

interface PStats { forumPosts: number; announcements: number; shots: number[] }
const STATS = statsSeed as Record<string, PStats>;

export default function Roster() {
  const [year, setYear] = useState<string>('all');
  const [game, setGame] = useState<string>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const p of people) if (p.firstYear) ys.add(p.firstYear);
    return [...ys].sort();
  }, []);
  const games = useMemo(() => {
    const gs = new Set<string>();
    for (const p of people) p.games.forEach((g) => gs.add(g));
    return [...gs].sort();
  }, []);

  // The span of a person's dated records: the honest answer to "when were
  // they in the group". A single dated year shows as that year alone.
  const spans = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of rosterEntries) {
      if (!e.year) continue;
      const cur = m[e.person_key];
      if (!cur) { m[e.person_key] = `${e.year}:${e.year}`; continue; }
      const [a, b] = cur.split(':').map(Number);
      m[e.person_key] = `${Math.min(a, e.year)}:${Math.max(b, e.year)}`;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(m)) {
      const [a, b] = v.split(':').map(Number);
      out[k] = a === b ? String(a) : `${a} to ${b}`;
    }
    return out;
  }, []);

  const rows = people.filter((p) =>
    (year === 'all' || String(p.firstYear) === year) &&
    (game === 'all' || p.games.includes(game)) &&
    // Searching an old handle should still find the person it belongs to.
    (!q || p.name.toLowerCase().includes(q.toLowerCase())
        || p.aka.some((a) => a.toLowerCase().includes(q.toLowerCase()))),
  );

  return (
    <div className="module">
      <div className="mhead"><h3>The Roster</h3><span className="sub">{rows.length} of {people.length} on the roll since 2011</span></div>
      <div className="chips">
        <button className={'chip' + (year === 'all' ? ' on' : '')} onClick={() => setYear('all')}>All years</button>
        {years.map((y) => (
          <button key={y} className={'chip' + (year === String(y) ? ' on' : '')} onClick={() => setYear(String(y))}>{y}</button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (game === 'all' ? ' on' : '')} onClick={() => setGame('all')}>All games</button>
        {games.map((g) => (
          <button key={g} className={'chip' + (game === g ? ' on' : '')} onClick={() => setGame(g)}>{GAME_NAMES[g] ?? g}</button>
        ))}
        <input
          className="chip" style={{ minWidth: 160 }} placeholder="Search a name"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="tscroll">
        <table className="rtable">
          <thead>
            <tr><th>Member</th><th>In the group</th><th>Rank / class</th><th>Games</th><th>Events called</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const key = p.key;
              const span = spans[key];
              const called = STATS[key]?.announcements ?? 0;
              return (
                <Fragment key={key}>
                  <tr>
                    <td>
                      <a className="rname plink" href={'#/member/' + encodeURIComponent(p.key)}>{p.name}</a>
                      {p.aka.length > 0 && (
                        <div className="raka">also on the record as {p.aka.join(', ')}</div>
                      )}
                    </td>
                    <td className="ryears">{span ?? (p.firstYear ? `since ${p.firstYear}` : 'on the roll')}</td>
                    <td>{(p as { title?: string }).title ? <b className="ptitle">{(p as { title?: string }).title}</b> : (p.rank ?? '')}</td>
                    <td>{p.games.map((g) => <span key={g} className="gtag">{g}</span>)}</td>
                    <td className="ryears">{called || '·'}</td>
                    <td><button className="btn" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => setOpen(open === key ? null : key)}>record</button></td>
                  </tr>
                  {open === key && rosterEntries.filter((e) => e.person_key === key).map((e, i) => (
                    <tr key={key + i}>
                      <td colSpan={6} className="meta" style={{ paddingLeft: 32 }}>
                        <span className="gtag">{e.game}</span>
                        {e.rank_or_class ? `${e.rank_or_class} · ` : ''}{e.year ?? 'undated'}
                        <span className="prov">source: {e.source_detail}{e.notes ? ` (${e.notes})` : ''}</span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="note">
        "In the group" is the span of a member's dated records in the archives.
        Event sign-up sheets did not survive, so attendance cannot be counted;
        "events called" are the ones a member personally posted, which the
        record can prove. Every row's sources are one click away under
        "record", and each name opens the member's own page.
      </div>
    </div>
  );
}
