import { useEffect, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaBars,
  FaCalendarDays,
  FaDiscord,
  FaFlag,
  FaGamepad,
  FaServer,
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
import { useLiveServers } from '../lib/useLiveServers';

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

type IconName = 'menu' | 'discord' | 'steam' | 'youtube' | 'server' | 'calendar' | 'banner' | 'people' | 'gamepad' | 'timeline' | 'shield' | 'arrow';

const ICONS: Record<IconName, IconType> = {
  menu: FaBars,
  discord: FaDiscord,
  steam: FaSteam,
  youtube: FaYoutube,
  server: FaServer,
  calendar: FaCalendarDays,
  banner: FaFlag,
  people: FaUserGroup,
  gamepad: FaGamepad,
  timeline: FaTimeline,
  shield: FaShieldHalved,
  arrow: FaArrowRight,
};

export function Icon({ name }: { name: IconName }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" focusable="false" />;
}

const NAV = [
  ['Home', '#/home'], ['About', '#/archive'], ['Media', '#/gallery'], ['Join', DISCORD],
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
        <nav aria-label="Footer"><a href="#/archive">History</a><a href="#/gallery">Gallery</a><a href="#/servers">Game Servers</a><a href="mailto:contact@coldstreamgaming.com">Contact</a></nav>
      </div>
    </footer>
  );
}

interface HomeEvent { id: string; title: string; game: string | null; starts_at: string; duration_minutes: number }

export default function Home({ me, signIn, signOut }: { me: Me | null; go: (v: string) => void; signIn: () => void; signOut: () => void }) {
  const servers = useLiveServers();
  const [events, setEvents] = useState<HomeEvent[]>([]);

  useEffect(() => {
    if (!supa) return;
    const db = supa;
    let cancelled = false;
    db.from('event').select('id,title,game,starts_at,duration_minutes').eq('historic', false).eq('cancelled', false).gte('starts_at', new Date().toISOString()).order('starts_at').limit(3).then((eventResult) => {
      if (!cancelled && eventResult.data) setEvents(eventResult.data as HomeEvent[]);
    });
    return () => { cancelled = true; };
  }, []);

  const onlineServers = servers.filter((server) => server.online);
  const playersOnline = onlineServers.reduce((total, server) => total + server.players, 0);

  return (
    <div className="cg-home">
      <SiteNav active="Home" />
      <AccountStrip me={me} signIn={signIn} signOut={signOut} />

      <main className="hq-home">
        <section className="hq-hero" aria-labelledby="cg-home-title">
          <div className="hq-hero-copy">
            <p className="cg-eyebrow">2nd Coldstream Guards · Holdfast</p>
            <h1 id="cg-home-title">The line forms here.</h1>
            <p className="hq-lede">Weekly 200+ player linebattles, backed by 15+ years across Napoleonic-era games. Join the regiment, earn your place and keep the record on your own profile.</p>
            <div className="hq-actions">
              <a className="hq-primary" href={DISCORD} target="_blank" rel="noopener"><Icon name="discord" />Join the 2ndCS</a>
              {me
                ? <a className="hq-secondary" href="#/player-profile"><Icon name="shield" />View my profile</a>
                : <button className="hq-secondary" type="button" onClick={signIn}><Icon name="discord" />Member sign in</button>}
            </div>
            <div className="hq-enlist-path" aria-label="How to enlist in Holdfast">
              <span><b>01</b>Pause Holdfast</span><i />
              <span><b>02</b>Open Regiments</span><i />
              <span><b>03</b>Search <strong>2ndCS</strong> and Enlist</span>
            </div>
          </div>
          <div className="hq-hero-visual">
            <HomeFilm />
            <div className="hq-standard"><img src={asset('/crest.webp')} width="900" height="920" alt="Coldstream Gaming crest" fetchPriority="high" /><span>Second to none.</span></div>
            <div className="hq-hero-record"><span>Service record</span><b>Ranks, medals and attendance</b><small>Kept with your member profile</small></div>
          </div>
        </section>

        <section className="hq-section" aria-labelledby="hq-title">
          <header className="hq-section-head"><div><p className="cg-eyebrow">Coldstream today</p><h2 id="hq-title">Community headquarters</h2></div><p>Events, servers and member records in one place.</p></header>
          <div className="hq-grid">
            <article className="hq-card hq-events">
              <header><span><Icon name="calendar" /></span><div><small>Schedule</small><h3>Upcoming events</h3></div><a href={DISCORD} target="_blank" rel="noopener">Discord <Icon name="arrow" /></a></header>
              <div className="hq-event-list">{events.length > 0 ? events.map((event) => {
                const starts = new Date(event.starts_at);
                return <div key={event.id}><time dateTime={event.starts_at}><b>{starts.toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{starts.toLocaleDateString(undefined, { month: 'short' })}</span></time><div><h4>{event.title}</h4><p>{event.game || 'Community event'} · {starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {event.duration_minutes} minutes</p></div></div>;
              }) : <p className="hq-empty">The next event will appear here when staff posts it.</p>}</div>
            </article>

            <article className="hq-card hq-servers">
              <header><span><Icon name="server" /></span><div><small>Live status</small><h3>Game servers</h3></div><a href="#/servers">All servers <Icon name="arrow" /></a></header>
              <div className="hq-server-total"><b>{playersOnline}</b><span>players online</span><small>{onlineServers.length} of {servers.length} servers reporting online</small></div>
              <div className="hq-server-list">{servers.slice(0, 3).map((server) => <div key={server.server_key}><i className={server.online ? 'online' : ''} /><span><b>{server.name}</b><small>{server.online ? `${server.players}/${server.max_players}${server.map ? ` · ${server.map}` : ''}` : server.visibility === 'private' ? 'Private development server' : 'Offline'}</small></span></div>)}</div>
            </article>

            <article className="hq-card hq-member">
              <header><span><Icon name="shield" /></span><div><small>{me ? 'Your account' : 'Member record'}</small><h3>{me ? me.display_name : 'Your place in the regiment'}</h3></div></header>
              {me ? <><div className="hq-member-row"><DiscordAvatar url={me.avatar_url} name={me.display_name} /><div><b>Discord connected</b><span>Profile ready to view</span></div></div><div className="hq-member-links"><a href="#/player-profile">Open profile</a>{(me.role === 'admin' || me.role === 'moderator') && <a href="#/admin">Admin Panel</a>}</div></> : <><p>Your rank, medals, detachment and confirmed event record stay together here.</p><button type="button" onClick={signIn}>Sign in through Discord</button></>}
            </article>
          </div>
        </section>

        <section className="hq-history" aria-labelledby="hq-history-title">
          <div className="hq-history-copy"><p className="cg-eyebrow">The record</p><h2 id="hq-history-title">Built over more than one era.</h2><p>Coldstream Gaming began in 2011. The games changed, the regiment returned, and the same gaming community kept forming up.</p><a href="#/archive">Open the full archive <Icon name="arrow" /></a></div>
          <div className="hq-stats" aria-label="Coldstream Gaming statistics">{STATS.map((stat) => <div key={stat.label}><span><Icon name={stat.icon} /></span><b>{stat.value}</b><small>{stat.label}</small></div>)}</div>
          <div className="hq-links"><a href="#/gallery"><span>Gallery</span><b>See the nights we kept.</b><Icon name="arrow" /></a><a href="#/servers"><span>Games</span><b>Find the servers.</b><Icon name="arrow" /></a><a href={STEAM} target="_blank" rel="noopener"><span>Steam</span><b>Join the group.</b><Icon name="arrow" /></a></div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
