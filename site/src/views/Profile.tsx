// One page per person: the fifteen year record paying off for an individual.
// Years and ranks with their sources, forum and announcement activity, and
// the screenshots the person is actually visible in. Everything traces to a
// dataset in the archive; nothing is decorative.
import { useEffect, useMemo, useState } from 'react';
import rosterSeed from '../seed/roster.json';
import statsSeed from '../seed/profile-stats.json';
import gallerySeed from '../seed/gallery.json';
import { yearsWithUs, GAME_NAMES } from '../lib/data';
import { asset } from '../lib/asset';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';

interface Person {
  key: string; title: string | null; name: string; firstYear: number | null; datedYear: number | null;
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
  const bySteam = personKey.startsWith('steam:') ? personKey.slice(6) : null;
  const person = bySteam
    ? PEOPLE.find((p) => p.steam_id64 === bySteam)
    : PEOPLE.find((p) => p.key === personKey);

  // Live Steam status, for anybody the tracker knows about. Read from our
  // own table rather than from Steam, for the same reason the front page
  // does: the browser cannot call Steam, and should not hold the key.
  const steamId = person?.steam_id64 ?? bySteam;
  const [live, setLive] = useState<{ persona_name: string | null; avatar_url: string | null; persona_state: number; game: string | null; visible: boolean } | null>(null);
  useEffect(() => {
    if (!supa || !steamId) return;
    supa.from('steam_presence')
      .select('persona_name, avatar_url, persona_state, game, visible')
      .eq('steam_id64', steamId)
      .maybeSingle()
      .then(({ data }) => setLive(data as typeof live));
  }, [steamId]);
  const records = useMemo(
    () => ENTRIES.filter((e) => e.person_key === personKey)
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    [personKey],
  );
  const stats: Stats = STATS[personKey] ?? { forumPosts: 0, announcements: 0, shots: [] };
  const shots = stats.shots.map((i) => SHOTS[i]).filter(Boolean);

  // Not on the roster, but signed in through Steam: a real member with no
  // archive behind them yet. That is a page worth having rather than a dead
  // link, and it will fill in as they turn up in screenshots and events.
  if (!person && bySteam) {
    return (
      <div className="wrap solo"><main>
        <div className="crumbs">
          <button className="lnk" onClick={() => go('archive')}>The Archive</button>
          <span> › </span>
          <span className="here">{live?.persona_name ?? 'Member'}</span>
        </div>
        <div className="module">
          <div className="mhead">
            <h3>{live?.persona_name ?? 'Member'}</h3>
            <span className="sub">new since the archive was compiled</span>
          </div>
          <div className="prof-head">
            <div className="prof-id">
              {live?.avatar_url && <img className="prof-avi" src={live.avatar_url} alt="" width={64} height={64} />}
              <div className="prof-live">
                {live?.game
                  ? <><span className="pres-game">{live.game}</span> right now</>
                  : live
                    ? (live.visible ? (live.persona_state > 0 ? 'Online' : 'Offline') : 'Profile is private')
                    : 'Steam status not known yet'}
              </div>
            </div>
          </div>
          <div className="note">
            This member signed in through Steam and is not in the recovered
            archive, which only reaches as far as the records we could get
            back. Nothing is missing here: there is simply nothing to show
            yet. They will appear in the record as they turn up in events and
            screenshots from here on.
          </div>
          <a className="ilink" href={`https://steamcommunity.com/profiles/${bySteam}`} target="_blank" rel="noopener">
            Their Steam profile
          </a>
        </div>
      </main></div>
    );
  }

  if (!person) {
    return (
      <div className="wrap solo"><main><div className="module">
        <div className="mhead"><h3>Member not found</h3></div>
        <div className="note">Nobody on the roll matches that address. <button className="lnk" onClick={() => go('archive')}>Back to the roster.</button></div>
      </div></main></div>
    );
  }

  const yrs = yearsWithUs(person.datedYear);
  const mine = false;
  const yearsLine = yrs
    ? `${yrs} years · joined ${person.datedYear}`
    : person.firstYear ? `on the roll since ${person.firstYear}` : 'on the roll';

  return (
    <div className="wrap solo">
      <main>
        <div className="crumbs">
          <button className="lnk" onClick={() => go('archive')}>The Archive</button>
          <span> › </span>
          <span className="here">{person.name}</span>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>{person.name}</h3>
            <span className="sub">{yearsLine}</span>
          </div>
          <div className="prof-head">
            <div className="prof-id">
              {live?.avatar_url && <img className="prof-avi" src={live.avatar_url} alt="" width={64} height={64} />}
              {live && (
                <div className="prof-live">
                  {live.game
                    ? <><span className="pres-game">{live.game}</span> right now</>
                    : live.visible
                      ? (live.persona_state > 0 ? 'Online now' : 'Offline')
                      : 'Steam profile is private'}
                </div>
              )}
              {person.title && <div className="prof-title">{person.title}</div>}
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
