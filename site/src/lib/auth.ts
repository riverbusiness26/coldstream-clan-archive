// Session state. Discord is the community identity. Steam remains a separate
// optional game identity for statistics already collected by the site.
import { useCallback, useEffect, useState } from 'react';
import { supa, DEMO } from './supa';

export interface Me {
  id: string;
  display_name: string;
  avatar_url: string | null;
  steam_id64: string | null;
  discord_id: string | null;
  role: string;
}

export function useAuth() {
  const [me, setMe] = useState<Me | null>(null);
  // A live session whose member row is missing. It means the edge function
  // issued the session but its member upsert did not land, and without this
  // the site would render a signed-in person as a guest and say nothing.
  const [orphanSession, setOrphanSession] = useState(false);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    const load = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setMe(null); setOrphanSession(false); return; }
      // The edge function checks current Discord server membership and roles,
      // then creates or refreshes the member row. A stale browser value never
      // promotes anybody.
      if (session.user.app_metadata.provider === 'discord') {
        const { error: syncError } = await sb.functions.invoke('discord-member-sync', { body: {} });
        if (syncError) console.warn('Discord member sync failed:', syncError.message);
      }
      // maybeSingle, not single: no member row is a state to report, not a
      // PGRST116 error to swallow.
      const { data, error } = await sb.from('member')
        .select('id, display_name, avatar_url, steam_id64, discord_id, role')
        .eq('auth_user_id', session.user.id).maybeSingle();
      if (error) console.warn('member row lookup failed:', error.message);
      setMe((data as Me | null) ?? null);
      setOrphanSession(!error && !data);
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  // Re-read the member row without re-running the Discord role sync.
  //
  // Something that changes the row rather than the session, such as linking a
  // Steam account, leaves `me` stale: there is no auth state change to react
  // to, so nothing would otherwise refresh it and the page would keep showing
  // the state from before the change.
  const refresh = useCallback(async () => {
    if (!supa) return;
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;
    const { data } = await supa.from('member')
      .select('id, display_name, avatar_url, steam_id64, discord_id, role')
      .eq('auth_user_id', session.user.id).maybeSingle();
    if (data) setMe(data as Me);
  }, []);

  const signIn = async () => {
    if (DEMO) {
      setMe({
        id: '00000000-0000-0000-0000-000000000001',
        display_name: 'Command Board Preview',
        avatar_url: null,
        steam_id64: null,
        discord_id: 'preview',
        role: 'admin',
      });
      return;
    }
    sessionStorage.setItem('coldstream-auth-return', location.hash.startsWith('#/') ? location.hash : '#/home');
    await supa!.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${location.origin}${location.pathname}` },
    });
  };
  const signOut = () => {
    if (DEMO) { setMe(null); return; }
    setOrphanSession(false);
    supa!.auth.signOut();
  };

  return { me, signIn, signOut, refresh, demo: DEMO, orphanSession };
}
