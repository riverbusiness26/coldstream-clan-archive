// Gallery categories and video handling.
//
// The categories mirror the seed in db/0009_gallery_categories.sql so the page
// works identically before the backend exists and after it does. When Supabase
// is connected the real table wins; this is the fallback and the ordering.

export interface Category {
  slug: string;
  name: string;
  description: string;
  accepts: 'image' | 'video' | 'both';
  locked: boolean;
}

export const CATEGORIES: Category[] = [
  { slug: 'napoleonic-wars', name: 'Napoleonic Wars', accepts: 'both', locked: false,
    description: 'Mount & Blade: Warband. The regiment years, linebattles and drills.' },
  { slug: 'counter-strike', name: 'Counter-Strike', accepts: 'both', locked: false,
    description: 'CS:GO and CS:S. Retakes, 10 mans, and the ESEA years.' },
  { slug: 'battlegrounds', name: 'Battlegrounds 2', accepts: 'both', locked: false,
    description: 'Where it started in 2011, before the regiment had a name.' },
  { slug: 'holdfast', name: 'Holdfast', accepts: 'both', locked: false,
    description: 'Nations at War.' },
  { slug: 'garrys-mod', name: "Garry's Mod", accepts: 'both', locked: false,
    description: 'TTT and whatever else the server was running that week.' },
  { slug: 'other-games', name: 'Other Games', accepts: 'both', locked: false,
    description: 'Everything else we have played together.' },
  { slug: 'films', name: 'Films', accepts: 'video', locked: false,
    description: "Videos of the community, ours and other people's." },
  { slug: 'the-archive', name: 'The Archive', accepts: 'both', locked: true,
    description: 'Recovered material, pulled off Photobucket and imgur before the links died. Read only: this is a record, not a noticeboard.' },
];

export const categoryBySlug = (slug: string | null) =>
  CATEGORIES.find((c) => c.slug === slug) ?? null;

// A member will paste whatever their browser had in the address bar, so accept
// every shape YouTube hands out rather than making them find the "right" one.
const PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
  /youtube\.com\/embed\/([\w-]{11})/i,
  /youtube\.com\/shorts\/([\w-]{11})/i,
  /youtube\.com\/live\/([\w-]{11})/i,
];

export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // A bare id, pasted on its own.
  if (/^[\w-]{11}$/.test(s)) return s;
  for (const p of PATTERNS) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
