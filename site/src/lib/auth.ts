// Session state. With a real backend: Supabase session created by the Steam
// edge function. In demo mode: a local pretend sign-in so flows can be
// reviewed end to end.
import { useEffect, useState } from 'react';
import { supa, DEMO, STEAM_LOGIN_URL } from './supa';

export interface Me {
  display_name: string;
  avatar_url: string | null;
  steam_id64: string;
  role: string;
}

export function useAuth() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    const load = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setMe(null); return; }
      const { data } = await sb.from('member')
        .select('display_name, avatar_url, steam_id64, role')
        .eq('auth_user_id', session.user.id).single();
      setMe(data as Me | null);
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = () => {
    if (DEMO) {
      setMe({ display_name: 'RiveRcs', avatar_url: null, steam_id64: '76561198044997257', role: 'admin' });
      return;
    }
    window.location.href = STEAM_LOGIN_URL!;
  };
  const signOut = () => {
    if (DEMO) { setMe(null); return; }
    supa!.auth.signOut();
  };

  return { me, signIn, signOut, demo: DEMO };
}
