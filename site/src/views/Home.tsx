import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
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

type IconName = 'menu' | 'discord' | 'steam' | 'mail' | 'server' | 'calendar' | 'banner' | 'people' | 'gamepad' | 'globe' | 'arrow';

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    discord: <><path d="M6 7.5c3-2 9-2 12 0 1.2 2 2 4.5 2 7-2.3 1.8-4.4 2.5-6.3 2.8l-.8-1.1" /><path d="M18 7.5c-1-.8-2-1.2-3-1.5M6 7.5C7 6.7 8 6.3 9 6" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /></>,
    steam: <><circle cx="8" cy="15.5" r="2.4" /><circle cx="16.5" cy="8" r="3.2" /><path d="m10 14.5 3.8-3.7M5.8 14.7 3 13.5" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m4 7 8 6 8-6" /></>,
    server: <><rect x="3" y="4" width="18" height="6" rx="1" /><rect x="3" y="14" width="18" height="6" rx="1" /><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M7 3v5M17 3v5M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
    banner: <><path d="M6 3h12v18l-6-3-6 3Z" /><path d="m12 7 1.2 2.4 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z" /></>,
    people: <><circle cx="12" cy="7" r="3" /><circle cx="5" cy="9" r="2" /><circle cx="19" cy="9" r="2" /><path d="M6 20v-2c0-3 2.2-5 6-5s6 2 6 5v2M2 19v-1c0-2.2 1.3-3.7 3.5-4.2M22 19v-1c0-2.2-1.3-3.7-3.5-4.2" /></>,
    gamepad: <><path d="M7 8h10c2 0 3.5 1.4 4 4l1 5c.4 2-1.7 3.2-3.2 1.8L16 16H8l-2.8 2.8C3.7 20.2 1.6 19 2 17l1-5c.5-2.6 2-4 4-4Z" /><path d="M8 11v4M6 13h4M16.5 12h.01M19 14h.01" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>,
    arrow: <path d="M5 12h13M14 7l5 5-5 5" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

const NAV = [
  ['Home', '#/home'], ['About', '#/archive'], ['Games', '#/servers'],
  ['Community', '#/archive'], ['Media', '#/gallery'], ['Join', DISCORD],
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
  { icon: 'server', title: 'Game Servers', copy: 'High quality game servers with active admins and lag-free performance.', href: '#/servers', image: '/gallery/2f2f6869d3.jpg' },
  { icon: 'calendar', title: 'Events', copy: 'Organised events and operations across a range of titles year-round.', href: '#/archive', image: '/gallery/7a32547d74.jpg' },
  { icon: 'banner', title: 'Regiments', copy: 'Play together. Train together. Fight together as one.', href: '#/archive', image: '/gallery/5e8775785e.jpg' },
  { icon: 'people', title: 'Community Hub', copy: 'Connect with members, share moments, and be part of something bigger.', href: DISCORD, image: '/gallery/210325a830.png' },
] as const satisfies readonly { icon: IconName; title: string; copy: string; href: string; image: string }[];

// Draft values supplied by the design spec. Keep them together so the
// source check before release changes data rather than markup.
const STATS = [
  { icon: 'people', number: '1,250+', label: 'Members' },
  { icon: 'gamepad', number: '12+', label: 'Games' },
  { icon: 'globe', number: '8', label: 'Regions' },
  { icon: 'calendar', number: '2011', label: 'Established' },
] as const satisfies readonly { icon: IconName; number: string; label: string }[];

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
        <nav aria-label="Footer"><a href="#/archive">Rules</a><a href="#/archive">Code of Conduct</a><a href="#/archive">Privacy Policy</a><a href="mailto:contact@coldstreamgaming.com">Contact</a><a href="/progress/">Progress</a></nav>
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
              <img className="cg-wordmark" src={asset('/wordmark.webp')} width="2087" height="392" alt="" fetchPriority="high" />
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
              <div className="cg-fleur" aria-hidden="true">⚜</div>
              <div className="cg-about-text">
                <h2 id="cg-about-title">About Coldstream Gaming</h2>
                <p>Coldstream Gaming was founded in 2011 by a group of friends who shared a passion for teamwork, community, and great games. Over a decade later, we continue to welcome new members, forge lasting friendships, and build memories that go far beyond the battlefield.</p>
                <a className="cg-more" href="#/archive"><span>Learn more about us</span><i><Icon name="arrow" /></i></a>
              </div>
            </div>
            <div className="cg-stats" aria-label="Coldstream Gaming statistics">
              {STATS.map((stat) => <div className="cg-stat" key={stat.label}><Icon name={stat.icon} /><b>{stat.number}</b><span>{stat.label}</span></div>)}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
