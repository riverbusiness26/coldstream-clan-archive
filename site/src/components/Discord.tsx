// Live Discord panel.
//
// Reads the server's own public widget endpoint straight from the browser.
// No bot token, no backend, nothing to keep running: the widget is enabled on
// the server and Discord serves it with open CORS. It gives who is in voice
// right now, who is online, and a working invite.
//
// The one thing the widget does not carry is the total member count, so that
// comes from the public invite lookup alongside it. Either half can fail on
// its own without taking the panel down with it.
import { useEffect, useState } from 'react';

const GUILD_ID = '669723836165521413';
const INVITE_CODE = '75sfq5VPY';
const INVITE_URL = `https://discord.gg/${INVITE_CODE}`;
const REFRESH_MS = 60_000;

interface WidgetMember {
  id: string;
  username: string;
  avatar_url: string;
  status: string;
  channel_id?: string;
  game?: { name: string };
}
interface WidgetChannel { id: string; name: string; position: number }
interface Widget {
  presence_count: number;
  members: WidgetMember[];
  channels: WidgetChannel[];
  instant_invite: string | null;
}

const STATUS_ORDER: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };

// The widget anonymises member ids and carries no bot flag, so the only way to
// keep the moderation bots out of the list is by name. Best effort, and only
// applied to the list: the online count stays exactly as Discord reports it,
// because that number is Discord's and not ours to adjust. The list is a
// truncated sample either way.
const BOTS = /^(carl ?bot|dyno|mee6|yagpdb|probot|groovy|rythm|arcane|tatsu|dank memer|ticket tool|statbot|pancake|septapus|nadeko|craig|vexera|fredboat|hydra|jockie|maki|invite ?tracker|serverstats|wick|sapphire|beemo)\b/i;
const isBot = (name: string) => BOTS.test(name.trim());

export default function Discord() {
  const [w, setW] = useState<Widget | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    const pull = async () => {
      try {
        const r = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`);
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Widget;
        if (live) { setW(j); setFailed(false); }
      } catch {
        if (live && !w) setFailed(true);
      }
    };

    // The total is stable enough to read once per mount.
    const pullTotal = async () => {
      try {
        const r = await fetch(
          `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`,
        );
        if (!r.ok) return;
        const j = await r.json();
        if (live && typeof j.approximate_member_count === 'number') {
          setTotal(j.approximate_member_count);
        }
      } catch { /* the panel is fine without it */ }
    };

    pull();
    pullTotal();
    const t = setInterval(pull, REFRESH_MS);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice first: an occupied channel is the most interesting thing on here.
  const inVoice = (w?.members ?? []).filter((m) => m.channel_id && !isBot(m.username));
  const voiceChannels = (w?.channels ?? [])
    .map((c) => ({ ...c, who: inVoice.filter((m) => m.channel_id === c.id) }))
    .filter((c) => c.who.length > 0)
    .sort((a, b) => a.position - b.position);

  const online = (w?.members ?? []).filter((m) => !isBot(m.username)).sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      a.username.localeCompare(b.username),
  );

  return (
    <div className="module dsc">
      <div className="mhead">
        <h3>Discord</h3>
        <span className="sub">
          {w ? `${w.presence_count} online${total ? ` of ${total}` : ''}` : 'connecting'}
        </span>
      </div>

      {failed && (
        <div className="note">
          Could not reach Discord just now. The door still works:{' '}
          <a className="ilink" href={INVITE_URL} target="_blank" rel="noopener">{INVITE_URL.replace('https://', '')}</a>
        </div>
      )}

      {w && (
        <>
          {voiceChannels.length > 0 && (
            <div className="dsc-voice">
              {voiceChannels.map((c) => (
                <div className="dsc-chan" key={c.id}>
                  <div className="dsc-chan-name">{c.name}</div>
                  <div className="dsc-chan-who">
                    {c.who.map((m) => (
                      <span className="dsc-mini" key={m.id} title={m.username}>
                        <img src={m.avatar_url} alt="" loading="lazy" />
                        {m.username}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {online.length > 0 ? (
            <div className="dsc-list">
              {online.slice(0, 24).map((m) => (
                <span className={`dsc-who s-${m.status}`} key={m.id}>
                  <img src={m.avatar_url} alt="" loading="lazy" />
                  <span className="dsc-name">{m.username}</span>
                  {m.game?.name && <span className="dsc-game">{m.game.name}</span>}
                </span>
              ))}
              {online.length > 24 && (
                <span className="dsc-more">and {online.length - 24} more</span>
              )}
            </div>
          ) : (
            <div className="note">Nobody online at the minute. Be the first one in.</div>
          )}
        </>
      )}

      <div className="dsc-foot">
        <a className="btn primary sm" href={INVITE_URL} target="_blank" rel="noopener">
          Join the Discord
        </a>
        <span className="dsc-refresh">refreshes every minute</span>
      </div>
    </div>
  );
}
