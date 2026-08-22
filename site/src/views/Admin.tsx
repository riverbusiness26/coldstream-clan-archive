// The back office. The point of this page is that routine changes stop
// needing an engineer: River can post news, fix a typo, take something down,
// clear the gallery queue, and see the state of the site, without anybody
// opening an editor.
//
// It is gated twice on purpose. The nav link and this page check the role so
// the door is not advertised, and every write behind it is checked again by a
// row level security policy in the database, which is the rule that actually
// holds. Hiding a button is a courtesy.
import { useCallback, useEffect, useState } from 'react';
import { supa, DEMO } from '../lib/supa';
import type { Me } from '../lib/auth';

interface NewsRow {
  id: string;
  title: string;
  body: string;
  author: string | null;
  original_date: string | null;
  source_site: string | null;
  created_at: string;
}

type Draft = { id: string | null; title: string; body: string };
const empty: Draft = { id: null, title: '', body: '' };

export default function Admin({ me }: { me: Me | null }) {
  const canAdmin = me?.role === 'moderator' || me?.role === 'admin';

  const [rows, setRows] = useState<NewsRow[] | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!supa) { setRows([]); return; }
    supa.from('news_item')
      .select('id, title, body, author, original_date, source_site, created_at')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setRows((data ?? []) as NewsRow[]);
      });
    // How much is waiting on a decision, so the queue is visible from here
    // rather than only from the gallery page.
    supa.from('gallery_item').select('id').eq('approved', false)
      .then(({ data }) => setPending(data ? data.length : null));
  }, []);

  useEffect(() => { if (canAdmin) load(); }, [canAdmin, load]);

  async function save() {
    setError(null);
    setDone(null);
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title) { setError('Give it a title.'); return; }
    if (!body) { setError('Give it something to say.'); return; }
    if (!supa || !me) { setError('No backend configured, so nothing was saved.'); return; }

    setBusy(true);
    const { error: e } = draft.id
      ? await supa.from('news_item').update({ title, body }).eq('id', draft.id)
      : await supa.from('news_item').insert({
        title, body,
        author: me.display_name,
        source_site: 'coldstreamgaming.com',
        posted_by: me.id,
      });
    setBusy(false);

    if (e) {
      setError(/permission denied|42501/i.test(e.message)
        ? 'The database refused that. Migration 0017 may not be applied yet.'
        : e.message);
      return;
    }
    setDone(draft.id ? 'Saved.' : 'Posted. It is on the front page now.');
    setDraft(empty);
    load();
  }

  async function remove(id: string) {
    setError(null);
    setDone(null);
    if (!supa) return;
    const { data, error: e } = await supa.from('news_item').delete().eq('id', id).select('id');
    if (e) {
      setError(/permission denied|42501/i.test(e.message)
        ? 'Deleting news is not switched on yet. Apply migration 0017.'
        : e.message);
      return;
    }
    // A delete that removes nothing is row level security filtering the row,
    // not an error. Saying "done" there would be a lie.
    if (!data || data.length === 0) { setError('The database did not allow that deletion.'); return; }
    setDone('Removed.');
    if (draft.id === id) setDraft(empty);
    load();
  }

  if (!canAdmin) {
    return (
      <div className="wrap solo"><main><div className="module">
        <div className="mhead"><h3>Back office</h3></div>
        <div className="note">
          This part of the site is for moderators and admins. If that should be
          you, ask River.
        </div>
      </div></main></div>
    );
  }

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead">
            <h3>Back office</h3>
            <span className="sub">signed in as {me!.display_name}, {me!.role}</span>
          </div>
          <div className="note">
            Everything here writes straight to the live site. The database checks
            your role again on every change, so a mistake here is a mistake you
            were allowed to make, not a hole.
            {DEMO && <><br /><b>Demo mode: no backend, nothing here will save.</b></>}
          </div>
          {pending !== null && pending > 0 && (
            <div className="note">
              <b>{pending}</b> gallery {pending === 1 ? 'submission is' : 'submissions are'} waiting
              on you. <a className="ilink" href="#/gallery">Open the gallery</a> to approve or deny.
            </div>
          )}
        </div>

        <div className="module">
          <div className="mhead">
            <h3>{draft.id ? 'Edit this post' : 'Post news'}</h3>
            {draft.id && (
              <button className="btn sm" onClick={() => { setDraft(empty); setError(null); setDone(null); }}>
                New post instead
              </button>
            )}
          </div>
          <div className="compose">
            <input
              className="inp" placeholder="Headline" value={draft.title} maxLength={140}
              onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setError(null); }}
            />
            <textarea
              className="inp ta" rows={7} placeholder="What is happening?"
              value={draft.body} maxLength={4000}
              onChange={(e) => { setDraft({ ...draft, body: e.target.value }); setError(null); }}
            />
            {error && <div className="ferr">{error}</div>}
            {done && <div className="fok">{done}</div>}
            <button className="btn primary sm" onClick={save} disabled={busy}>
              {busy ? 'Saving' : draft.id ? 'Save changes' : 'Post it'}
            </button>
          </div>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>Posted news</h3>
            <span className="sub">{rows === null ? 'loading' : `${rows.length} on the site`}</span>
          </div>
          {rows !== null && rows.length === 0 && (
            <div className="note">
              Nothing posted through the site yet. The front page is showing the
              recovered posts from the old sites, which live in the archive seed
              and are not editable here on purpose.
            </div>
          )}
          {rows?.map((n) => (
            <article className="post" key={n.id}>
              <div className="meta">
                <b>{n.title}</b> · {new Date(n.created_at).toLocaleDateString()}
                {n.author ? ` · ${n.author}` : ''}
              </div>
              <p>{n.body.length > 240 ? n.body.slice(0, 240) + '...' : n.body}</p>
              <div className="chips">
                <button className="chip" onClick={() => {
                  setDraft({ id: n.id, title: n.title, body: n.body });
                  setError(null); setDone(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>Edit</button>
                <button className="chip" onClick={() => remove(n.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
