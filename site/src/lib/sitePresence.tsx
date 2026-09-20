import { useEffect, useSyncExternalStore } from 'react';
import type { Me } from './auth';
import { supa } from './supa';

type PresencePayload = { discordId?: unknown };
type PresenceState = Record<string, PresencePayload[]>;

const listeners = new Set<() => void>();
let localDiscordId: string | null = null;
let remoteDiscordIds = new Set<string>();
let onlineDiscordIds = new Set<string>();
const emptyOnlineDiscordIds = new Set<string>();

function validDiscordId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

export function discordIdsFromPresence(state: PresenceState): Set<string> {
  const ids = new Set<string>();
  for (const presences of Object.values(state)) {
    for (const presence of presences) if (validDiscordId(presence.discordId)) ids.add(presence.discordId);
  }
  return ids;
}

function publish() {
  const next = new Set(remoteDiscordIds);
  if (localDiscordId) next.add(localDiscordId);
  onlineDiscordIds = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOnlineDiscordIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => onlineDiscordIds, () => emptyOnlineDiscordIds);
}

export default function SitePresence({ member }: { member: Me | null }) {
  useEffect(() => {
    const discordId = validDiscordId(member?.discord_id) ? member.discord_id : null;
    localDiscordId = discordId;
    publish();
    if (!supa || !member || !discordId) return () => {
      if (localDiscordId === discordId) localDiscordId = null;
      remoteDiscordIds = new Set();
      publish();
    };

    const sb = supa;
    const channel = sb.channel('coldstream-site-presence-v1', {
      config: { presence: { key: member.id } },
    });
    const sync = () => {
      remoteDiscordIds = discordIdsFromPresence(channel.presenceState() as PresenceState);
      publish();
    };
    channel.on('presence', { event: 'sync' }, sync).subscribe(status => {
      if (status === 'SUBSCRIBED') void channel.track({ discordId, onlineAt: new Date().toISOString() });
    });

    return () => {
      if (localDiscordId === discordId) localDiscordId = null;
      remoteDiscordIds = new Set();
      publish();
      void channel.untrack();
      void sb.removeChannel(channel);
    };
  }, [member?.id, member?.discord_id]);

  return null;
}
