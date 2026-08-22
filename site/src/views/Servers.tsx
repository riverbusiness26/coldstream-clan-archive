// Live server tracker. GitHub Actions refreshes public game-query data every
// few minutes so visitors can see the community servers without touching the
// game ports from their browser.
import { useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import { servers as seedServers, type ServerInfo } from '../lib/content';
import { GAME_NAMES } from '../lib/games';
import { asset } from '../lib/asset';

const GAME_LOGOS: Record<string, string> = {
  HOL: '/game-logos/holdfast.webp',
  MC: '/game-logos/minecraft.webp',
  VAL: '/game-logos/valheim.webp',
};

export default function Servers() {
  const [servers, setServers] = useState<ServerInfo[]>(seedServers);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    const load = () => sb.from('server_status').select('*').then(({ data }) => {
      if (!data) return;
      const live = new Map((data as ServerInfo[]).map((server) => [server.server_key, server]));
      setServers(seedServers.map((server) => ({ ...server, ...live.get(server.server_key) })));
    });
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead"><h3>Servers</h3><span className="sub">live player counts refresh every few minutes</span></div>
          <div className="srv-grid">
            {servers.map((s) => (
              <div className="srv" key={s.server_key}>
                {GAME_LOGOS[s.game] && (
                  <div className="srv-logo">
                    <img src={asset(GAME_LOGOS[s.game])} alt={`${GAME_NAMES[s.game]} logo`} />
                  </div>
                )}
                <div className="srv-top">
                  <span className="srv-game"><span className="gtag">{s.game}</span>{GAME_NAMES[s.game] ?? s.game}</span>
                  <span className={'pill' + (s.online ? ' live' : '')}>
                    {s.online ? `${s.players}/${s.max_players} ONLINE` : s.visibility === 'private' ? 'PRIVATE DEV' : 'OFFLINE'}
                  </span>
                </div>
                <div className="srv-name">{s.name}</div>
                <div className="srv-meta">{s.online && s.map ? `map: ${s.map} · ` : ''}{s.address}</div>
                <div className="srv-players">
                  <div className="srv-players-head">
                    <span>Players</span>
                    {s.updated_at && <span>updated {new Date(s.updated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
                  </div>
                  {s.online && s.players > 0 && s.player_names?.length ? (
                    <div className="srv-player-list">
                      {s.player_names.map((name) => <span className="srv-player" key={name}>{name}</span>)}
                    </div>
                  ) : s.online && s.players > 0 ? (
                    <div className="srv-empty">Player count is public, names are hidden by the server.</div>
                  ) : s.online ? (
                    <div className="srv-empty">Nobody is in this server yet.</div>
                  ) : (
                    <div className="srv-empty">Waiting for the next successful server query.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="note">
            Status comes from public game-query responses. Some games expose
            player names, while others expose only the current player count.
          </div>
        </div>
      </main>
    </div>
  );
}
