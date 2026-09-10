import { useEffect, useMemo, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import EventTypeIcon, { eventTypeSlug } from '../components/EventTypeIcon';
import '../event-type-icons.css';

interface EventRow { id: string; title: string; game: string | null; starts_at: string; duration_minutes: number | null; event_type: string | null; body?: string | null; going?: number; maybe?: number; }
type RsvpStatus = 'going' | 'maybe' | 'out';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const keyFor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function Calendar({ me }: { me: Me | null }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpStatus>>({});
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!supa) { setLoading(false); return; }
    const db = supa;
    setLoading(true); setError(false); setSelected(null); setSelectedDay(null);
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
    db.from('event').select('id,title,game,starts_at,duration_minutes,event_type,body').eq('historic', false).eq('cancelled', false).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at')
      .then(async ({ data, error: queryError }) => {
        if (queryError) { setError(true); setEvents([]); setLoading(false); return; }
        const loaded = (data as EventRow[] | null) ?? [];
        const ids = loaded.map((event) => event.id);
        const [counts, mine] = await Promise.all([
          ids.length ? db.from('event_attendance').select('event_id,going,maybe').in('event_id', ids) : Promise.resolve({ data: [], error: null }),
          me && ids.length ? db.from('event_rsvp').select('event_id,status').eq('member_id', me.id).in('event_id', ids) : Promise.resolve({ data: [], error: null }),
        ]);
        const countById = new Map((counts.data ?? []).map((row: any) => [row.event_id, row]));
        setEvents(loaded.map((event) => ({ ...event, going: Number(countById.get(event.id)?.going ?? 0), maybe: Number(countById.get(event.id)?.maybe ?? 0) })));
        setMyRsvps(Object.fromEntries((mine.data ?? []).map((row: any) => [row.event_id, row.status as RsvpStatus])));
        setLoading(false);
      });
  }, [cursor, me]);

  async function setRsvp(eventId: string, status: RsvpStatus) {
    if (!supa || !me) return;
    setRsvpBusy(eventId); setRsvpMessage(null);
    const result = await supa.from('event_rsvp').upsert({ event_id: eventId, member_id: me.id, status }, { onConflict: 'event_id,member_id' });
    setRsvpBusy(null);
    if (result.error) { setRsvpMessage('Your RSVP could not be saved. Please try again.'); return; }
    setMyRsvps((current) => ({ ...current, [eventId]: status }));
    setEvents((current) => current.map((event) => {
      if (event.id !== eventId) return event;
      const previous = myRsvps[eventId];
      return { ...event, going: Math.max(0, (event.going ?? 0) + (status === 'going' ? 1 : 0) - (previous === 'going' ? 1 : 0)), maybe: Math.max(0, (event.maybe ?? 0) + (status === 'maybe' ? 1 : 0) - (previous === 'maybe' ? 1 : 0)) };
    }));
    setRsvpMessage(status === 'going' ? 'You are marked as going.' : status === 'maybe' ? 'You are marked as maybe.' : 'You are marked as not going.');
  }
  const cells = useMemo(() => { const offset = (cursor.getDay()+6)%7; return Array.from({length:42}, (_,i) => new Date(cursor.getFullYear(), cursor.getMonth(), i-offset+1)); }, [cursor]);
  const byDay = useMemo(() => events.reduce<Record<string, EventRow[]>>((m,e) => { (m[keyFor(new Date(e.starts_at))] ||= []).push(e); return m; }, {}), [events]);
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const dayEvents = selectedDay ? (byDay[selectedDay] || []) : [];
  return <div className="wrap solo events-page"><main>
    <div className="page-head"><p className="cg-eyebrow">The schedule</p><h1>Events</h1><p className="page-sub">The full Coldstream calendar. Select an event to see its details.</p></div>
    <div className="event-type-legend" aria-label="Event types"><span className="event-kind-public"><EventTypeIcon type="public_server" />Public Server</span><span className="event-kind-linebattle"><EventTypeIcon type="linebattle" />Linebattle Event</span><span className="event-kind-competitive"><EventTypeIcon type="competitive" />Competitive</span></div>
    <section className="module full-calendar" aria-label={`${monthLabel} calendar`}>
      <div className="mhead"><button className="btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}>← Previous</button><h2>{monthLabel}</h2><button className="btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}>Next →</button></div>
      {loading ? <div className="note">Loading events.</div> : error ? <div className="note">The calendar could not be opened right now.</div> : <><div className="hub-calendar-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}</div><div className="hub-calendar-grid">{cells.map(day => { const k=keyFor(day); const list=byDay[k]||[]; return <button type="button" key={k} className={`hub-calendar-day${day.getMonth()===cursor.getMonth()?'':' outside'}${k===keyFor(today)?' today':''}${k===selectedDay?' selected':''}`} onClick={() => { setSelectedDay(k); setSelected(list[0] || null); }}><time dateTime={k}>{day.getDate()}</time>{list.slice(0,3).map(e => <span className={`event-kind-${eventTypeSlug(e.event_type)}`} key={e.id}><EventTypeIcon type={e.event_type} />{e.title}</span>)}{list.length>3&&<small>+{list.length-3} more</small>}</button>; })}</div></>}
    </section>
    {selectedDay && <section className="module event-day-detail"><div className="mhead"><h2>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h2><button className="btn sm" onClick={() => setSelectedDay(null)}>Close</button></div>{dayEvents.length===0 ? <p className="note">No events are scheduled for this day.</p> : dayEvents.map(event => <button type="button" className="event-day-row" key={event.id} onClick={() => setSelected(event)}><time>{new Date(event.starts_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time><span><b>{event.title}</b><small>{event.game || 'Community event'} · Duration {event.duration_minutes ?? '—'} minutes</small></span></button>)}</section>}
    {selected && <section className="module event-detail"><div className="mhead"><h2>{selected.title}</h2><button className="btn sm" onClick={() => setSelected(null)}>Close</button></div><p className="event-detail-meta">{new Date(selected.starts_at).toLocaleString()} · {selected.game || 'Community event'} · {selected.duration_minutes ?? '—'} minutes</p>{selected.event_type && <span className="gtag">{selected.event_type}</span>}<p>{selected.body || 'Event details will be posted here when available.'}</p><div className="event-rsvp-summary"><span><b>{selected.going ?? 0}</b> going</span><span><b>{selected.maybe ?? 0}</b> maybe</span></div>{me ? <div className="event-rsvp-actions" aria-label="Your RSVP"><span>Your RSVP</span>{(['going', 'maybe', 'out'] as RsvpStatus[]).map((status) => <button key={status} type="button" className={myRsvps[selected.id] === status ? 'active' : ''} disabled={rsvpBusy === selected.id} onClick={() => setRsvp(selected.id, status)}>{status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : 'Not going'}</button>)}</div> : <p className="note">Sign in with Discord to RSVP. Attendance is confirmed from the event record and Discord voice-presence samples.</p>}{rsvpMessage && <p className="fok" role="status">{rsvpMessage}</p>}</section>}
    {!loading && !error && events.length===0 && <div className="note">No events are on the calendar yet.</div>}
  </main></div>;
}
