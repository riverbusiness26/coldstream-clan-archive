import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FaArrowRight, FaCamera, FaChevronDown, FaDiscord, FaEye, FaEyeSlash, FaMedal, FaShieldAlt, FaTimes } from 'react-icons/fa';
import DiscordAvatar from './DiscordAvatar';
import ProfileLive from './ProfileLive';
import type { Me } from '../lib/auth';
import { asset } from '../lib/asset';
import { supa } from '../lib/supa';
import { EMPTY_COMBAT_STATS, loadCombatStats, type CombatStats } from '../lib/combatStats';
import { loadPersonnelDisplayRows, partitionMedals, saveMedalVisibility, type PersonnelDisplayRow } from '../lib/medalVisibility';
import '../profile-designs.css';
import '../profile-display-case.css';

export interface DisplayCaseMember { id: string; display_name: string; avatar_url: string | null; discord_id?: string | null; role?: string }
interface CatalogueItem { id: string; kind: 'rank' | 'medal'; name: string; description: string | null; storage_key: string | null }
interface DisplayRecord { items: CatalogueItem[]; rows: PersonnelDisplayRow[]; detachment: string | null; stats: CombatStats; visibilityAvailable: boolean; visibilityError: string | null }
const EMPTY_RECORD: DisplayRecord = { items: [], rows: [], detachment: null, stats: EMPTY_COMBAT_STATS, visibilityAvailable: false, visibilityError: null };
const COMPACT_MEDAL_LIMIT = 8;
const PREVIEW_ITEMS: CatalogueItem[] = [
  { id: 'reference-rank', kind: 'rank', name: 'Volunteer', description: 'Supplied shoulder-patch reference. This is not an awarded rank in the local preview.', storage_key: null },
  ...Array.from({ length: 20 }, (_, index) => ({ id: `reference-medal-${index + 1}`, kind: 'medal' as const, name: `Reference patch ${String(index + 1).padStart(2, '0')}`, description: 'The same supplied round patch is repeated to test a large collection. This is not an awarded medal.', storage_key: null })),
];

function labelDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}
function numberLabel(value: number | null, ratio = false) { return value === null || !Number.isFinite(value) ? 'N/R' : ratio ? value.toFixed(2) : value.toLocaleString('en-US'); }
function voiceLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'N/R';
  const minutes = Math.floor(Math.max(0, value) * 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function ProfileDisplayCase({ member, viewer, signIn, forcePreview = false }: { member: DisplayCaseMember | null; viewer: Me | null; signIn?: () => void; forcePreview?: boolean }) {
  const preview = forcePreview || !supa;
  const canManage = preview || !!viewer && !!member && (viewer.id === member.id || ['admin', 'moderator'].includes(viewer.role));
  const [record, setRecord] = useState<DisplayRecord>(EMPTY_RECORD);
  const [loading, setLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selectedMedalId, setSelectedMedalId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [previewHidden, setPreviewHidden] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const saving = useRef(false);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const request = ++epoch.current;
    setRecord(EMPTY_RECORD); setRecordError(null); setLoading(false); setExpanded(false); setManaging(false); setSelectedMedalId(null); setNotice(null); setBusyId(null);
    if (preview || !supa || !member) return;
    const db = supa;
    setLoading(true);
    void (async () => {
      try {
        const [catalogue, personnel, memberResult, stats] = await Promise.all([
          db.from('personnel_item').select('id,kind,name,description,storage_key').order('kind').order('sort_order').order('name'),
          loadPersonnelDisplayRows(db, member.id),
          db.from('member').select('company_id').eq('id', member.id).maybeSingle(),
          loadCombatStats(db, member.id).catch(() => EMPTY_COMBAT_STATS),
        ]);
        if (request !== epoch.current) return;
        if (catalogue.error || memberResult.error) throw new Error('The member record could not be opened.');
        let detachment: string | null = null;
        if (memberResult.data?.company_id) {
          const company = await db.from('company').select('name').eq('id', memberResult.data.company_id).maybeSingle();
          if (company.error) throw new Error('The detachment record could not be opened.');
          detachment = company.data?.name ?? null;
        }
        if (request === epoch.current) setRecord({ items: (catalogue.data ?? []) as CatalogueItem[], rows: personnel.rows, detachment, stats,
          visibilityAvailable: personnel.visibilityAvailable, visibilityError: personnel.visibilityError });
      } catch (error) {
        if (request === epoch.current) setRecordError(error instanceof Error ? error.message : 'The member record could not be opened.');
      } finally { if (request === epoch.current) setLoading(false); }
    })();
    return () => { epoch.current += 1; };
  }, [member?.id, preview, reload]);

  const previewRows = useMemo(() => PREVIEW_ITEMS.map((item) => ({ id: item.id, item_id: item.id, item_kind: item.kind, member_id: 'preview-member',
    assigned_at: '', removed_at: null, note: null, display_on_profile: !previewHidden.has(item.id) })) as PersonnelDisplayRow[], [previewHidden]);
  const rows = preview ? previewRows : record.rows;
  const items = preview ? PREVIEW_ITEMS : record.items;
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const currentRank = rows.find((row) => row.item_kind === 'rank' && !row.removed_at);
  const rankItem = currentRank ? itemById.get(currentRank.item_id) : null;
  const ranks = rows.filter((row) => row.item_kind === 'rank');
  const medalParts = partitionMedals(rows, COMPACT_MEDAL_LIMIT);
  const visibleMedals = expanded ? [...medalParts.visible, ...medalParts.overflow] : medalParts.visible;
  const visibleCount = medalParts.visible.length + medalParts.overflow.length;
  const activeMedals = rows.filter((row) => row.item_kind === 'medal' && !row.removed_at);
  const selectedMedal = activeMedals.find((row) => row.id === selectedMedalId && (canManage || row.display_on_profile === true)) ?? null;
  const selectedItem = selectedMedal ? itemById.get(selectedMedal.item_id) : null;
  const stats = preview ? EMPTY_COMBAT_STATS : record.stats;
  const name = preview ? 'Member preview' : member?.display_name ?? 'Your profile';
  const visibilityAvailable = preview || record.visibilityAvailable;
  function artwork(row: PersonnelDisplayRow | undefined | null) {
    if (!row) return null;
    if (preview) return asset(row.item_kind === 'rank' ? '/museum/profile-studies/volunteer.png' : '/museum/profile-studies/medal-shape-reference.png');
    const key = itemById.get(row.item_id)?.storage_key;
    return key && supa ? supa.storage.from('personnel-artwork').getPublicUrl(key).data.publicUrl : null;
  }
  function selectMedal(id: string) {
    setSelectedMedalId(id);
    window.requestAnimationFrame(() => detailRef.current?.focus({ preventScroll: true }));
  }
  async function setVisibility(row: PersonnelDisplayRow, visible: boolean) {
    if (!canManage || !visibilityAvailable || saving.current) return;
    setNotice(null);
    if (preview) {
      setPreviewHidden((current) => { const next = new Set(current); visible ? next.delete(row.id) : next.add(row.id); return next; });
      if (!visible && selectedMedalId === row.id) setSelectedMedalId(null);
      setNotice({ text: `${visible ? 'Shown' : 'Hidden'} in this local preview only. No member award was changed.`, error: false });
      return;
    }
    if (!supa) return;
    const request = epoch.current;
    saving.current = true; setBusyId(row.id);
    try {
      const confirmed = await saveMedalVisibility(supa, row.id, visible);
      if (request !== epoch.current) return;
      setRecord((current) => ({ ...current, rows: current.rows.map((entry) => entry.id === row.id ? { ...entry, display_on_profile: confirmed } : entry) }));
      if (!confirmed && selectedMedalId === row.id) setSelectedMedalId(null);
      setNotice({ text: confirmed ? 'This medal is now shown on the profile.' : 'This medal is hidden from the profile. Its award record and history are unchanged.', error: false });
    } catch (error) {
      if (request === epoch.current) {
        const message = error instanceof Error ? error.message : 'The display preference could not be confirmed. Reload the record before trying again.';
        setNotice({ text: message, error: true });
        // A timed-out response may still have saved. Close the display until a
        // fresh read confirms the flags, instead of displaying a stale award.
        setRecord((current) => ({ ...current, visibilityAvailable: false, visibilityError: message,
          rows: current.rows.map((entry) => entry.item_kind === 'medal' ? { ...entry, display_on_profile: null } : entry) }));
        setSelectedMedalId(null);
      }
    } finally { saving.current = false; if (request === epoch.current) setBusyId(null); }
  }

  return <main className='profile-designs pd-design-display profile-display-case' aria-labelledby='pdc-title'>
    <nav className='pdc-breadcrumb' aria-label='Profile navigation'><a href='#/home'>Your weekly brief</a><span>/</span><span>{preview ? 'Display case preview' : viewer?.id === member?.id ? 'Your profile' : 'Member profile'}</span>{viewer && ['admin', 'moderator'].includes(viewer.role) && <a href='#/admin' className='pdc-staff-link'>Staff panel <FaArrowRight /></a>}</nav>
    {preview && <div className='pd-provenance pdc-preview-note' role='status'><strong>Local display preview.</strong> Twenty copies of the supplied round patch test a large collection. They are reference artwork, not awarded medals. Hide/Show changes only this preview.</div>}
    <section className='pd-identity pd-identity-compact' aria-label='Member overview'><div className='pd-avatar'><DiscordAvatar url={member?.avatar_url ?? viewer?.avatar_url ?? null} name={name} /></div><div className='pd-identity-copy'><span className='pd-eyebrow'>Coldstream Gaming · Member record</span><h1 id='pdc-title'>{name}</h1><p>{preview ? 'A place for your part in the community.' : record.detachment ?? 'Gaming community member'}</p><div className='pd-identity-meta'><span>{rankItem?.name ?? (loading ? 'Opening record' : 'Rank not recorded')}</span>{!preview && <span>{member?.role === 'admin' ? 'Admin' : member?.role === 'moderator' ? 'Moderator' : 'Member'}</span>}</div></div>{!member && !preview && signIn && <button type='button' className='pdc-button' onClick={signIn}><FaDiscord />Sign in through Discord</button>}</section>
    {recordError && <div className='pdc-error' role='alert'>{recordError}<button type='button' onClick={() => setReload((value) => value + 1)}>Try again</button></div>}
    <div className='pd-display-grid'>
      <section className='pd-honours' aria-labelledby='pdc-honours-title' style={{ '--pd-cloth': `url("${asset('/textures/coldstream-felt-tile.png')}")` } as CSSProperties}>
        <header className='pd-section-head'><div><span className='pd-eyebrow'>The regimental display</span><h2 id='pdc-honours-title'>Rank &amp; medals</h2></div><FaShieldAlt aria-hidden='true' /></header>
        <div className='pd-uniform'><figure className='pd-rank'><div className='pd-patch-seat'>{artwork(currentRank) ? <img src={artwork(currentRank)!} alt={`${rankItem?.name ?? 'Rank'} shoulder patch${preview ? ', reference artwork' : ''}`} width='144' height='216' /> : <span className='pd-missing-patch'><FaShieldAlt aria-hidden='true' /><small>{loading ? 'Opening record' : 'Rank artwork'}</small></span>}</div><figcaption><span className='pd-eyebrow'>{preview ? 'Reference artwork' : 'Current rank'}</span><strong>{rankItem?.name ?? (loading ? 'Opening record' : 'Rank not recorded')}</strong>{!preview && currentRank?.assigned_at && <small>Since {labelDate(currentRank.assigned_at)}</small>}</figcaption>{!preview && currentRank?.note && <p className='pdc-rank-note'>{currentRank.note}</p>}</figure>
          <div className='pd-medals'><div className='pd-medal-heading'><h3>Medals</h3><span>{visibleCount ? `${visibleMedals.length} of ${visibleCount} ${preview ? 'reference patches' : 'medals'} shown` : loading ? 'Opening medal record' : 'Personal recognition'}</span></div>
            {visibleMedals.length > 0 ? <div className='pd-medal-shelf pdc-medal-grid' id='pdc-medal-collection'>{visibleMedals.map((row) => <button type='button' className='pd-medal-item' key={row.id} onClick={() => selectMedal(row.id)} aria-label={`View ${itemById.get(row.item_id)?.name ?? 'medal'}`}><span className='pdc-medal-art'>{artwork(row) ? <img src={artwork(row)!} alt='' loading='lazy' /> : <FaMedal aria-hidden='true' />}</span><span>{itemById.get(row.item_id)?.name ?? 'Medal'}</span></button>)}</div> : <p className='pd-empty'>{loading ? 'Opening the medal record.' : medalParts.unknown.length > 0 ? 'The medal display is temporarily unavailable. Award records have not been removed.' : activeMedals.length > 0 ? 'No medals are on display.' : 'No medals recorded yet.'}</p>}
            {visibleCount > COMPACT_MEDAL_LIMIT && <button type='button' className='pdc-collection-toggle' aria-expanded={expanded} aria-controls='pdc-medal-collection' onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show fewer medals' : `Show all medals (${visibleCount})`}<FaChevronDown className={expanded ? 'is-open' : ''} /></button>}
            {canManage && (activeMedals.length > 0 || medalParts.historical.length > 0) && <button type='button' className='pdc-manage-toggle' aria-expanded={managing} aria-controls='pdc-medal-manager' onClick={() => setManaging((value) => !value)}><FaEye />{managing ? 'Close display manager' : 'Manage display'}{medalParts.hidden.length > 0 && <span>{medalParts.hidden.length} hidden</span>}</button>}
            {canManage && !preview && !loading && !visibilityAvailable && rows.length > 0 && <button type='button' className='pdc-manage-toggle' disabled={busyId !== null} onClick={() => setReload((value) => value + 1)}>Reload display settings</button>}
            <p className='pd-display-note'>{preview ? 'Shape reference only. Expand the collection or try Hide/Show below.' : 'Select a medal for its award date and details.'}</p>
          </div>
        </div>
        {selectedMedal && <section className='pdc-medal-detail' ref={detailRef} tabIndex={-1} aria-label='Medal details'><div className='pdc-detail-art'>{artwork(selectedMedal) ? <img src={artwork(selectedMedal)!} alt='' /> : <FaMedal />}</div><div><span className='pd-eyebrow'>{preview ? 'Reference artwork' : 'Award record'}</span><h3>{selectedItem?.name ?? 'Medal'}</h3>{!preview && <time dateTime={selectedMedal.assigned_at}>Awarded {labelDate(selectedMedal.assigned_at)}</time>}{selectedItem?.description && <p>{selectedItem.description}</p>}{selectedMedal.note && <p>{selectedMedal.note}</p>}</div><button type='button' onClick={() => setSelectedMedalId(null)} aria-label='Close medal details'><FaTimes /></button></section>}
        {canManage && managing && <section className='pdc-medal-manager' id='pdc-medal-manager' aria-labelledby='pdc-manager-title'><header><span className='pd-eyebrow'>Your display, your choice</span><h3 id='pdc-manager-title'>Manage medal display</h3><p>Hide a medal from the profile without removing the award. Show all only expands the visible collection.</p></header>{!visibilityAvailable && <p className='pdc-warning' role='status'>{record.visibilityError ?? 'Medal display settings are not available yet. Award records remain intact, and display controls are disabled until the update is available.'}</p>}<div className='pdc-manager-list'>{activeMedals.map((row) => <div className='pdc-manager-row' key={row.id}><span className='pdc-manager-art'>{artwork(row) ? <img src={artwork(row)!} alt='' loading='lazy' /> : <FaMedal />}</span><div><button type='button' className='pdc-manager-name' onClick={() => selectMedal(row.id)}>{itemById.get(row.item_id)?.name ?? 'Medal'}</button><small>{row.display_on_profile === true ? 'Shown on profile' : row.display_on_profile === false ? 'Hidden from profile' : 'Display preference unavailable'}{!preview && labelDate(row.assigned_at) ? ` · ${labelDate(row.assigned_at)}` : ''}</small></div><button type='button' className='pdc-visibility-button' disabled={!visibilityAvailable || busyId !== null || row.display_on_profile === null} aria-label={`${row.display_on_profile === false ? 'Show' : 'Hide'} ${itemById.get(row.item_id)?.name ?? 'medal'}`} onClick={() => setVisibility(row, row.display_on_profile !== true)}>{busyId === row.id ? 'Saving' : row.display_on_profile === false ? <><FaEye />Show</> : <><FaEyeSlash />Hide</>}</button></div>)}</div>{medalParts.historical.length > 0 && <details className='pdc-past-awards'><summary>Earlier award records ({medalParts.historical.length})</summary>{medalParts.historical.map((row) => <p key={row.id}><strong>{itemById.get(row.item_id)?.name ?? 'Medal'}</strong><span>{labelDate(row.assigned_at)} to {labelDate(row.removed_at)}</span></p>)}</details>}</section>}
        {notice && <p className={`pdc-save-notice${notice.error ? ' is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
        <footer><span>{preview ? 'Reference art · Local preview' : record.detachment ?? 'Coldstream Gaming'}</span><span>Earned recognition.</span></footer>
      </section>
      <div className='pd-record-stack'>
        <section className='pd-panel pd-combat' aria-labelledby='pdc-combat-title'><header className='pd-section-head'><div><span className='pd-eyebrow'>The playing record</span><h2 id='pdc-combat-title'>Combat stats</h2></div><span className='pd-period'>All time</span></header><dl className='pd-metrics'>{[['Kills', numberLabel(stats.kills)], ['Deaths', numberLabel(stats.deaths)], ['K/D', numberLabel(stats.kdr, true)], ['MVPs', numberLabel(stats.mvps)], ['Top 5s', numberLabel(stats.top5)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd aria-label={value === 'N/R' ? `${label}: not recorded` : undefined}>{value}</dd></div>)}</dl><p className='pd-source'>Approved results only. N/R means not recorded, not zero.</p><a className='pd-text-link' href='#/leaderboard'>View the leaderboard <FaArrowRight /></a></section>
        <section className='pd-panel pd-attendance' aria-labelledby='pdc-attendance-title'><header className='pd-section-head'><div><span className='pd-eyebrow'>Time together</span><h2 id='pdc-attendance-title'>Attendance</h2></div><span className='pd-period'>All time</span></header><dl className='pd-attendance-metrics'><div><dt>Sampled voice time</dt><dd>{voiceLabel(stats.attendanceHours)}</dd></div><div><dt>Events attended</dt><dd>{numberLabel(stats.eventsAttended)}</dd></div></dl><p className='pd-source'>Recorded voice samples only. RSVP choices do not add attendance. Older records may include AFK time.</p><a className='pd-text-link' href='#/events'>Find the next event <FaArrowRight /></a></section>
      </div>
    </div>
    <div className='pd-lower-grid'><section className='pd-panel pdc-contributions'><header className='pd-section-head'><div><span className='pd-eyebrow'>Part of the story</span><h2>Community contributions</h2></div><FaCamera /></header><dl className='pd-metrics'>{[['Weekly features', stats.weeklyFeatures], ['Weekly submissions', stats.weeklySubmissions], ['Gallery uploads', stats.galleryUploads]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{numberLabel(typeof value === 'number' ? value : null)}</dd></div>)}</dl><p>Recorded submissions and published features. Removed submissions are not included. N/R means unavailable.</p><a className='pd-text-link' href='#/gallery'>Explore community media <FaArrowRight /></a></section><section className='pd-panel pd-history'><details><summary><div><span className='pd-eyebrow'>Your progression</span><h2>Rank history</h2></div><FaChevronDown /></summary>{!preview && ranks.length ? <ol>{ranks.map((row) => <li key={row.id}><span className='pd-history-dot' /><div><strong>{itemById.get(row.item_id)?.name ?? 'Rank'}</strong><small>{labelDate(row.assigned_at)}{row.removed_at ? ` to ${labelDate(row.removed_at)}` : ' · Current'}</small>{row.note && <p>{row.note}</p>}</div></li>)}</ol> : <p className='pd-empty'>{preview ? 'This preview does not invent a member service history.' : loading ? 'Opening rank history.' : 'No rank history recorded yet.'}</p>}</details></section></div>
    {!preview && member && <section className='pdc-member-notes' aria-label='About and member wall'><ProfileLive key={member.id} memberId={member.id} steamId={null} displayName={member.display_name} me={viewer} /></section>}
  </main>;
}
