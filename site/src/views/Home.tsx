import { useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaBars,
  FaDiscord,
  FaSteam,
  FaYoutube,
} from 'react-icons/fa6';
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';
import DiscordAvatar from '../components/DiscordAvatar';

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

type IconName = 'menu' | 'discord' | 'steam' | 'youtube' | 'arrow';

const ICONS: Record<IconName, IconType> = {
  menu: FaBars,
  discord: FaDiscord,
  steam: FaSteam,
  youtube: FaYoutube,
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
  { value: '2011', label: 'Founded' },
  { value: '4', label: 'Eras' },
  { value: '315+', label: 'Members' },
  { value: '1,227+', label: 'Events' },
] as const;

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

export default function Home({ me, signIn, signOut }: { me: Me | null; go: (v: string) => void; signIn: () => void; signOut: () => void }) {
  return (
    <div className="cg-home csg-homepage">
      <SiteNav active="Home" />
      <AccountStrip me={me} signIn={signIn} signOut={signOut} />

      <main className="csg-home-main">
        <section className="csg-home-hero" aria-labelledby="cg-home-title">
          <div className="csg-home-glow" aria-hidden="true" />
          <img className="csg-home-crest" src={asset('/home/hero-crest-blood.png')} width="1228" height="1228" alt="Coldstream Gaming Second to None crest" fetchPriority="high" />
          <h1 id="cg-home-title">Coldstream Gaming</h1>
          <div className="csg-home-motto" aria-label="Second to none"><i /><span>Second to none.</span><i /></div>
          <div className="csg-home-actions">
            <a className="csg-home-primary" href={DISCORD} target="_blank" rel="noopener">Join us (Discord)</a>
            {me
              ? <a className="csg-home-secondary" href="#/player-profile">My profile <Icon name="arrow" /></a>
              : <button className="csg-home-secondary" type="button" onClick={signIn}>Member login</button>}
          </div>
        </section>

        <section className="csg-home-stats" aria-label="Coldstream Gaming history in numbers">
          {STATS.map((stat) => <div key={stat.label}><b>{stat.value}</b><span>{stat.label}</span></div>)}
        </section>

        <section className="csg-home-about" aria-labelledby="csg-home-about-title">
          <div>
            <h2 id="csg-home-about-title">Who we are</h2>
            <p>A multi-gaming community established in 2011, home of the 2nd Coldstream Holdfast regiment.</p>
          </div>
          <a href="#/archive">See our history <Icon name="arrow" /></a>
        </section>
        <div className="csg-home-values" aria-label="Discipline, loyalty, excellence"><i />Discipline <b>•</b> Loyalty <b>•</b> Excellence <i /></div>
      </main>
    </div>
  );
}
