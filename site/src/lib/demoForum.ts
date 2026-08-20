// Demo-mode forum store. Gives the forum full working behaviour before the
// backend exists: boards, threads, replies, all persisted to localStorage on
// this machine. The Forums component talks to this only when Supabase is not
// configured; the moment the backend lands, the same UI reads the real thing.
// Fresh boards only, per River: the old posts stay in The Archive.

export interface DBoard {
  id: string; slug: string; name: string; description: string | null;
  position: number; min_role_read: string | null; min_role_post: string;
}
export interface DThread {
  id: string; board_id: string; title: string; pinned: boolean; locked: boolean;
  created_at: string; last_post_at: string; author: { display_name: string };
}
export interface DPost {
  id: string; thread_id: string; body: string; created_at: string; edited_at: string | null;
  author: { display_name: string; avatar_url: string | null };
}

const KEY = 'csg-demo-forum-v1';

export const DEMO_BOARDS: DBoard[] = [
  { id: 'b-ann', slug: 'announcements', name: 'Announcements', description: 'Official word from the staff. Everyone can read, staff post.', position: 0, min_role_read: null, min_role_post: 'moderator' },
  { id: 'b-gen', slug: 'general', name: 'General Discussion', description: 'The barracks. Anything and everything.', position: 1, min_role_read: null, min_role_post: 'member' },
  { id: 'b-enlist', slug: 'enlist', name: 'Enlist Here', description: 'New here? Introduce yourself and get on the roll.', position: 2, min_role_read: null, min_role_post: 'member' },
  { id: 'b-events', slug: 'events', name: 'Events and Matches', description: 'Sign-ups, results and scheduling for every game we run.', position: 3, min_role_read: null, min_role_post: 'member' },
  { id: 'b-media', slug: 'media', name: 'Screenshots and Films', description: 'Post your clips and shots. The best go in the gallery.', position: 4, min_role_read: null, min_role_post: 'member' },
];

interface Store { threads: DThread[]; posts: DPost[] }

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* fall through to the seed */ }
  const now = new Date().toISOString();
  const seed: Store = {
    threads: [{
      id: 't-welcome', board_id: 'b-gen', title: 'Welcome to the new forums',
      pinned: true, locked: false, created_at: now, last_post_at: now,
      author: { display_name: 'Crawford' },
    }],
    posts: [{
      id: 'p-welcome', thread_id: 't-welcome',
      body: 'Fresh boards for a fresh start. The old threads are preserved in The Archive; this is where the next fifteen years get written. Fall in.',
      created_at: now, edited_at: null,
      author: { display_name: 'Crawford', avatar_url: null },
    }],
  };
  save(seed);
  return seed;
}

function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked; demo keeps working in memory */ }
}

const uid = () => 'd-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const demoForum = {
  boards(): DBoard[] { return DEMO_BOARDS; },
  counts(): Record<string, { threads: number; last: string | null }> {
    const s = load();
    const acc: Record<string, { threads: number; last: string | null }> = {};
    for (const t of s.threads) {
      const c = (acc[t.board_id] ??= { threads: 0, last: null });
      c.threads += 1;
      if (!c.last || t.last_post_at > c.last) c.last = t.last_post_at;
    }
    return acc;
  },
  threads(boardId: string): DThread[] {
    return load().threads
      .filter((t) => t.board_id === boardId)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.last_post_at.localeCompare(a.last_post_at));
  },
  posts(threadId: string): DPost[] {
    return load().posts
      .filter((p) => p.thread_id === threadId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  createThread(boardId: string, title: string, body: string, who: { display_name: string; avatar_url: string | null }): DThread {
    const s = load();
    const now = new Date().toISOString();
    const t: DThread = {
      id: uid(), board_id: boardId, title, pinned: false, locked: false,
      created_at: now, last_post_at: now, author: { display_name: who.display_name },
    };
    s.threads.push(t);
    s.posts.push({ id: uid(), thread_id: t.id, body, created_at: now, edited_at: null, author: who });
    save(s);
    return t;
  },
  reply(threadId: string, body: string, who: { display_name: string; avatar_url: string | null }): void {
    const s = load();
    const now = new Date().toISOString();
    s.posts.push({ id: uid(), thread_id: threadId, body, created_at: now, edited_at: null, author: who });
    const t = s.threads.find((x) => x.id === threadId);
    if (t) t.last_post_at = now;
    save(s);
  },
};
