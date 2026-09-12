import { useState } from 'react';
import { people } from '../lib/data';
import filmsSeed from '../seed/films.json';
import summary from '../seed/summary.json';
import Roster, { type RosterEraFilter } from '../components/Roster';
import type { Me } from '../lib/auth';
import { HomeFilm } from './Home';
import '../history-redesign.css';

interface Film {
  id: string;
  title: string;
  views: number;
  viewsText: string;
  published: string;
  channel: string;
  channelUrl: string;
}

interface Era {
  id: string;
  years: string;
  shortTitle: string;
  title: string;
  game: string;
  story: string[];
  filmIds: string[];
  recordYears?: [number, number];
}

const FILMS = [...filmsSeed as Film[]].sort((a, b) => b.views - a.views);
const CHANNELS = [...new Set(FILMS.map((film) => film.channel))];

// These chapters follow the recovered community chronology in PROJECT.md.
// Films are selected by an existing catalogue identity, never by converting a
// rounded "years ago" label into a claimed publication date.
const ERAS: Era[] = [
  {
    id: 'first-linebattles', years: '2011', shortTitle: 'The first line', title: '21st Pennsylvania', game: 'Battlegrounds 2', recordYears: [2011, 2011],
    story: ['The first recorded era was the 21st Pennsylvania Regiment of Foot. The surviving Battlegrounds 2 films are where this record begins.', 'The footage keeps more than the organised events. It also keeps the moments between them, with the people who were there.'],
    filmIds: ['dqgcg0if-3U', 'ZypEBUL_hs4'],
  },
  {
    id: 'midnight-coldstream', years: '2011–2012', shortTitle: 'The Coldstream name', title: 'Midnight Mercenaries and the 2nd Coldstream', game: 'Mount & Musket · Napoleonic Wars', recordYears: [2011, 2012],
    story: ['Midnight Mercenaries and the 2nd Coldstream Regiment belonged to the same unit, recorded across three group pages. Mount & Musket linebattles became part of the community’s routine.', 'The move into Napoleonic Wars followed in 2012. The final Mount & Musket linebattle and footage from the new game preserve both sides of that change.'],
    filmIds: ['ThhbfRP95w8', '8AU7hzl8w5M', 'OnesY-EczqY'],
  },
  {
    id: 'nox-viator', years: '2013–2015', shortTitle: 'Nox Viator', title: 'A community beyond one game', game: 'Nox Viator · 2nd Coldstream · Napoleonic Wars', recordYears: [2013, 2015],
    story: ['Nox Viator became the wider community, with the 2nd Coldstream as its regiment. The preserved announcements, roster entries and films connect the two.', 'The regiment became inactive in 2014 and returned in 2015, before another inactive period in 2016. The 2015 footage remains part of that story, alongside the earlier linebattles.'],
    filmIds: ['QgziRNt4nnM'],
  },
  {
    id: 'roar', years: '2017–2018', shortTitle: 'RoaR Gaming', title: 'The Counter-Strike years', game: 'Counter-Strike · ESEA · FACEIT', recordYears: [2017, 2018],
    story: ['RoaR Gaming carried the community into Counter-Strike, with ESEA and FACEIT in the recovered record.', 'This chapter is represented by dated roster and announcement evidence. The current film catalogue does not include a verified video from this era.'],
    filmIds: [],
  },
  {
    id: 'return-2020', years: '2020', shortTitle: 'Back in formation', title: 'The 2nd Coldstream returns', game: 'Holdfast: Nations at War', recordYears: [2020, 2020],
    story: ['The 2nd Coldstream Guard returned in 2020. The surviving July films record public linebattles and what happened after hours.', 'It was a short Holdfast return. Around 2020–2021, Coldstream Gaming also ran TTT, Prop Hunt and Deathrun servers in Garry’s Mod.'],
    filmIds: ['kwokOGLWLdU', '84rV0sXDZtA', 'vOk5eMxv7Dc'],
  },
  {
    id: 'coldstream-gaming', years: '2020–now', shortTitle: 'Still Coldstream', title: 'Coldstream Gaming', game: 'The gaming community today',
    story: ['Coldstream Gaming is the current chapter, with the return of the 2nd Coldstream and community game servers.', 'The record stays here alongside what is happening now. New events, films and member contributions belong to the same community that first appears in 2011.'],
    filmIds: [],
  },
];

function scrollToSection(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  section?.focus({ preventScroll: true });
}

export default function Archive({ me: _me }: { me: Me | null }) {
  const [selectedEra, setSelectedEra] = useState(ERAS[0].id);
  const [rosterEra, setRosterEra] = useState<RosterEraFilter | null>(null);
  const [filmQuery, setFilmQuery] = useState('');
  const [channel, setChannel] = useState('all');
  const era = ERAS.find((item) => item.id === selectedEra) ?? ERAS[0];
  const eraFilms = era.filmIds.flatMap((id) => { const film = FILMS.find((item) => item.id === id); return film ? [film] : []; });
  const catalogue = FILMS.filter((film) => (channel === 'all' || film.channel === channel) && film.title.toLocaleLowerCase().includes(filmQuery.trim().toLocaleLowerCase()));
  const viewRoster = () => {
    if (era.recordYears) setRosterEra({ id: era.id, title: era.years, firstYear: era.recordYears[0], lastYear: era.recordYears[1] });
    else setRosterEra(null);
    scrollToSection('historical-roster');
  };

  return (
    <main className="history-page">
      <header className="history-masthead">
        <div className="history-masthead-copy"><p className="history-eyebrow">Coldstream Gaming · The living archive</p><h1>Same people.<br /><em>Different eras.</em></h1><p>Our story starts in 2011. Follow the games, the names and the nights that brought us here.</p><div className="history-masthead-actions"><button type="button" onClick={() => scrollToSection('history-timeline')}>Explore the eras <span aria-hidden="true">↓</span></button><button type="button" onClick={() => scrollToSection('historical-roster')}>Find an old name</button></div></div>
        <div className="history-foundation"><span>On the record since</span><strong>2011</strong><p>Six chapters.<br />One gaming community.</p><i aria-hidden="true" /></div>
      </header>

      <div className="history-ledger" aria-label="Archive catalogue totals"><div><b>{people.length}</b><span>names in the roster</span></div><div><b>{summary.events}</b><span>catalogued events</span></div><div><b>{FILMS.length}</b><span>surviving videos</span></div><p>From the recovered community archives.<br />Catalogue totals, not current membership.</p></div>

      <section className="history-timeline" id="history-timeline" aria-labelledby="history-timeline-title" tabIndex={-1}>
        <header className="history-section-heading"><div><p className="history-eyebrow">Choose a chapter</p><h2 id="history-timeline-title">The eras</h2></div><span className="history-count">2011 to today</span></header>
        <nav className="history-era-nav" aria-label="Community eras"><ol>{ERAS.map((item, index) => <li key={item.id}><button type="button" aria-pressed={item.id === selectedEra} aria-controls="history-era-story" onClick={() => setSelectedEra(item.id)}><span className="history-era-dot" aria-hidden="true" /><span className="history-era-number">{String(index + 1).padStart(2, '0')}</span><b>{item.years}</b><small>{item.shortTitle}</small></button></li>)}</ol></nav>
        <article className="history-era-story" id="history-era-story" aria-labelledby="history-era-title" key={era.id}>
          <div className="history-era-copy"><p className="history-eyebrow">{era.years} · {era.game}</p><h3 id="history-era-title">{era.title}</h3>{era.story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="history-story-actions"><button type="button" onClick={viewRoster}>{era.recordYears ? 'People recorded in this era' : 'Explore the historical roster'} <span aria-hidden="true">↗</span></button><button type="button" onClick={() => scrollToSection('history-film-catalogue')}>Full film catalogue</button></div></div>
          <div className="history-era-records">{eraFilms.length ? <><a className="history-era-film" href={`https://www.youtube.com/watch?v=${eraFilms[0].id}`} target="_blank" rel="noopener noreferrer"><img src={`https://i.ytimg.com/vi/${eraFilms[0].id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy" /><span className="history-play-mark" aria-hidden="true">▶</span><div><small>From the surviving footage</small><strong>{eraFilms[0].title}</strong><span>Watch on YouTube ↗</span></div></a>{eraFilms.length > 1 && <div className="history-era-more">{eraFilms.slice(1).map((film) => <a key={film.id} href={`https://www.youtube.com/watch?v=${film.id}`} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span><b>{film.title}</b><small>↗</small></a>)}</div>}</> : <div className="history-era-folio"><span className="history-eyebrow">{era.id === 'coldstream-gaming' ? 'The next page is ours' : 'From the written record'}</span><strong>{era.years}</strong><p>{era.id === 'coldstream-gaming' ? 'More nights. More names. More to keep.' : 'Not every era left a film. The people and the sources still belong in the story.'}</p>{era.id === 'coldstream-gaming' && <a href="#/home">This week in Coldstream ↗</a>}</div>}</div>
        </article>
      </section>

      <Roster era={rosterEra} onClearEra={() => setRosterEra(null)} />

      <section className="history-screening" aria-labelledby="history-screening-title"><div><p className="history-eyebrow">Play the memories</p><h2 id="history-screening-title">A window into the record.</h2><p>The archive player remains here. Browse the complete film catalogue below for individual titles and original channels.</p></div><div className="history-screening-player"><HomeFilm controls /></div></section>

      <section className="history-catalogue" id="history-film-catalogue" aria-labelledby="history-film-catalogue-title" tabIndex={-1}>
        <header className="history-section-heading"><div><p className="history-eyebrow">The films, kept together</p><h2 id="history-film-catalogue-title">Every surviving video</h2></div><span className="history-count">{FILMS.length} catalogued films</span></header>
        <div className="history-catalogue-toolbar"><label className="history-search"><span>Find a film</span><input type="search" value={filmQuery} onChange={(event) => setFilmQuery(event.target.value)} placeholder="Search video titles" /></label><label><span>Original channel</span><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">All channels</option>{CHANNELS.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><span role="status">{catalogue.length} results · most watched first</span></div>
        {catalogue.length ? <div className="history-film-grid">{catalogue.map((film) => <article key={film.id}><a href={`https://www.youtube.com/watch?v=${film.id}`} target="_blank" rel="noopener noreferrer"><div className="history-film-thumb"><img src={`https://i.ytimg.com/vi/${film.id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy" /><span aria-hidden="true">▶</span></div><h3>{film.title}</h3></a><p>{film.viewsText} <span>· archived count</span></p><a className="history-film-channel" href={film.channelUrl} target="_blank" rel="noopener noreferrer">{film.channel} ↗</a></article>)}</div> : <div className="history-empty"><h3>No matching films</h3><p>Try another title or choose all channels.</p></div>}
        <p className="history-provenance">Titles, view counts and channels come from the saved film catalogue. View counts are not live. Original videos and channels open on YouTube. Some source publication labels are rounded, so they are not shown here as exact dates.</p>
      </section>
    </main>
  );
}
