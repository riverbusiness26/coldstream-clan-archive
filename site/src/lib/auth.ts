// Session state. With a real backend: Supabase session created by the Steam
// edge function. In demo mode: a local pretend sign-in so flows can be
// reviewed end to end.
import { useEffect, useState } from 'react';
import { supa, DEMO, STEAM_LOGIN_URL } from './supa';

export interface Me {
  id: string;
  display_name: string;
  avatar_url: string | null;
  steam_id64: string;
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
      // maybeSingle, not single: no member row is a state to report, not a
      // PGRST116 error to swallow.
      const { data, error } = await sb.from('member')
        .select('id, display_name, avatar_url, steam_id64, role')
        .eq('auth_user_id', session.user.id).maybeSingle();
      if (error) console.warn('member row lookup failed:', error.message);
      setMe((data as Me | null) ?? null);
      setOrphanSession(!error && !data);
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = () => {
    if (DEMO) {
      setMe({ id: '00000000-0000-0000-0000-000000000001', display_name: 'RiveRcs', avatar_url: null, steam_id64: '76561198044997257', role: 'admin' });
      return;
    }
    window.location.href = STEAM_LOGIN_URL!;
  };
  const signOut = () => {
    if (DEMO) { setMe(null); return; }
    setOrphanSession(false);
    supa!.auth.signOut();
  };

  return { me, signIn, signOut, demo: DEMO, orphanSession };
}
