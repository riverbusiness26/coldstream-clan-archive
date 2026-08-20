// One page per person: the fifteen year record paying off for an individual.
// Years and ranks with their sources, forum and announcement activity, and
// the screenshots the person is actually visible in. Everything traces to a
// dataset in the archive; nothing is decorative.
import { useMemo } from 'react';
import rosterSeed from '../seed/roster.json';
import statsSeed from '../seed/profile-stats.json';
import gallerySeed from '../seed/gallery.json';
import { yearsWithUs, GAME_NAMES } from '../lib/data';
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';

interface Person {
  key: string; name: string; firstYear: number | null; datedYear: number | null;
  games: string[]; rank: string | null; steam_id64: string | null; entries: number; aka: string[];
}
interface Entry {
  person_key: string; person_name: string; game: string; rank_or_class: string | null;
  year: number | null; source: string; source_detail: string; notes: string | null;
}
interface Shot { src: string; w: number; h: number; caption: string; date: string | null; year: number | null; game: string; who: string[] }
interface Stats { forumPosts: number; announcements: number; shots: number[] }

const PEOPLE = (rosterSeed as { people: Person[] }).people;
const ENTRIES = (rosterSeed as { entries: Entry[] }).entries;
const STATS = statsSeed as Record<string, Stats>;
const SHOTS = gallerySeed as Shot[];

export default function Profile({ personKey, me, go }: { personKey: string; me: Me | null; go: (v: string) => void }) {
  const person = PEOPLE.find((p) => p.key === personKey);
  const records = useMemo(
    () => ENTRIES.filter((e) => e.person_key === personKey)
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    [personKey],
  );
  const stats: Stats = STATS[personKey] ?? { forumPosts: 0, announcements: 0, shots: [] };
  const shots = stats.shots.map((i) => SHOTS[i]).filter(Boolean);

  if (!person) {
    return (
      <div className="wrap solo"><main><div className="module">
        <div className="mhead"><h3>Member not found</h3></div>
        <div className="note">Nobody on the roll matches that address. <button className="lnk" onClick={() => go('members')}>Back to the roster.</button></div>
      </div></main></div>
    );
  }

  const yrs = yearsWithUs(person.datedYear);
  const mine = !!me && (person.steam_id64 === me.steam_id64);
  const yearsLine = yrs
    ? `${yrs} years · joined ${person.datedYear}`
    : person.firstYear ? `on the roll since ${person.firstYear}` : 'on the roll';

  return (
    <div className="wrap solo">
      <main>
        <div className="crumbs">
          <button className="lnk" onClick={() => go('members')}>Members</button>
          <span> › </span>
          <span className="here">{person.name}</span>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>{person.name}{mine ? ' · you' : ''}</h3>
            <span className="sub">{yearsLine}</span>
          </div>
          <div className="prof-head">
            <div className="prof-id">
              {person.rank && <div className="prof-rank">{person.rank}</div>}
              <div className="prof-games">{person.games.map((g) => <span key={g} className="gtag" title={GAME_NAMES[g] ?? g}>{g}</span>)}</div>
              {person.aka.length > 0 && <div className="meta">also on the record as: {person.aka.join(', ')}</div>}
            </div>
            <div className="stats prof-stats">
              <div className="stat"><div className="n">{records.length}</div><div className="l">records on file</div></div>
              <div className="stat"><div className="n">{stats.forumPosts}</div><div className="l">forum posts</div></div>
              <div className="stat"><div className="n">{stats.announcements}</div><div className="l">events called</div></div>
              <div className="stat"><div className="n">{shots.length}</div><div className="l">screenshots in</div></div>
            </div>
          </div>
        </div>

        <div className="module">
          <div className="mhead"><h3>Service Record</h3><span className="sub">every line carries its source</span></div>
          {records.map((e, i) => (
            <div className="prof-rec" key={i}>
              <span className="prof-year">{e.year ?? '····'}</span>
              <span className="gtag">{e.game}</span>
              <span className="prof-what">{e.rank_or_class ?? 'on the roll'}</span>
              <span className="prov">{e.source_detail}{e.notes ? ` (${e.notes})` : ''}</span>
            </div>
          ))}
        </div>

        {shots.length > 0 && (
          <div className="module">
            <div className="mhead"><h3>Seen in the Field</h3><span className="sub">screenshots this member is visible in</span></div>
            <div className="gal-grid">
              {shots.map((s) => (
                <button className="shotbtn" key={s.src} onClick={() => go('gallery')} aria-label={`Open the gallery: ${s.caption}`}>
                  <img src={asset(s.src)} alt={s.caption} loading="lazy" width={s.w} height={s.h} />
                  <span className="shotyear">{s.date ? s.date.slice(0, 4) : 'undated'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
