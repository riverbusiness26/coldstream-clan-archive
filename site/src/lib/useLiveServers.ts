import { useEffect, useState } from 'react';
import { servers as seedServers, type ServerInfo } from './content';
import { supa } from './supa';

export function useLiveServers(): ServerInfo[] {
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

  return servers;
}
