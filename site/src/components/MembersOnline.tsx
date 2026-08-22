// Who is about right now.
//
// Reads the steam_presence table, which a scheduled job fills from the Steam
// Web API every few minutes. The browser never talks to Steam: it cannot,
// since Steam sends no CORS headers, and the key must not reach a browser
// anyway. So this is a cheap indexed read of one small table, and it costs
// the same whether one person is looking at the page or two hundred are.
//
// The polling here is only to pick up what the scheduler has already
// written, so it is slow on purpose. Anything faster would be asking the
// database a question whose answer cannot have changed yet.
import { useEffect, useState } from 'react';
import { supa } from '../lib/supa';

interface Row {
  steam_id64: string;
  persona_name: string | null;
  avatar_url: string | null;
  persona_state: number;
  game: string | null;
  visible: boolean;
  checked_at: string;
}

// Steam's numbering, in our words. Busy, away and snooze all mean the same
// thing to somebody deciding whether to start a game, so they collapse.
const label = (s: number) => (s === 0 ? 'Offline' : s === 1 ? 'Online' : 'Away');

const REFRESH_MS = 90_000;

export default function MembersOnline() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!supa) { setRows([]); return; }
    const sb = supa;
    let live = true;

    const load = () => {
      sb.from('steam_presence')
        .select('steam_id64, persona_name, avatar_url, persona_state, game, visible, checked_at')
        .order('persona_state', { ascending: false })
        .limit(60)
        .then(({ data }) => { if (live) setRows((data ?? []) as Row[]); });
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(t); };
  }, []);

  if (rows === null) {
    return (
      <div className="module">
        <div className="mhead"><h3>Members</h3><span className="sub">checking Steam</span></div>
      </div>
    );
  }

  // Nothing to show is a real state and worth explaining, because "no
  // members online" and "the tracker has never run" look identical
  // otherwise, and one of them is a bug.
  if (rows.length === 0) {
    return (
      <div className="module">
        <div className="mhead"><h3>Members</h3><span className="sub">Steam status</span></div>
        <div className="note">
          Nobody has linked a Steam account yet, or the tracker has not run
          for the first time. Sign in through Steam and you will appear here.
        </div>
      </div>
    );
  }

  const inGame = rows.filter((r) => r.game);
  const online = rows.filter((r) => r.persona_state > 0 && !r.game);
  const off = rows.filter((r) => r.persona_state === 0);
  const stale = Date.now() - new Date(rows[0].checked_at).getTime() > 20 * 60_000;

  const Line = ({ r }: { r: Row }) => (
    <a className="pres" key={r.steam_id64}
      href={`https://steamcommunity.com/profiles/${r.steam_id64}`}
      target="_blank" rel="noopener">
      {r.avatar_url
        ? <img src={r.avatar_url} alt="" loading="lazy" width={20} height={20} />
        : <span className="pres-noavi" aria-hidden="true" />}
      <span className="pres-name">{r.persona_name ?? 'member'}</span>
      {r.game
        ? <span className="pres-game" title={r.game}>{r.game}</span>
        : <span className="pres-state">{r.visible ? label(r.persona_state) : 'Private'}</span>}
    </a>
  );

  return (
    <div className="module">
      <div className="mhead">
        <h3>Members</h3>
        <span className="sub">
          {inGame.length > 0 ? `${inGame.length} in game` : `${online.length} online`}
          {' of '}{rows.length}
        </span>
      </div>
      <div className="preslist">
        {inGame.map((r) => <Line key={r.steam_id64} r={r} />)}
        {online.map((r) => <Line key={r.steam_id64} r={r} />)}
        {off.slice(0, 12).map((r) => <Line key={r.steam_id64} r={r} />)}
      </div>
      {stale && (
        <div className="note">
          Steam status has not refreshed in a while, so this may be out of date.
        </div>
      )}
    </div>
  );
}
