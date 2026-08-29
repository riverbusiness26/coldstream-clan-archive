// The media model, and the only place that knows where media comes from.
//
// The gallery has always had two sources that behave nothing alike: a local
// seed of recovered screenshots seed/gallery.json, read synchronously at
// import, and gallery_item in Supabase, read over the network and moderated.
// The view used to hold both shapes at once and branch on which was which,
// which is why the two halves drifted into having different lightboxes,
// different filters and different link behaviour.
//
// Everything above this file now sees one MediaItem. Fetching is the only IO
// and it happens once; selecting, searching and sorting are pure functions
// over the result, so filtering never refetches and never re-renders anything
// it did not have to.
//
// Swapping Supabase for a CMS or an object store means rewriting fetchMedia
// and nothing else.
import { supa } from './supa';
import { demoGallery } from './demoGallery';
import { one } from './rel';
import shotsSeed from '../seed/gallery.json';
import { youtubeThumb, youtubeWatch, youtubeEmbed } from './gallery';

export type MediaType = 'image' | 'video';

// Where an item came from, which is an editorial distinction and not a
// category. A recovered plate carries provenance and can be checked; a
// member's upload carries an author and cannot. They are never merged.
export type MediaOrigin = 'record' | 'member';

export interface MediaItem {
  id: string;
  type: MediaType;
  origin: MediaOrigin;
  title: string;
  description: string | null;
  /** Full resolution, or the watch URL for a film. */
  src: string;
  thumbnail: string;
  poster: string | null;
  /** Playable embed for a film, null for a still. */
  embed: string | null;
  alt: string;
  /** Game category slug, from gallery_category. */
  category: string | null;
  /** What kind of media it is, independent of which game. */
  collection: CollectionSlug | null;
  tags: string[];
  author: string | null;
  /** As known: YYYY, YYYY-MM or YYYY-MM-DD. Not every plate knows its day. */
  date: string | null;
  /** Epoch ms, for ordering only. Never rendered. */
  sortDate: number;
  year: number | null;
  /** Seconds. Null unless something recorded it; never guessed. */
  duration: number | null;
  featured: boolean;
  views: number | null;
  downloadable: boolean;
  /** WebVTT URL, when one exists. */
  captions: string | null;
  width: number | null;
  height: number | null;
  videoId: string | null;
  /** Recovered plates only: the address it was pulled back from. */
  source: string | null;
  /** Recovered plates only: the names still legible in the shot. */
  names: string[];
}

// The media kinds, as distinct from the game categories. A category answers
// "which game", a collection answers "what kind of thing is this".
export const COLLECTIONS = [
  { slug: 'screenshots', name: 'Screenshots' },
  { slug: 'gameplay', name: 'Gameplay' },
  { slug: 'trailers', name: 'Trailers' },
  { slug: 'events', name: 'Events' },
  { slug: 'artwork', name: 'Artwork' },
  { slug: 'community', name: 'Community' },
] as const;

export type CollectionSlug = typeof COLLECTIONS[number]['slug'];

const COLLECTION_SLUGS = COLLECTIONS.map((c) => c.slug) as readonly string[];

export const collectionName = (slug: string | null) =>
  COLLECTIONS.find((c) => c.slug === slug)?.name ?? null;

const isCollection = (v: unknown): v is CollectionSlug =>
  typeof v === 'string' && COLLECTION_SLUGS.includes(v);

export type SortKey = 'newest' | 'oldest' | 'featured' | 'views';

export interface MediaQuery {
  origin?: MediaOrigin | 'all';
  type?: MediaType | 'all';
  category?: string;
  collection?: string;
  year?: string;
  search?: string;
  sort?: SortKey;
}

interface Shot {
  src: string; w: number; h: number; caption: string;
  date: string | null; year: number | null; game: string;
  who: string[]; source: string;
}

interface Row {
  id: string;
  storage_key: string | null;
  category_id: string | null;
  category_slug?: string | null;
  media_type: MediaType;
  video_id: string | null;
  caption: string | null;
  game: string | null;
  year: number | null;
  width?: number | null;
  height?: number | null;
  approved: boolean;
  created_at: string;
  uploader?: { display_name: string } | { display_name: string }[] | null;
  // Everything below arrives only once 0021 has been run. Reading them off a
  // `select *` means an unrun migration leaves them undefined rather than
  // throwing, which is the same shape the server status poller uses.
  description?: string | null;
  tags?: string[] | null;
  collection?: string | null;
  duration_seconds?: number | null;
  featured?: boolean | null;
  views?: number | null;
  downloadable?: boolean | null;
  captions_url?: string | null;
}

const BUCKET = 'gallery';

const publicUrl = (k: string | null) =>
  !k ? '' : k.startsWith('data:') ? k
    : supa ? supa.storage.from(BUCKET).getPublicUrl(k).data.publicUrl : '';

// A stable id for a recovered plate. The filenames are already content
// hashes, so the basename is the identity and a deep link to one keeps
// working as long as the file does.
const recordId = (src: string) => 'rec-' + (src.split('/').pop() ?? src).replace(/\.[a-z0-9]+$/i, '');

// A partial date sorts by the earliest instant it could mean, so "2012"
// lands before "2012-06" rather than after everything.
function toEpoch(date: string | null, year: number | null): number {
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  }
  if (year) return Date.UTC(year, 0, 1);
  return 0;
}

function fromSeed(s: Shot): MediaItem {
  return {
    id: recordId(s.src),
    type: 'image',
    origin: 'record',
    title: s.caption,
    description: null,
    src: s.src,
    thumbnail: s.src,
    poster: null,
    embed: null,
    alt: s.caption,
    category: null,
    // Truthfully derived rather than invented: every recovered plate is a
    // screenshot. Nothing else about the seed says what kind of media it is,
    // so nothing else is claimed.
    collection: 'screenshots',
    tags: s.who,
    author: null,
    date: s.date,
    sortDate: toEpoch(s.date, s.year),
    year: s.date ? Number(s.date.slice(0, 4)) : s.year,
    duration: null,
    featured: false,
    views: null,
    // Ours to hand over: these are served from this origin and the whole point
    // of recovering them was that people could keep a copy this time.
    downloadable: true,
    captions: null,
    width: s.w,
    height: s.h,
    videoId: null,
    source: s.source,
    names: s.who,
  };
}

function fromRow(r: Row, slugFor: (id: string | null) => string | null): MediaItem {
  const video = r.media_type === 'video' && !!r.video_id;
  const thumb = video ? youtubeThumb(r.video_id as string) : publicUrl(r.storage_key);
  const title = r.caption || (video ? 'A film' : 'A screenshot');
  return {
    id: r.id,
    type: r.media_type,
    origin: 'member',
    title,
    description: r.description ?? null,
    src: video ? youtubeWatch(r.video_id as string) : publicUrl(r.storage_key),
    thumbnail: thumb,
    poster: video ? thumb : null,
    embed: video ? youtubeEmbed(r.video_id as string, { captions: !!r.captions_url }) : null,
    alt: title,
    category: r.category_slug ?? slugFor(r.category_id),
    collection: isCollection(r.collection) ? r.collection : null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    author: one(r.uploader)?.display_name ?? 'member',
    date: r.created_at.slice(0, 10),
    sortDate: Date.parse(r.created_at) || 0,
    year: r.year,
    duration: r.duration_seconds ?? null,
    featured: r.featured === true,
    views: typeof r.views === 'number' ? r.views : null,
    // A YouTube film is not ours to hand over, so the default differs by type
    // and the column, once it exists, can still override either way.
    downloadable: r.downloadable ?? !video,
    captions: r.captions_url ?? null,
    // A YouTube poster frame is 16:9 whatever the film is.
    width: video ? 480 : r.width ?? null,
    height: video ? 270 : r.height ?? null,
    videoId: r.video_id,
    source: null,
    names: [],
  };
}

export interface MediaLoad {
  /** Approved and public. */
  items: MediaItem[];
  /** Held for a moderator. Empty for anyone RLS does not show them to. */
  pending: MediaItem[];
  /** Set when the member half could not be read. The record half still loads. */
  error: string | null;
}

// How many member rows to ask for. The recovered half is a bundled seed and
// is always whole. If gallery_item ever outgrows this, move the cap into a
// .range() here and pass the page down; the callers already ask for a page at
// a time and would not change.
const ROW_CAP = 200;

export async function fetchMedia(): Promise<MediaLoad> {
  const record = (shotsSeed as Shot[]).map(fromSeed);

  if (!supa) {
    const rows = demoGallery.list() as unknown as Row[];
    const slugFor = () => null;
    return {
      items: [...record, ...rows.filter((r) => r.approved).map((r) => fromRow(r, slugFor))],
      pending: rows.filter((r) => !r.approved).map((r) => fromRow(r, slugFor)),
      error: null,
    };
  }

  const [cats, rows] = await Promise.all([
    supa.from('gallery_category').select('id, slug'),
    supa.from('gallery_item')
      .select('*, uploader:member(display_name)')
      .order('created_at', { ascending: false })
      .limit(ROW_CAP),
  ]);

  // A category lookup that fails is cosmetic: items still render, they just
  // cannot be filtered by game. A row fetch that fails is not, and says so.
  const byId = new Map((cats.data ?? []).map((c: { id: string; slug: string }) => [c.id, c.slug]));
  const slugFor = (id: string | null) => (id ? byId.get(id) ?? null : null);

  if (rows.error) {
    return { items: record, pending: [], error: rows.error.message };
  }

  const all = (rows.data ?? []) as Row[];
  return {
    items: [...record, ...all.filter((r) => r.approved).map((r) => fromRow(r, slugFor))],
    pending: all.filter((r) => !r.approved).map((r) => fromRow(r, slugFor)),
    error: null,
  };
}

// Counting a view is best effort and must never be able to break a page that
// is only trying to show a picture. It is a no-op in demo mode, on the
// recovered half, which is a static seed, and until 0021 has been run.
export async function recordView(item: MediaItem): Promise<void> {
  if (!supa || item.origin !== 'member') return;
  try {
    await supa.rpc('gallery_item_viewed', { item: item.id });
  } catch { /* the function is not there yet */ }
}

// ---------------------------------------------------------------- selecting

const haystack = (m: MediaItem) => [
  m.title, m.description ?? '', m.author ?? '', m.category ?? '',
  collectionName(m.collection) ?? '', ...m.tags, ...m.names,
].join(' ').toLowerCase();

// Every term must appear somewhere, so adding a word narrows rather than
// widens. Quoting is not supported and would not earn its keep here.
function matches(m: MediaItem, search: string): boolean {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = haystack(m);
  return terms.every((t) => hay.includes(t));
}

const UNDATED = 'undated';

export const yearOf = (m: MediaItem) => (m.year ? String(m.year) : UNDATED);

export function selectMedia(items: MediaItem[], q: MediaQuery): MediaItem[] {
  const out = items.filter((m) =>
    (!q.origin || q.origin === 'all' || m.origin === q.origin)
    && (!q.type || q.type === 'all' || m.type === q.type)
    && (!q.category || q.category === 'all' || m.category === q.category)
    && (!q.collection || q.collection === 'all' || m.collection === q.collection)
    && (!q.year || q.year === 'all' || yearOf(m) === q.year)
    && (!q.search || matches(m, q.search)));

  const by: Record<SortKey, (a: MediaItem, b: MediaItem) => number> = {
    newest: (a, b) => b.sortDate - a.sortDate,
    oldest: (a, b) => a.sortDate - b.sortDate,
    // Featured first, then newest within each group, so the toggle is a
    // promotion rather than a different ordering to relearn.
    featured: (a, b) => Number(b.featured) - Number(a.featured) || b.sortDate - a.sortDate,
    views: (a, b) => (b.views ?? 0) - (a.views ?? 0) || b.sortDate - a.sortDate,
  };
  return out.sort(by[q.sort ?? 'newest']);
}

/** Counts for a facet, computed against everything else already narrowed. */
export function countBy(items: MediaItem[], key: (m: MediaItem) => string | null) {
  const counts = new Map<string, number>();
  for (const m of items) {
    const k = key(m);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** Render only as much of a date as is actually known. */
export function shownDate(d: string | null | undefined): string {
  if (!d) return 'date unknown';
  const [y, m, day] = d.split('-');
  const month = MONTHS[Number(m) - 1] ?? '';
  if (!month) return y;
  return day ? `${Number(day)} ${month} ${y}` : `${month} ${y}`;
}

export function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'unknown source'; }
}
