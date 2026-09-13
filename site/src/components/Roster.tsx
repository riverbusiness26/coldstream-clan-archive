import { Fragment, useEffect, useMemo, useState } from 'react';
import { people, rosterEntries, GAME_NAMES } from '../lib/data';
import '../history-redesign.css';

export interface RosterEraFilter {
  id: string;
  title: string;
  firstYear: number;
  lastYear: number;
}

const PAGE_SIZE = 25;
const isIdentifier = (value: string) => /^\d{17}$/.test(value.trim());
const recordedName = (value: string) => isIdentifier(value) ? 'Name not preserved' : value;
const gameName = (value: string) => value === 'GEN' ? 'Community record' : GAME_NAMES[value] ?? value;

export default function Roster({ era, onClearEra, rosterPeople = people, sourceEntries = rosterEntries }: { era?: RosterEraFilter | null; onClearEra?: () => void; rosterPeople?: typeof people; sourceEntries?: typeof rosterEntries }) {
  const [year, setYear] = useState('all');
  const [game, setGame] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('earliest');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const records = useMemo(() => {
    const byPerson = new Map<string, typeof rosterEntries>();
    for (const entry of sourceEntries) {
      const entries = byPerson.get(entry.person_key) ?? [];
      entries.push(entry);
      byPerson.set(entry.person_key, entries);
    }
    return rosterPeople.map((person, index) => {
      const entries = [...(byPerson.get(person.key) ?? [])].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
      const years = [...new Set(entries.flatMap((entry) => entry.year == null ? [] : [entry.year]))].sort((a, b) => a - b);
      return { person, index, entries, years, first: years[0] ?? null, last: years.at(-1) ?? null };
    });
  }, [rosterPeople, sourceEntries]);
  const years = useMemo(() => [...new Set(records.flatMap((record) => record.years))].sort((a, b) => a - b), [records]);
  const games = useMemo(() => [...new Set(rosterPeople.flatMap((person) => person.games))].sort((a, b) => gameName(a).localeCompare(gameName(b))), [rosterPeople]);

  useEffect(() => {
    setYear('all');
    setGame('all');
    setQuery('');
    setPage(0);
    setOpen(null);
  }, [era?.id]);

  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return records.filter(({ person, years: recordedYears }) =>
      (!era || recordedYears.some((value) => value >= era.firstYear && value <= era.lastYear)) &&
      (year === 'all' || (year === 'undated' ? recordedYears.length === 0 : recordedYears.includes(Number(year)))) &&
      (game === 'all' || person.games.includes(game)) &&
      (!search || [recordedName(person.name), ...person.aka.filter((name) => !isIdentifier(name))].some((name) => name.toLocaleLowerCase().includes(search))),
    ).sort((a, b) => {
      const nameOrder = recordedName(a.person.name).localeCompare(recordedName(b.person.name), undefined, { sensitivity: 'base' });
      if (sort === 'name') return nameOrder;
      if (sort === 'latest') return (b.last ?? -Infinity) - (a.last ?? -Infinity) || nameOrder;
      if (sort === 'records') return b.entries.length - a.entries.length || nameOrder;
      return (a.first ?? Infinity) - (b.first ?? Infinity) || nameOrder;
    });
  }, [records, era, year, game, query, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const resetPage = () => { setPage(0); setOpen(null); };
  const clearFilters = () => {
    setYear('all'); setGame('all'); setQuery(''); resetPage(); onClearEra?.();
  };
  const filtersActive = Boolean(era || year !== 'all' || game !== 'all' || query.trim());

  return (
    <section className="history-roster" id="historical-roster" aria-labelledby="historical-roster-title" tabIndex={-1}>
      <header className="history-section-heading">
        <div><p className="history-eyebrow">The people in the record</p><h2 id="historical-roster-title">Historical roster</h2></div>
        <span className="history-count">{rosterPeople.length} archived names</span>
      </header>
      <p className="history-roster-context">Find a name, a game or a year. Dates below come from surviving records, not a complete service history.</p>
      <div className="history-roster-toolbar">
        <label className="history-search"><span>Search the roster</span><input type="search" placeholder="Name or previous handle" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} /></label>
        <label><span>Recorded in</span><select value={year} onChange={(event) => { setYear(event.target.value); resetPage(); }}><option value="all">All years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}<option value="undated">Undated records</option></select></label>
        <label><span>Game</span><select value={game} onChange={(event) => { setGame(event.target.value); resetPage(); }}><option value="all">All games</option>{games.map((value) => <option key={value} value={value}>{gameName(value)}</option>)}</select></label>
        <label><span>Sort by</span><select value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}><option value="earliest">Earliest record</option><option value="latest">Latest record</option><option value="name">Name A to Z</option><option value="records">Most records</option></select></label>
      </div>
      <div className="history-roster-results">
        <span role="status">{rows.length} {rows.length === 1 ? 'name' : 'names'}{era ? ` · ${era.title}` : ''}</span>
        {filtersActive && <button type="button" onClick={clearFilters}>Clear filters</button>}
      </div>
      {rows.length === 0 ? <div className="history-empty"><h3>No matching records</h3><p>Try a different name, year or game. Undated records will not appear in an era filter.</p><button type="button" onClick={clearFilters}>Show all archived names</button></div> : (
        <div className="history-roster-table-wrap">
          <table className="history-roster-table">
            <caption className="history-screen-reader">Archived names and the years in which dated evidence survives. Expand a record to read its sources.</caption>
            <thead><tr><th scope="col">Name in the archive</th><th scope="col">Dated evidence</th><th scope="col">Games</th><th scope="col">Sources</th></tr></thead>
            <tbody>
              {visibleRows.map(({ person, index, entries, first, last, years: recordedYears }) => {
                const expanded = open === index;
                const aliases = person.aka.filter((name) => !isIdentifier(name));
                const recordId = `historical-record-${index}`;
                return <Fragment key={`${person.key}-${index}`}>
                  <tr className={expanded ? 'is-expanded' : undefined}>
                    <th scope="row">{person.key && !isIdentifier(person.key) ? <a className="history-person-name" href={`#/member/${encodeURIComponent(person.key)}`}>{recordedName(person.name)}</a> : <button className="history-person-name" type="button" aria-expanded={expanded} aria-controls={recordId} onClick={() => setOpen(expanded ? null : index)}>{recordedName(person.name)}</button>}{aliases.length > 0 && <small className="history-person-alias">Also {aliases.slice(0, 2).join(', ')}{aliases.length > 2 ? ` +${aliases.length - 2}` : ''}</small>}</th>
                    <td data-label="Dated evidence"><span className="history-record-range">{first == null ? 'Undated' : first === last ? first : `${first} to ${last}`}</span>{recordedYears.length > 1 && <small>{recordedYears.length} recorded years</small>}</td>
                    <td data-label="Games"><div className="history-game-tags">{person.games.length ? person.games.map((value) => <span key={value}>{gameName(value)}</span>) : <span className="is-unknown">Not recorded</span>}</div></td>
                    <td><button className="history-record-toggle" type="button" aria-label={`${expanded ? 'Hide' : 'Show'} source records for ${recordedName(person.name)}`} aria-expanded={expanded} aria-controls={recordId} onClick={() => setOpen(expanded ? null : index)}><span>{entries.length} {entries.length === 1 ? 'record' : 'records'}</span><b aria-hidden="true">{expanded ? '−' : '+'}</b></button></td>
                  </tr>
                  <tr className="history-evidence-row" hidden={!expanded} id={recordId}><td colSpan={4}><div className="history-evidence">
                    <div className="history-evidence-heading"><h3>{recordedName(person.name)}</h3><span>Source record, not a linked account</span></div>
                    {aliases.length > 0 && <p>Names on record: {aliases.join(', ')}</p>}
                    {entries.length ? <ol>{entries.map((entry, entryIndex) => <li key={`${index}-${entryIndex}`}><time>{entry.year ?? 'Undated'}</time><div><b>{gameName(entry.game)}{entry.rank_or_class ? ` · ${entry.rank_or_class}` : ''}</b><p>{entry.source_detail}</p>{entry.notes && <p className="history-source-note">{entry.notes}</p>}<small>{entry.source === 'enjin' ? 'Recovered Enjin record' : `${entry.source.charAt(0).toUpperCase()}${entry.source.slice(1)} record`}</small></div></li>)}</ol> : <p>No underlying source rows are included in this catalogue.</p>}
                  </div></td></tr>
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>
      )}
      <footer className="history-roster-footer">
        <p>{rows.length ? `${currentPage * PAGE_SIZE + 1} to ${Math.min((currentPage + 1) * PAGE_SIZE, rows.length)} of ${rows.length}` : '0 results'}<span>25 names per page</span></p>
        <nav aria-label="Historical roster pages"><button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setOpen(null); }}>Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => { setPage(currentPage + 1); setOpen(null); }}>Next</button></nav>
      </footer>
      <p className="history-provenance">A range means records survive from its first and last years. It does not establish uninterrupted membership, a join date or a departure date. Undated evidence remains available in each record.</p>
    </section>
  );
}
