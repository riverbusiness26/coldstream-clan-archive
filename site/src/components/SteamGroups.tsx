// The Steam groups, as the archive holds them.
//
// These come from our own tables, not from Steam. The steam-sync edge
// function copies each group down and this reads the copy. That is not a
// caching decision: the Steam Web API sends no CORS headers, so a browser
// cannot call it, and the key must never ship in a bundle even if it could.
//
// It also means the page keeps working on the day a group is deleted, which
// is the whole reason the archive exists.
import { useEffect, useMemo, useState } from 'react';
import { supa } from '../lib/supa';
import erasSeed from '../seed/eras.json';

interface Group {
  group_id64: string;
  url_slug: string;
  name: string;
  headline: string | null;
  avatar_url: string | null;
  sort_order: number;
  member_count_shown: number | null;
  member_count_listed: number | null;
  members_online: number | null;
  members_in_game: number | null;
  fetched_at: string | null;
  gone_at: string | null;
}

interface GroupMember {
  group_id64: string;
  steam_id64: string;
  persona_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  left_at: string | null;
}

// Which eras a group belongs to.
//
// This is not one to one and cannot be made one to one. An era is a period
// this community lived through, and several of them ran across more than one
// Steam group at once, which is why an era carries a list of sources. The
// same group therefore turns up in more than one era: Midnight Mercenaries
// was running through both the 2nd Coldstream era and the Nox Viator era.
//
// So the heading is the group's own name as Steam has it, and the eras it
// was part of go underneath. Trying to stamp one era label on each group
// would have to pick a winner, and there is no honest way to pick.
interface SeedEra { slug: string; label: string; sources?: string[] }
const ERAS_FOR: Record<string, string[]> = {};
for (const e of (erasSeed as unknown as { eras: SeedEra[] }).eras) {
  for (const slug of e.sources ?? [e.slug]) (ERAS_FOR[slug] ??= []).push(e.label);
}

function when(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export default function SteamGroups() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!supa) { setGroups([]); return; }
    supa.from('steam_group')
      .select('group_id64, url_slug, name, headline, avatar_url, sort_order, member_count_shown, member_count_listed, members_online, members_in_game, fetched_at, gone_at')
      .order('sort_order')
      .then(({ data }) => setGroups((data ?? []) as Group[]));
  }, []);

  // Members are only fetched once somebody opens a group. Nearly six hundred
  // rows with avatars is not something to pull down for a page most people
  // will scroll straight past.
  useEffect(() => {
    if (!open || !supa || members) return;
    supa.from('steam_group_member')
      .select('group_id64, steam_id64, persona_name, avatar_url, profile_url, left_at')
      .is('left_at', null)
      .then(({ data }) => setMembers((data ?? []) as GroupMember[]));
  }, [open, members]);

  const byGroup = useMemo(() => {
    const m: Record<string, GroupMember[]> = {};
    for (const x of members ?? []) (m[x.group_id64] ??= []).push(x);
    // Named profiles first: a wall that opens with private accounts looks
    // broken, when it is only Steam declining to say who they are.
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => {
        if (!!a.persona_name !== !!b.persona_name) return a.persona_name ? -1 : 1;
        return (a.persona_name ?? '').localeCompare(b.persona_name ?? '');
      });
    }
    return m;
  }, [members]);

  const totals = useMemo(() => {
    const g = groups ?? [];
    return {
      shown: g.reduce((n, x) => n + (x.member_count_shown ?? 0), 0),
      online: g.reduce((n, x) => n + (x.members_online ?? 0), 0),
      inGame: g.reduce((n, x) => n + (x.members_in_game ?? 0), 0),
      fetched: g.map((x) => x.fetched_at).filter(Boolean).sort().slice(-1)[0] ?? null,
    };
  }, [groups]);

  if (groups === null) {
    return (
      <div className="module">
        <div className="mhead"><h3>The Steam Groups</h3></div>
        <div className="note">Loading.</div>
      </div>
    );
  }
  if (groups.length === 0) return null;

  const peak = Math.max(...groups.map((g) => g.member_count_shown ?? 0), 1);

  return (
    <div className="module">
      <div className="mhead">
        <h3>The Steam Groups</h3>
        <span className="sub">
          {groups.length} groups · {totals.shown} members · {totals.online} online now
        </span>
      </div>

      <div className="note">
        Every group this community has run, copied down from Steam rather than
        linked to, so the record survives the day one of them is deleted.
        {totals.fetched && <> Last checked {when(totals.fetched)}.</>}
        {' '}Open a group for the people in it.
      </div>

      <ol className="eras sgroups">
        {groups.map((g) => {
          const isOpen = open === g.url_slug;
          const shown = g.member_count_shown ?? 0;
          const listed = g.member_count_listed ?? 0;
          const mine = byGroup[g.group_id64] ?? [];
          return (
            <li className={'era' + (isOpen ? ' open' : '')} key={g.group_id64}>
              <button className="era-head sg-head"
                onClick={() => setOpen(isOpen ? null : g.url_slug)}
                aria-expanded={isOpen}>
                {g.avatar_url
                  ? <img className="sg-av" src={g.avatar_url} alt="" width={32} height={32} loading="lazy" />
                  : <span className="sg-av sg-av-none" aria-hidden="true" />}
                <span className="era-mid">
                  <span className="era-name">{g.name}</span>
                  {/* The slug rather than the era labels: it is the group's
                      identity on Steam, and era labels already contain a
                      middle dot, so listing several of them here would read
                      as more eras than there are. They go in the body. */}
                  <span className="era-game">steamcommunity.com/groups/{g.url_slug}</span>
                </span>
                <span className="era-bar" aria-hidden="true">
                  <span className="era-fill" style={{ width: `${Math.round((shown / peak) * 100)}%` }} />
                </span>
                <span className="era-events">
                  {shown} {shown === 1 ? 'member' : 'members'}
                  {g.members_online ? <span className="sg-on"><span className="sdot" />{g.members_online}</span> : null}
                </span>
              </button>

              {isOpen && (
                <div className="era-body">
                  {g.headline && <p className="era-note">{g.headline}</p>}

                  <dl className="era-facts">
                    <div><dt>Steam shows</dt><dd>{shown} members</dd></div>
                    <div><dt>List contains</dt><dd>{listed} accounts</dd></div>
                    <div><dt>Online now</dt><dd>{g.members_online ?? 0}, {g.members_in_game ?? 0} in game</dd></div>
                  </dl>

                  {(ERAS_FOR[g.url_slug] ?? []).length > 0 && (
                    <div className="era-who sg-eras">
                      <b>Part of</b>{' '}
                      {ERAS_FOR[g.url_slug].map((label) => (
                        <span className="gtag" key={label}>{label}</span>
                      ))}
                    </div>
                  )}

                  {listed !== shown && (
                    <div className="era-who sg-note">
                      Steam reports both of those numbers itself and they do not
                      agree. The member list returns {listed} accounts while the
                      group page says {shown}, the difference being accounts
                      Steam no longer counts publicly. Both are kept rather than
                      quietly picking one.
                    </div>
                  )}

                  {members === null && <div className="note">Loading members.</div>}

                  {mine.length > 0 && (
                    <div className="sg-wall">
                      {mine.map((m) => (
                        <a className="sg-person" key={m.steam_id64}
                          href={m.profile_url ?? `https://steamcommunity.com/profiles/${m.steam_id64}`}
                          target="_blank" rel="noopener"
                          title={m.persona_name ?? 'Private profile'}>
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt="" width={40} height={40} loading="lazy" />
                            : <span className="sg-person-none" aria-hidden="true" />}
                          <span className="sg-name">{m.persona_name ?? 'private'}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="era-prov">
                    source: Steam group <span className="mono">{g.url_slug}</span>,
                    member list read {when(g.fetched_at)}
                    {g.gone_at && <> · Steam stopped returning this group, so what is shown is the last good read</>}
                    {' · '}
                    <a className="ilink" href={`https://steamcommunity.com/groups/${g.url_slug}`}
                      target="_blank" rel="noopener">on Steam</a>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
