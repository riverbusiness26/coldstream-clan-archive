// The Archive: the locked room. Statistics and records up front, everything
// labeled with what it is and where it came from. The deep history lives on
// the archive site, linked, never deleted.
import { eventStats } from '../lib/data';

const ARCHIVE_URL = 'https://riverbusiness26.github.io/coldstream-clan-archive/';

export default function Archive() {
  const byYear: Record<number, { total: number; games: Record<string, number> }> = {};
  for (const e of eventStats) {
    const y = (byYear[e.year] ||= { total: 0, games: {} });
    y.total += e.events;
    y.games[e.game] = (y.games[e.game] || 0) + e.events;
  }
  const years: number[] = [];
  for (let y = 2011; y <= 2020; y++) years.push(y);
  const max = Math.max(...Object.values(byYear).map((v) => v.total), 1);

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead"><h3>The Archive</h3><span className="sub">the record room · everything labeled, nothing deleted</span></div>
          <div className="note" style={{ borderBottom: '1px solid var(--line)' }}>
            Fifteen years of the community's records: event statistics, rosters,
            films, and the pages of our old websites. Every item here says what
            it is, where it came from, and when. The full deep archive, including
            every recovered page and forum thread, lives on the{' '}
            <a href={ARCHIVE_URL} target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>archive site</a>.
          </div>
          <div className="mhead"><h3>Events run per year</h3><span className="sub">counted from 1,210 archived Steam announcements · these are statistics, not news</span></div>
          <div className="bars">
            {years.map((y) => {
              const v = byYear[y]?.total ?? 0;
              return (
                <div className="bar" key={y}>
                  <div className="v">{v || '·'}</div>
                  <div className="col" style={{ height: Math.max(2, Math.round((v / max) * 150)) }} />
                  <div className="y">{String(y).slice(2)}</div>
                </div>
              );
            })}
          </div>
          <div className="note">
            <b>2014:</b> no event announcements are on record for that year.{' '}
            <b>2019:</b> shows empty because the community ran on FACEIT, ESEA,
            Twitch and Discord that year, which the announcement feed does not capture.
          </div>
          <div className="mhead"><h3>Events by game</h3></div>
          <div className="note">
            {eventStats
              .reduce((acc: { game: string; events: number }[], e) => {
                const g = acc.find((x) => x.game === e.game);
                if (g) g.events += e.events; else acc.push({ game: e.game, events: e.events });
                return acc;
              }, [])
              .sort((a, b) => b.events - a.events)
              .map((g) => <span key={g.game} style={{ marginRight: 16 }}><span className="gtag">{g.game}</span>{g.events} events</span>)}
          </div>
        </div>
      </main>
    </div>
  );
}
