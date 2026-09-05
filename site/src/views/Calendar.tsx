import { useEffect, useMemo, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';

interface EventRow { id: string; title: string; game: string | null; starts_at: string; duration_minutes: number | null; event_type: string | null; body?: string | null; }
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const keyFor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function Calendar({ me: _me }: { me: Me | null }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!supa) { setLoading(false); return; }
    setLoading(true); setError(false); setSelected(null);
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
    supa.from('event').select('id,title,game,starts_at,duration_minutes,event_type,body').eq('historic', false).eq('cancelled', false).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at')
      .then(({ data, error: queryError }) => { if (queryError) setError(true); setEvents((data as EventRow[] | null) ?? []); setLoading(false); });
  }, [cursor]);
  const cells = useMemo(() => { const offset = (cursor.getDay()+6)%7; return Array.from({length:42}, (_,i) => new Date(cursor.getFullYear(), cursor.getMonth(), i-offset+1)); }, [cursor]);
  const byDay = useMemo(() => events.reduce<Record<string, EventRow[]>>((m,e) => { (m[keyFor(new Date(e.starts_at))] ||= []).push(e); return m; }, {}), [events]);
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  return <div className="wrap solo events-page"><main>
    <div className="page-head"><p className="cg-eyebrow">The schedule</p><h1>Events</h1><p className="page-sub">The full Coldstream calendar. Select an event to see its details.</p></div>
    <section className="module full-calendar" aria-label={`${monthLabel} calendar`}>
      <div className="mhead"><button className="btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}>← Previous</button><h2>{monthLabel}</h2><button className="btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}>Next →</button></div>
      {loading ? <div className="note">Loading events.</div> : error ? <div className="note">The calendar could not be opened right now.</div> : <><div className="hub-calendar-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}</div><div className="hub-calendar-grid">{cells.map(day => { const k=keyFor(day); const list=byDay[k]||[]; return <button type="button" key={k} className={`hub-calendar-day${day.getMonth()===cursor.getMonth()?'':' outside'}${k===keyFor(today)?' today':''}`} onClick={() => list[0] && setSelected(list[0])}><time dateTime={k}>{day.getDate()}</time>{list.slice(0,3).map(e => <span key={e.id}>{e.title}</span>)}{list.length>3&&<small>+{list.length-3} more</small>}</button>; })}</div></>}
    </section>
    {selected && <section className="module event-detail"><div className="mhead"><h2>{selected.title}</h2><button className="btn sm" onClick={() => setSelected(null)}>Close</button></div><p className="event-detail-meta">{new Date(selected.starts_at).toLocaleString()} · {selected.game || 'Community event'} · {selected.duration_minutes ?? '—'} minutes</p>{selected.event_type && <span className="gtag">{selected.event_type}</span>}<p>{selected.body || 'Event details will be posted here when available.'}</p><p className="note">Attendance and RSVP information will appear once the Discord event connection is active.</p></section>}
    {!loading && !error && events.length===0 && <div className="note">No events are on the calendar yet.</div>}
  </main></div>;
}
