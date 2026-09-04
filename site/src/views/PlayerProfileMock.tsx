import { useEffect, useMemo, useRef, useState } from 'react';
import type { Me } from '../lib/auth';
import { Icon } from './Home';
import { beginSteamLink, clearSteamAssertion, completeSteamLink, pendingSteamAssertion, unlinkSteam } from '../lib/steamLink';
import { supa } from '../lib/supa';

type ItemKind = 'rank' | 'medal';
interface PersonnelItem {
  id: string;
  kind: ItemKind;
  name: string;
  description: string | null;
  storage_key: string | null;
  active: boolean;
  sort_order: number;
}
interface PersonnelAssignment {
  id: string;
  item_id: string;
  item_kind: ItemKind;
  assigned_at: string;
  note: string | null;
}
interface Detachment {
  name: string;
  tag: string | null;
  emblem_storage_key: string | null;
}

const EVENT_STATS = [
  ['Events attended', 'Pending', 'Recorded events'],
  ['Kills', 'Pending', 'Confirmed combat record'],
  ['Deaths', 'Pending', 'Confirmed combat record'],
  ['K/D ratio', 'Pending', 'Calculated automatically'],
  ['Best event', 'Pending', 'Highest confirmed kills'],
  ['Last event', 'Pending', 'Waiting for first record'],
] as const;

export default function PlayerProfileMock({ me, signIn, refresh }: { me: Me | null; signIn: () => void; refresh: () => void }) {
  const connected = Boolean(me);
  const [avatarStyle, setAvatarStyle] = useState<'discord' | 'crest' | 'initials'>('discord');
  const [items, setItems] = useState<PersonnelItem[]>([]);
  const [assignments, setAssignments] = useState<PersonnelAssignment[]>([]);
  const [detachment, setDetachment] = useState<Detachment | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [steamBusy, setSteamBusy] = useState(false);
  const [steamMsg, setSteamMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Finishing a link the member started before they left for Steam.
  //
  // Held until `me` has loaded rather than run on mount, because the member
  // row is what the function writes to and it arrives a moment after the page
  // does. The ref is what keeps this to one attempt: `me` changing from null
  // to a member is a second render, and Steam refuses a replayed assertion,
  // so without it a successful link reports itself as a failure straight after.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || !me) return;
    const params = pendingSteamAssertion();
    if (!params) return;
    handled.current = true;
    clearSteamAssertion();
    setSteamBusy(true);
    completeSteamLink(params).then((result) => {
      setSteamBusy(false);
      setSteamMsg({ ok: result.ok, text: result.ok ? 'Steam account linked.' : (result.error ?? 'That did not work.') });
      if (result.ok) refresh();
    });
  }, [me, refresh]);

  useEffect(() => {
    if (!supa || !me) {
      setItems([]);
      setAssignments([]);
      setDetachment(null);
      setRecordLoading(false);
      setRecordError(null);
      return;
    }

    const db = supa;
    let cancelled = false;
    const loadRecord = async () => {
      setRecordLoading(true);
      setRecordError(null);
      const [itemResult, assignmentResult, memberResult] = await Promise.all([
        db.from('personnel_item')
          .select('id,kind,name,description,storage_key,active,sort_order')
          .order('kind').order('sort_order').order('name'),
        db.from('personnel_assignment')
          .select('id,item_id,item_kind,assigned_at,note')
          .eq('member_id', me.id).is('removed_at', null)
          .order('assigned_at', { ascending: false }),
        db.from('member').select('company_id').eq('id', me.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const firstError = itemResult.error || assignmentResult.error || memberResult.error;
      if (firstError) {
        setRecordError('The service record could not be opened.');
        setRecordLoading(false);
        return;
      }
      setItems((itemResult.data ?? []) as PersonnelItem[]);
      setAssignments((assignmentResult.data ?? []) as PersonnelAssignment[]);

      const companyId = memberResult.data?.company_id as string | null | undefined;
      if (companyId) {
        const companyResult = await db.from('company').select('name,tag,emblem_storage_key').eq('id', companyId).maybeSingle();
        if (!cancelled && companyResult.error) setRecordError('The detachment record could not be opened.');
        if (!cancelled) setDetachment((companyResult.data as Detachment | null) ?? null);
      } else {
        setDetachment(null);
      }
      if (!cancelled) setRecordLoading(false);
    };
    loadRecord();
    return () => { cancelled = true; };
  }, [me]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const currentRank = assignments
    .filter((row) => row.item_kind === 'rank')
    .map((row) => ({ assignment: row, item: itemById.get(row.item_id) }))
    .find((row): row is { assignment: PersonnelAssignment; item: PersonnelItem } => Boolean(row.item));
  const medals = assignments
    .filter((row) => row.item_kind === 'medal')
    .map((row) => ({ assignment: row, item: itemById.get(row.item_id) }))
    .filter((row): row is { assignment: PersonnelAssignment; item: PersonnelItem } => Boolean(row.item));
  const artworkUrl = (item: PersonnelItem | undefined) => !item?.storage_key || !supa
    ? null
    : supa.storage.from('personnel-artwork').getPublicUrl(item.storage_key).data.publicUrl;
  const rankArtwork = artworkUrl(currentRank?.item);
  const detachmentArtwork = !detachment?.emblem_storage_key || !supa
    ? null
    : supa.storage.from('personnel-artwork').getPublicUrl(detachment.emblem_storage_key).data.publicUrl;
  const assignedDate = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  async function unlink() {
    setSteamBusy(true);
    const result = await unlinkSteam();
    setSteamBusy(false);
    setSteamMsg({ ok: result.ok, text: result.ok ? 'Steam account unlinked.' : (result.error ?? 'That did not work.') });
    if (result.ok) refresh();
  }

  return (
    <main className="player-portal" aria-labelledby="player-portal-title">
      <section className="portal-account">
        <div className={`portal-avatar ${avatarStyle}`}>
          {avatarStyle === 'crest' ? <img src="/crest.webp" alt="" /> : avatarStyle === 'initials' ? <b>{me?.display_name.slice(0, 2).toUpperCase() || 'CG'}</b> : me?.avatar_url ? <img src={me.avatar_url} alt="" /> : <Icon name="discord" />}
          <span className="portal-live-dot" title="Live status" />
        </div>
        <div className="portal-identity">
          <p className="cg-eyebrow">Coldstream player profile</p>
          <h1 id="player-portal-title">{connected ? me!.display_name : 'Your profile starts here'}</h1>
          <p>{connected ? 'Your identity, current rank and awarded medals stay together in one service record.' : 'Sign in through Discord once. We create the member record and keep your community activity together.'}</p>
          <div className="portal-badges">
            <span>{connected ? recordLoading ? 'Opening service record' : currentRank?.item.name ?? 'Rank not assigned' : 'Rank pending'}</span>
            <span>{connected ? me!.role === 'admin' ? 'Site admin' : me!.role === 'moderator' ? 'Site moderator' : 'Discord linked' : 'Not connected'}</span>
          </div>
        </div>
        {connected
          ? <a className="portal-discord" href={(me!.role === 'admin' || me!.role === 'moderator') ? '#/admin' : '#/home'}><Icon name="discord" />{(me!.role === 'admin' || me!.role === 'moderator') ? 'Open Command Board' : 'Discord connected'}</a>
          : <button className="portal-discord" type="button" onClick={signIn}><Icon name="discord" />Sign in through Discord</button>}
      </section>

      <div className="portal-grid">
        <section className="portal-panel portal-customize" aria-labelledby="customize-title">
          <header><span>Profile</span><h2 id="customize-title">Make it yours</h2></header>
          <div className="portal-field"><b>Display name</b><span>{connected ? me!.display_name : 'Imported from Discord'}</span><button type="button" disabled>Edit later</button></div>
          <div className="portal-field avatar-field"><b>Avatar</b><span>Choose a preview style</span></div>
          <div className="avatar-choices" aria-label="Avatar preview options">
            <button className={avatarStyle === 'discord' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('discord')}><Icon name="discord" /><span>Discord</span></button>
            <button className={avatarStyle === 'crest' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('crest')}><img src="/crest.webp" alt="" /><span>Crest</span></button>
            <button className={avatarStyle === 'initials' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('initials')}><b>CG</b><span>Initials</span></button>
          </div>
          <button className="portal-secondary" type="button">Upload custom avatar</button>

          <div className="portal-field">
            <b>Steam account</b>
            <span>{me?.steam_id64
              ? 'Linked. Your Steam presence and game statistics can find this record.'
              : 'Optional. Link it and your Steam presence and game statistics attach to this record.'}</span>
            {connected
              ? me!.steam_id64
                ? <button type="button" onClick={unlink} disabled={steamBusy}>{steamBusy ? 'Working' : 'Unlink'}</button>
                : <button type="button" onClick={beginSteamLink} disabled={steamBusy}>{steamBusy ? 'Working' : 'Link Steam'}</button>
              : <button type="button" disabled>Sign in first</button>}
          </div>
          {steamMsg && <p className={steamMsg.ok ? 'portal-empty' : 'ferr'}>{steamMsg.text}</p>}
          <p className="portal-empty">Signing in is Discord only. Steam is a link on this record, never a way in.</p>
        </section>

        <section className="portal-panel portal-rank" aria-labelledby="rank-title">
          <header><span>Service record</span><h2 id="rank-title">Rank and distinctions</h2></header>
          {recordError && <p className="ferr">{recordError}</p>}
          <div className={`service-rank-showcase ${rankArtwork ? 'has-artwork' : ''}`}>
            <div className="service-rank-art">
              {rankArtwork
                ? <img src={rankArtwork} alt={`${currentRank!.item.name} rank insignia`} />
                : <div className="service-rank-placeholder"><img src="/crest.webp" alt="" /><span>{recordLoading ? 'Opening record' : connected ? 'Awaiting assignment' : 'Sign in to view'}</span></div>}
            </div>
            <div className="service-rank-copy">
              <span>Current rank</span>
              <h3>{recordLoading ? 'Opening record' : currentRank?.item.name ?? (connected ? 'Not assigned' : 'Your rank')}</h3>
              {currentRank?.item.description && <p>{currentRank.item.description}</p>}
              {currentRank && <time dateTime={currentRank.assignment.assigned_at}>Awarded {assignedDate(currentRank.assignment.assigned_at)}</time>}
              {currentRank?.assignment.note && <blockquote>{currentRank.assignment.note}</blockquote>}
              <div className="service-detachment">
                <span>{detachmentArtwork ? <img src={detachmentArtwork} alt={`${detachment!.name} emblem`} /> : <img src="/crest.webp" alt="" />}</span>
                <div><small>Detachment</small><b>{detachment?.name ?? (connected ? 'Not assigned' : 'Shown after sign in')}</b>{detachment?.tag && <em>{detachment.tag}</em>}</div>
              </div>
            </div>
          </div>

          <div className="service-medals-head">
            <div><span>Distinctions</span><h3>Medals</h3></div>
            {medals.length > 0 && <b>{medals.length}</b>}
          </div>
          {medals.length > 0 ? (
            <div className="service-medal-row">
              {medals.map(({ assignment, item }) => {
                const url = artworkUrl(item);
                return (
                  <figure className="service-medal" key={assignment.id}>
                    <div>{url ? <img src={url} alt={`${item.name} medal`} /> : <span>◇</span>}</div>
                    <figcaption><b>{item.name}</b><time dateTime={assignment.assigned_at}>{assignedDate(assignment.assigned_at)}</time>{assignment.note && <small>{assignment.note}</small>}</figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <p className="service-medals-empty">{recordLoading ? 'Opening medal record.' : connected ? 'No medals have been awarded yet.' : 'Sign in to view your awarded medals.'}</p>
          )}
        </section>
      </div>

      <section className="portal-stats" aria-labelledby="stats-title">
        <header><div><span>Event record</span><h2 id="stats-title">Combat statistics</h2></div><small><i />Updates after confirmed events</small></header>
        <div className="portal-stat-grid">
          {EVENT_STATS.map(([label, value, note]) => <article key={label}><span>{label}</span><b>{value}</b><small>{note}</small></article>)}
        </div>
        <div className="game-night-record">
          <div><h3>Game-night activity</h3><p>Attendance, game, session length and results will appear here after the first recorded night.</p></div>
          <div className="activity-placeholder" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="portal-tracking" aria-labelledby="tracking-title">
        <header><div><span>Holdfast activity</span><h2 id="tracking-title">Public play tracking</h2></div><span className="tracking-status">Planned integration</span></header>
        <div className="tracking-grid">
          <article><b>Coldstream servers</b><p>Full event and public-play records can be matched to a member through their Steam ID.</p><span>Kills, deaths, score, map, round and time played</span></article>
          <article><b>Partner servers</b><p>Records can be included when the server owner runs our tracker or shares a compatible score log.</p><span>Requires permission from the server owner</span></article>
          <article className="tracking-limited"><b>Other public servers</b><p>Holdfast does not provide a global public record we can query for every server.</p><span>Not available without server-side access</span></article>
        </div>
      </section>
    </main>
  );
}
