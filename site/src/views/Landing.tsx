import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FaArrowDown, FaArrowRight, FaDiscord } from 'react-icons/fa6';
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';
import summary from '../seed/summary.json';
import gallery from '../seed/gallery.json';
import { COMMUNITY_DISCORD } from '../components/SiteShell';
import '../landing-redesign.css';

const destinations = [
  { name: 'Events', tag: 'Fall in', text: 'Linebattles, public servers and the next game night.', route: 'events', emblem: 'events', access: 'Member calendar' },
  { name: 'Leaderboard', tag: 'On the record', text: 'The rounds, the results, the people who earned them.', route: 'leaderboard', emblem: 'leaderboard', access: 'Member standings' },
  { name: 'Our History', tag: 'Since 2011', text: 'Different games. Familiar names. The record remains.', route: 'archive', emblem: 'history', access: 'Explore the archive' },
  { name: 'Media', tag: 'The plate room', text: 'Good volleys. Bad decisions. Worth keeping.', route: 'gallery', emblem: 'media', access: 'Browse photos & films' },
  { name: 'Join the Coldstream', tag: 'A place in the line', text: 'Meet the community. Find your next game.', route: 'join', emblem: 'join', access: 'Start here' },
  { name: 'Member HQ', tag: 'Your weekly brief', text: 'Your service record, statistics and weekly brief.', route: 'home', emblem: 'profile', access: 'Continue with Discord' },
];

export default function Landing({ me, go, signIn, preview = false }: { me: Me | null; go: (v: string) => void; signIn: () => void; preview?: boolean }) {
  const [layout, setLayout] = useState<'split' | 'panorama' | 'compact'>('panorama');
  const landscape = useRef<HTMLPictureElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { if (landscape.current) landscape.current.style.transform = reduced.matches || !finePointer.matches ? 'none' : `translateY(${Math.min(window.scrollY * .045, 30)}px)`; frame = 0; });
    };
    update(); window.addEventListener('scroll', update, { passive: true }); reduced.addEventListener('change', update); finePointer.addEventListener('change', update);
    return () => { window.removeEventListener('scroll', update); reduced.removeEventListener('change', update); finePointer.removeEventListener('change', update); cancelAnimationFrame(frame); };
  }, []);
  const shots = gallery.slice(0, 3);
  return <main className={`hq-landing landing-layout-${layout}`}>
    {preview && <div className="landing-design-options" aria-label="Landing design options"><span>Landing study</span>{(['split', 'panorama', 'compact'] as const).map(option => <button type="button" key={option} aria-pressed={layout === option} onClick={() => setLayout(option)}>{option === 'split' ? '01 · Quiet split' : option === 'panorama' ? '02 · Full photograph' : '03 · Compact banner'}</button>)}</div>}
    <section className="hq-hero" aria-labelledby="hq-hero-title">
      <picture className="hq-landscape" ref={landscape}><source media="(max-width: 640px)" srcSet={asset('/museum/landing-mobile-v3.png')} /><img src={asset('/museum/landing-campaign-v3.png')} alt="" fetchPriority="high" width="1672" height="941" /></picture>
      <div className="hq-hero-shade" />
      <div className="hq-hero-body">
        <div className="hq-hero-copy"><p className="hq-eyebrow">EST. 2011 <span /> THE 2ND COLDSTREAM GUARDS</p><h1 id="hq-hero-title">Second<br />to <em>none.</em></h1><p className="hq-hero-description">A place in the line.<br />{' '}A gaming community beyond it.</p><div className="hq-hero-actions"><a className="hq-button primary" href="#/join">Join the Coldstream <FaArrowRight className="hq-button-tail" /></a><button className="hq-button" onClick={() => me ? go('home') : signIn()}><FaDiscord />{me ? 'Open headquarters' : 'Continue with Discord'}</button></div><small>Home of the 2nd Coldstream Guards. Together since 2011.</small></div>
      </div>
      <div className="hq-hero-foot"><span>HOLDFAST · MINECRAFT · VALHEIM</span><a href="#hq-destinations" onClick={(e) => { e.preventDefault(); document.getElementById('hq-destinations')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Explore the Coldstream <FaArrowDown /></a></div>
    </section>
    <section className="hq-proof" aria-label="From the Coldstream record"><div><b>2011</b><span>Established</span></div><div><b>4</b><span>Linebattle eras</span></div><div><b>{summary.people}</b><span>Names in the archive</span></div><p>Many games.<br /><em>One community.</em></p></section>
    <section className="hq-band" id="hq-destinations"><header className="hq-band-head" data-reveal><div><p className="hq-eyebrow">Your next destination</p><h2>The doors are open.</h2></div><p>Find the next event, revisit an old campaign,<br />or take your place in the line.</p></header><div className="hq-destinations">{destinations.map((item, i) => <a className="hq-destination" onMouseMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--light-x', `${(event.clientX - box.left) / box.width * 100}%`); event.currentTarget.style.setProperty('--light-y', `${(event.clientY - box.top) / box.height * 100}%`); }} href={`#/${item.route}`} key={item.route} data-reveal style={{ '--stagger': `${i % 3 * 60}ms` } as CSSProperties}><div><span className="hq-eyebrow">{item.tag}</span><img className="hq-destination-emblem" src={asset(`/museum/emblem-${item.emblem}-keyed.png`)} alt="" width="128" height="128" loading="lazy" decoding="async" /></div><h3>{item.name}</h3><p>{item.text}</p><span className="hq-text-link">{item.access} <FaArrowRight className="hq-button-tail" /></span></a>)}</div></section>
    <section className="hq-muster" data-reveal><div className="hq-muster-number">01<span>THE WEEKLY BRIEF</span></div><div><p className="hq-eyebrow">From the community</p><h2>This week in the Coldstream.</h2><p>Member highlights, upcoming events and the latest approved results. Your week, in one place.</p></div><a className="hq-button" href="#/home">{me ? 'Read your brief' : 'Sign in for the brief'} <FaArrowRight className="hq-button-tail" /></a></section>
    <section className="hq-band hq-games"><header className="hq-band-head" data-reveal><div><p className="hq-eyebrow">Beyond the linebattle</p><h2>Same company.<br /><em>Different worlds.</em></h2></div><p>Holdfast is home. There is always<br />another world to get lost in together.</p></header><div className="hq-games-grid"><article data-reveal><span className="hq-game-no">I</span><p className="hq-eyebrow">The regiment</p><h3>Holdfast</h3><p>Nations At War. Line infantry with the 2nd Coldstream Guards.</p><a href="#/events">Find the next muster <FaArrowRight className="hq-button-tail" /></a></article><article data-reveal><span className="hq-game-no">II</span><p className="hq-eyebrow">Build together</p><h3>Minecraft</h3><p>A change of pace. Bring an idea, and probably a spare pickaxe.</p><a href={COMMUNITY_DISCORD} target="_blank" rel="noreferrer">Find us on Discord <FaArrowRight className="hq-button-tail" /></a></article><article data-reveal><span className="hq-game-no">III</span><p className="hq-eyebrow">Go further</p><h3>Valheim</h3><p>A longboat, a new shore, and the usual company.</p><a href={COMMUNITY_DISCORD} target="_blank" rel="noreferrer">Plan the next voyage <FaArrowRight className="hq-button-tail" /></a></article></div></section>
    <section className="hq-history-band"><div data-reveal><p className="hq-eyebrow">The record room</p><h2>Some things<br />are worth <em>keeping.</em></h2><p>From the first recorded linebattles in 2011 to the people playing today. The photographs, films and names tell the story.</p><a className="hq-text-link" href="#/archive">Walk through our history <FaArrowRight className="hq-button-tail" /></a><img className="hq-campaign-wordmark" src={asset('/wordmark.webp')} alt="We're back. Second to none." loading="lazy" width="2087" height="392" /></div><div className="hq-history-plates">{shots.map((shot, i) => <a href="#/gallery" key={shot.src} data-reveal><img src={asset(shot.src)} alt={shot.caption} loading="lazy" /><span>FROM THE ARCHIVE <b>0{i + 1}</b></span></a>)}</div></section>
    <section className="hq-enlist" data-reveal><p className="hq-eyebrow">A familiar name. A new chapter.</p><h2>There’s room in the line.</h2><p>Join us on Discord. We’ll take it from there.</p><a className="hq-button primary" href={COMMUNITY_DISCORD} target="_blank" rel="noreferrer"><FaDiscord />Join the Coldstream <FaArrowRight className="hq-button-tail" /></a></section>
  </main>;
}
