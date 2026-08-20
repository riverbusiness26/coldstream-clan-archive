// The roster: the centrepiece. Every person in the record since 2011,
// grouped by person, filterable by year and game, with years-with-us as the
// headline figure and provenance one click away.
import { Fragment, useMemo, useState } from 'react';
import { people, rosterEntries, yearsWithUs, GAME_NAMES } from '../lib/data';
import type { Me } from '../lib/auth';
import Ranks from '../components/Ranks';

export default function Members({ me }: { me: Me | null }) {
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

  const rows = people.filter((p) =>
    (year === 'all' || String(p.firstYear) === year) &&
    (game === 'all' || p.games.includes(game)) &&
    // Searching an old handle should still find the person it belongs to.
    (!q || p.name.toLowerCase().includes(q.toLowerCase())
        || p.aka.some((a) => a.toLowerCase().includes(q.toLowerCase()))),
  );

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Ranks somebody on the roster actually held, so the ladder marks them.
  const held = useMemo(() => new Set(people.map((p) => p.rank).filter(Boolean) as string[]), []);

  return (
    <div className="wrap solo">
      <main>
        <Ranks held={held} />
        <div className="module">
          <div className="mhead"><h3>Members</h3><span className="sub">{rows.length} of {people.length} on the roll since 2011</span></div>
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
                <tr><th>Member</th><th>With us</th><th>Rank / class</th><th>Games</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const yrs = yearsWithUs(p.firstYear);
                  // The key comes from the seed rather than being re-derived from
                  // the display name. Where two names have been confirmed as one
                  // person the key is the canonical one, and the entries under it
                  // were filed under a name that is no longer the one on show.
                  const key = p.key;
                  const mine = !!me && (
                    p.steam_id64 === me.steam_id64
                    || norm(me.display_name) === key
                    || p.aka.some((a) => norm(a) === norm(me.display_name))
                  );
                  return (
                    <Fragment key={key}>
                      <tr className={mine ? 'me' : undefined}>
                        <td>
                          <span className="rname">{p.name}</span>
                          {mine && <span className="ryears"> · you</span>}
                          {p.aka.length > 0 && (
                            <div className="raka">also on the record as {p.aka.join(', ')}</div>
                          )}
                        </td>
                        <td className="ryears">{yrs ? `${yrs} years · joined ${p.firstYear}` : 'on the roll'}</td>
                        <td>{p.rank ?? ''}</td>
                        <td>{p.games.map((g) => <span key={g} className="gtag">{g}</span>)}</td>
                        <td><button className="btn" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => setOpen(open === key ? null : key)}>record</button></td>
                      </tr>
                      {open === key && rosterEntries.filter((e) => e.person_key === key).map((e, i) => (
                        <tr key={key + i}>
                          <td colSpan={5} className="meta" style={{ paddingLeft: 32 }}>
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
            Years are counted from a member's earliest dated record in the archives.
            Every row's source is one click away under "record". Sign in through
            Steam and your own history finds you automatically.
          </div>
        </div>
      </main>
    </div>
  );
}
