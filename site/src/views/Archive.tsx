// The Archive: the record room, and now the whole record. The roster and the
// rank ladder live here, then the timeline and the statistics it produced.
// Everything here says what it is, where it came from, and when. The deep
// archive, every recovered page and forum thread, lives on the archive site
// and is linked, never folded in and never deleted.
import { useMemo, useState } from 'react';
import { eventStats, people } from '../lib/data';
import erasSeed from '../seed/eras.json';
import filmsSeed from '../seed/films.json';
import Roster from '../components/Roster';
import Ranks from '../components/Ranks';
import SteamGroups from '../components/SteamGroups';
import Calendar from './Calendar';
import type { Me } from '../lib/auth';

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
  sources?: string[];
  ran?: string;
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
interface RibEra { slug: string; label: string; foundedIso: string | null; ran?: string; events: number }
const ERAS = (erasSeed as unknown as { eras: RibEra[] }).eras;
const PEAK = Math.max(...ERAS.map((e) => e.events), 1);

const HISTORY = [
  { years: '2011', group: '21st Pennsylvania Regiment of Foot', game: 'Battlegrounds 2' },
  { years: '2011–2012', group: 'Midnight Mercenaries and 2nd Coldstream', game: 'Battlegrounds 2, Mount & Musket to Napoleonic Wars' },
  { years: '2013–2015', group: '2nd Coldstream Regiment of Footguards', game: 'Napoleonic Wars' },
  { years: '2020', group: '2nd Coldstream returned', game: 'Napoleonic Wars' },
  { years: 'Now', group: 'Coldstream Gaming', game: 'Holdfast and other games' },
] as const;

export default function Archive({ me }: { me: Me | null }) {
  const [openEra, setOpenEra] = useState<string | null>(null);
  const [deepOpen, setDeepOpen] = useState(false);

  // Ranks somebody on the roster actually held, so the ladder marks them.
  const held = useMemo(
    () => new Set(people.map((p) => p.rank).filter(Boolean) as string[]),
    [],
  );

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
    <div className="wrap solo recordroom">
      <main>
        {/* The record room, per CSG Archive.png and artwork.png: the page says
            what it is before any module does, and the section marks sit on the
            page rather than on a box lid. */}
        <div className="page-head">
          <h1>The Archive</h1>
          <p className="page-sub">The games changed. The community carried on.</p>
        </div>

        <section className="archive-intro" aria-labelledby="archive-story-title">
          <div>
            <p className="cg-eyebrow">Since 2011</p>
            <h2 id="archive-story-title">A long history, kept simple.</h2>
            <p>Coldstream Gaming has moved through different games and group names since 2011. The details are kept in the record, but the important part is straightforward: people kept coming back to play together.</p>
          </div>
          <div className="archive-quick-stats" aria-label="Archive totals">
            <span><b>{people.length}</b> members</span>
            <span><b>{eventStats.reduce((n, e) => n + e.events, 0)}</b> events</span>
            <span><b>{FILMS.length}</b> films</span>
            <span><b>2011</b> established</span>
          </div>
        </section>

        <section className="archive-timeline" aria-labelledby="archive-timeline-title">
          <div className="mhead"><h2 id="archive-timeline-title">The games we played</h2><span className="sub">a short history</span></div>
          <ol>
            {HISTORY.map((item) => <li key={`${item.years}-${item.group}`}>
              <time>{item.years}</time>
              <span><b>{item.group}</b><small>{item.game}</small></span>
            </li>)}
          </ol>
        </section>

        <section className="archive-featured" aria-labelledby="archive-featured-title">
          <div className="mhead"><h2 id="archive-featured-title">From the record</h2><span className="sub">three films from the archive</span></div>
          <div className="archive-film-row">
            {FILMS.slice(0, 3).map((film) => <a href={`https://www.youtube.com/watch?v=${film.id}`} target="_blank" rel="noopener" key={film.id}>
              <img src={`https://i.ytimg.com/vi/${film.id}/hqdefault.jpg`} alt="" loading="lazy" width="480" height="360" />
              <span>{film.title}</span>
            </a>)}
          </div>
        </section>

        <details className="archive-depth" open={deepOpen} onToggle={(event) => setDeepOpen(event.currentTarget.open)}>
          <summary>Open the full archive <span>Roster, ranks, records, groups and every surviving film</span></summary>

        <div className="module">
          <div className="mhead"><h3>The Numbers</h3><span className="sub">the community, counted</span></div>
          {/* Label over figure, with where it came from underneath. The refs
              put a source line on every number and they are right to: a bare
              count on an archive page is a claim, and this is the one page
              where every claim is supposed to say who is making it. The
              wording is what the seeds actually are, not a masthead. */}
          <div className="stats sourced" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div className="stat"><div className="l">members on the roll</div><div className="n">{people.length}</div><div className="src">from the community archives</div></div>
            <div className="stat"><div className="l">events on record</div><div className="n">{eventStats.reduce((n, e) => n + e.events, 0)}</div><div className="src">from 1,210 archived announcements</div></div>
            <div className="stat"><div className="l">films preserved</div><div className="n">{FILMS.length}</div><div className="src">recovered video, catalogued</div></div>
            <div className="stat"><div className="l">years running</div><div className="n">15</div><div className="src">April 2011 to now</div></div>
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
                <div className="lera-year">{e.ran ?? (e.foundedIso ? e.foundedIso.slice(0, 4) : '')}</div>
                <div className="lera-name">{e.label}</div>
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
            Fifteen years of the community's records: the roster and the ranks,
            the timeline, the event statistics, the films, and the pages of our
            old sites. Every item says what it is, where it came from, and when.
            The full deep archive, including every recovered page and forum
            thread, lives on the{' '}
            <a href={ARCHIVE_URL} target="_blank" rel="noopener" className="ilink">archive site</a>.
          </div>
          {/* River's line, from artwork.png. It states the editorial rule this
              whole page follows, so it belongs on the page and not in a brief. */}
          <blockquote className="pullquote">
            We keep the nights.<br />We do not keep a scoreboard.
          </blockquote>
        </div>

        <Roster />
        <Ranks held={held} />

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
                    <span className="era-year">{e.ran ?? e.foundedIso?.slice(0, 4) ?? '·'}</span>
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
                        {e.members > 0 && (
                          <div><dt>On the group</dt><dd>{e.members} members, {e.namedMembers} named</dd></div>
                        )}
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
                        source: Steam {e.sources && e.sources.length > 1 ? 'groups' : 'group'}{' '}
                        <span className="mono">{(e.sources ?? [e.slug]).join(', ')}</span>, announcement archive
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <SteamGroups />

        <Calendar me={me} />

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
        </details>
      </main>
    </div>
  );
}
