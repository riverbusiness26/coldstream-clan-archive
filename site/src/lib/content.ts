// The light half of the seed: news and the server list.
//
// These live apart from lib/data because lib/data imports the roster, which
// is 272 KB of JSON. Any page importing a single thing from lib/data used to
// drag the whole archive into the first download with it, which is why the
// front page was paying for data it never showed.
import newsSeed from '../seed/news.json';

export interface NewsItem {
  title: string; body: string; author: string | null;
  date: string | null; site: string | null; truncated?: boolean;
}
export interface ServerInfo {
  server_key: string; game: string; name: string; address: string;
  online: boolean; players: number; max_players: number; map?: string | null;
  player_names?: string[];
  visibility?: 'public' | 'private'; updated_at?: string;
}

export const news = newsSeed as NewsItem[];
// These are the servers actually provisioned on the community's VPS. The
// Holdfast row is updated by a live A2S query; the others deliberately stay
// private until their access rules are ready.
export const servers: ServerInfo[] = [
  { server_key: 'holdfast-dev', game: 'HOL', name: 'Coldstream Gaming Holdfast DEV', address: '40.160.84.169:20100', online: false, players: 0, max_players: 0, player_names: [], visibility: 'public' },
  { server_key: 'minecraft-dev', game: 'MC', name: 'Coldstream Minecraft DEV', address: '40.160.84.169:25565', online: false, players: 0, max_players: 0, player_names: [], visibility: 'public' },
  { server_key: 'valheim-dev', game: 'VAL', name: 'Coldstream Valheim DEV', address: '40.160.84.169:2456', online: false, players: 0, max_players: 0, player_names: [], visibility: 'public' },
];
