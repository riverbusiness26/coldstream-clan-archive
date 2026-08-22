// The living half of a profile: what somebody is playing, what they say
// about themselves, and what other people say to them.
//
// Kept separate from the archive half above it on purpose. An archive entry
// is a record, fixed and sourced and not the member's to edit, because the
// whole point is that it can be checked. This half is theirs. Stacking them
// rather than merging keeps it obvious which is evidence and which is
// somebody talking about themselves.
import { useCallback, useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';

interface RecentGame { appid: number; name: string; minutes_2weeks: number; minutes_total: number }
interface Prof { motto: string | null; bio: string | null; games: string[] | null }
interface HfStat {
  hf_name: string | null; regiment: string | null;
  kills: number; deaths: number; melee_kills: number; shooting_kills: number;
  arty_kills: number; games_won: number; games_lost: number;
  rounds_played: number; rounds_won: number; kdr: number | null;
}
interface GameStat {
  appid: number; game_name: string | null;
  stats: Record<string, number>; achieved: number; achievements: number;
}
interface WallPost {
  id: string; body: string; created_at: string; author_id: string;
  author?: { display_name: string; steam_id64: string } | { display_name: string; steam_id64: string }[] | null;
}

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

// Steam gives minutes. Nobody thinks in minutes past about ninety of them.
const hours = (m: number) => (m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`);

// Steam stat keys are the game's own internal names. These are shown to
// people, so the obvious ones get read out properly and anything unrecognised
// falls back to a tidied version of its key rather than being hidden: a stat
// we cannot name is still a number somebody earned.
const prettyStat = (k: string) =>
  k.replace(/^stat[_.]?/i, '')
   .replace(/[_.]+/g, ' ')
   .replace(/([a-z])/g, (m) => m.toUpperCase())
   .trim();

export default function ProfileLive({
  memberId, steamId, displayName, me,
}: { memberId: string | null; steamId: string | null; displayName: string; me: Me | null }) {
  const [recent, setRecent] = useState<RecentGame[] | null>(null);
  const [prof, setProf] = useState<Prof | null>(null);
  const [gstats, setGstats] = useState<GameStat[]>([]);
  const [hf, setHf] = useState<HfStat | null>(null);
  const [wall, setWall] = useState<WallPost[] | null>(null);

  const [editing, setEditing] = useState(false);
  const [motto, setMotto] = useState('');
  const [bio, setBio] = useState('');
  const [games, setGames] = useState('');
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [say, setSay] = useState('');
  const [posting, setPosting] = useState(false);
  const [wallErr, setWallErr] = useState<string | null>(null);

  const isMine = !!me && !!memberId && me.id === memberId;

  const loadWall = useCallback(() => {
    if (!supa || !memberId) return;
    supa.from('member_wall')
      .select('id, body, created_at, author_id, author:member!member_wall_author_id_fkey(display_name, steam_id64)')
      .eq('subject_id', memberId)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => setWall((data ?? []) as unknown as WallPost[]));
  }, [memberId]);

  useEffect(() => {
    if (!supa) return;
    if (steamId) {
      supa.from('steam_recent').select('games').eq('steam_id64', steamId).maybeSingle()
        .then(({ data }) => setRecent(((data?.games ?? []) as RecentGame[]) ?? []));
      supa.from('game_stats')
        .select('appid, game_name, stats, achieved, achievements')
        .eq('steam_id64', steamId)
        .then(({ data }) => setGstats((data ?? []) as GameStat[]));
      supa.from('holdfast_stats')
        .select('hf_name, regiment, kills, deaths, melee_kills, shooting_kills, arty_kills, games_won, games_lost, rounds_played, rounds_won, kdr')
        .eq('steam_id64', steamId)
        .maybeSingle()
        .then(({ data }) => setHf((data ?? null) as HfStat | null));
    }
    if (memberId) {
      supa.from('member_profile').select('motto, bio, games').eq('member_id', memberId).maybeSingle()
        .then(({ data }) => {
          const d = (data ?? null) as Prof | null;
          setProf(d);
          setMotto(d?.motto ?? '');
          setBio(d?.bio ?? '');
          setGames((d?.games ?? []).join(', '));
        });
    }
    loadWall();
  }, [steamId, memberId, loadWall]);

  async function saveProfile() {
    if (!supa || !memberId) return;
    setSaveErr(null);
    const row = {
      member_id: memberId,
      motto: motto.trim() || null,
      bio: bio.trim() || null,
      games: games.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 8),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supa.from('member_profile').upsert(row, { onConflict: 'member_id' });
    if (error) {
      setSaveErr(/permission denied|42501|relation/i.test(error.message)
        ? 'Profiles are not switched on yet. An admin needs to apply migration 0019.'
        : error.message);
      return;
    }
    setProf({ motto: row.motto, bio: row.bio, games: row.games });
    setEditing(false);
  }

  async function post() {
    if (!supa || !me || !memberId) return;
    setWallErr(null);
    const body = say.trim();
    if (!body) return;
    setPosting(true);
    const { error } = await supa.from('member_wall')
      .insert({ subject_id: memberId, author_id: me.id, body });
    setPosting(false);
    if (error) {
      setWallErr(/permission denied|42501|relation/i.test(error.message)
        ? 'Walls are not switched on yet. An admin needs to apply migration 0019.'
        : error.message.replace(/^.*?: /, ''));
      return;
    }
    setSay('');
    loadWall();
  }

  async function removePost(id: string) {
    if (!supa) return;
    const { data } = await supa.from('member_wall').delete().eq('id', id).select('id');
    if (data && data.length) loadWall();
    else setWallErr('That is not yours to remove.');
  }

  return (
    <>
      {/* What they have actually been playing. The most alive thing on the
          page, and the reason to come back to somebody else's. */}
      {recent !== null && recent.length > 0 && (
        <div className="module">
          <div className="mhead">
            <h3>Playing lately</h3>
            <span className="sub">last two weeks, from Steam</span>
          </div>
          <div className="playlist">
            {recent.map((g) => (
              <a className="playrow" key={g.appid}
                href={`https://store.steampowered.com/app/${g.appid}/`}
                target="_blank" rel="noopener">
                <img alt="" loading="lazy" width={32} height={32}
                  src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/capsule_184x69.jpg`} />
                <span className="playname">{g.name}</span>
                <span className="playtime">
                  {g.minutes_2weeks > 0 && <b>{hours(g.minutes_2weeks)}</b>}
                  {g.minutes_total > 0 && <span> {hours(g.minutes_total)} all time</span>}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Event statistics, which for this community is the half that counts.
          Shown above the Steam numbers because a K/D from organised
          linebattles says more about somebody here than an achievement
          count does. */}
      {hf && hf.rounds_played > 0 && (
        <div className="module">
          <div className="mhead">
            <h3>Holdfast, in events</h3>
            <span className="sub">
              {hf.regiment ? hf.regiment : 'from hfstats.online'}
            </span>
          </div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            <div className="stat"><div className="n">{hf.kills.toLocaleString('en-US')}</div><div className="l">kills</div></div>
            <div className="stat"><div className="n">{hf.deaths.toLocaleString('en-US')}</div><div className="l">deaths</div></div>
            <div className="stat"><div className="n">{hf.kdr ? Number(hf.kdr).toFixed(2) : '·'}</div><div className="l">K / D</div></div>
            <div className="stat"><div className="n">{hf.rounds_played.toLocaleString('en-US')}</div><div className="l">rounds played</div></div>
          </div>
          {/* The split is the interesting part: it says how somebody
              actually fights, which a single kill count never does. */}
          <div className="killsplit">
            {[
              ['Melee', hf.melee_kills],
              ['Shooting', hf.shooting_kills],
              ['Artillery', hf.arty_kills],
            ].filter(([, v]) => (v as number) > 0).map(([label, v]) => {
              const total = Math.max(1, hf.melee_kills + hf.shooting_kills + hf.arty_kills);
              return (
                <div className="ksrow" key={label as string}>
                  <span className="kslabel">{label}</span>
                  <span className="ksbar"><span style={{ width: `${Math.round(((v as number) / total) * 100)}%` }} /></span>
                  <span className="ksn">{(v as number).toLocaleString('en-US')}</span>
                </div>
              );
            })}
          </div>
          <div className="note">
            Won {hf.games_won} of {hf.games_won + hf.games_lost} games, and{' '}
            {hf.rounds_won} of {hf.rounds_played} rounds.
            <span className="prov">source: hfstats.online, used with permission, refreshed daily</span>
          </div>
        </div>
      )}

      {/* Numbers from the games themselves, where the game publishes them. */}
      {gstats.filter((g) => g.achievements > 0 || Object.keys(g.stats).length > 0).map((g) => {
        const entries = Object.entries(g.stats)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);
        return (
          <div className="module" key={g.appid}>
            <div className="mhead">
              <h3>{g.game_name ?? 'Game stats'}</h3>
              <span className="sub">from Steam</span>
            </div>
            {g.achievements > 0 && (
              <div className="achv">
                <div className="achv-bar">
                  <span style={{ width: `${Math.round((g.achieved / g.achievements) * 100)}%` }} />
                </div>
                <div className="achv-n">
                  {g.achieved} of {g.achievements} achievements
                </div>
              </div>
            )}
            {entries.length > 0 && (
              <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                {entries.map(([k, v]) => (
                  <div className="stat" key={k}>
                    <div className="n">{v.toLocaleString('en-US')}</div>
                    <div className="l">{prettyStat(k)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Theirs to write. */}
      <div className="module">
        <div className="mhead">
          <h3>About</h3>
          {isMine && !editing && (
            <button className="btn sm" onClick={() => setEditing(true)}>
              {prof ? 'Edit' : 'Write yours'}
            </button>
          )}
        </div>

        {!editing && (
          prof && (prof.motto || prof.bio || (prof.games ?? []).length) ? (
            <div className="about">
              {prof.motto && <p className="about-motto">{prof.motto}</p>}
              {prof.bio && <p className="about-bio">{prof.bio}</p>}
              {(prof.games ?? []).length > 0 && (
                <div className="chips">
                  {prof.games!.map((g) => <span className="chip" key={g}>{g}</span>)}
                </div>
              )}
            </div>
          ) : (
            <div className="note">
              {isMine
                ? 'Nothing here yet. Write a line about yourself, it shows up on the front page when you are online.'
                : `${displayName} has not written anything here yet.`}
            </div>
          )
        )}

        {editing && (
          <div className="compose">
            <input className="inp" maxLength={90} placeholder="A line under your name"
              value={motto} onChange={(e) => setMotto(e.target.value)} />
            <textarea className="inp ta" rows={4} maxLength={600}
              placeholder="Anything you like. How long you have been about, what you play, what you are bad at."
              value={bio} onChange={(e) => setBio(e.target.value)} />
            <input className="inp" placeholder="Games you play, separated by commas"
              value={games} onChange={(e) => setGames(e.target.value)} />
            {saveErr && <div className="ferr">{saveErr}</div>}
            <div className="fieldrow">
              <button className="btn primary sm" onClick={saveProfile}>Save</button>
              <button className="btn sm" onClick={() => { setEditing(false); setSaveErr(null); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* The bit that makes a page worth visiting twice. */}
      {memberId && (
        <div className="module">
          <div className="mhead">
            <h3>Wall</h3>
            <span className="sub">{wall === null ? 'loading' : `${wall.length} posted`}</span>
          </div>

          {me ? (
            <div className="compose">
              <input className="inp" maxLength={400}
                placeholder={isMine ? 'Leave a note on your own wall' : `Say something to ${displayName}`}
                value={say} onChange={(e) => { setSay(e.target.value); setWallErr(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') post(); }} />
              {wallErr && <div className="ferr">{wallErr}</div>}
              <button className="btn primary sm" onClick={post} disabled={posting || !say.trim()}>
                {posting ? 'Posting' : 'Post'}
              </button>
            </div>
          ) : (
            <div className="note">Sign in through Steam to post on this wall.</div>
          )}

          {wall?.length === 0 && (
            <div className="note">
              Nothing on this wall yet. {isMine ? 'Somebody will turn up.' : 'Be the first.'}
            </div>
          )}

          {wall?.map((w) => {
            const a = one(w.author);
            const canRemove = !!me && (w.author_id === me.id || isMine
              || me.role === 'moderator' || me.role === 'admin');
            return (
              <article className="post wallpost" key={w.id}>
                <div className="meta">
                  <b>{a?.display_name ?? 'member'}</b> · {new Date(w.created_at).toLocaleDateString()}
                  {canRemove && (
                    <button className="shout-x" onClick={() => removePost(w.id)}
                      aria-label="Remove this post">x</button>
                  )}
                </div>
                <p>{w.body}</p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
