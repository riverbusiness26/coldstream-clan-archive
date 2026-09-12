import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { FaArrowRight, FaCamera, FaChevronDown, FaMedal, FaPlay, FaShieldAlt } from 'react-icons/fa';
import DiscordAvatar from '../components/DiscordAvatar';
import ProfileDisplayCase from '../components/ProfileDisplayCase';
import type { Me } from '../lib/auth';
import { asset } from '../lib/asset';
import { EMPTY_COMBAT_STATS, loadCombatStats, type CombatStats } from '../lib/combatStats';
import { supa } from '../lib/supa';
import { loadPersonnelDisplayRows } from '../lib/medalVisibility';
import '../profile-designs.css';

type Design = 'display' | 'dossier' | 'fieldbook';
type RecordMode = 'artwork' | 'current';
interface CatalogueItem { id: string; kind: 'rank' | 'medal'; name: string; description: string | null; storage_key: string | null }
interface Award { id: string; name: string; description: string | null; image: string | null; date: string | null; ended: string | null; note: string | null }
interface MemberRecord { rank: Award | null; medals: Award[]; ranks: Award[]; detachment: string | null; stats: CombatStats }
const EMPTY_RECORD: MemberRecord = { rank: null, medals: [], ranks: [], detachment: null, stats: EMPTY_COMBAT_STATS };
const DESIGNS: { key: Design; number: string; name: string; summary: string; recommendation?: string }[] = [
  { key: 'display', number: '01', name: 'The display case', summary: 'A personal display of rank and medals. A compact record beside it.', recommendation: 'Recommended' },
  { key: 'dossier', number: '02', name: 'The service dossier', summary: 'A familiar profile at the left. An orderly record that opens like a document.' },
  { key: 'fieldbook', number: '03', name: 'The fieldbook', summary: 'Everything important in one compact view. Less scrolling, the same character.' },
];

function useMemberRecord(me: Me | null, enabled: boolean) {
  const [record, setRecord] = useState<MemberRecord>(EMPTY_RECORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRecord(EMPTY_RECORD);
    setError(null);
    setLoading(false);
    if (!enabled || !supa || !me || me.discord_id === 'preview') return;
    let cancelled = false;
    const db = supa;
    setLoading(true);
    void (async () => {
      try {
        const [catalogue, awards, member, stats] = await Promise.all([
          db.from('personnel_item').select('id,kind,name,description,storage_key').order('sort_order'),
          loadPersonnelDisplayRows(db, me.id),
          db.from('member').select('company_id').eq('id', me.id).maybeSingle(),
          loadCombatStats(db, me.id),
        ]);
        if (catalogue.error || member.error) throw new Error('This member record is not available right now.');
        const byId = new Map(((catalogue.data ?? []) as CatalogueItem[]).map((item) => [item.id, item]));
        const mapped = awards.rows.filter((row) => row.item_kind === 'rank' || row.display_on_profile === true).flatMap((row) => {
          const item = byId.get(row.item_id);
          return item ? [{ kind: row.item_kind, id: row.id, name: item.name, description: item.description,
            image: item.storage_key ? db.storage.from('personnel-artwork').getPublicUrl(item.storage_key).data.publicUrl : null,
            date: row.assigned_at, ended: row.removed_at, note: row.note }] : [];
        });
        let detachment: string | null = null;
        if (member.data?.company_id) {
          const company = await db.from('company').select('name').eq('id', member.data.company_id).maybeSingle();
          if (company.error) throw new Error('The detachment record could not be opened.');
          detachment = company.data?.name ?? null;
        }
        if (!cancelled) setRecord({
          rank: mapped.find((award) => award.kind === 'rank' && !award.ended) ?? null,
          medals: mapped.filter((award) => award.kind === 'medal' && !award.ended),
          ranks: mapped.filter((award) => award.kind === 'rank'), detachment, stats,
        });
      } catch (problem) {
        if (!cancelled) setError(problem instanceof Error ? problem.message : 'This record could not be opened.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me?.id, enabled]);
  return { record, loading, error };
}

function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
function statLabel(value: number | null, ratio = false) {
  return value === null || !Number.isFinite(value) ? 'N/R' : ratio ? value.toFixed(2) : value.toLocaleString('en-US');
}
function hoursLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'N/R';
  const minutes = Math.floor(Math.max(0, value) * 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function ProfileDesigns({ me }: { me: Me | null }) {
  return <ProfileDisplayCase member={me} viewer={me} forcePreview />;
}

// Keep the original alternatives available for a future design review.
// The selected route now previews the same component used by real profiles.
export function OriginalProfileConcepts({ me }: { me: Me | null }) {
  const [design, setDesign] = useState<Design>('display');
  const [mode, setMode] = useState<RecordMode>('artwork');
  const [recordSection, setRecordSection] = useState<'combat' | 'attendance' | 'community'>('combat');
  const [selectedMedal, setSelectedMedal] = useState<Award | null>(null);
  const { record, loading, error } = useMemberRecord(me, mode === 'current');
  const canReadMember = !!supa && !!me && me.discord_id !== 'preview';
  const artworkStudy = mode === 'artwork';
  const activeDesign = DESIGNS.find((item) => item.key === design)!;
  const displayName = artworkStudy ? 'Member preview' : me?.display_name ?? 'Your profile';
  const rank = useMemo<Award | null>(() => artworkStudy ? {
    id: 'artwork-study', name: 'Volunteer', description: 'River’s supplied shoulder-patch reference, shown for scale.',
    image: asset('/museum/profile-studies/volunteer.png'), date: null, ended: null, note: null,
  } : record.rank, [artworkStudy, record.rank]);
  const profileData = { rank, medals: artworkStudy ? [] : record.medals, stats: artworkStudy ? EMPTY_COMBAT_STATS : record.stats };
  const avatar = <DiscordAvatar url={me?.avatar_url ?? null} name={displayName} />;

  function identity(compact = false) {
    return <section className={`pd-identity ${compact ? 'pd-identity-compact' : ''}`} aria-label="Member overview">
      <div className="pd-avatar">{avatar}</div>
      <div className="pd-identity-copy"><span className="pd-eyebrow">Coldstream Gaming</span><h2>{displayName}</h2>
        <p>{artworkStudy ? 'A place for your part in the community.' : record.detachment ?? 'Community member'}</p>
        <div className="pd-identity-meta"><span>{rank?.name ?? 'Rank record'}</span><span>{artworkStudy ? 'Layout preview' : 'Member record'}</span></div>
      </div>
      {!compact && <p className="pd-identity-foot">Your rank. Your record.<br />The moments you were part of.</p>}
    </section>;
  }

  function honours() {
    return <section className="pd-honours" aria-labelledby="pd-honours-title" style={{ '--pd-cloth': `url("${asset('/textures/coldstream-felt-tile.png')}")` } as CSSProperties}>
      <header className="pd-section-head"><div><span className="pd-eyebrow">The regimental display</span><h3 id="pd-honours-title">Rank &amp; medals</h3></div><FaShieldAlt aria-hidden="true" /></header>
      <div className="pd-uniform">
        <figure className="pd-rank">
          <div className="pd-patch-seat">{rank?.image ? <img src={rank.image} alt={`${rank.name} shoulder patch${artworkStudy ? ', artwork study' : ''}`} width="144" height="216" /> : <span className="pd-missing-patch"><FaShieldAlt /><small>{loading ? 'Opening record' : 'Rank artwork'}</small></span>}</div>
          <figcaption><span className="pd-eyebrow">{artworkStudy ? 'Artwork study' : 'Current rank'}</span><strong>{rank?.name ?? (loading ? 'Opening record' : 'No rank recorded')}</strong>{rank?.date && <small>Since {dateLabel(rank.date)}</small>}</figcaption>
        </figure>
        <div className="pd-medals">
          <div className="pd-medal-heading"><h4>Distinctions</h4><span>{profileData.medals.length > 0 ? `${profileData.medals.length} awarded` : artworkStudy ? 'Artwork positions' : 'Your medals'}</span></div>
          {profileData.medals.length > 0 ? <div className="pd-medal-shelf">{profileData.medals.map((medal) => <button key={medal.id} type="button" className="pd-medal-item" onClick={() => setSelectedMedal(medal)} aria-label={`View ${medal.name}`}>
            {medal.image ? <img src={medal.image} alt="" loading="lazy" /> : <FaMedal aria-hidden="true" />}<span>{medal.name}</span>
          </button>)}</div> : artworkStudy ? <div className="pd-medal-positions" aria-label="Three illustrative medal positions, not awarded medals">
            {[1, 2, 3].map((position) => <figure key={position}><img className="pd-medal-reference" src={asset('/museum/profile-studies/medal-shape-reference.png')} alt="Supplied round patch used only as a medal shape reference" /><figcaption>Shape reference</figcaption></figure>)}
          </div> : <p className="pd-empty">{loading ? 'Opening your medal record.' : 'No medals recorded yet. Awarded medals will appear here with their date and details.'}</p>}
          <p className="pd-display-note">{artworkStudy ? 'The round patches show medal shape and scale only. They are not awarded medals.' : 'Select a medal to view its details. Artwork is never stretched or cropped.'}</p>
        </div>
      </div>
      <footer><span>{artworkStudy ? 'Shared cloth, subtle stitching' : record.detachment ?? 'Coldstream Gaming'}</span><span>{artworkStudy ? 'Patch shown at a modest scale' : 'A record of recognition'}</span></footer>
    </section>;
  }

  function combat() {
    const stats = profileData.stats;
    const metrics = [['Kills', statLabel(stats.kills)], ['Deaths', statLabel(stats.deaths)], ['K/D', statLabel(stats.kdr, true)], ['MVPs', statLabel(stats.mvps)], ['Top 5s', statLabel(stats.top5)]];
    return <section className="pd-panel pd-combat" aria-labelledby="pd-combat-title">
      <header className="pd-section-head"><div><span className="pd-eyebrow">The playing record</span><h3 id="pd-combat-title">Combat stats</h3></div><span className="pd-period">All time</span></header>
      <dl className="pd-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd aria-label={value === 'N/R' ? `${label}: not recorded` : undefined}>{value}</dd></div>)}</dl>
      <p className="pd-source">Approved results only. N/R means not recorded, not zero.</p>
      <a className="pd-text-link" href="#/leaderboard">View the leaderboard <FaArrowRight aria-hidden="true" /></a>
    </section>;
  }

  function attendance() {
    return <section className="pd-panel pd-attendance" aria-labelledby="pd-attendance-title"><header className="pd-section-head"><div><span className="pd-eyebrow">Time together</span><h3 id="pd-attendance-title">Attendance</h3></div><span className="pd-period">All time</span></header>
      <dl className="pd-attendance-metrics"><div><dt>Voice time</dt><dd>{hoursLabel(profileData.stats.attendanceHours)}</dd></div><div><dt>Events attended</dt><dd>{statLabel(profileData.stats.eventsAttended)}</dd></div></dl>
      <p className="pd-source">Time comes from Discord voice-presence samples. AFK channels are excluded. RSVP choices do not add hours.</p>
      <a className="pd-text-link" href="#/events">Find the next event <FaArrowRight aria-hidden="true" /></a>
    </section>;
  }

  function community() {
    return <section className="pd-panel pd-community" aria-labelledby="pd-community-title"><header className="pd-section-head"><div><span className="pd-eyebrow">Part of the story</span><h3 id="pd-community-title">Community contributions</h3></div></header>
      <div className="pd-contribution-row"><span className="pd-contribution-icon"><FaPlay aria-hidden="true" /></span><div><h4>Weekly features</h4><p>Appearances in the weekly feature</p></div><small>Not connected</small></div>
      <div className="pd-contribution-row"><span className="pd-contribution-icon"><FaCamera aria-hidden="true" /></span><div><h4>Media contributions</h4><p>Approved images and videos</p></div><small>Not connected</small></div>
      <p className="pd-source">Proposed counters. They need a verified per-member count before appearing on a real profile.</p>
      <a className="pd-text-link" href="#/gallery">Explore the gallery <FaArrowRight aria-hidden="true" /></a>
    </section>;
  }

  function history() {
    return <section className="pd-panel pd-history" aria-labelledby="pd-rank-history-title"><details><summary><div><span className="pd-eyebrow">Your progression</span><h3 id="pd-rank-history-title">Rank history</h3></div><FaChevronDown aria-hidden="true" /></summary>
      {!artworkStudy && record.ranks.length > 0 ? <ol>{record.ranks.map((entry) => <li key={entry.id}><span className="pd-history-dot" /><div><strong>{entry.name}</strong><small>{dateLabel(entry.date)}{entry.ended ? ` to ${dateLabel(entry.ended)}` : ' · Current'}</small>{entry.note && <p>{entry.note}</p>}</div></li>)}</ol> : <p className="pd-empty">{artworkStudy ? 'The chosen design will show each recorded rank and its dates here. This artwork study does not invent a service history.' : 'No rank history recorded yet.'}</p>}
    </details></section>;
  }

  return <main className={`profile-designs pd-design-${design}`} aria-labelledby="pd-page-title">
    <header className="pd-workbench"><div><span className="pd-eyebrow">Draft for approval · Profile studies</span><h1 id="pd-page-title">A record worth keeping.</h1><p>Three directions. Your current profile has not been replaced.</p></div><a href="#/home">Back to your weekly brief <FaArrowRight aria-hidden="true" /></a></header>
    <div className="pd-design-switcher" aria-label="Choose a profile design">{DESIGNS.map((option) => <button key={option.key} type="button" aria-pressed={design === option.key} onClick={() => { setDesign(option.key); setSelectedMedal(null); }}><span className="pd-design-number">{option.number}</span><span><strong>{option.name}</strong><small>{option.recommendation ?? (option.key === 'dossier' ? 'Record-led' : 'Compact')}</small></span><FaArrowRight aria-hidden="true" /></button>)}</div>
    <div className="pd-study-explainer"><p>{activeDesign.summary}</p><div className="pd-mode-switcher" aria-label="Profile data mode"><button type="button" aria-pressed={artworkStudy} onClick={() => setMode('artwork')}>Artwork study</button><button type="button" aria-pressed={!artworkStudy} disabled={!canReadMember} title={canReadMember ? 'Read your existing member record without changing it' : 'Available with a real signed-in member session'} onClick={() => setMode('current')}>My record</button></div></div>
    <div className="pd-provenance" role="status">{artworkStudy ? 'Illustrative layout, not a live member record. Existing shoulder-patch artwork; medal positions are placeholders. No statistics have been invented.' : loading ? 'Opening your existing record. Nothing on this page can change it.' : error ?? 'Read-only member record. Unknown data stays marked as unavailable.'}</div>
    <div className="pd-profile-canvas" key={design}>
      {design === 'display' && <>{identity(true)}<div className="pd-display-grid">{honours()}<div className="pd-record-stack">{combat()}{attendance()}</div></div><div className="pd-lower-grid">{community()}{history()}</div></>}
      {design === 'dossier' && <div className="pd-dossier-grid"><aside>{identity()}{history()}</aside><div className="pd-dossier-main">{honours()}{combat()}<div className="pd-lower-grid">{attendance()}{community()}</div></div></div>}
      {design === 'fieldbook' && <>{identity(true)}{honours()}<div className="pd-record-navigation" aria-label="Choose a record section">{(['combat', 'attendance', 'community'] as const).map((section) => <button key={section} type="button" aria-pressed={recordSection === section} onClick={() => setRecordSection(section)}>{section === 'combat' ? 'Combat stats' : section === 'attendance' ? 'Attendance' : 'Contributions'}</button>)}</div><div className="pd-fieldbook-record">{recordSection === 'combat' ? combat() : recordSection === 'attendance' ? attendance() : community()}</div>{history()}</>}
    </div>
    {selectedMedal && <section className="pd-medal-detail" aria-label="Selected medal details"><div>{selectedMedal.image && <img src={selectedMedal.image} alt="" />}<div><span className="pd-eyebrow">Awarded medal</span><h3>{selectedMedal.name}</h3>{selectedMedal.date && <p>Awarded {dateLabel(selectedMedal.date)}</p>}{selectedMedal.description && <p>{selectedMedal.description}</p>}{selectedMedal.note && <p>{selectedMedal.note}</p>}</div><button type="button" onClick={() => setSelectedMedal(null)}>Close details</button></div></section>}
    <footer className="pd-review-note"><strong>What to choose</strong><p>The display case puts the artwork first without making it oversized. The dossier gives long service records room. The fieldbook keeps the daily visit short.</p><p>All three retain the avatar and keep rank, medals, statistics and attendance together. Existing profile editing, member walls and admin controls remain in the current site until a direction is approved.</p></footer>
  </main>;
}
