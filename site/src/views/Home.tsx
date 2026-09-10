import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaBars,
  FaCalendarDays,
  FaDiscord,
  FaFlag,
  FaShieldHalved,
  FaSteam,
  FaTimeline,
  FaUserGroup,
  FaYoutube,
} from 'react-icons/fa6';
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';
import DiscordAvatar from '../components/DiscordAvatar';
import EventTypeIcon, { eventTypeSlug } from '../components/EventTypeIcon';
import { supa } from '../lib/supa';
import gallerySeed from '../seed/gallery.json';
import { youtubeId, youtubeThumb } from '../lib/gallery';
import { displayStat, EMPTY_COMBAT_STATS, loadCombatStats, type CombatStats } from '../lib/combatStats';

const DISCORD = 'https://discord.gg/75sfq5VPY';
const STEAM = 'https://steamcommunity.com/groups/2ndColdstreamOfficial';
const YOUTUBE = 'https://www.youtube.com/@2ndColdstreamGuards';

const HOME_FILMS = [
  { src: '/video/memories/tribute-2011.mp4', icon: '/steam-group-21stpa.jpg', label: '21st Pennsylvania · Battlegrounds 2 · May 2011' },
  { src: '/video/memories/militia-2011.mp4', icon: '/steam-group-21stpa.jpg', label: '21st Pennsylvania · Battlegrounds 2 · May 2011' },
  { src: '/video/memories/mount-musket-2012.mp4', icon: '/steam-group-2ndcoldstream.jpg', label: '2nd Coldstream · Mount & Musket · February 2012' },
  { src: '/video/memories/rwl-opening-2012.mp4', icon: '/steam-group-2ndcoldstream.jpg', label: '2nd Coldstream vs. 3eVolt · Napoleonic Wars · May 2012' },
  { src: '/video/memories/rwl-volley-2012.mp4', icon: '/steam-group-2ndcoldstream.jpg', label: '2nd Coldstream vs. 3eVolt · Napoleonic Wars · May 2012' },
  { src: '/video/memories/eighth-regiment-2012.mp4', icon: '/steam-group-2ndcoldstream.jpg', label: '2nd Coldstream vs. 8th Regiment · Napoleonic Wars · October 2012' },
  { src: '/video/memories/friday-linebattle-2012.mp4', icon: '/steam-group-2ndcoldstream.jpg', label: '2nd Coldstream · Friday Linebattle · 2012' },
] as const;

const GALLERY_STILLS = (gallerySeed as Array<{ src: string; caption: string }>).slice(0, 6).map((shot) => ({
  type: 'image' as const,
  src: shot.src,
  icon: '',
  label: shot.caption,
}));

const HOME_MEDIA = [
  ...HOME_FILMS.map((film) => ({ ...film, type: 'video' as const })),
  ...GALLERY_STILLS,
];

interface WeeklyFeature { id: string; url: string; title: string; description: string | null; provider: string; }

export function HomeFilm({ controls = false, weekly = [], mode = 'normal' }: { controls?: boolean; weekly?: WeeklyFeature[]; mode?: 'normal' | 'expanding' } = {}) {
  const [remoteWeekly, setRemoteWeekly] = useState<WeeklyFeature[]>([]);
  const loadRemoteWeekly = () => { const db = supa; if (!db) return; void db.rpc('deploy_weekly_content').then(() => db.from('weekly_content_submission').select('id,url,title,description,provider').eq('status', 'approved').not('deployed_at', 'is', null).gt('featured_until', new Date().toISOString()).is('archived_at', null).order('approved_at', { ascending: false }).then(({ data }) => setRemoteWeekly((data as WeeklyFeature[] | null) ?? []))); };
  useEffect(() => { loadRemoteWeekly(); const refresh = () => loadRemoteWeekly(); window.addEventListener('weekly-content-updated', refresh); return () => window.removeEventListener('weekly-content-updated', refresh); }, []);
  const mediaList = [...HOME_MEDIA, ...[...weekly, ...remoteWeekly].map((item) => ({ type: 'image' as const, src: item.provider === 'youtube' && youtubeId(item.url) ? youtubeThumb(youtubeId(item.url)!) : '/landing-desktop.jpg', icon: '', label: item.title }))];
  const [activeMedia, setActiveMedia] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const media = mediaList[activeMedia] ?? mediaList[0];

  const chooseMedia = (next: number) => {
    if (transitioning) return;
    setTransitioning(true);
    video.current?.pause();
    window.setTimeout(() => {
      setActiveMedia((next + mediaList.length) % mediaList.length);
      window.setTimeout(() => setTransitioning(false), 480);
    }, 120);
  };

  const advanceVideo = () => {
    const nextVideo = (activeMedia + 1) % HOME_FILMS.length;
    chooseMedia(nextVideo);
  };

  return (
    <div className={`cg-home-film cg-home-film--${mode}${transitioning ? ' transitioning' : ''}`}>
      <img src={asset('/landing-desktop.jpg')} alt="" />
      <div className="cg-film-frame active">
        {media.type === 'video' ? <video ref={video} src={asset(media.src)} autoPlay muted playsInline controls={controls} preload="auto" tabIndex={-1} onEnded={advanceVideo} /> : <img className="cg-film-still" src={asset(media.src)} alt={media.label} />}
      </div>
      <button className="cg-film-nav cg-film-nav-prev" type="button" onClick={() => chooseMedia(activeMedia - 1)} aria-label="Previous weekly media">←</button>
      <button className="cg-film-nav cg-film-nav-next" type="button" onClick={() => chooseMedia(activeMedia + 1)} aria-label="Next weekly media">→</button>
      <span><img src={media.icon ? asset(media.icon) : undefined} alt="" /><b>{media.label}</b></span>
    </div>
  );
}

function WeeklyUpload({ me, onSubmitted }: { me: Me | null; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false); const [url, setUrl] = useState(''); const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  if (!me) return <p className="hub-weekly-submit-note">Sign in with Discord to submit a highlight, funny moment or screenshot.</p>;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!me) return; setMessage(''); if (!/^https?:\/\//i.test(url.trim())) { setMessage('Paste a YouTube or stream link.'); return; }
    if (!supa) { setMessage('Submissions are unavailable in preview mode.'); return; }
    setBusy(true); const provider = youtubeId(url) ? 'youtube' : 'stream'; const memberId = me.id;
    const result = await supa.from('weekly_content_submission').insert({ submitter_id: memberId, url: url.trim(), provider, title: title.trim() || 'Weekly submission' });
    setBusy(false); if (result.error) { setMessage(result.error.message); return; } setUrl(''); setTitle(''); setOpen(false); setMessage('Sent to staff for review.'); window.dispatchEvent(new Event('weekly-content-updated')); onSubmitted();
  }
  return <div className="hub-weekly-submit"><p>Want to be featured? Submit your favorite highlights, funny moments or screenshots by clicking the upload button to the right, if your submission is accepted it will automatically post the next Monday morning!</p>{open ? <form onSubmit={submit}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={160} /><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube or stream link" required /><div><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send submission'}</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></div>{message && <small>{message}</small>}</form> : <button type="button" onClick={() => setOpen(true)}>Upload</button>}{!open && message && <small>{message}</small>}</div>;
}

type IconName = 'menu' | 'discord' | 'steam' | 'youtube' | 'calendar' | 'banner' | 'people' | 'timeline' | 'shield' | 'arrow';

const ICONS: Record<IconName, IconType> = {
  menu: FaBars,
  discord: FaDiscord,
  steam: FaSteam,
  youtube: FaYoutube,
  calendar: FaCalendarDays,
  banner: FaFlag,
  people: FaUserGroup,
  timeline: FaTimeline,
  shield: FaShieldHalved,
  arrow: FaArrowRight,
};

export function Icon({ name }: { name: IconName }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" focusable="false" />;
}

const NAV = [
  ['Home', '#/home'], ['Events', '#/events'], ['Leaderboard', '#/leaderboard'], ['Our History', '#/archive'], ['Media', '#/gallery'], ['Join', DISCORD],
] as const;

export function SiteNav({ active = 'Home' }: { active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="cg-nav">
      <button className="cg-menu" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        <Icon name="menu" />
      </button>
      <nav aria-label="Primary" className={menuOpen ? 'open' : undefined}>
        {NAV.map(([label, href]) => <a key={label} className={label === active ? 'active' : undefined} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener' : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <div className="cg-social" aria-label="Community links">
        <a href={DISCORD} target="_blank" rel="noopener" aria-label="Discord"><Icon name="discord" /></a>
        <a href={STEAM} target="_blank" rel="noopener" aria-label="2nd Coldstream Official Steam group"><Icon name="steam" /></a>
        <a href={YOUTUBE} target="_blank" rel="noopener" aria-label="2nd Coldstream YouTube channel"><Icon name="youtube" /></a>
      </div>
    </header>
  );
}

export function AccountStrip({ me, signIn, signOut }: { me: Me | null; signIn: () => void; signOut: () => void }) {
  return (
    <div className="cg-account-strip" aria-label="Member account">
      {me ? <>
        <a className="member-profile-link cg-account-member" href="#/profile"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><span>Signed in as <b>{me.display_name}</b></span></a>
        <a href="#/profile">My profile</a>
        {(me.role === 'moderator' || me.role === 'admin') && <a href="#/admin">Command Board</a>}
        <button type="button" onClick={signOut}>Sign out</button>
      </> : <button type="button" onClick={signIn}>Sign in through Discord</button>}
    </div>
  );
}

const STATS = [
  { icon: 'calendar', value: '2011', label: 'Established' },
  { icon: 'timeline', value: '4', label: 'Line-Battle Eras' },
  { icon: 'people', value: '315+', label: 'Members' },
  { icon: 'calendar', value: '1227', label: 'Recorded Events' },
] as const satisfies readonly { icon: IconName; value: string; label: string }[];

function Ornament() {
  return <span className="cg-ornament" aria-hidden="true"><i /><b>◆</b><i /></span>;
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="cg-footer">
      <div className="cg-width">
        <span>© 2011–{year} Coldstream Gaming. All rights reserved.</span>
        <span className="cg-footer-motto"><Ornament /><em>Second to none.</em><Ornament /></span>
        <nav aria-label="Footer"><a href="#/archive">Our History</a><a href="#/gallery">Gallery</a><a href="mailto:contact@coldstreamgaming.com">Contact</a></nav>
      </div>
    </footer>
  );
}

interface HomeEvent {
  id: string;
  title: string;
  game: string | null;
  starts_at: string;
  duration_minutes: number;
  event_type?: string | null;
}

interface TopPlayer {
  member_id: string;
  name: string;
  discord_id: string | null;
  kills: number;
  mvps: number;
  top5: number;
  kdr: number;
}

const PERIODS = ['Day', 'Week', 'Month'] as const;
const MODES = ['Public Play', 'Events', 'Competitive'] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function countdownLabel(startsAt: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((new Date(startsAt).getTime() - now) / 60_000));
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return `in ${hours}h${remaining ? ` ${remaining}m` : ''}`;
  const days = Math.floor(hours / 24);
  return `in ${days}d${hours % 24 ? ` ${hours % 24}h` : ''}`;
}

export default function Home({ me, signIn, signOut }: { me: Me | null; go: (v: string) => void; signIn: () => void; signOut: () => void }) {
  const [clock, setClock] = useState(() => Date.now());
  const now = new Date(clock);
  const [period, setPeriod] = useState<typeof PERIODS[number]>('Month');
  const [monthCursor, setMonthCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyFeature[]>([]);
  const [homeStats, setHomeStats] = useState<CombatStats>(EMPTY_COMBAT_STATS);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [homeRank, setHomeRank] = useState('Not assigned');
  const [homeDetachment, setHomeDetachment] = useState('Not assigned');

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supa) { setEventsLoading(false); return; }
    let cancelled = false;
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    setEventsLoading(true);
    setEventsError(false);
    supa.from('event')
      .select('id,title,game,starts_at,duration_minutes,event_type')
      .eq('historic', false)
      .eq('cancelled', false)
      .gte('starts_at', monthStart.toISOString())
      .lt('starts_at', monthEnd.toISOString())
      .order('starts_at')
      .then((result) => {
        if (cancelled) return;
        if (result.error) setEventsError(true);
        setEvents((result.data as HomeEvent[] | null) ?? []);
        setEventsLoading(false);
      });
    return () => { cancelled = true; };
  }, [monthCursor]);

  const loadWeekly = () => { const db = supa; if (!db) return; void db.rpc('deploy_weekly_content').then(() => db.from('weekly_content_submission').select('id,url,title,description,provider').eq('status', 'approved').not('deployed_at', 'is', null).gt('featured_until', new Date().toISOString()).is('archived_at', null).order('approved_at', { ascending: false }).then(({ data }) => setWeekly((data as WeeklyFeature[] | null) ?? []))); };
  useEffect(() => { loadWeekly(); }, []);
  useEffect(() => {
    if (!supa || !me) { setHomeStats(EMPTY_COMBAT_STATS); setHomeRank('Not assigned'); setHomeDetachment('Not assigned'); return; }
    const db = supa;
    let cancelled = false;
    void Promise.all([
      loadCombatStats(db, me.id, period),
      db.from('personnel_assignment').select('item_id,item_kind,assigned_at').eq('member_id', me.id).is('removed_at', null).order('assigned_at', { ascending: false }),
      db.from('personnel_item').select('id,name,kind'),
      db.from('member').select('company_id').eq('id', me.id).maybeSingle(),
    ]).then(async ([stats, assignments, items, member]) => {
      if (cancelled) return;
      setHomeStats(stats);
      const itemMap = new Map((items.data ?? []).map((item: any) => [item.id, item]));
      const rank = (assignments.data ?? []).find((row: any) => row.item_kind === 'rank');
      setHomeRank(rank ? itemMap.get(rank.item_id)?.name ?? 'Assigned rank' : 'Not assigned');
      const companyId = member.data?.company_id as string | null | undefined;
      if (companyId) {
        const company = await db.from('company').select('name').eq('id', companyId).maybeSingle();
        if (!cancelled) setHomeDetachment(company.data?.name ?? 'Assigned detachment');
      } else setHomeDetachment('Not assigned');
    }).catch(() => { if (!cancelled) { setHomeStats(EMPTY_COMBAT_STATS); setHomeRank('Not assigned'); setHomeDetachment('Not assigned'); } });
    return () => { cancelled = true; };
  }, [me, period]);
  useEffect(() => {
    if (!supa) { setTopPlayers([]); return; }
    let cancelled = false;
    void Promise.all([
      supa.from('stat_leaderboard').select('member_id,kills,deaths,mvps,top5,kdr'),
      supa.from('member').select('id,display_name,discord_id'),
    ]).then(([stats, members]) => {
      if (cancelled) return;
      const memberMap = new Map((members.data ?? []).map((row: any) => [row.id, row]));
      const totals = new Map<string, { member_id: string; kills: number; deaths: number; mvps: number; top5: number }>();
      for (const row of (stats.data ?? []) as any[]) {
        const current = totals.get(row.member_id) ?? { member_id: row.member_id, kills: 0, deaths: 0, mvps: 0, top5: 0 };
        current.kills += Number(row.kills) || 0; current.deaths += Number(row.deaths) || 0; current.mvps += Number(row.mvps) || 0; current.top5 += Number(row.top5) || 0;
        totals.set(row.member_id, current);
      }
      setTopPlayers([...totals.values()].sort((a, b) => b.kills - a.kills || (b.deaths ? b.kills / b.deaths : b.kills) - (a.deaths ? a.kills / a.deaths : a.kills) || b.top5 - a.top5 || b.mvps - a.mvps).slice(0, 3).map((row) => ({ ...row, kdr: row.deaths ? row.kills / row.deaths : row.kills, name: memberMap.get(row.member_id)?.display_name ?? 'Discord member', discord_id: memberMap.get(row.member_id)?.discord_id ?? null })));
    });
    return () => { cancelled = true; };
  }, []);

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstOffset = (new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), index - firstOffset + 1));
  const eventsByDay = events.reduce<Record<string, HomeEvent[]>>((byDay, event) => {
    const key = localDateKey(new Date(event.starts_at));
    (byDay[key] ||= []).push(event);
    return byDay;
  }, {});
  const nextThree = events.filter((event) => new Date(event.starts_at).getTime() >= clock).slice(0, 3);
  const nextEvent = nextThree[0] ?? null;
  const activityItems = [
    ...nextThree.map((event) => ({ label: 'Upcoming event', title: event.title, detail: `${countdownLabel(event.starts_at, clock)} · ${event.game || 'Community event'}`, kind: 'Event' })),
    ...weekly.slice(0, 2).map((feature) => ({ label: 'Weekly feature', title: feature.title, detail: 'Approved feature currently in rotation', kind: 'Weekly' })),
  ].slice(0, 4);

  return (
    <div className="cg-home hub-home">
      <SiteNav active="Home" />
      <AccountStrip me={me} signIn={signIn} signOut={signOut} />

      <main className="hub-main">
        <section className="hub-status" aria-label="Coldstream status">
          <div className="hub-status-member">{me ? <a className="member-profile-link" href="#/profile"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><div><span className="cg-eyebrow">Member headquarters</span><strong>{me.display_name}</strong><small>Volunteer · Line Infantry</small></div></a> : <><DiscordAvatar url={null} name="Guest" /><div><span className="cg-eyebrow">Coldstream Gaming</span><strong>Welcome to Coldstream</strong><small>Sign in with Discord to open your member hub</small></div></>}</div>
          <div className="hub-status-next">{nextEvent ? <><span className="cg-eyebrow">Next on the calendar</span><strong>{nextEvent.title}</strong><small><time dateTime={nextEvent.starts_at}>{new Date(nextEvent.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time> · {countdownLabel(nextEvent.starts_at, clock)} · Duration {nextEvent.duration_minutes} minutes</small></> : <><strong>No events on the calendar</strong><a href="#/events">Open Events</a></>}</div>
        </section>

        <section className="hub-weekly" aria-labelledby="hub-weekly-title"><header className="hub-section-head"><div><p className="cg-eyebrow">The week</p><h2 id="hub-weekly-title">This Week in the Coldstream</h2></div><span className="hub-date-note">Week of {now.toLocaleDateString(undefined, { month: 'long' })}</span></header><div className="hub-weekly-grid"><div className="hub-weekly-media"><HomeFilm controls mode="normal" weekly={weekly} /><a className="hub-archive-link" href="#/gallery">Previous features <Icon name="arrow" /></a></div><aside className="hub-rail" aria-label="Weekly highlights"><article className="hub-rail-card"><p className="cg-eyebrow">Featured member</p><strong>Staff feature not set</strong><span>It will appear here when selected by staff.</span></article><article className="hub-rail-card"><p className="cg-eyebrow">Top player of the week</p><strong>Data will appear after approval</strong><span>Overall results across approved submissions.</span><div className="hub-rail-metrics"><span><b>—</b>Kills</span><span><b>—</b>K/D</span><span><b>—</b>MVPs</span></div></article><div className="hub-pulse" aria-label="Weekly activity"><span><b>{weekly.length}</b> approved features</span><span><b>{nextThree.length}</b> events this week</span><span><b>Mon 12 AM</b> resets CT</span></div><article className="hub-rail-card hub-rail-submit"><p className="cg-eyebrow">Get featured</p><WeeklyUpload me={me} onSubmitted={loadWeekly} /></article></aside></div><div className="hub-weekly-events"><header className="hub-subhead"><div><p className="cg-eyebrow">Upcoming events</p></div><a className="hub-open-events" href="#/events">Full calendar <Icon name="arrow" /></a></header><div className="hub-next-events">{eventsLoading ? <p className="hub-empty">Loading the calendar.</p> : eventsError ? <p className="hub-empty">The calendar could not be opened right now.</p> : nextThree.length === 0 ? <p className="hub-empty">No events are on the calendar yet.</p> : <div className="hub-event-list">{nextThree.map((event) => { const starts = new Date(event.starts_at); const type = eventTypeSlug(event.event_type); return <article className={`event-kind-${type}`} key={event.id}><time dateTime={event.starts_at}><b>{starts.toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{starts.toLocaleDateString(undefined, { weekday: 'short' })}</span></time><div><h3>{event.title}</h3><p>{starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {event.game || 'Community event'} · Duration {event.duration_minutes} minutes</p></div><span className="hub-event-kind"><EventTypeIcon type={event.event_type} />{event.event_type || 'Scheduled'}</span></article>; })}</div>}</div></div></section>

        <section className="hub-hero-stats hub-personal" aria-labelledby="hero-statistics-title"><header><div><p className="cg-eyebrow">For the member signed in</p><h2 id="hero-statistics-title">Your Statistics</h2></div>{me && <div className="hub-periods" role="group" aria-label="Personal stats period">{PERIODS.map((item) => <button key={item} type="button" className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>}</header>{me ? <div className="hub-quick-stats"><div className="hub-stat-person"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><strong>{me.display_name}</strong></div><div><b>{displayStat(homeStats.kills)}</b><small>Kills</small></div><div><b>{displayStat(homeStats.kdr, homeStats.kdr === null ? '' : '×')}</b><small>K/D</small></div><div><b>{displayStat(homeStats.mvps)}</b><small>MVPs</small></div><div><b>{displayStat(homeStats.top5)}</b><small>Top 5s</small></div><div><b>{displayStat(homeStats.attendancePercent, homeStats.attendancePercent === null ? '' : '%')}</b><small>Attendance</small></div><div><b>{homeRank}</b><small>Rank</small></div><div><b>{homeDetachment}</b><small>Detachment</small></div></div> : <div className="hub-quick-signin"><span>Sign in with Discord to see your kills, K/D, MVPs, Top 5s, attendance, rank and detachment.</span><button type="button" onClick={signIn}>Sign in</button></div>}</section>

        <nav className="hub-quick-actions" aria-label="Member shortcuts"><span className="cg-eyebrow">Quick access</span><a href="#/events"><Icon name="calendar" />View events</a><a href="#/leaderboard"><Icon name="timeline" />Leaderboard</a><a href="#/gallery"><Icon name="youtube" />Gallery</a>{me ? <a href="#/profile"><Icon name="shield" />My profile</a> : <button type="button" onClick={signIn}><Icon name="discord" />Sign in with Discord</button>}{me && (me.role === 'moderator' || me.role === 'admin') && <a className="hub-staff-action" href="#/admin"><Icon name="shield" />Staff command panel</a>}</nav>

        <section className="hub-community-grid"><article className="hub-leaderboard" aria-labelledby="hub-leaderboard-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Top players</p><h2 id="hub-leaderboard-title">Leaderboard</h2></div><a className="hub-open-events" href="#/leaderboard">View full leaderboard <Icon name="arrow" /></a></header>{topPlayers.length === 0 ? <p className="hub-empty">Leaderboard results will appear here as approved stat submissions arrive.</p> : <div className="hub-top-players">{topPlayers.map((player, index) => player.discord_id && me?.id === player.member_id ? <a className={`hub-top-player place-${index + 1}`} href="#/profile" key={player.member_id}><span className="hub-top-badge" aria-hidden="true" /><strong>{player.name}</strong><small>{player.kills} kills · {player.kdr.toFixed(2)} K/D · {player.mvps} MVPs · {player.top5} Top 5s</small></a> : <div className={`hub-top-player place-${index + 1}`} key={player.member_id}><span className="hub-top-badge" aria-hidden="true" /><strong>{player.name}</strong><small>{player.kills} kills · {player.kdr.toFixed(2)} K/D · {player.mvps} MVPs · {player.top5} Top 5s</small></div>)}</div>}</article><article className="hub-activity" aria-labelledby="hub-activity-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Live from the community</p><h2 id="hub-activity-title">Recent activity</h2></div><a className="hub-open-events" href="#/events">View events <Icon name="arrow" /></a></header>{activityItems.length === 0 ? <p className="hub-empty">Activity will appear here as events are scheduled and weekly features are approved.</p> : <div className="hub-activity-list">{activityItems.map((item, index) => <article key={`${item.kind}-${item.title}-${index}`}><span>{item.label}</span><strong>{item.title}</strong><small>{item.detail}</small><em>{item.kind}</em></article>)}</div>}</article></section>

      </main>
      <SiteFooter />
    </div>
  );
}
