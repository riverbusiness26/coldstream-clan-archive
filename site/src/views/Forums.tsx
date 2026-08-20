// The forum: board index, thread list, and thread view.
//
// Reads from Supabase when configured. Reading is public; posting needs a
// signed-in member, and the staff board is hidden from everyone else by the
// row level security policy, so this component does not have to police it.
import { useCallback, useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import { one } from '../lib/rel';
import { demoForum } from '../lib/demoForum';

interface Board {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  min_role_read: string | null;
  min_role_post: string;
}

interface Thread {
  id: string;
  board_id: string;
  title: string;
  pinned: boolean;
  locked: boolean;
  created_at: string;
  last_post_at: string;
  author?: { display_name: string } | { display_name: string }[] | null;
}

interface Post {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author?: { display_name: string; avatar_url: string | null } | { display_name: string; avatar_url: string | null }[] | null;
}

function when(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Forums({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [counts, setCounts] = useState<Record<string, { threads: number; last: string | null }>>({});
  const [openBoard, setOpenBoard] = useState<Board | null>(null);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- board index ----
  useEffect(() => {
    if (!supa) { setBoards(demoForum.boards()); setCounts(demoForum.counts()); return; }
    const sb = supa;
    sb.from('board').select('*').order('position').then(({ data, error: e }) => {
      if (e) { setError(e.message); return; }
      setBoards((data ?? []) as Board[]);
      sb.from('thread').select('board_id, last_post_at').then(({ data: t }) => {
        const acc: Record<string, { threads: number; last: string | null }> = {};
        for (const row of (t ?? []) as { board_id: string; last_post_at: string }[]) {
          const c = (acc[row.board_id] ??= { threads: 0, last: null });
          c.threads += 1;
          if (!c.last || row.last_post_at > c.last) c.last = row.last_post_at;
        }
        setCounts(acc);
      });
    });
  }, []);

  // ---- threads in a board ----
  const loadThreads = useCallback((board: Board) => {
    setOpenBoard(board);
    setOpenThread(null);
    setThreads(null);
    if (!supa) { setThreads(demoForum.threads(board.id) as unknown as Thread[]); return; }
    supa
      .from('thread')
      .select('*, author:member(display_name)')
      .eq('board_id', board.id)
      .order('pinned', { ascending: false })
      .order('last_post_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setThreads((data ?? []) as Thread[]);
      });
  }, []);

  // ---- posts in a thread ----
  const loadPosts = useCallback((thread: Thread) => {
    setOpenThread(thread);
    setPosts(null);
    if (!supa) { setPosts(demoForum.posts(thread.id) as unknown as Post[]); return; }
    supa
      .from('post')
      .select('*, author:member(display_name, avatar_url)')
      .eq('thread_id', thread.id)
      .order('created_at')
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setPosts((data ?? []) as Post[]);
      });
  }, []);

  async function reply() {
    setFormError(null);
    if (!replyBody.trim()) { setFormError('Write something first.'); return; }
    if (!openThread || !me) return;
    if (!supa) {
      demoForum.reply(openThread.id, replyBody.trim(), { display_name: me.display_name, avatar_url: me.avatar_url });
      setReplyBody('');
      loadPosts(openThread);
      return;
    }

    setBusy(true);
    const { error } = await supa
      .from('post')
      .insert({ thread_id: openThread.id, author_id: me.id, body: replyBody.trim() });
    setBusy(false);
    if (error) { setFormError(error.message); return; }
    setReplyBody('');
    loadPosts(openThread);
  }

  async function createThread() {
    setFormError(null);
    if (!draftTitle.trim()) { setFormError('Give the thread a title.'); return; }
    if (!draftBody.trim()) { setFormError('Write something in the first post.'); return; }
    if (!openBoard || !me) return;
    if (!supa) {
      demoForum.createThread(openBoard.id, draftTitle.trim(), draftBody.trim(), { display_name: me.display_name, avatar_url: me.avatar_url });
      setDraftTitle(''); setDraftBody(''); setComposing(false);
      loadThreads(openBoard);
      return;
    }

    setBusy(true);
    const { data: t, error: e1 } = await supa
      .from('thread')
      .insert({ board_id: openBoard.id, title: draftTitle.trim(), author_id: me.id })
      .select()
      .single();

    if (e1 || !t) { setBusy(false); setFormError(e1?.message ?? 'Could not start the thread.'); return; }

    const { error: e2 } = await supa
      .from('post')
      .insert({ thread_id: t.id, author_id: me.id, body: draftBody.trim() });

    setBusy(false);
    if (e2) { setFormError(e2.message); return; }
    setDraftTitle(''); setDraftBody(''); setComposing(false);
    loadThreads(openBoard);
  }

  // ---- thread view ----
  if (openThread) {
    return (
      <div className="wrap solo">
        <main>
          <div className="crumbs">
            <button className="lnk" onClick={() => setOpenThread(null)}>Forums</button>
            <span> › </span>
            <button className="lnk" onClick={() => openBoard && loadThreads(openBoard)}>{openBoard?.name}</button>
            <span> › </span>
            <span className="here">{openThread.title}</span>
          </div>
          <div className="module">
            <div className="mhead">
              <h3>{openThread.title}</h3>
              {openThread.locked && <span className="pill">LOCKED</span>}
            </div>
            {posts === null && <div className="note">Loading.</div>}
            {posts?.length === 0 && <div className="note">Nothing in this thread yet.</div>}
            {posts?.map((p) => {
              const a = one(p.author);
              return (
                <article className="fpost" key={p.id}>
                  <div className="fpost-who">
                    {a?.avatar_url
                      ? <img className="fav" src={a.avatar_url} alt="" />
                      : <span className="fav ph" aria-hidden="true" />}
                    <span className="fname">{a?.display_name ?? 'unknown'}</span>
                    <span className="fwhen">{when(p.created_at)}</span>
                  </div>
                  <div className="fbody">{p.body}</div>
                </article>
              );
            })}

            {openThread.locked ? (
              <div className="note">This thread is locked. Nobody can add to it.</div>
            ) : me ? (
              <div className="compose">
                <textarea
                  className="inp ta"
                  placeholder="Reply"
                  value={replyBody}
                  onChange={(e) => { setReplyBody(e.target.value); setFormError(null); }}
                  rows={4}
                />
                {formError && <div className="ferr">{formError}</div>}
                <button className="btn primary sm" onClick={reply} disabled={busy}>
                  {busy ? 'Posting' : 'Post reply'}
                </button>
              </div>
            ) : (
              <div className="compose">
                <div className="note" style={{ padding: 0 }}>Sign in through Steam to reply.</div>
                <button className="btn sm" onClick={signIn}>Sign in through Steam</button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ---- thread list ----
  if (openBoard) {
    const canPost = Boolean(me);
    return (
      <div className="wrap solo">
        <main>
          <div className="crumbs">
            <button className="lnk" onClick={() => { setOpenBoard(null); setComposing(false); }}>Forums</button>
            <span> › </span>
            <span className="here">{openBoard.name}</span>
          </div>
          <div className="module">
            <div className="mhead">
              <h3>{openBoard.name}</h3>
              {canPost
                ? <button className="btn sm" onClick={() => setComposing((v) => !v)}>{composing ? 'Cancel' : 'New thread'}</button>
                : <button className="btn sm" onClick={signIn}>Sign in to post</button>}
            </div>
            {openBoard.description && <div className="note">{openBoard.description}</div>}

            {composing && (
              <div className="compose">
                <input
                  className="inp"
                  placeholder="Thread title"
                  value={draftTitle}
                  onChange={(e) => { setDraftTitle(e.target.value); setFormError(null); }}
                  maxLength={140}
                />
                <textarea
                  className="inp ta"
                  placeholder="Say your piece"
                  value={draftBody}
                  onChange={(e) => { setDraftBody(e.target.value); setFormError(null); }}
                  rows={5}
                />
                {formError && <div className="ferr">{formError}</div>}
                <button className="btn primary sm" onClick={createThread} disabled={busy}>
                  {busy ? 'Posting' : 'Post thread'}
                </button>
              </div>
            )}

            {threads === null && <div className="note">Loading.</div>}
            {threads?.length === 0 && <div className="note">No threads here yet. Be the first.</div>}
            {threads && threads.length > 0 && (
              <div className="tscroll">
                <table className="ftable">
                  <thead><tr><th>Thread</th><th>Started by</th><th>Last post</th></tr></thead>
                  <tbody>
                    {threads.map((t) => (
                      <tr key={t.id}>
                        <td>
                          {t.pinned && <span className="pin">PINNED</span>}
                          <button className="lnk strong" onClick={() => loadPosts(t)}>{t.title}</button>
                        </td>
                        <td className="dim">{one(t.author)?.display_name ?? 'unknown'}</td>
                        <td className="dim">{when(t.last_post_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ---- board index ----
  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead">
            <h3>Forums</h3>
            <span className="sub">reading is open to everyone, posting needs a Steam sign-in</span>
          </div>

          {error && <div className="note">Could not load the boards: {error}</div>}
          {boards === null && <div className="note">Loading.</div>}
          {boards?.length === 0 && !error && (
            <div className="note">No boards yet.</div>
          )}

          {boards && boards.length > 0 && (
            <div className="tscroll">
              <table className="ftable boards">
                <thead><tr><th>Board</th><th>Threads</th><th>Last post</th></tr></thead>
                <tbody>
                  {boards.map((b) => {
                    const c = counts[b.id];
                    return (
                      <tr key={b.id}>
                        <td>
                          <button className="lnk strong" onClick={() => loadThreads(b)}>{b.name}</button>
                          {b.min_role_read && <span className="pin">STAFF</span>}
                          {b.description && <div className="bdesc">{b.description}</div>}
                        </td>
                        <td className="dim num">{c?.threads ?? 0}</td>
                        <td className="dim">{c?.last ? when(c.last) : 'never'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
