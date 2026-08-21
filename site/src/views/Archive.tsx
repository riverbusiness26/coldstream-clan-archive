// The Archive: the record room. The eras up front, because the eras are the
// spine of the whole thing, then the statistics they produced. Everything
// here says what it is, where it came from, and when. The deep archive, every
// recovered page and forum thread, lives on the archive site and is linked,
// never folded in and never deleted.
import { useState } from 'react';
import { eventStats, people } from '../lib/data';
import erasSeed from '../seed/eras.json';
import filmsSeed from '../seed/films.json';

interface Film {
  id: string;
  title: string;
  views: number;
  viewsText: string;
  published: string;
  channel: string;
  channelUrl: string;
}

const FILMS = filmsSeed as Film[];
const CHANNELS = [...new Set(FILMS.map((f) => f.channel))];

interface Era {
  slug: string;
  name: string;
  label: string;
  game: string;
  note: string;
  founded: string;
  foundedIso: string | null;
  members: number;
  namedMembers: number;
  announcements: number;
  events: number;
  first: string | null;
  last: string | null;
  byYear: Record<string, number>;
  topAuthors: { name: string; n: number }[];
}

const { eras, totals } = erasSeed as unknown as {
  eras: Era[];
  totals: { announcements: number; events: number };
};

// The deep archive page, now a sibling of the site rather than its root.
const ARCHIVE_URL = '/lineage/';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Spans are only ever as precise as the archive that produced them, which
// records months reliably and days only sometimes. Month and year it is.
function span(first: string | null, last: string | null) {
  if (!first) return 'no announcements on record';
  const at = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
  return first === last ? at(first) : `${at(first)} to ${at(last!)}`;
}


// ---- migrated from the landing page (River: the landing is video only now;
// the numbers belong here in the record room).
interface RibEra { slug: string; label: string; foundedIso: string | null; events: number }
const ERAS = (erasSeed as unknown as { eras: RibEra[] }).eras;
const PEAK = Math.max(...ERAS.map((e) => e.events), 1);

const HONOURS: { fig: string; name: string; body: string }[] = [
  { fig: '139,456', name: 'views on one thread',
    body: 'The recruitment thread ran fifty nine pages over three and a half years, and a hundred and thirty nine thousand people looked in.' },
  { fig: '276', name: 'events in one stretch',
    body: 'Called by the 2nd Coldstream between 2012 and 2015, three quarters of every event the record holds.' },
  { fig: 'ESEA', name: 'Open and Intermediate',
    body: 'Two teams fielded in CS:GO, retake servers that stayed full, and 10 mans running on FACEIT.' },
  { fig: 'RoaR', name: 'a skin in the Steam Workshop',
    body: 'A creator built a USP, named it for the org, and handed it over.' },
  { fig: '384', name: 'names on the roll',
    body: 'Everyone the record remembers since 2011, each one traceable to the source it came from.' },
  { fig: '2012', name: 'our own ground ever since',
    body: '2ndColdstream_TDM was the first server. There has been one running under our name in some form ever since.' },
];

export default function Archive() {
  const [openEra, setOpenEra] = useState<string | null>(null);

  const byYear: Record<number, number> = {};
  for (const e of eventStats) byYear[e.year] = (byYear[e.year] ?? 0) + e.events;
  const years: number[] = [];
  for (let y = 2011; y <= 2020; y++) years.push(y);
  const max = Math.max(...Object.values(byYear), 1);

  const byGame = eventStats
    .reduce((acc: { game: string; events: number }[], e) => {
      const g = acc.find((x) => x.game === e.game);
      if (g) g.events += e.events; else acc.push({ game: e.game, events: e.events });
      return acc;
    }, [])
    .sort((a, b) => b.events - a.events);

  const peak = Math.max(...eras.map((e) => e.events), 1);

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead"><h3>The Numbers</h3><span className="sub">the community, counted</span></div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div className="stat"><div className="n">{people.length}</div><div className="l">members on the roll</div></div>
            <div className="stat"><div className="n">{eventStats.reduce((n, e) => n + e.events, 0)}</div><div className="l">events on record</div></div>
            <div className="stat"><div className="n">{FILMS.length}</div><div className="l">films preserved</div></div>
            <div className="stat"><div className="n">15</div><div className="l">years running</div></div>
          </div>
        </div>

        <div className="module">
          <div className="mhead"><h3>Fifteen Years</h3><span className="sub">bars are events called, from 1,210 archived announcements</span></div>
          <div className="land-eras" style={{ padding: '18px 16px' }}>
            {ERAS.map((e) => (
              <div className="lera" key={'rib-' + e.slug}>
                <div className="lera-bar">
                  <span style={{ height: `${Math.max(3, Math.round((e.events / PEAK) * 100))}%` }} />
                </div>
                <div className="lera-n">{e.events || '·'}</div>
                <div className="lera-year">{e.foundedIso ? e.foundedIso.slice(0, 4) : ''}</div>
                <div className="lera-name">{e.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="module">
          <div className="mhead"><h3>Honours</h3><span className="sub">every figure checkable against the record</span></div>
          <div className="land-honours" style={{ padding: 16 }}>
            {HONOURS.map((h) => (
              <div className="honour" key={h.name}>
                <div className="hfig">{h.fig}</div>
                <div className="hname">{h.name}</div>
                <p>{h.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>The Archive</h3>
            <span className="sub">the record room · everything labeled, nothing deleted</span>
          </div>
          <div className="note">
            Fifteen years of the community's records: the eras, the event
            statistics, the rosters, the films, and the pages of our old sites.
            Every item says what it is, where it came from, and when. The full
            deep archive, including every recovered page and forum thread, lives
            on the{' '}
            <a href={ARCHIVE_URL} target="_blank" rel="noopener" className="ilink">archive site</a>.
          </div>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>The Eras</h3>
            <span className="sub">{eras.length} on record, April 2011 to now</span>
          </div>
          <div className="note">
            Counted from {totals.announcements.toLocaleString('en-US')} archived
            Steam announcements across every group we have ever run. Open an era
            for its numbers and the people who called the events.
          </div>
          <ol className="eras">
            {eras.map((e) => {
              const open = openEra === e.slug;
              return (
                <li className={'era' + (open ? ' open' : '')} key={e.slug}>
                  <button className="era-head" onClick={() => setOpenEra(open ? null : e.slug)}
                    aria-expanded={open}>
                    <span className="era-year">{e.foundedIso?.slice(0, 4) ?? '·'}</span>
                    <span className="era-mid">
                      <span className="era-name">{e.label}</span>
                      {e.game && <span className="era-game">{e.game}</span>}
                    </span>
                    <span className="era-bar" aria-hidden="true">
                      <span className="era-fill" style={{ width: `${Math.round((e.events / peak) * 100)}%` }} />
                    </span>
                    <span className="era-events">
                      {e.events ? `${e.events} ${e.events === 1 ? 'event' : 'events'}` : 'no events counted'}
                    </span>
                  </button>
                  {open && (
                    <div className="era-body">
                      <p className="era-note">{e.note}</p>
                      <dl className="era-facts">
                        <div><dt>Founded</dt><dd>{e.founded}</dd></div>
                        <div><dt>Announcements</dt><dd>{span(e.first, e.last)}</dd></div>
                        <div><dt>On the group</dt><dd>{e.members} members, {e.namedMembers} named</dd></div>
                        <div><dt>Posts archived</dt><dd>{e.announcements.toLocaleString('en-US')}</dd></div>
                        <div><dt>Events called</dt><dd>{e.events}</dd></div>
                      </dl>
                      {e.topAuthors.length > 0 && (
                        <div className="era-who">
                          <b>Who posted</b>{' '}
                          {e.topAuthors.map((a) => `${a.name} (${a.n})`).join(', ')}
                        </div>
                      )}
                      {Object.keys(e.byYear).length > 0 && (
                        <div className="era-who">
                          <b>Events by year</b>{' '}
                          {Object.entries(e.byYear).map(([y, n]) => `${y}: ${n}`).join(' · ')}
                        </div>
                      )}
                      <div className="era-prov">
                        source: Steam group <span className="mono">{e.slug}</span>, announcement archive
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>Events run per year</h3>
            <span className="sub">these are statistics, not news</span>
          </div>
          <div className="bars">
            {years.map((y) => {
              const v = byYear[y] ?? 0;
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
            Twitch and Discord that year, which the announcement feed does not
            capture. An empty bar means the record is quiet, not that we were.
          </div>
          <div className="mhead"><h3>Events by game</h3></div>
          <div className="note">
            {byGame.map((g) => (
              <span key={g.game} style={{ marginRight: 16 }}>
                <span className="gtag">{g.game}</span>{g.events} events
              </span>
            ))}
          </div>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>The Films</h3>
            <span className="sub">
              all {FILMS.length}, most watched first
            </span>
          </div>
          <div className="note">
            Everything still standing on the community's own YouTube channels:{' '}
            {CHANNELS.map((c, i) => {
              const f = FILMS.find((x) => x.channel === c)!;
              return (
                <span key={c}>
                  {i > 0 && ', '}
                  <a className="ilink" href={f.channelUrl} target="_blank" rel="noopener">{c}</a>
                </span>
              );
            })}. Ages are the ones YouTube gives, which are relative and rounded
            down, so a film marked thirteen years old was posted around 2013.
          </div>
          <div className="film-grid">
            {FILMS.map((f) => (
              <a className="film" key={f.id}
                href={`https://www.youtube.com/watch?v=${f.id}`}
                target="_blank" rel="noopener">
                <img src={`https://i.ytimg.com/vi/${f.id}/hqdefault.jpg`}
                  alt="" loading="lazy" width={480} height={360} />
                <div className="ft">{f.title}</div>
                <div className="fm">{f.viewsText}{f.published ? ` · ${f.published}` : ''}</div>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
