import { useState } from 'react';
import { Icon } from './Home';

const EVENT_STATS = [
  ['Events attended', 'Pending', 'Recorded events'],
  ['Kills', 'Pending', 'Confirmed combat record'],
  ['Deaths', 'Pending', 'Confirmed combat record'],
  ['K/D ratio', 'Pending', 'Calculated automatically'],
  ['Best event', 'Pending', 'Highest confirmed kills'],
  ['Last event', 'Pending', 'Waiting for first record'],
] as const;

export default function PlayerProfileMock() {
  const [connected, setConnected] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState<'discord' | 'crest' | 'initials'>('discord');

  return (
    <main className="player-portal" aria-labelledby="player-portal-title">
      <div className="portal-preview-note"><b>Profile mockup</b><span>No Discord account is connected and nothing is saved.</span></div>

      <section className="portal-account">
        <div className={`portal-avatar ${avatarStyle}`}>
          {avatarStyle === 'crest' ? <img src="/crest.webp" alt="" /> : avatarStyle === 'initials' ? <b>CG</b> : <Icon name="discord" />}
          <span className="portal-live-dot" title="Live status" />
        </div>
        <div className="portal-identity">
          <p className="cg-eyebrow">Coldstream player profile</p>
          <h1 id="player-portal-title">{connected ? 'Discord Player' : 'Your profile starts here'}</h1>
          <p>{connected ? 'Profile preview created. Discord roles and activity would synchronize automatically.' : 'Sign in through Discord once. We create the profile and keep your community activity together.'}</p>
          <div className="portal-badges"><span>{connected ? 'Member' : 'Rank pending'}</span><span>{connected ? 'Discord linked' : 'Not connected'}</span></div>
        </div>
        <button className="portal-discord" type="button" onClick={() => setConnected((value) => !value)}>
          <Icon name="discord" />{connected ? 'Reset preview' : 'Preview Discord sign in'}
        </button>
      </section>

      <div className="portal-grid">
        <section className="portal-panel portal-customize" aria-labelledby="customize-title">
          <header><span>Profile</span><h2 id="customize-title">Make it yours</h2></header>
          <div className="portal-field"><b>Display name</b><span>{connected ? 'Discord Player' : 'Imported from Discord'}</span><button type="button">Edit</button></div>
          <div className="portal-field avatar-field"><b>Avatar</b><span>Choose a preview style</span></div>
          <div className="avatar-choices" aria-label="Avatar preview options">
            <button className={avatarStyle === 'discord' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('discord')}><Icon name="discord" /><span>Discord</span></button>
            <button className={avatarStyle === 'crest' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('crest')}><img src="/crest.webp" alt="" /><span>Crest</span></button>
            <button className={avatarStyle === 'initials' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('initials')}><b>CG</b><span>Initials</span></button>
          </div>
          <button className="portal-secondary" type="button">Upload custom avatar</button>
        </section>

        <section className="portal-panel portal-rank" aria-labelledby="rank-title">
          <header><span>Service record</span><h2 id="rank-title">Rank and detachment</h2></header>
          <div className="service-identity">
            <article className="service-mark">
              <div className="service-image rank-image"><span>Rank image</span></div>
              <small>Current rank</small>
              <b>{connected ? 'Member' : 'Not synchronized'}</b>
            </article>
            <article className="service-mark">
              <div className="service-image detachment-image"><img src="/crest.webp" alt="Detachment badge preview" /></div>
              <small>Detachment</small>
              <b>{connected ? 'Assigned through Discord' : 'Not assigned'}</b>
            </article>
          </div>
          <p className="service-note">Rank insignia and detachment artwork have their own image slots. Discord roles determine which record appears.</p>
          <h3 className="medal-heading">Medals</h3>
          <div className="medal-row">
            {[1, 2, 3].map((medal) => <div className="medal-empty" key={medal}><i>◇</i><span>Medal slot</span></div>)}
          </div>
          <p className="portal-empty">Medals appear here when they are awarded by an admin.</p>
        </section>
      </div>

      <section className="portal-stats" aria-labelledby="stats-title">
        <header><div><span>Event record</span><h2 id="stats-title">Combat statistics</h2></div><small><i />Updates after confirmed events</small></header>
        <div className="portal-stat-grid">
          {EVENT_STATS.map(([label, value, note]) => <article key={label}><span>{label}</span><b>{value}</b><small>{note}</small></article>)}
        </div>
        <div className="game-night-record">
          <div><h3>Game-night activity</h3><p>Attendance, game, session length and results will appear here after the first recorded night.</p></div>
          <div className="activity-placeholder" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="portal-tracking" aria-labelledby="tracking-title">
        <header><div><span>Holdfast activity</span><h2 id="tracking-title">Public play tracking</h2></div><span className="tracking-status">Planned integration</span></header>
        <div className="tracking-grid">
          <article><b>Coldstream servers</b><p>Full event and public-play records can be matched to a member through their Steam ID.</p><span>Kills, deaths, score, map, round and time played</span></article>
          <article><b>Partner servers</b><p>Records can be included when the server owner runs our tracker or shares a compatible score log.</p><span>Requires permission from the server owner</span></article>
          <article className="tracking-limited"><b>Other public servers</b><p>Holdfast does not provide a global public record we can query for every server.</p><span>Not available without server-side access</span></article>
        </div>
      </section>
    </main>
  );
}
