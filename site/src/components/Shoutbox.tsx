// The shoutbox. Realtime over Supabase when configured; a local demo feed
// otherwise so the module can be reviewed without a backend.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supa, DEMO } from '../lib/supa';
import type { Me } from '../lib/auth';
import SteamButton from './SteamButton';

interface Shout { id: string; name: string; body: string; t: string; authorId?: string }

const seedShouts: Shout[] = [
  { id: 's1', t: '21:02', name: 'Crawford', body: 'fall in, event at 8. bring a recruit' },
  { id: 's2', t: '21:04', name: 'Blaboon', body: 'fourteen years and my aim has not improved' },
  { id: 's3', t: '21:05', name: 'Timmy9000', body: 'and it never will' },
  { id: 's4', t: '21:11', name: 'kavcav', body: 'retakes after, usual lobby' },
];

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const LIMIT = 100;

// An embedded relation comes back as an object for a to-one link, but the
// client types it as an array, and PostgREST will hand back either shape
// depending on how it reads the foreign key. Take whichever arrives.
interface Row {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author?: { display_name: string } | { display_name: string }[] | null;
}

function authorName(r: Row): string | null {
  const a = Array.isArray(r.author) ? r.author[0] : r.author;
  return a?.display_name ?? null;
}

export default function Shoutbox({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [shouts, setShouts] = useState<Shout[]>(DEMO ? seedShouts : []);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // A realtime INSERT payload carries the shout's own columns and nothing
  // else, so it has an author_id and no display name. Rather than a round trip
  // per message, names are cached as they are seen and looked up on a miss.
  const names = useRef<Map<string, string>>(new Map());

  const nameFor = useCallback(async (authorId: string) => {
    const hit = names.current.get(authorId);
    if (hit) return hit;
    if (!supa) return 'member';
    const { data } = await supa
      .from('member').select('display_name').eq('id', authorId).single();
    const n = (data?.display_name as string | undefined) ?? 'member';
    names.current.set(authorId, n);
    return n;
  }, []);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    let live = true;

    sb.from('shout')
      .select('id, body, created_at, author_id, author:member(display_name)')
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error: e }) => {
        if (!live) return;
        if (e) { setError(e.message); return; }
        const rows = (data ?? []) as unknown as Row[];
        for (const r of rows) {
          const n = authorName(r);
          if (n) names.current.set(r.author_id, n);
        }
        // Newest first off the wire, oldest first on screen.
        setShouts(rows.reverse().map((r) => ({
          id: r.id,
          body: r.body,
          name: authorName(r) ?? 'member',
          t: hhmm(new Date(r.created_at)),
          authorId: r.author_id,
        })));
      });

    const ch = sb.channel('shouts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shout' },
        async (payload) => {
          const row = payload.new as {
            id: string; body: string; author_id: string; created_at: string;
          };
          const name = await nameFor(row.author_id);
          if (!live) return;
          setShouts((s) =>
            // The sender already echoed their own line locally.
            s.some((x) => x.id === row.id)
              ? s
              : [...s.slice(-(LIMIT - 1)), {
                id: row.id, body: row.body, name, t: hhmm(new Date(row.created_at)),
                authorId: row.author_id,
              }],
          );
        })
      .subscribe();

    return () => { live = false; sb.removeChannel(ch); };
  }, [nameFor]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [shouts]);

  const send = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setError(null);
    setText('');

    if (DEMO) {
      setShouts((s) => [...s, {
        id: String(Date.now()), name: me.display_name, body, t: hhmm(new Date()),
      }]);
      return;
    }

    const { data, error: e } = await supa!
      .from('shout')
      .insert({ author_id: me.id, body })
      .select('id, created_at')
      .single();

    // Put the text back rather than losing it to a failed send.
    if (e || !data) { setError(e?.message ?? 'Could not send that.'); setText(body); return; }

    names.current.set(me.id, me.display_name);
    // Echo straight away; realtime skips it because the id is already here.
    setShouts((s) => s.some((x) => x.id === data.id) ? s : [...s.slice(-(LIMIT - 1)), {
      id: data.id, body, name: me.display_name, t: hhmm(new Date(data.created_at)),
    }]);
  };

  async function remove(id: string) {
    const before = shouts;
    setShouts((s) => s.filter((x) => x.id !== id));
    setError(null);
    if (!supa) return;
    const { data, error: e } = await supa.from('shout').delete().eq('id', id).select('id');
    if (e) {
      setShouts(before);
      setError(/permission denied|42501/i.test(e.message)
        ? 'Deleting is not switched on for this site yet. An admin needs to apply migration 0015.'
        : e.message);
      return;
    }
    if (!data || data.length === 0) {
      setShouts(before);
      setError('That is not yours to delete.');
    }
  }

  return (
    <div className="module">
      <div className="mhead">
        <h3>Shoutbox</h3>
        <span className="sub">{DEMO ? 'demo, local only' : 'live'}</span>
      </div>
      <div className="shout-log" ref={logRef}>
        {shouts.length === 0 && <div className="note">Quiet in here. Say something.</div>}
        {shouts.map((s) => {
          const canRemove = !!me && (s.authorId === me.id || me.role === 'moderator' || me.role === 'admin');
          return (
            <div className="shout" key={s.id}>
              <span className="t">{s.t}</span>
              <span className="m"><b>{s.name}</b>: {s.body}</span>
              {canRemove && (
                <button className="shout-x" onClick={() => remove(s.id)}
                  title={s.authorId === me!.id ? 'Delete your shout' : 'Remove this shout'}
                  aria-label="Delete this shout">x</button>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="ferr" style={{ padding: '8px 16px' }}>{error}</div>}
      {!me && (
        <div className="shout-in"><SteamButton me={me} signIn={signIn} /></div>
      )}
      {me && (
      <div className="shout-in">
        <input
          value={text}
          maxLength={200}
          placeholder={me ? `Shout as ${me.display_name}` : 'Sign in to shout'}
          disabled={!me}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn" disabled={!me || !text.trim()} onClick={send}>Send</button>
      </div>
      )}
    </div>
  );
}
