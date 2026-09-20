import { useEffect, useState } from 'react';
import { supa } from './supa';

export type QuartermasterMember = {
  id: string;
  discord_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type QuartermasterDirectory = Record<string, QuartermasterMember>;

export function useQuartermasterMembers(discordIds: string[]) {
  const key = [...new Set(discordIds.filter(Boolean))].sort().join(',');
  const [directory, setDirectory] = useState<QuartermasterDirectory>({});

  useEffect(() => {
    if (!supa || !key) { setDirectory({}); return; }
    let current = true;
    supa.from('member').select('id,discord_id,display_name,avatar_url').in('discord_id', key.split(','))
      .then(({ data, error }) => {
        if (!current || error) return;
        setDirectory(Object.fromEntries(((data ?? []) as QuartermasterMember[]).map(member => [member.discord_id, member])));
      });
    return () => { current = false; };
  }, [key]);

  return directory;
}
