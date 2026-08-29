// Demo-mode gallery store: member uploads work before the backend exists,
// persisted to localStorage on this machine. Same shape as the real
// gallery_item rows; storage_key holds the compressed data URL directly.
// Capped so the browser's storage quota never becomes the user's problem.
//
// It now carries the whole row rather than the image half of it. Videos,
// categories and dimensions all existed in the schema and in the upload form
// while this store still only understood "a picture with a caption", so demo
// mode quietly dropped three of the fields the person had just filled in and
// then rendered every plate cropped to 16:9. An agent working without a
// Supabase key sees only this path, so what it drops is what they think the
// feature does.

export interface DemoUpload {
  id: string;
  storage_key: string | null;   // data: URL in demo mode, null for a video
  media_type: 'image' | 'video';
  video_id: string | null;
  category_slug: string | null;
  category_id: null;            // demo mode has no ids; the slug is the link
  caption: string | null;
  game: string | null;
  year: number | null;
  width: number | null;
  height: number | null;
  approved: boolean;
  created_at: string;
  uploader: { display_name: string };
}

export interface DemoDraft {
  media_type: 'image' | 'video';
  storage_key: string | null;
  video_id: string | null;
  category_slug: string | null;
  caption: string | null;
  game: string | null;
  year: number | null;
  width: number | null;
  height: number | null;
}

const KEY = 'csg-demo-gallery-v1';
const MAX_ITEMS = 15;

function load(): DemoUpload[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    // Rows written before this store understood videos and categories are
    // still image rows and still valid; the missing fields just default.
    return (JSON.parse(raw) as Partial<DemoUpload>[]).map((r) => ({
      id: String(r.id),
      storage_key: r.storage_key ?? null,
      media_type: r.media_type ?? 'image',
      video_id: r.video_id ?? null,
      category_slug: r.category_slug ?? null,
      category_id: null,
      caption: r.caption ?? null,
      game: r.game ?? null,
      year: r.year ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      approved: r.approved ?? false,
      created_at: r.created_at ?? new Date(0).toISOString(),
      uploader: r.uploader ?? { display_name: 'member' },
    }));
  } catch { /* fresh start */ }
  return [];
}

function save(items: DemoUpload[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota; keep in memory */ }
}

const uid = () => 'g-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const demoGallery = {
  list(): DemoUpload[] {
    return load().sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  add(draft: DemoDraft, who: string): { ok: true } | { ok: false; reason: string } {
    const items = load();
    if (items.length >= MAX_ITEMS) {
      return { ok: false, reason: `The demo store holds ${MAX_ITEMS} items. The real backend has no such limit.` };
    }
    items.push({
      id: uid(), category_id: null, approved: false,
      created_at: new Date().toISOString(),
      uploader: { display_name: who },
      ...draft,
    });
    save(items);
    return { ok: true };
  },
  approve(id: string) {
    const items = load();
    const it = items.find((x) => x.id === id);
    if (it) it.approved = true;
    save(items);
  },
  remove(id: string) {
    save(load().filter((x) => x.id !== id));
  },
};
