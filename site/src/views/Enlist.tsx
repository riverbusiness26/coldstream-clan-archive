// Enlist Here. Signing in through Steam is the whole membership step, so this
// page is not a gate: it is the introduction. It opens a thread on the
// enlistment board under your own name, which is the same thing the old
// applications did, minus the waiting.
//
// If the roster already knows the name you signed in with, that is worth
// saying out loud before anything else. Someone who played in 2012 should not
// be asked to introduce themselves like a stranger.
import { useEffect, useMemo, useState } from 'react';
import { supa } from '../lib/supa';
import { people, yearsWithUs } from '../lib/data';
import type { Me } from '../lib/auth';
import { one } from '../lib/rel';

const BOARD_SLUG = 'enlist';

interface Board { id: string; name: string }
interface Intro {
  id: string;
  title: string;
  created_at: string;
  author?: { display_name: string } | { display_name: string }[] | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export default function Enlist({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [intros, setIntros] = useState<Intro[] | null>(null);
  const [games, setGames] = useState('');
  const [found, setFound] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  // Does the roster already have this name? Steam names drift, so match on the
  // normalised form and treat it as a strong hint rather than proof.
  const match = useMemo(() => {
    if (!me) return null;
    const key = norm(me.display_name);
    if (!key) return null;
    return people.find((p) => norm(p.name) === key)
      ?? people.find((p) => {
        const n = norm(p.name);
        return n.length >= 4 && (n.includes(key) || key.includes(n));
      })
      ?? null;
  }, [me]);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    sb.from('board').select('id, name').eq('slug', BOARD_SLUG).single()
      .then(({ data }) => {
        if (!data) return;
        setBoard(data as Board);
        sb.from('thread')
          .select('id, title, created_at, author:member(display_name)')
          .eq('board_id', (data as Board).id)
          .order('created_at', { ascending: false })
          .limit(12)
          .then(({ data: t }) => setIntros((t ?? []) as unknown as Intro[]));
      });
  }, []);

  async function post() {
    setError(null);
    if (!about.trim()) { setError('Write a line or two about yourself first.'); return; }
    if (!supa || !me) return;
    if (!board) { setError('The enlistment board is not reachable right now.'); return; }

    // The two optional lines sit above the introduction, with a blank line
    // between them only if either was actually filled in.
    const head: string[] = [];
    if (games.trim()) head.push(`Playing: ${games.trim()}`);
    if (found.trim()) head.push(`Found us through: ${found.trim()}`);
    const body = head.length
      ? `${head.join('\n')}\n\n${about.trim()}`
      : about.trim();

    setBusy(true);
    const { data: t, error: e1 } = await supa
      .from('thread')
      .insert({ board_id: board.id, title: `${me.display_name} reporting in`, author_id: me.id })
      .select('id')
      .single();

    if (e1 || !t) { setBusy(false); setError(e1?.message ?? 'Could not post that.'); return; }

    const { error: e2 } = await supa
      .from('post')
      .insert({ thread_id: t.id, author_id: me.id, body });

    setBusy(false);
    if (e2) { setError(e2.message); return; }
    setPosted(true);
  }

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead">
            <h3>Enlist Here</h3>
            <span className="sub">signing in is the whole of it</span>
          </div>

          {!me && (
            <>
              <div className="note">
                Sign in through Steam and you are in the door. There is no
                application to wait on and nothing to fill in twice. If you have
                played with us before, your record on the roster links up on its
                own the moment you sign in.
              </div>
              <div className="compose">
                <button className="btn primary" onClick={signIn}>Sign in through Steam</button>
              </div>
            </>
          )}

          {me && match && (
            <div className="welcome-back">
              <div className="wb-tag">ON THE ROLL ALREADY</div>
              <div className="wb-name">{match.name}</div>
              <div className="wb-line">
                {match.firstYear
                  ? <>First on the record in <b>{match.firstYear}</b>. That is{' '}
                    <b>{yearsWithUs(match.firstYear)} years</b> with us.</>
                  : <>Already on the roster, though the record does not say which year you turned up.</>}
              </div>
              {match.games?.length > 0 && (
                <div className="wb-games">
                  {match.games.map((g: string) => <span className="gtag" key={g}>{g}</span>)}
                </div>
              )}
              <div className="wb-line dim">
                Welcome back. Say hello below if you want to, but you do not
                have to introduce yourself to this lot.
              </div>
            </div>
          )}

          {me && !match && (
            <div className="note">
              Signed in as <b>{me.display_name}</b>. The roster does not have
              that name yet, which just means you are new to the record. Post an
              introduction and you are on it.
            </div>
          )}

          {me && posted && (
            <div className="compose">
              <div className="fok">
                Posted. It is on the enlistment board now and people will see it.
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
                placeholder={match
                  ? 'Anything you want to say. Old stories welcome.'
                  : 'A line or two about yourself.'}
                value={about} onChange={(e) => { setAbout(e.target.value); setError(null); }} />
              {error && <div className="ferr">{error}</div>}
              <button className="btn primary sm" onClick={post} disabled={busy}>
                {busy ? 'Posting' : match ? 'Say hello' : 'Post your introduction'}
              </button>
            </div>
          )}
        </div>

        <div className="module">
          <div className="mhead">
            <h3>Lately on the enlistment board</h3>
            <span className="sub">newest first</span>
          </div>
          {intros === null && <div className="note">Loading.</div>}
          {intros?.length === 0 && (
            <div className="note">Nobody has posted here yet. Go on then.</div>
          )}
          {intros && intros.length > 0 && (
            <table className="ftable">
              <thead><tr><th>Thread</th><th>Who</th></tr></thead>
              <tbody>
                {intros.map((t) => (
                  <tr key={t.id}>
                    <td><a className="lnk strong" href="#/forums">{t.title}</a></td>
                    <td className="dim">{one(t.author)?.display_name ?? 'member'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
