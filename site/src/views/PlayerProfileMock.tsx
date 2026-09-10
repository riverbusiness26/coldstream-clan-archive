import { useEffect, useMemo, useState } from 'react';
import type { Me } from '../lib/auth';
import { Icon } from './Home';
import DiscordAvatar from '../components/DiscordAvatar';
import DetachmentEmblem from '../components/DetachmentEmblem';
import { supa } from '../lib/supa';
import { displayStat, EMPTY_COMBAT_STATS, loadCombatStats, type CombatStats } from '../lib/combatStats';

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

export default function PlayerProfileMock({ me, signIn }: { me: Me | null; signIn: () => void; refresh?: () => void }) {
  const connected = Boolean(me);
  const [items, setItems] = useState<PersonnelItem[]>([]);
  const [assignments, setAssignments] = useState<PersonnelAssignment[]>([]);
  const [detachment, setDetachment] = useState<Detachment | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [combatStats, setCombatStats] = useState<CombatStats>(EMPTY_COMBAT_STATS);

  useEffect(() => {
    if (!supa || !me) {
      setItems([]);
      setAssignments([]);
      setDetachment(null);
      setCombatStats(EMPTY_COMBAT_STATS);
      setRecordLoading(false);
      setRecordError(null);
      return;
    }

    const db = supa;
    let cancelled = false;
    const loadRecord = async () => {
      setRecordLoading(true);
      setRecordError(null);
      const [itemResult, assignmentResult, memberResult, statsResult] = await Promise.all([
        db.from('personnel_item')
          .select('id,kind,name,description,storage_key,active,sort_order')
          .order('kind').order('sort_order').order('name'),
        db.from('personnel_assignment')
          .select('id,item_id,item_kind,assigned_at,note')
          .eq('member_id', me.id).is('removed_at', null)
          .order('assigned_at', { ascending: false }),
        db.from('member').select('company_id').eq('id', me.id).maybeSingle(),
        loadCombatStats(db, me.id).catch(() => EMPTY_COMBAT_STATS),
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
      setCombatStats(statsResult);

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

  return (
    <main className="player-portal" aria-labelledby="player-portal-title">
      <section className="portal-account">
        <div className="portal-avatar">
          <DiscordAvatar url={me?.avatar_url ?? null} name={me?.display_name ?? 'Coldstream member'} />
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
          <header><span>Profile</span><h2 id="customize-title">Discord identity</h2></header>
          <div className="portal-field"><b>Display name</b><span>{connected ? me!.display_name : 'Imported from Discord'}</span><button type="button" disabled>Edit later</button></div>
          <div className="portal-field avatar-field"><b>Profile picture</b><span>{connected ? 'Synced from your Discord account' : 'Available after Discord sign in'}</span></div>

          <p className="portal-empty">Your profile is managed through Discord. We are not asking members to link a separate gaming account.</p>
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
                <span><DetachmentEmblem name={detachment?.name} src={detachmentArtwork} alt={`${detachment?.name ?? 'Detachment'} emblem`} /></span>
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
          {[
            ['Events attended', displayStat(combatStats.eventsAttended), 'Confirmed attendance'],
            ['Kills', displayStat(combatStats.kills), 'Approved stat submissions'],
            ['Deaths', displayStat(combatStats.deaths), 'Approved stat submissions'],
            ['K/D ratio', displayStat(combatStats.kdr, combatStats.kdr === null ? '' : '×'), 'Calculated automatically'],
            ['MVPs', displayStat(combatStats.mvps), 'Top of the scoreboard'],
            ['Top 5s', displayStat(combatStats.top5), 'Approved round results'],
            ['Attendance', displayStat(combatStats.attendancePercent, combatStats.attendancePercent === null ? '' : '%'), 'Confirmed RSVP record'],
            ['Voice hours', displayStat(combatStats.attendanceHours, combatStats.attendanceHours === null ? '' : 'h'), 'Discord presence samples'],
          ].map(([label, value, note]) => <article key={label}><span>{label}</span><b>{value}</b><small>{note}</small></article>)}
        </div>
        <div className="game-night-record">
          <div><h3>Game-night activity</h3><p>Attendance, game, session length and results will appear here after the first recorded night.</p></div>
          <div className="activity-placeholder" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="portal-tracking" aria-labelledby="tracking-title">
        <header><div><span>Record provenance</span><h2 id="tracking-title">How your record is built</h2></div><span className="tracking-status">Discord controlled</span></header>
        <div className="tracking-grid">
          <article><b>Confirmed events</b><p>Attendance and event results come from the Coldstream calendar, RSVP record and staff review.</p><span>Events attended, kills, deaths, MVPs and Top 5s</span></article>
          <article><b>Voice presence</b><p>Attendance hours are calculated only from Discord voice-presence samples, with AFK channels excluded.</p><span>Two-minute samples · early and late grace windows</span></article>
          <article className="tracking-limited"><b>Staff assignments</b><p>Rank, detachment and medals are assigned in the Command Board and remain visible in your service record.</p><span>Every change is recorded in the audit log</span></article>
        </div>
      </section>
    </main>
  );
}
