import { useEffect, useRef, useState } from 'react';
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

export function HomeFilm() {
  const [slots, setSlots] = useState<[number, number]>([0, 1]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [loaded, setLoaded] = useState<[boolean, boolean]>([false, false]);
  const [transitioning, setTransitioning] = useState(false);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const film = HOME_FILMS[slots[activeSlot]];

  const advance = async () => {
    if (transitioning) return;
    const incoming = activeSlot === 0 ? 1 : 0;
    const outgoing = activeSlot;
    const incomingVideo = videos.current[incoming];
    if (!incomingVideo) return;
    setTransitioning(true);
    incomingVideo.currentTime = 0;
    await incomingVideo.play().catch(() => undefined);
    window.setTimeout(() => {
      setActiveSlot(incoming);
      window.setTimeout(() => {
        videos.current[outgoing]?.pause();
        const following = (slots[incoming] + 1) % HOME_FILMS.length;
        setLoaded((value) => value.map((state, index) => index === outgoing ? false : state) as [boolean, boolean]);
        setSlots((value) => value.map((slot, index) => index === outgoing ? following : slot) as [number, number]);
        setTransitioning(false);
      }, 1200);
    }, 120);
  };

  return (
    <div className={`cg-home-film${transitioning ? ' transitioning' : ''}`} aria-hidden="true">
      <img src={asset('/landing-desktop.jpg')} alt="" />
      {slots.map((slot, index) => {
        const slotFilm = HOME_FILMS[slot];
        return <div className={`cg-film-frame${index === activeSlot && loaded[index] ? ' active' : ''}`} key={`${index}-${slotFilm.src}`}>
          <video ref={(node) => { videos.current[index] = node; }} src={asset(slotFilm.src)} autoPlay={index === 0 && slot === 0} muted playsInline preload="auto" tabIndex={-1} onCanPlay={() => {
            setLoaded((value) => value.map((state, loadedIndex) => loadedIndex === index ? true : state) as [boolean, boolean]);
          }} onEnded={index === activeSlot ? advance : undefined} />
        </div>;
      })}
      <span><img src={asset(film.icon)} alt="" /><b>{film.label}</b></span>
    </div>
  );
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
  ['Home', '#/home'], ['Events', '#/events'], ['Our History', '#/archive'], ['Media', '#/gallery'], ['Join', DISCORD],
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
  { icon: 'calendar', value: '1,227+', label: 'Recorded Events' },
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
              <a className="hq-primary" href={DISCORD} target="_blank" rel="noopener"><Icon name="discord" />Join the 2ndCS</a>
              {me ? <a className="hq-secondary" href="#/player-profile"><Icon name="shield" />View my profile</a> : <button className="hq-secondary" type="button" onClick={signIn}><Icon name="discord" />Member sign in</button>}
            </div>
          </div>
          <div className="hub-hero-visual"><HomeFilm /></div>
        </section>

        <section className="hub-weekly" aria-labelledby="hub-weekly-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Weekly feature</p><h2 id="hub-weekly-title">This Week in the Coldstream</h2></div><span className="hub-date-note">Current archive video while submissions are being connected</span></header><HomeFilm /></section>

        <section className="hub-personal" aria-labelledby="your-statistics-title">
          <header className="hub-section-head"><div><p className="cg-eyebrow">For the member signed in</p><h2 id="your-statistics-title">Your Statistics</h2></div><div className="hub-periods" role="group" aria-label="Personal stats period">{PERIODS.map((item) => <button key={item} type="button" className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div></header>
          {me ? <>
            <div className="hub-member-intro"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><div><strong>{me.display_name}</strong><span>Personal stats will appear here as the Discord bot records activity.</span></div></div>
            <div className="hub-mode-grid">{MODES.map((mode) => <article key={mode} className="hub-stat-block"><h3>{mode}</h3><div><span><b>Pending</b><small>Kills</small></span><span><b>Pending</b><small>K/D</small></span><span><b>Pending</b><small>MVPs</small></span></div><p>Waiting for stat tracking</p></article>)}</div>
            <div className="hub-personal-foot"><div><span>Attendance</span><strong>Pending</strong><small>Awaiting confirmed event records</small></div><div><span>Next rank</span><strong>Placeholder</strong><small>Requirements will be connected to the rank tree</small></div></div>
          </> : <div className="hub-signin-prompt"><p>Sign in with Discord to see your stats, attendance, rank progress and place on the leaderboard.</p><button type="button" onClick={signIn}>Sign in through Discord</button></div>}
        </section>

        <section className="hub-events hub-events-compact" aria-labelledby="hub-events-title">
          <header className="hub-section-head"><div><p className="cg-eyebrow">The schedule</p><h2 id="hub-events-title">Upcoming events</h2></div><a className="hub-open-events" href="#/events">Open full calendar <Icon name="arrow" /></a></header>
          <div className="hub-next-events">{eventsLoading ? <p className="hub-empty">Loading the calendar.</p> : eventsError ? <p className="hub-empty">The calendar could not be opened right now.</p> : nextThree.length === 0 ? <p className="hub-empty">No events are on the calendar yet.</p> : <div className="hub-event-list">{nextThree.map((event) => { const starts = new Date(event.starts_at); return <article key={event.id}><time dateTime={event.starts_at}><b>{starts.toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{starts.toLocaleDateString(undefined, { month: 'short' })}</span></time><div><h3>{event.title}</h3><p>{event.game || 'Community event'} · {starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {event.duration_minutes} minutes</p></div><span className="hub-event-kind">{event.event_type || 'Scheduled'}</span></article>; })}</div>}</div>
        </section>

        <section className="hub-community-grid"><article className="hub-leaderboard" aria-labelledby="hub-leaderboard-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Community standing</p><h2 id="hub-leaderboard-title">Leaderboard</h2></div><span className="hub-coming">Bot data coming soon</span></header><div className="hub-podium"><div><b>Pending</b><span>Second</span></div><div className="first"><b>Pending</b><span>First</span></div><div><b>Pending</b><span>Third</span></div></div><p className="hub-empty">Public Play, Events and Competitive rankings will appear when the Discord bot begins recording results.</p></article><article className="hub-activity" aria-labelledby="hub-activity-title"><header className="hub-section-head"><div><p className="cg-eyebrow">Live from the community</p><h2 id="hub-activity-title">Recent activity</h2></div><span className="hub-coming">Waiting for bot events</span></header><p className="hub-empty">Rank changes, completed events, featured clips and new members will appear here.</p></article></section>
      </main>
      <SiteFooter />
    </div>
  );
}
