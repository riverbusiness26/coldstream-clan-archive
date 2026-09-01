// The Archive: the record room, and now the whole record. The roster and the
// rank ladder live here, then the timeline and the statistics it produced.
// Everything here says what it is, where it came from, and when. The deep
// archive, every recovered page and forum thread, lives on the archive site
// and is linked, never folded in and never deleted.
import { useState, type CSSProperties } from 'react';
import { eventStats, people } from '../lib/data';
import filmsSeed from '../seed/films.json';
import Roster from '../components/Roster';
import SteamGroups from '../components/SteamGroups';
import type { Me } from '../lib/auth';
import { HomeFilm } from './Home';

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
const FILMS_BY_CHANNEL = CHANNELS.map((channel) => ({
  channel,
  films: FILMS.filter((film) => film.channel === channel),
}));

// The deep archive page, now a sibling of the site rather than its root.
const ARCHIVE_URL = '/lineage/';

const HISTORY = [
  {
    years: '2011',
    group: '21st Pennsylvania Regiment of Foot',
    game: 'Battlegrounds 2',
    note: 'The first recorded era.',
    video: 'dqgcg0if-3U',
    evidence: 'Watch: 9 May 2011',
  },
  {
    years: '2011–2012',
    group: '2nd Coldstream Regiment of Footguards',
    game: 'Mount & Musket',
    note: 'A new name and a move into linebattles.',
    video: 'ThhbfRP95w8',
    evidence: 'Watch: 18 April 2012',
  },
  {
    years: '2012–2016',
    group: '2nd Coldstream Regiment of Footguards',
    game: 'Napoleonic Wars',
    note: 'The regiment moved into the Warband DLC, became inactive in 2014, returned in 2015, and became inactive again in 2016.',
    video: '8AU7hzl8w5M',
    evidence: 'Watch: 14 December 2012',
  },
  {
    years: '2016–2020',
    group: 'Coldstream Gaming carried on',
    game: 'Different games, same gaming community',
    note: 'The regiment was quiet, but Coldstream Gaming continued.',
  },
  {
    years: '2020–2021',
    group: '2nd Coldstream Regiment of Footguards and Coldstream Gaming',
    game: 'Holdfast: Nations at War and Garry’s Mod',
    note: 'A short return to Holdfast, alongside successful TTT, Prop Hunt and Deathrun servers on Garry’s Mod.',
    video: 'kwokOGLWLdU',
    evidence: 'Watch: 15 July 2020',
  },
  {
    years: 'Present',
    group: 'The return of the 2nd Coldstream and Coldstream Gaming',
    game: 'Holdfast: Nations at War and game servers',
    note: 'We are returning to Holdfast and bringing Coldstream Gaming’s game servers with us. We have learned from every era, kept what worked, and are coming back better prepared to build something that lasts.',
  },
] as const;

const FEATURED_HISTORY = [
  { id: 'dqgcg0if-3U', title: '21st Pennsylvania Regiment of Foot · 2011' },
  { id: 'ThhbfRP95w8', title: 'The last Mount & Musket linebattle · 2012' },
  { id: 'QgziRNt4nnM', title: 'The Napoleonic Wars revival · 2015' },
] as const;

export default function Archive({ me: _me }: { me: Me | null }) {
  const [deepOpen, setDeepOpen] = useState(false);

  return (
    <>
    <section className="archive-memory cg-film-flashes" aria-label="Coldstream Gaming memories by era">
      <HomeFilm />
    </section>
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

        <section className="archive-timeline timeline-bands" aria-labelledby="archive-timeline-title">
          <div className="mhead"><h2 id="archive-timeline-title">The games we played</h2><span className="sub">a short history</span></div>
          <ol>
            {HISTORY.map((item) => <li key={`${item.years}-${item.group}`} style={'video' in item ? { '--era-image': `url(https://i.ytimg.com/vi/${item.video}/hqdefault.jpg)` } as CSSProperties : undefined}>
              <time>{item.years}</time>
              <span>
                <b>{item.group}</b>
                <small>{item.game}</small>
                <p>{item.note}</p>
                {'video' in item && <a href={`https://www.youtube.com/watch?v=${item.video}`} target="_blank" rel="noopener">{item.evidence}</a>}
              </span>
            </li>)}
          </ol>
        </section>

        <section className="archive-featured" aria-labelledby="archive-featured-title">
          <div className="mhead"><h2 id="archive-featured-title">From the record</h2><span className="sub">three films from the archive</span></div>
          <div className="archive-film-row">
            {FEATURED_HISTORY.map((film) => <a href={`https://www.youtube.com/watch?v=${film.id}`} target="_blank" rel="noopener" key={film.id}>
              <img src={`https://i.ytimg.com/vi/${film.id}/hqdefault.jpg`} alt="" loading="lazy" width="480" height="360" />
              <span>{film.title}</span>
            </a>)}
          </div>
        </section>

        <details className="archive-depth" open={deepOpen} onToggle={(event) => setDeepOpen(event.currentTarget.open)}>
          <summary>Open the full archive <span>Roster, Steam groups and every surviving film</span></summary>

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
          <div className="mhead">
            <h3>The Archive</h3>
            <span className="sub">the record room · everything labeled, nothing deleted</span>
          </div>
          <div className="note">
            The community's records: the roster, the Steam groups, the films,
            and the pages of our old sites. Every item says
            what it is, where it came from, and when.
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

        <SteamGroups />

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
          <div className="film-categories">
            {FILMS_BY_CHANNEL.map(({ channel, films }) => (
              <details className="film-category" key={channel}>
                <summary><span>{channel}</span><small>{films.length} films</small></summary>
                <div className="film-grid">
                  {films.map((f) => (
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
              </details>
            ))}
          </div>
        </div>
        </details>
      </main>
    </div>
    </>
  );
}
