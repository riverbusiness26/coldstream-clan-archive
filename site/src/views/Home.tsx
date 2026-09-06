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
import { supa } from '../lib/supa';
import gallerySeed from '../seed/gallery.json';
import { youtubeId, youtubeThumb } from '../lib/gallery';

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

export function HomeFilm({ controls = false, weekly = [] }: { controls?: boolean; weekly?: WeeklyFeature[] } = {}) {
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
    <div className={`cg-home-film${transitioning ? ' transitioning' : ''}`}>
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
        <span className="cg-account-member"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><span>Signed in as <b>{me.display_name}</b></span></span>
        <a href="#/player-profile">My profile</a>
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

const PERIODS = ['Day', 'Week', 'Month'] as const;
const MODES = ['Public Play', 'Events', 'Competitive'] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Home({ me, signIn, signOut }: { me: Me | null; go: (v: string) => void; signIn: () => void; signOut: () => void }) {
  const now = new Date();
  const [period, setPeriod] = useState<typeof PERIODS[number]>('Month');
  const [monthCursor, setMonthCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyFeature[]>([]);

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

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstOffset = (new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), index - firstOffset + 1));
  const eventsByDay = events.reduce<Record<string, HomeEvent[]>>((byDay, event) => {
    const key = localDateKey(new Date(event.starts_at));
    (byDay[key] ||= []).push(event);
    return byDay;
  }, {});
  const nextThree = events.filter((event) => new Date(event.starts_at).getTime() >= Date.now()).slice(0, 3);

  return (
    <div className="cg-home hub-home">
      <SiteNav active="Home" />
      <AccountStrip me={me} signIn={signIn} signOut={signOut} />

      <main className="hub-main">
        <section className="hub-hero" aria-labelledby="cg-home-title">
          <div className="hub-hero-copy">
            <p className="cg-eyebrow">2nd Coldstream Guards · Holdfast</p>
            <h1 id="cg-home-title">Coldstream headquarters.</h1>
            <p className="hub-lede">The place to see what is happening, how you are doing, and where the regiment is forming up next.</p>
            <div className="hq-actions">
              {me ? <a className="hq-secondary" href="#/player-profile"><Icon name="shield" />View my profile</a> : <button className="hq-secondary" type="button" onClick={signIn}><Icon name="discord" />Member sign in</button>}
              {me && (me.role === 'moderator' || me.role === 'admin') && <a className="hq-secondary mobile-command-panel" href="#/admin"><Icon name="shield" />Open command panel</a>}
            </div>
          </div>
          <section className="hub-hero-stats" aria-labelledby="hero-statistics-title">
            <header><div><p className="cg-eyebrow">For the member signed in</p><h2 id="hero-statistics-title">Your Statistics</h2></div>{me && <div className="hub-periods" role="group" aria-label="Personal stats period">{PERIODS.map((item) => <button key={item} type="button" className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>}</header>
            {me ? <div className="hub-quick-stats"><div className="hub-stat-person"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><strong>{me.display_name}</strong></div><div><b>Pending</b><small>Kills</small></div><div><b>Pending</b><small>K/D</small></div><div><b>Pending</b><small>MVPs</small></div><div><b>Pending</b><small>Top 5s</small></div><div><b>Pending</b><small>Attendance</small></div><div><b>Placeholder</b><small>Rank</small></div><div><b>Placeholder</b><small>Detachment</small></div></div> : <div className="hub-quick-signin"><span>Sign in with Discord to see your kills, K/D, MVPs, Top 5s, attendance, rank and detachment.</span><button type="button" onClick={signIn}>Sign in</button></div>}
          </section>
        </section>

        <nav className="hub-quick-actions" aria-label="Member shortcuts">
          <span className="cg-eyebrow">Quick access</span>
          <a href="#/events"><Icon name="calendar" />View events</a>
          <a href="#/leaderboard"><Icon name="timeline" />Leaderboard</a>
          <a href="#/gallery"><Icon name="youtube" />Gallery</a>
          {me ? <a href="#/player-profile"><Icon name="shield" />My profile</a> : <button type="button" onClick={signIn}><Icon name="discord" />Sign in with Discord</button>}
        </nav>

        <section className="hub-weekly" aria-labelledby="hub-weekly-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Weekly feature</p><h2 id="hub-weekly-title">This Week in the Coldstream</h2></div><span className="hub-date-note">Top player of the week overall: <b>Pending</b></span></header><div className="hub-pulse" aria-label="Weekly activity"><span><b>{weekly.length}</b> approved features</span><span><b>{nextThree.length}</b> upcoming events</span><span><b>Sunday</b> weekly reset</span></div><HomeFilm controls weekly={weekly} /><WeeklyUpload me={me} onSubmitted={loadWeekly} /><div className="hub-weekly-events"><header className="hub-subhead"><div><p className="cg-eyebrow">The schedule</p><h3>Upcoming events</h3></div><a className="hub-open-events" href="#/events">Open full calendar <Icon name="arrow" /></a></header><div className="hub-next-events">{eventsLoading ? <p className="hub-empty">Loading the calendar.</p> : eventsError ? <p className="hub-empty">The calendar could not be opened right now.</p> : nextThree.length === 0 ? <p className="hub-empty">No events are on the calendar yet.</p> : <div className="hub-event-list">{nextThree.map((event) => { const starts = new Date(event.starts_at); return <article key={event.id}><time dateTime={event.starts_at}><b>{starts.toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{starts.toLocaleDateString(undefined, { month: 'short' })}</span></time><div><h3>{event.title}</h3><p>{event.game || 'Community event'} · {starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · Duration {event.duration_minutes} minutes</p></div><span className="hub-event-kind">{event.event_type || 'Scheduled'}</span></article>; })}</div>}</div></div><a className="hub-archive-link" href="#/gallery">Browse previous weekly features <Icon name="arrow" /></a></section>

        <section className="hub-community-grid"><article className="hub-leaderboard" aria-labelledby="hub-leaderboard-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Top players</p><h2 id="hub-leaderboard-title">Leaderboard</h2></div><span className="hub-coming">Bot data coming soon</span></header><div className="hub-podium"><div><b>Pending</b><span>Second</span></div><div className="first"><b>Pending</b><span>First</span></div><div><b>Pending</b><span>Third</span></div></div><p className="hub-empty">Public Play, Events and Competitive rankings will appear when the Discord bot begins recording results.</p></article><article className="hub-activity" aria-labelledby="hub-activity-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Live from the community</p><h2 id="hub-activity-title">Recent activity</h2></div><span className="hub-coming">Waiting for bot events</span></header><p className="hub-empty">Rank changes, completed events, featured clips and new members will appear here.</p></article></section>
      </main>
      <SiteFooter />
    </div>
  );
}
