import { useEffect, useRef, useState } from 'react';
import type { Me } from '../lib/auth';
import { Icon } from './Home';
import { beginSteamLink, clearSteamAssertion, completeSteamLink, pendingSteamAssertion, unlinkSteam } from '../lib/steamLink';

const EVENT_STATS = [
  ['Events attended', 'Pending', 'Recorded events'],
  ['Kills', 'Pending', 'Confirmed combat record'],
  ['Deaths', 'Pending', 'Confirmed combat record'],
  ['K/D ratio', 'Pending', 'Calculated automatically'],
  ['Best event', 'Pending', 'Highest confirmed kills'],
  ['Last event', 'Pending', 'Waiting for first record'],
] as const;

export default function PlayerProfileMock({ me, signIn, refresh }: { me: Me | null; signIn: () => void; refresh: () => void }) {
  const connected = Boolean(me);
  const [avatarStyle, setAvatarStyle] = useState<'discord' | 'crest' | 'initials'>('discord');

  const [steamBusy, setSteamBusy] = useState(false);
  const [steamMsg, setSteamMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Finishing a link the member started before they left for Steam.
  //
  // Held until `me` has loaded rather than run on mount, because the member
  // row is what the function writes to and it arrives a moment after the page
  // does. The ref is what keeps this to one attempt: `me` changing from null
  // to a member is a second render, and Steam refuses a replayed assertion,
  // so without it a successful link reports itself as a failure straight after.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || !me) return;
    const params = pendingSteamAssertion();
    if (!params) return;
    handled.current = true;
    clearSteamAssertion();
    setSteamBusy(true);
    completeSteamLink(params).then((result) => {
      setSteamBusy(false);
      setSteamMsg({ ok: result.ok, text: result.ok ? 'Steam account linked.' : (result.error ?? 'That did not work.') });
      if (result.ok) refresh();
    });
  }, [me, refresh]);

  async function unlink() {
    setSteamBusy(true);
    const result = await unlinkSteam();
    setSteamBusy(false);
    setSteamMsg({ ok: result.ok, text: result.ok ? 'Steam account unlinked.' : (result.error ?? 'That did not work.') });
    if (result.ok) refresh();
  }

  return (
    <main className="player-portal" aria-labelledby="player-portal-title">
      <div className="portal-preview-note"><b>Profile groundwork</b><span>{connected ? 'Discord identity connected. Profile editing comes after the Command Board.' : 'Sign in is live. Profile editing comes after the Command Board.'}</span></div>

      <section className="portal-account">
        <div className={`portal-avatar ${avatarStyle}`}>
          {avatarStyle === 'crest' ? <img src="/crest.webp" alt="" /> : avatarStyle === 'initials' ? <b>{me?.display_name.slice(0, 2).toUpperCase() || 'CG'}</b> : me?.avatar_url ? <img src={me.avatar_url} alt="" /> : <Icon name="discord" />}
          <span className="portal-live-dot" title="Live status" />
        </div>
        <div className="portal-identity">
          <p className="cg-eyebrow">Coldstream player profile</p>
          <h1 id="player-portal-title">{connected ? me!.display_name : 'Your profile starts here'}</h1>
          <p>{connected ? 'Discord is connected. Ranks and medals will come from the staff-managed service record.' : 'Sign in through Discord once. We create the member record and keep your community activity together.'}</p>
          <div className="portal-badges"><span>{connected ? me!.role : 'Rank pending'}</span><span>{connected ? 'Discord linked' : 'Not connected'}</span></div>
        </div>
        {connected
          ? <a className="portal-discord" href={(me!.role === 'admin' || me!.role === 'moderator') ? '#/admin' : '#/home'}><Icon name="discord" />{(me!.role === 'admin' || me!.role === 'moderator') ? 'Open Command Board' : 'Discord connected'}</a>
          : <button className="portal-discord" type="button" onClick={signIn}><Icon name="discord" />Sign in through Discord</button>}
      </section>

      <div className="portal-grid">
        <section className="portal-panel portal-customize" aria-labelledby="customize-title">
          <header><span>Profile</span><h2 id="customize-title">Make it yours</h2></header>
          <div className="portal-field"><b>Display name</b><span>{connected ? me!.display_name : 'Imported from Discord'}</span><button type="button" disabled>Edit later</button></div>
          <div className="portal-field avatar-field"><b>Avatar</b><span>Choose a preview style</span></div>
          <div className="avatar-choices" aria-label="Avatar preview options">
            <button className={avatarStyle === 'discord' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('discord')}><Icon name="discord" /><span>Discord</span></button>
            <button className={avatarStyle === 'crest' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('crest')}><img src="/crest.webp" alt="" /><span>Crest</span></button>
            <button className={avatarStyle === 'initials' ? 'active' : ''} type="button" onClick={() => setAvatarStyle('initials')}><b>CG</b><span>Initials</span></button>
          </div>
          <button className="portal-secondary" type="button">Upload custom avatar</button>

          <div className="portal-field">
            <b>Steam account</b>
            <span>{me?.steam_id64
              ? 'Linked. Your Steam presence and game statistics can find this record.'
              : 'Optional. Link it and your Steam presence and game statistics attach to this record.'}</span>
            {connected
              ? me!.steam_id64
                ? <button type="button" onClick={unlink} disabled={steamBusy}>{steamBusy ? 'Working' : 'Unlink'}</button>
                : <button type="button" onClick={beginSteamLink} disabled={steamBusy}>{steamBusy ? 'Working' : 'Link Steam'}</button>
              : <button type="button" disabled>Sign in first</button>}
          </div>
          {steamMsg && <p className={steamMsg.ok ? 'portal-empty' : 'ferr'}>{steamMsg.text}</p>}
          <p className="portal-empty">Signing in is Discord only. Steam is a link on this record, never a way in.</p>
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
