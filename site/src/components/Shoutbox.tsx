// The shoutbox. Realtime over Supabase when configured; a local demo feed
// otherwise so the module can be reviewed.
import { useEffect, useRef, useState } from 'react';
import { supa, DEMO } from '../lib/supa';
import type { Me } from '../lib/auth';

interface Shout { id: string; name: string; body: string; t: string }

const seedShouts: Shout[] = [
  { id: 's1', t: '21:02', name: 'Crawford', body: 'fall in, event at 8. bring a recruit' },
  { id: 's2', t: '21:04', name: 'Blaboon', body: 'fourteen years and my aim has not improved' },
  { id: 's3', t: '21:05', name: 'Timmy9000', body: 'and it never will' },
  { id: 's4', t: '21:11', name: 'kavcav', body: 'retakes after, usual lobby' },
];

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function Shoutbox({ me }: { me: Me | null }) {
  const [shouts, setShouts] = useState<Shout[]>(DEMO ? seedShouts : []);
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supa) return;
    const sb = supa;
    sb.from('shout')
      .select('id, body, created_at, member:author_id(display_name)')
      .order('created_at', { ascending: true }).limit(100)
      .then(({ data }) => {
        if (data) setShouts(data.map((r: any) => ({
          id: r.id, body: r.body, name: r.member?.display_name ?? '?', t: hhmm(new Date(r.created_at)),
        })));
      });
    const ch = sb.channel('shouts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shout' }, (payload: any) => {
        setShouts((s) => [...s.slice(-99), {
          id: payload.new.id, body: payload.new.body, name: payload.new.author_name ?? 'member', t: hhmm(new Date()),
        }]);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [shouts]);

  const send = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setText('');
    if (DEMO) {
      setShouts((s) => [...s, { id: String(Date.now()), name: me.display_name, body, t: hhmm(new Date()) }]);
      return;
    }
    await supa!.rpc('post_shout', { p_body: body }).then(async (r) => {
      if (r.error) await supa!.from('shout').insert({ body });
    });
  };

  return (
    <div className="module">
      <div className="mhead"><h3>Chat Room</h3><span className="sub">{DEMO ? 'demo, local only' : 'live'}</span></div>
      <div className="shout-log" ref={logRef}>
        {shouts.map((s) => (
          <div className="shout" key={s.id}>
            <span className="t">{s.t}</span>
            <span className="m"><b>{s.name}</b>: {s.body}</span>
          </div>
        ))}
      </div>
      <div className="shout-in">
        <input
          value={text}
          maxLength={200}
          placeholder={me ? `Shout as ${me.display_name}` : 'Sign in to shout'}
          disabled={!me}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn" disabled={!me} onClick={send}>Send</button>
      </div>
    </div>
  );
}
