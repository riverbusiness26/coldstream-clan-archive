import { useRef, useState, type CSSProperties } from 'react';
import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaBars,
  FaCalendarDays,
  FaDiscord,
  FaEnvelope,
  FaFlag,
  FaGamepad,
  FaServer,
  FaShieldHalved,
  FaSteam,
  FaTimeline,
  FaUserGroup,
} from 'react-icons/fa6';
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';

const DISCORD = 'https://discord.gg/75sfq5VPY';
const STEAM = 'https://steamcommunity.com/groups/coldstreamgaming';

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

type IconName = 'menu' | 'discord' | 'steam' | 'mail' | 'server' | 'calendar' | 'banner' | 'people' | 'gamepad' | 'timeline' | 'shield' | 'arrow';

const ICONS: Record<IconName, IconType> = {
  menu: FaBars,
  discord: FaDiscord,
  steam: FaSteam,
  mail: FaEnvelope,
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
  ['Home', '#/home'], ['About', '#/archive'], ['Games', '#/servers'],
  ['Community', DISCORD], ['Media', '#/gallery'], ['Join', DISCORD],
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
        <a href={STEAM} target="_blank" rel="noopener" aria-label="Steam group"><Icon name="steam" /></a>
        <a href="mailto:contact@coldstreamgaming.com" aria-label="Email Coldstream Gaming"><Icon name="mail" /></a>
      </div>
    </header>
  );
}

const PILLARS = [
  { icon: 'server', title: 'Game Servers', copy: 'Community servers maintained by active admins and moderators.', href: '#/servers', image: '/gallery/2f2f6869d3.jpg' },
  { icon: 'calendar', title: 'Events', copy: 'Scheduled game nights and organised events across the games we play.', href: DISCORD, image: '/gallery/7a32547d74.jpg' },
  { icon: 'banner', title: '2nd Coldstream', copy: 'Our Holdfast regiment for line battles, training and organised play.', href: '#/archive', image: '/gallery/5e8775785e.jpg' },
  { icon: 'people', title: 'Community', copy: 'Meet members, find games and follow community updates on Discord.', href: DISCORD, image: '/gallery/210325a830.png' },
] as const satisfies readonly { icon: IconName; title: string; copy: string; href: string; image: string }[];

const STATS = [
  { icon: 'calendar', value: '2011', label: 'Established' },
  { icon: 'timeline', value: '4', label: 'Line-Battle Eras' },
  { icon: 'people', value: '315+', label: 'Members' },
  { icon: 'calendar', value: '627', label: 'Recorded Events' },
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

export default function Home({ go: _go }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
  return (
    <div className="cg-home">
      <SiteNav active="Home" />

      <main>
        <section className="cg-hero" aria-labelledby="cg-home-title">
          <div className="cg-hero-inner">
            <div className="cg-emblem-wrap"><img src={asset('/crest.webp')} width="900" height="920" alt="" fetchPriority="high" /></div>
            <div className="cg-hero-copy">
              <p className="cg-eyebrow">Coldstream Gaming</p>
              <h1 className="cg-sr" id="cg-home-title">Coldstream Gaming. We’re Back. Second to none.</h1>
              <div className="cg-wordmark-crop" aria-hidden="true">
                <img className="cg-wordmark" src={asset('/wordmark.webp')} width="2087" height="392" alt="" fetchPriority="high" />
              </div>
              <div className="cg-motto"><Ornament /><span>Second to none.</span><Ornament /></div>
              <p className="cg-sub">A multi-gaming community, established 2011.</p>
              <div className="cg-actions">
                <a className="cg-action discord" href={DISCORD} target="_blank" rel="noopener"><Icon name="discord" />Join us on Discord</a>
                <a className="cg-action steam" href={STEAM} target="_blank" rel="noopener"><Icon name="steam" />Steam Group</a>
              </div>
            </div>
          </div>
        </section>

        <section className="cg-pillars" aria-labelledby="cg-pillars-title">
          <h2 className="cg-sr" id="cg-pillars-title">Explore Coldstream Gaming</h2>
          <div className="cg-width cg-pillar-grid">
            {PILLARS.map((pillar) => <a className="cg-pillar" href={pillar.href} key={pillar.title} target={pillar.href.startsWith('http') ? '_blank' : undefined} rel={pillar.href.startsWith('http') ? 'noopener' : undefined} style={{ '--pillar-image': `url(${asset(pillar.image)})` } as CSSProperties}>
              <span className="cg-pillar-icon"><Icon name={pillar.icon} /></span>
              <span className="cg-pillar-copy"><h3>{pillar.title}</h3><p>{pillar.copy}</p></span>
              <span className="cg-pillar-arrow"><Icon name="arrow" /></span>
            </a>)}
          </div>
        </section>

        <section className="cg-about" aria-labelledby="cg-about-title">
          <div className="cg-width cg-about-grid">
            <div className="cg-about-copy">
              <div className="cg-fleur" aria-hidden="true"><Icon name="shield" /></div>
              <div className="cg-about-text">
                <h2 id="cg-about-title">About Coldstream Gaming</h2>
                <p>Coldstream Gaming began in 2011. We are a gaming community built around organised events, community servers and the 2nd Coldstream Regiment of Foot Guards. Discord is where members meet, organise games and keep up with what is happening.</p>
                <a className="cg-more" href="#/archive"><span>Learn more about us</span><i><Icon name="arrow" /></i></a>
              </div>
            </div>
            <div className="cg-stats" aria-label="Coldstream Gaming statistics">
              {STATS.map((stat) => <div className="cg-stat" key={stat.label}><Icon name={stat.icon} /><b className={stat.value.length > 4 ? 'word' : undefined}>{stat.value}</b><span>{stat.label}</span></div>)}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
