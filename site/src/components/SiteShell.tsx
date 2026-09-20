import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FaArrowRight, FaBars, FaDiscord, FaSteam, FaTv, FaXmark, FaYoutube } from 'react-icons/fa6';
import type { Me } from '../lib/auth';
import { asset } from '../lib/asset';
import { isStaff } from '../lib/routing';
import DiscordAvatar from './DiscordAvatar';

export const COMMUNITY_DISCORD = 'https://discord.gg/75sfq5VPY';
const NAV = [['Home', 'home'], ['Events', 'events'], ['Leaderboard', 'leaderboard'], ['Our History', 'archive'], ['Media', 'gallery']] as const;

export default function SiteShell({ me, signIn, signOut, view, children }: { me: Me | null; signIn: () => void; signOut: () => void; view: string; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => { setMenu(false); }, [view]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); document.getElementById('hq-menu-toggle')?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  return <div className={`living-hq view-${view.split('/')[0]}`}>
    <a className="hq-skip" href="#hq-content" onClick={(e) => { e.preventDefault(); document.getElementById('hq-content')?.focus(); }}>Skip to content</a>
    <header className={`hq-header${scrolled ? ' is-scrolled' : ''}`}>
      <a className="hq-brand" href={me ? '#/home' : '#/landing'} aria-label="Coldstream Gaming home"><img src={asset('/museum/coldstream-crest-v2.png')} width="49" height="52" alt="" /><span>Coldstream<span>GAMING <i /> EST. 2011</span></span></a>
      <button className="hq-menu-toggle" id="hq-menu-toggle" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="hq-navigation" onClick={() => setMenu(!menu)}>{menu ? <FaXmark /> : <FaBars />}</button>
      <div id="hq-navigation" className={`hq-navigation${menu ? ' is-open' : ''}`}>
        <nav aria-label="Primary">{NAV.map(([label, route]) => <a href={`#/${route === 'home' && !me ? 'landing' : route}`} key={route} aria-current={view === route || route === 'home' && view === 'landing' ? 'page' : undefined} onClick={() => setMenu(false)}>{label}</a>)}<span className="hq-join-links"><a href="#/join" aria-current={view === 'join' ? 'page' : undefined} onClick={() => setMenu(false)}>Join</a><a className="hq-shillings-link" href="#/stores" aria-label="Shillings" title="Shillings" aria-current={view === 'stores' ? 'page' : undefined} onClick={() => setMenu(false)}><span aria-hidden="true">🪙</span></a><a className="hq-tv-link" href="https://tv.coldstreamgaming.com/" aria-label="Coldstream TV" title="Coldstream TV" onClick={() => setMenu(false)}><FaTv aria-hidden="true" /></a></span></nav>
        <div className="hq-social"><a href={COMMUNITY_DISCORD} target="_blank" rel="noreferrer" aria-label="Discord"><FaDiscord /></a><a href="https://steamcommunity.com/groups/2ndColdstreamOfficial" target="_blank" rel="noreferrer" aria-label="Steam group"><FaSteam /></a><a href="https://www.youtube.com/@2ndColdstreamGuards" target="_blank" rel="noreferrer" aria-label="YouTube"><FaYoutube /></a></div>
        {me ? <a className="hq-account" href="#/profile" onClick={() => setMenu(false)}><DiscordAvatar url={me.avatar_url} name={me.display_name} /><span>{me.display_name}</span></a> : <button className="hq-sign-in" onClick={signIn}>Sign in <FaArrowRight /></button>}
      </div>
    </header>
    {me && <nav className="hq-member-nav" aria-label="Member navigation"><span><i /> Member headquarters</span><a href="#/home" aria-current={view === 'home' ? 'page' : undefined}>Weekly brief</a><a href="#/profile" aria-current={view === 'profile' ? 'page' : undefined}>Service record</a><a href="#/roster" aria-current={view === 'roster' ? 'page' : undefined}>Historical roster</a>{isStaff(me.role) && <a href="#/admin" aria-current={view === 'admin' ? 'page' : undefined}>Staff command</a>}<button onClick={signOut}>Sign out</button></nav>}
    <div id="hq-content" tabIndex={-1} className="hq-content"><RouteMotion view={view}>{children}</RouteMotion></div>
    <footer className="hq-footer"><div><a className="hq-footer-name" href={me ? '#/home' : '#/landing'}>Coldstream Gaming</a><p>A gaming community, since 2011.</p></div><em>Nulli Secundus.</em><nav aria-label="Footer"><a href="#/join">Join us</a><a href="#/archive">Our History</a><a href="mailto:contact@coldstreamgaming.com">Contact</a></nav><small>© 2011–{new Date().getFullYear()} Coldstream Gaming<span className="hq-powered-by">Powered by Bannerforge Studios</span></small></footer>
  </div>;
}

function RouteMotion({ view, children }: { view: string; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = element.current;
    if (!container || !('IntersectionObserver' in window)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: 0.06 });
    const scan = () => container.querySelectorAll<HTMLElement>('[data-reveal]:not(.reveal-ready)').forEach((node) => { node.classList.add('reveal-ready'); observer.observe(node); });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(container, { childList: true, subtree: true });
    const showAll = () => { if (reduced.matches) container.querySelectorAll('.reveal-ready').forEach((node) => node.classList.add('revealed')); };
    reduced.addEventListener('change', showAll);
    return () => {
      observer.disconnect(); mutations.disconnect(); reduced.removeEventListener('change', showAll);
      // A remount must observe these nodes again, including React Strict Mode's setup replay.
      container.querySelectorAll('.reveal-ready').forEach((node) => node.classList.remove('reveal-ready'));
    };
  }, [view]);
  return <div className="hq-route" key={view} ref={element}>{children}</div>;
}
