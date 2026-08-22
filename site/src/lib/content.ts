// The light half of the seed: news and the server list.
//
// These live apart from lib/data because lib/data imports the roster, which
// is 272 KB of JSON. Any page importing a single thing from lib/data used to
// drag the whole archive into the first download with it, which is why the
// front page was paying for data it never showed.
import newsSeed from '../seed/news.json';
import serversSeed from '../seed/servers.json';

export interface NewsItem {
  title: string; body: string; author: string | null;
  date: string | null; site: string | null; truncated?: boolean;
}
export interface ServerInfo {
  server_key: string; game: string; name: string; address: string;
  online: boolean; players: number; max_players: number; map?: string;
}

export const news = newsSeed as NewsItem[];
export const servers = serversSeed as ServerInfo[];
