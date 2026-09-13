export interface WeeklyFeature {
  member?: { display_name: string } | { display_name: string }[] | null;
  id: string;
  url: string;
  title: string;
  description: string | null;
  provider: string;
  submitted_at?: string | null;
  approved_at?: string | null;
}

export interface WeeklyMedia {
  submitter?: string;
  key: string;
  type: 'video' | 'image' | 'youtube' | 'link';
  src: string;
  label: string;
  description?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  source: 'weekly' | 'archive';
}

export function weeklyMediaItems(features: WeeklyFeature[], getYoutubeId: (url: string) => string | null): WeeklyMedia[] {
  const seen = new Set<string>();
  return features.flatMap((item) => {
    if (seen.has(item.id)) return [];
    seen.add(item.id);
    let url: URL;
    try { url = new URL(item.url); } catch { return []; }
    if (!['https:', 'http:'].includes(url.protocol)) return [];
    const youtube = getYoutubeId(item.url);
    const type: WeeklyMedia['type'] = youtube ? 'youtube'
      : /\.(mp4|webm|mov|m4v)$/i.test(url.pathname) || item.provider === 'video' ? 'video'
      : /\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname) || item.provider === 'image' ? 'image'
      : 'link';
    return [{ key: item.id, type, src: youtube || item.url, label: item.title || 'Community highlight',
      description: item.description, submitter: (Array.isArray(item.member) ? item.member[0]?.display_name : item.member?.display_name) || 'Community member', submitted_at: item.submitted_at, approved_at: item.approved_at, source: 'weekly' as const }];
  });
}

export function nextMediaIndex(index: number, direction: number, length: number): number {
  return length > 0 ? ((index + direction) % length + length) % length : 0;
}
