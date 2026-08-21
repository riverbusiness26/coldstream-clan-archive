// Join. Signing in through Steam is the whole membership step, so this
// page is not a gate: it is the introduction. Introductions land in their own
// enlistment book (the forum was scrapped; this page never needed one).
//
// Deliberately not wired to the roster: signing in shows who you are on
// Steam and nothing more, per River. The roster stays its own record.
import { useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import SteamButton from '../components/SteamButton';
import type { Me } from '../lib/auth';

interface Intro {
  id: string;
  display_name: string;
  body: string;
  created_at: string;
}

const DEMO_KEY = 'csg-demo-enlist-v1';
const demoLoad = (): Intro[] => {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]') as Intro[]; } catch { return []; }
};
const demoSave = (v: Intro[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(v)); } catch { /* quota */ } };

export default function Enlist({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [intros, setIntros] = useState<Intro[] | null>(null);
  const [games, setGames] = useState('');
  const [found, setFound] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const load = () => {
    if (!supa) { setIntros(demoLoad().sort((a, b) => b.created_at.localeCompare(a.created_at))); return; }
    supa.from('enlistment')
      .select('id, display_name, body, created_at')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setIntros((data ?? []) as Intro[]));
  };
  useEffect(load, []);

  async function post() {
    setError(null);
    if (!about.trim()) { setError('Write a line or two about yourself first.'); return; }
    if (!me) return;

    const head: string[] = [];
    if (games.trim()) head.push(`Playing: ${games.trim()}`);
    if (found.trim()) head.push(`Found us through: ${found.trim()}`);
    const body = head.length ? `${head.join('\n')}\n\n${about.trim()}` : about.trim();

    if (!supa) {
      const items = demoLoad();
      items.push({ id: 'e-' + Date.now().toString(36), display_name: me.display_name, body, created_at: new Date().toISOString() });
      demoSave(items);
      setPosted(true);
      load();
      return;
    }

    setBusy(true);
    const { error: e } = await supa.from('enlistment').insert({ body, display_name: me.display_name });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setPosted(true);
    load();
  }

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead">
            <h3>Join</h3>
            <span className="sub">signing in is the whole of it</span>
          </div>

          {!me && (
            <>
              <div className="note">
                Sign in through Steam and you are in the door. There is no
                application to wait on and nothing to fill in twice.
              </div>
              <div className="compose">
                <SteamButton me={me} signIn={signIn} />
              </div>
            </>
          )}

          {me && !posted && (
            <div className="note">
              <div style={{ marginBottom: 8 }}><SteamButton me={me} signIn={signIn} /></div>
              Say hello below and you are on the book.
            </div>
          )}

          {me && posted && (
            <div className="compose">
              <div className="fok">
                Posted. It is in the enlistment book now and people will see it.
              </div>
            </div>
          )}

          {me && !posted && (
            <div className="compose">
              <div className="fieldrow">
                <input className="inp" placeholder="What are you playing these days?"
                  value={games} onChange={(e) => setGames(e.target.value)} maxLength={120} />
              </div>
              <input className="inp" placeholder="How did you find us? (optional)"
                value={found} onChange={(e) => setFound(e.target.value)} maxLength={120} />
              <textarea className="inp ta" rows={5}
                placeholder="A line or two about yourself."
                value={about} onChange={(e) => { setAbout(e.target.value); setError(null); }} />
              {error && <div className="ferr">{error}</div>}
              <button className="btn primary sm" onClick={post} disabled={busy}>
                {busy ? 'Posting' : 'Post your introduction'}
              </button>
            </div>
          )}
        </div>

        <div className="module">
          <div className="mhead">
            <h3>The enlistment book</h3>
            <span className="sub">newest first</span>
          </div>
          {intros === null && <div className="note">Loading.</div>}
          {intros?.length === 0 && (
            <div className="note">Nobody has signed the book yet. Go on then.</div>
          )}
          {intros && intros.length > 0 && intros.map((t) => (
            <article className="post" key={t.id}>
              <div className="meta"><b>{t.display_name}</b> · {new Date(t.created_at).toLocaleDateString()}</div>
              <p>{t.body}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
