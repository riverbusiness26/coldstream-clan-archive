// Events, now a room in the Archive. Upcoming events on top (moderator-posted; a demo store
// until the backend lands), and below it the part no other community site
// has: the dated record of 362 real events back to 2011, straight from the
// announcement archive.
import { useEffect, useState } from 'react';
import eventRecord from '../seed/event-record.json';
import { supa } from '../lib/supa';
import { GAME_NAMES } from '../lib/games';
import type { Me } from '../lib/auth';

interface PastEvent { date: string; title: string; game: string; author: string | null; group: string }
interface Upcoming { id: string; title: string; game: string | null; starts_at: string; details: string | null; created_by_name: string }

const RECORD = eventRecord as PastEvent[];
const DEMO_KEY = 'csg-demo-events-v1';

const demoLoad = (): Upcoming[] => {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]') as Upcoming[]; } catch { return []; }
};
const demoSave = (v: Upcoming[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(v)); } catch { /* quota */ } };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export default function Calendar({ me }: { me: Me | null }) {
  const years = [...new Set(RECORD.map((e) => e.date.slice(0, 4)))].sort().reverse();
  const [year, setYear] = useState(years[0]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [game, setGame] = useState('');
  const [when, setWhen] = useState('');
  const [details, setDetails] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canPost = me?.role === 'moderator' || me?.role === 'admin';

  const loadUpcoming = () => {
    if (!supa) { setUpcoming(demoLoad().filter((u) => u.starts_at >= new Date().toISOString().slice(0, 10))); return; }
    supa.from('event').select('*, creator:created_by(display_name)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .then(({ data }) => setUpcoming(((data ?? []) as any[]).map((r) => ({
        id: r.id, title: r.title, game: r.game, starts_at: r.starts_at, details: r.details,
        created_by_name: r.creator?.display_name ?? 'moderator',
      }))));
  };
  useEffect(loadUpcoming, []);

  async function post() {
    setFormError(null);
    if (!title.trim()) { setFormError('Give the event a name.'); return; }
    if (!when || isNaN(new Date(when).getTime())) { setFormError('Pick a date and time.'); return; }
    if (!me) return;
    if (!supa) {
      const items = demoLoad();
      items.push({ id: 'e-' + Date.now().toString(36), title: title.trim(), game: game.trim() || null, starts_at: when, details: details.trim() || null, created_by_name: me.display_name });
      demoSave(items);
      setTitle(''); setGame(''); setWhen(''); setDetails(''); setComposing(false);
      loadUpcoming();
      return;
    }
    const { error } = await supa.from('event').insert({ title: title.trim(), game: game.trim() || null, starts_at: new Date(when).toISOString(), details: details.trim() || null });
    if (error) { setFormError(error.message); return; }
    setTitle(''); setGame(''); setWhen(''); setDetails(''); setComposing(false);
    loadUpcoming();
  }

  const inYear = RECORD.filter((e) => e.date.startsWith(year));
  const byMonth: Record<string, PastEvent[]> = {};
  for (const e of inYear) (byMonth[e.date.slice(5, 7)] ||= []).push(e);

  return (
    <>
        <div className="module">
          <div className="mhead">
            <h3>Upcoming Events</h3>
            {canPost
              ? <button className="btn sm" onClick={() => setComposing((v) => !v)}>{composing ? 'Cancel' : 'Post an event'}</button>
              : <span className="sub">posted by admins and moderators</span>}
          </div>

          {composing && (
            <div className="compose">
              <input className="inp" placeholder="Event name" value={title} maxLength={140}
                onChange={(e) => { setTitle(e.target.value); setFormError(null); }} />
              <div className="fieldrow">
                <input className="inp" placeholder="Game" value={game} maxLength={60}
                  onChange={(e) => setGame(e.target.value)} />
                <input className="inp" type="datetime-local" value={when}
                  onChange={(e) => { setWhen(e.target.value); setFormError(null); }} />
              </div>
              <textarea className="inp ta" placeholder="Server, rules, what to bring" rows={3}
                value={details} onChange={(e) => setDetails(e.target.value)} />
              {formError && <div className="ferr">{formError}</div>}
              <button className="btn primary sm" onClick={post}>Post event</button>
            </div>
          )}

          {upcoming.length === 0 && (
            <div className="note">Nothing on the board yet. When an admin or moderator posts the next event it shows here, with the server details.</div>
          )}
          {upcoming.map((u) => (
            <div className="prof-rec" key={u.id}>
              <span className="prof-year">{new Date(u.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              {u.game && <span className="gtag">{u.game.toUpperCase().slice(0, 5)}</span>}
              <span className="prof-what">{u.title}</span>
              <span className="prov">{new Date(u.starts_at).toLocaleString()} · posted by {u.created_by_name}{u.details ? ` · ${u.details}` : ''}</span>
            </div>
          ))}
        </div>

        <div className="module">
          <div className="mhead">
            <h3>The Event Record</h3>
            <span className="sub">{RECORD.length} dated events since 2011, from the announcement archive</span>
          </div>
          <div className="chips">
            {years.map((y) => (
              <button key={y} className={'chip' + (year === y ? ' on' : '')} onClick={() => setYear(y)}>{y}</button>
            ))}
          </div>
          {Object.keys(byMonth).sort().map((m) => (
            <div key={m}>
              <div className="cal-month">{MONTHS[Number(m) - 1]} {year} · {byMonth[m].length} events</div>
              {byMonth[m].map((e, i) => (
                <div className="prof-rec" key={m + i}>
                  <span className="prof-year">{Number(e.date.slice(8, 10))}</span>
                  <span className="gtag" title={GAME_NAMES[e.game] ?? e.game}>{e.game}</span>
                  <span className="prof-what">{e.title}</span>
                  {e.author && <span className="prov">called by {e.author}</span>}
                </div>
              ))}
            </div>
          ))}
          {inYear.length === 0 && <div className="note">No dated events on record for {year}.</div>}
        </div>
    </>
  );
}
