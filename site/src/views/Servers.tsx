// Live server trackers. Reads server_status from the backend when
// configured; shows the seeded lineup as offline until the poller exists.
import { useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import { servers as seedServers, GAME_NAMES, type ServerInfo } from '../lib/data';

export default function Servers() {
  const [servers, setServers] = useState<ServerInfo[]>(seedServers);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    const load = () => sb.from('server_status').select('*').then(({ data }) => {
      if (data && data.length) setServers(data as ServerInfo[]);
    });
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead"><h3>Servers</h3><span className="sub">player counts refresh every 30 seconds once live</span></div>
          <div className="srv-grid">
            {servers.map((s) => (
              <div className="srv" key={s.server_key}>
                <div className="srv-top">
                  <span className="srv-game"><span className="gtag">{s.game}</span>{GAME_NAMES[s.game] ?? s.game}</span>
                  <span className={'pill' + (s.online ? ' live' : '')}>{s.online ? `${s.players}/${s.max_players} ONLINE` : 'COMING SOON'}</span>
                </div>
                <div className="srv-name">{s.name}</div>
                <div className="srv-meta">{s.online && s.map ? `map: ${s.map} · ` : ''}{s.address === 'TBA' ? 'address TBA' : s.address}</div>
              </div>
            ))}
          </div>
          <div className="note">
            Trackers light up the day each server goes online. The status poller
            runs on the game server box and updates every 30 seconds.
          </div>
        </div>
      </main>
    </div>
  );
}
