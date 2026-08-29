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

// The chips a member browses the wall with. Films is deliberately not among
// them: the screenshots/films segment above already does that filter, and two
// controls with one job is the reason nobody could tell which was in effect.
// It stays a real category, and stays offered when you upload.
export const BROWSE_CATEGORIES = CATEGORIES.filter((c) => !c.locked && c.slug !== 'films');

// One item, whichever half of the page it came from.
//
// The viewer takes these and nothing else, which is the point: before this
// existed the recovered half opened in a lightbox and a member's upload was an
// anchor straight to the Supabase storage URL, so clicking a picture either
// stayed on the site or threw you off it depending on which half you happened
// to click. `kind` selects the caption block. Everything above it is shared.
export interface Plate {
  key: string;
  kind: 'record' | 'member';
  src: string;              // the image, or the poster frame for a video
  w: number | null;         // null means unknown, and the tile falls back to 16:9
  h: number | null;
  caption: string;
  media: 'image' | 'video';
  videoId: string | null;
  game: string | null;
  year: number | null;
  // Recovered plates carry their provenance, which is the whole reason that
  // half of the page exists.
  date?: string | null;
  who?: string[];           // the names still legible in the shot
  source?: string;          // the address it was pulled back from
  // A member's upload carries who added it instead. It has no provenance and
  // must never be dressed up as though it had.
  by?: string;
}

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
