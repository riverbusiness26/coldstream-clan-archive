// Demo-mode gallery store: member uploads work before the backend exists,
// persisted to localStorage on this machine. Same shape as the real
// gallery_item rows; storage_key holds the compressed data URL directly.
// Capped so the browser's storage quota never becomes the user's problem.

export interface DemoUpload {
  id: string;
  storage_key: string;          // data: URL in demo mode
  caption: string | null;
  game: string | null;
  year: number | null;
  approved: boolean;
  created_at: string;
  uploader: { display_name: string };
}

const KEY = 'csg-demo-gallery-v1';
const MAX_ITEMS = 15;

function load(): DemoUpload[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoUpload[];
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
  add(dataUrl: string, caption: string | null, game: string | null, year: number | null, who: string): { ok: true } | { ok: false; reason: string } {
    const items = load();
    if (items.length >= MAX_ITEMS) {
      return { ok: false, reason: `The demo store holds ${MAX_ITEMS} images. The real backend has no such limit.` };
    }
    items.push({
      id: uid(), storage_key: dataUrl, caption, game, year,
      approved: false, created_at: new Date().toISOString(),
      uploader: { display_name: who },
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
