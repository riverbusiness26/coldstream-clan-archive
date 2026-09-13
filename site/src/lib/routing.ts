export const AUTH_HASH = /(^|[#&])(access_token|refresh_token|provider_token|error|error_description|error_code)=/;
const aliases: Record<string, string> = { history: 'archive', media: 'gallery', brief: 'home', 'player-profile': 'profile' };
export function canonicalRoute(path: string): string {
  const [head, ...tail] = path.replace(/^#?\/?/, '').split('?')[0].split('/');
  return [aliases[head] ?? head, ...tail].join('/') || 'landing';
}
export function routeFromLocation(hash: string, pathname = '/'): string {
  if (AUTH_HASH.test(hash)) return 'home';
  const route = canonicalRoute(hash.replace(/^#\/?/, '') || pathname.replace(/^\//, ''));
  return route.startsWith('member/') || route.startsWith('design/') ? route : route.split('/')[0];
}
export function requiresMember(view: string): boolean {
  return ['home', 'events', 'leaderboard', 'profile', 'stores', 'roster', 'admin'].includes(view);
}
export function isStaff(role?: string): boolean { return role === 'admin' || role === 'moderator'; }
