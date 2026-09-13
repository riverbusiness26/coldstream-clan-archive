import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { FaArrowRight, FaCalendarAlt, FaCheck, FaChevronLeft, FaChevronRight, FaClock, FaListUl, FaSearch, FaTimes, FaUsers } from 'react-icons/fa';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import EventTypeIcon, { eventTypeSlug } from '../components/EventTypeIcon';
import { calendarDayLabel, calendarMonthKey, calendarMonthLabel, calendarVisibleRange, chicagoDateKey, chicagoMidnight, chicagoMonth, chicagoTimeLabel, eventEnd, shiftCalendarMonth, type CalendarMonth } from '../lib/calendarTime';
import '../event-type-icons.css';
import '../events-redesign.css';

interface EventRow { id: string; title: string; game: string | null; starts_at: string; duration_minutes: number | null; event_type: string | null; body?: string | null; going: number | null; maybe: number | null; demo?: boolean }
interface CountRow { event_id: string; going: number | null; maybe: number | null }
type RsvpStatus = 'going' | 'maybe' | 'out';
type TypeFilter = 'all' | 'public' | 'linebattle' | 'competitive' | 'fallback';
const RSVP_LABELS: Record<RsvpStatus, string> = { going: 'Going', maybe: 'Maybe', out: 'Not Going' };
const TYPES: { value: TypeFilter; label: string; kind?: string }[] = [
  { value: 'all', label: 'All events' }, { value: 'public', label: 'Public Server', kind: 'public_server' },
  { value: 'linebattle', label: 'Linebattle', kind: 'linebattle' }, { value: 'competitive', label: 'Competitive', kind: 'competitive' },
  { value: 'fallback', label: 'Other events', kind: 'other' },
];
const typeLabel = (kind: string | null) => ({ public_server: 'Public Server', linebattle: 'Linebattle', competitive: 'Competitive', training: 'Training', social: 'Game Night', campaign: 'Campaign', other: 'Community Event' }[kind ?? ''] ?? 'Community Event');
function previewEvents(month: CalendarMonth): EventRow[] {
  const monthKey = calendarMonthKey(month);
  return [
    { day: 16, title: 'Public server evening', type: 'public_server', body: 'An example of an open public-server session. The real event description, game and joining details will appear here.' },
    { day: 21, title: 'Linebattle evening', type: 'linebattle', body: 'An example linebattle card. This preview shows where the event briefing and preparation details belong.' },
    { day: 26, title: 'Competitive match', type: 'competitive', body: 'An example competitive event. No match is being scheduled and no Discord message is sent from this preview.' },
  ].map((example) => ({ id: `preview-${monthKey}-${example.day}`, title: example.title, game: 'Holdfast: Nations At War', event_type: example.type,
    starts_at: new Date(Date.parse(chicagoMidnight(`${monthKey}-${example.day}`)) + 19 * 3_600_000).toISOString(), duration_minutes: 90,
    body: example.body, going: null, maybe: null, demo: true }));
}

export default function Calendar({ me }: { me: Me | null }) {
  const [now, setNow] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => chicagoMonth());
  // The month grid gives members the quickest overview of the schedule by default. Agenda
  // remains available from the view switcher when a chronological list is useful.
  const [view, setView] = useState<'agenda' | 'month'>('month');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [countWarning, setCountWarning] = useState<string | null>(null);
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpStatus>>({});
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<{ eventId: string; text: string; error: boolean } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const loadEpoch = useRef(0);
  const saving = useRef(false);
  const mounted = useRef(false);
  const requestedDay = useRef<string | null>(null);
  const details = useRef<HTMLElement>(null);
  const range = useMemo(() => calendarVisibleRange(cursor), [cursor.year, cursor.month]);
  const isDemo = !supa;
  const todayKey = chicagoDateKey(now);

  useEffect(() => { mounted.current = true; const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => { mounted.current = false; window.clearInterval(timer); }; }, []);
  useEffect(() => {
    const epoch = ++loadEpoch.current;
    const controller = new AbortController();
    const preferredDay = requestedDay.current;
    requestedDay.current = null;
    setLoading(true); setLoadError(null); setCountWarning(null); setMyRsvps({}); setEvents([]); setSelectedDay(preferredDay); setRsvpMessage(null);
    if (!supa) {
      const examples = previewEvents(cursor);
      setEvents(examples); setSelectedId(preferredDay ? examples.find((event) => chicagoDateKey(event.starts_at) === preferredDay)?.id ?? null : examples.find((event) => Date.parse(event.starts_at) >= Date.now())?.id ?? examples[0]?.id ?? null); setLoading(false);
      return () => { controller.abort(); loadEpoch.current += 1; };
    }
    const db = supa;
    void (async () => {
      try {
        const result = await db.from('event').select('id,title,game,starts_at,duration_minutes,event_type,body').eq('historic', false).eq('cancelled', false)
          .gte('starts_at', range.start).lt('starts_at', range.end).order('starts_at').abortSignal(controller.signal);
        if (controller.signal.aborted || epoch !== loadEpoch.current) return;
        if (result.error) throw new Error('The calendar could not be opened. Please try refreshing.');
        const loaded = (result.data ?? []) as Omit<EventRow, 'going' | 'maybe'>[];
        const ids = loaded.map((event) => event.id);
        const [counts, mine] = await Promise.all([
          ids.length ? db.from('event_attendance').select('event_id,going,maybe').in('event_id', ids).abortSignal(controller.signal) : Promise.resolve({ data: [] as CountRow[], error: null }),
          me && ids.length ? db.from('event_rsvp').select('event_id,status').eq('member_id', me.id).in('event_id', ids).abortSignal(controller.signal) : Promise.resolve({ data: [], error: null }),
        ]);
        if (controller.signal.aborted || epoch !== loadEpoch.current) return;
        const byId = new Map(((counts.data ?? []) as CountRow[]).map((row) => [row.event_id, row]));
        setEvents(loaded.map((event) => ({ ...event, going: counts.error ? null : Number(byId.get(event.id)?.going ?? 0), maybe: counts.error ? null : Number(byId.get(event.id)?.maybe ?? 0) })));
        if (counts.error || mine.error) setCountWarning([counts.error ? 'RSVP totals are temporarily unavailable.' : '', mine.error ? 'Your saved RSVP choices could not be loaded.' : ''].filter(Boolean).join(' '));
        if (!mine.error) setMyRsvps(Object.fromEntries((mine.data ?? []).filter((row) => ['going', 'maybe', 'out'].includes(row.status)).map((row) => [row.event_id, row.status as RsvpStatus])));
        setSelectedId((current) => preferredDay ? loaded.find((event) => chicagoDateKey(event.starts_at) === preferredDay)?.id ?? null : loaded.some((event) => event.id === current) ? current : loaded.find((event) => Date.parse(event.starts_at) >= Date.now())?.id ?? loaded[0]?.id ?? null);
      } catch (problem) {
        if (!controller.signal.aborted && epoch === loadEpoch.current) { setLoadError(problem instanceof Error ? problem.message : 'The calendar could not be opened.'); setEvents([]); setSelectedId(null); }
      } finally {
        if (!controller.signal.aborted && epoch === loadEpoch.current) setLoading(false);
      }
    })();
    return () => { controller.abort(); loadEpoch.current += 1; };
  }, [cursor.year, cursor.month, me?.id, range.start, range.end, refresh]);

  const matchingEvents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return events.filter((event) => (typeFilter === 'all' || eventTypeSlug(event.event_type) === typeFilter) && (!needle || `${event.title} ${event.game ?? ''} ${typeLabel(event.event_type)}`.toLocaleLowerCase().includes(needle)));
  }, [events, typeFilter, search]);
  const byDay = useMemo(() => matchingEvents.reduce<Record<string, EventRow[]>>((groups, event) => { (groups[chicagoDateKey(event.starts_at)] ||= []).push(event); return groups; }, {}), [matchingEvents]);
  const selected = matchingEvents.find((event) => event.id === selectedId) ?? null;
  const dayEvents = selectedDay ? byDay[selectedDay] ?? [] : [];
  const agendaEvents = matchingEvents.filter((event) => includePast || Date.parse(eventEnd(event.starts_at, event.duration_minutes) ?? event.starts_at) >= now.valueOf());
  const nextEvent = matchingEvents.find((event) => Date.parse(event.starts_at) >= now.valueOf());
  const selectedEnd = selected ? eventEnd(selected.starts_at, selected.duration_minutes) : null;
  const monthLabel = calendarMonthLabel(cursor);
  function showToday() {
    const month = chicagoMonth();
    if (month.year === cursor.year && month.month === cursor.month) {
      setSelectedDay(todayKey); setSelectedId(byDay[todayKey]?.[0]?.id ?? null);
    } else { requestedDay.current = todayKey; setCursor(month); }
    setRsvpMessage(null);
  }
  function selectEvent(event: EventRow) {
    setSelectedId(event.id); setSelectedDay(chicagoDateKey(event.starts_at)); setRsvpMessage(null);
    if (window.matchMedia('(max-width: 1000px)').matches) window.requestAnimationFrame(() => details.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }
  function selectDay(key: string) { setSelectedDay(key); setSelectedId(byDay[key]?.[0]?.id ?? null); setRsvpMessage(null); }
  function moveGridFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowUp' ? index - 7 : event.key === 'ArrowDown' ? index + 7 : event.key === 'Home' ? index - index % 7 : event.key === 'End' ? index + 6 - index % 7 : null;
    if (next === null) return;
    event.preventDefault();
    if (range.days[next]) document.getElementById(`ce-day-${range.days[next]}`)?.focus();
  }
  async function setRsvp(eventId: string, status: RsvpStatus) {
    if (!supa || !me || saving.current || events.find((event) => event.id === eventId)?.demo) return;
    const db = supa;
    const epoch = loadEpoch.current;
    let saved = false;
    saving.current = true; setRsvpBusy(eventId); setRsvpMessage(null);
    try {
      const result = await db.from('event_rsvp').upsert({ event_id: eventId, member_id: me.id, status }, { onConflict: 'event_id,member_id' });
      if (epoch !== loadEpoch.current) return;
      if (result.error) throw new Error('Your RSVP could not be saved. Please try again.');
      saved = true;
      setMyRsvps((current) => ({ ...current, [eventId]: status }));
      const counts = await db.from('event_attendance').select('event_id,going,maybe').eq('event_id', eventId).maybeSingle();
      if (epoch !== loadEpoch.current) return;
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, going: counts.error ? null : Number(counts.data?.going ?? 0), maybe: counts.error ? null : Number(counts.data?.maybe ?? 0) } : event));
      setRsvpMessage({ eventId, text: counts.error ? `Saved: ${RSVP_LABELS[status]}. RSVP totals could not be refreshed.` : `Saved: ${RSVP_LABELS[status]}.`, error: !!counts.error });
    } catch (problem) {
      if (epoch === loadEpoch.current) {
        if (saved) setEvents((current) => current.map((event) => event.id === eventId ? { ...event, going: null, maybe: null } : event));
        setRsvpMessage({ eventId, text: saved ? `Saved: ${RSVP_LABELS[status]}. RSVP totals could not be refreshed.` : problem instanceof Error ? problem.message : 'Your RSVP could not be saved. Please try again.', error: true });
      }
    } finally { saving.current = false; if (mounted.current) setRsvpBusy(null); }
  }
  function eventCard(event: EventRow) {
    const dateKey = chicagoDateKey(event.starts_at);
    return <button type='button' key={event.id} className={`ce-agenda-event ce-kind-${eventTypeSlug(event.event_type)}${selectedId === event.id ? ' is-selected' : ''}`} onClick={() => selectEvent(event)} aria-pressed={selectedId === event.id}>
      <span className='ce-date-tile'><small>{calendarDayLabel(dateKey, { month: 'short' })}</small><strong>{Number(dateKey.slice(-2))}</strong><small>{calendarDayLabel(dateKey, { weekday: 'short' })}</small></span>
      <span className='ce-agenda-copy'><span className='ce-kind-label'><EventTypeIcon type={event.event_type} />{typeLabel(event.event_type)}{event.demo && <small>Preview</small>}</span><strong>{event.title}</strong><span className='ce-agenda-meta'><span><FaClock />{chicagoTimeLabel(event.starts_at)}</span><span>{event.game ?? 'Community event'}</span></span></span>
      <span className='ce-agenda-response'>{myRsvps[event.id] ? <span className='ce-my-rsvp'><FaCheck />{RSVP_LABELS[myRsvps[event.id]]}</span> : event.going !== null ? <span><FaUsers />{event.going} going</span> : <span>{event.demo ? 'Illustrative' : 'Totals unavailable'}</span>}<FaArrowRight className='ce-card-arrow' /></span>
    </button>;
  }
  return <main className='coldstream-events' aria-labelledby='ce-page-title'>
    <header className='ce-page-head'><div><span className='ce-eyebrow'>Make time for a good night</span><h1 id='ce-page-title'>Events &amp; game nights</h1><p>See what is coming up, read the briefing and let people know if you can make it.</p></div><span className='ce-timezone'><FaClock aria-hidden='true' /><span>Chicago time<strong>Central Time · CT</strong></span></span></header>
    {isDemo && <div className='ce-preview-note' role='status'><strong>Local design preview</strong><span>The events below are illustrative, not scheduled events. RSVP is disabled. No attendance or player counts are invented.</span></div>}
    {!loading && nextEvent && <button type='button' className={`ce-next-event ce-kind-${eventTypeSlug(nextEvent.event_type)}`} onClick={() => selectEvent(nextEvent)}><span className='ce-next-icon'><EventTypeIcon type={nextEvent.event_type} /></span><span><small className='ce-eyebrow'>{isDemo ? 'Example next event' : 'Next up in this view'}</small><strong>{nextEvent.title}</strong><span>{calendarDayLabel(chicagoDateKey(nextEvent.starts_at), { weekday: 'short', month: 'short', day: 'numeric' })} · {chicagoTimeLabel(nextEvent.starts_at)}</span></span><span className='ce-next-action'>Read the briefing <FaArrowRight /></span></button>}
    <div className='ce-workspace'>
      <section className='ce-calendar-main' aria-label='Browse events'>
        <div className='ce-calendar-toolbar'><div className='ce-month-navigation'><button type='button' aria-label='Previous month' onClick={() => setCursor((current) => shiftCalendarMonth(current, -1))}><FaChevronLeft /></button><h2>{monthLabel}</h2><button type='button' aria-label='Next month' onClick={() => setCursor((current) => shiftCalendarMonth(current, 1))}><FaChevronRight /></button></div><div className='ce-view-switch'><button type='button' onClick={showToday} className='ce-today-button'>Today</button><button type='button' aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><FaListUl />Agenda</button><button type='button' aria-pressed={view === 'month'} onClick={() => setView('month')}><FaCalendarAlt />Month</button></div></div>
        <div className='ce-filter-row' aria-label='Filter by event type'>{TYPES.map((type) => <button type='button' key={type.value} className={`ce-type-filter ce-kind-${type.value}`} aria-pressed={typeFilter === type.value} onClick={() => setTypeFilter(type.value)}>{type.kind && <EventTypeIcon type={type.kind} />}{type.label}</button>)}</div>
        <div className='ce-search-row'><label className='ce-search'><FaSearch aria-hidden='true' /><input type='search' value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Find an event or game' aria-label='Find an event or game' /></label>{view === 'agenda' && <label className='ce-past-toggle'><input type='checkbox' checked={includePast} onChange={(event) => setIncludePast(event.target.checked)} />Include earlier events</label>}</div>
        {loading ? <div className='ce-state' role='status'><span className='ce-eyebrow'>Opening the calendar</span><h3>Finding the next good night.</h3></div> : loadError ? <div className='ce-state ce-error' role='alert'><h3>Calendar unavailable</h3><p>{loadError}</p><button type='button' onClick={() => setRefresh((value) => value + 1)}>Try again</button></div> : view === 'agenda' ? <div className='ce-agenda'>{agendaEvents.length ? agendaEvents.map(eventCard) : <div className='ce-state'><FaCalendarAlt aria-hidden='true' /><h3>{search || typeFilter !== 'all' ? 'No matching events' : 'Nothing coming up in this view'}</h3><p>{search || typeFilter !== 'all' ? 'Try another event type or clear your search.' : 'Check another month, or include earlier events to look back.'}</p>{(search || typeFilter !== 'all') && <button type='button' onClick={() => { setSearch(''); setTypeFilter('all'); }}>Clear filters</button>}</div>}</div> : <div className='ce-month-calendar'><div className='ce-weekdays' aria-hidden='true'>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className='ce-days'>{range.days.map((key, index) => {
          const list = byDay[key] ?? [];
          return <button type='button' id={`ce-day-${key}`} key={key} onKeyDown={(event) => moveGridFocus(event, index)} onClick={() => selectDay(key)} aria-pressed={selectedDay === key} aria-label={`${calendarDayLabel(key)}, ${list.length} ${list.length === 1 ? 'event' : 'events'}${list.length ? `: ${list.map((event) => event.title).join(', ')}` : ''}`} className={`ce-day${key.slice(0, 7) === calendarMonthKey(cursor) ? '' : ' is-adjacent'}${key === todayKey ? ' is-today' : ''}${key === selectedDay ? ' is-selected' : ''}`}><time dateTime={key}>{Number(key.slice(-2))}</time><span className='ce-day-events'>{list.slice(0, 2).map((event) => <span key={event.id} className={`ce-event-pill ce-kind-${eventTypeSlug(event.event_type)}`} title={event.title}><i />{event.title}</span>)}{list.length > 2 && <small>+{list.length - 2} more</small>}</span>{list.length > 0 && <span className='ce-day-dots' aria-hidden='true'>{list.slice(0, 3).map((event) => <i key={event.id} className={`ce-kind-${eventTypeSlug(event.event_type)}`} />)}</span>}</button>;
        })}</div><p className='ce-grid-hint'>Select a date to open its events. Adjacent-month dates are included. Arrow keys move between dates.</p></div>}
        {countWarning && <p className='ce-warning' role='status'>{countWarning}</p>}
        <footer className='ce-view-footer'><span>All dates and times use America/Chicago.</span><button type='button' onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Refresh calendar</button></footer>
      </section>
      <aside ref={details} className={`ce-detail-panel${selected ? ` ce-kind-${eventTypeSlug(selected.event_type)}` : ''}`} aria-label='Event briefing'>
        {selectedDay && <section className='ce-day-picker'><div><span className='ce-eyebrow'>Selected day</span><strong>{calendarDayLabel(selectedDay, { weekday: 'short', month: 'short', day: 'numeric' })}</strong></div>{dayEvents.length ? <div className='ce-day-choices'>{dayEvents.map((event) => <button type='button' key={event.id} aria-pressed={selectedId === event.id} onClick={() => { setSelectedId(event.id); setRsvpMessage(null); }}><span className={`ce-kind-label ce-kind-${eventTypeSlug(event.event_type)}`}><EventTypeIcon type={event.event_type} />{event.title}</span><small>{chicagoTimeLabel(event.starts_at)}</small></button>)}</div> : <p>No matching events on this day.</p>}</section>}
        {selected ? <section className='ce-event-briefing' key={selected.id}><header><span className='ce-kind-label'><EventTypeIcon type={selected.event_type} />{typeLabel(selected.event_type)}</span><button type='button' aria-label='Close event briefing' onClick={() => { setSelectedId(null); setRsvpMessage(null); }}><FaTimes /></button></header><span className='ce-eyebrow'>{selected.demo ? 'Illustrative event briefing' : 'Event briefing'}</span><h2>{selected.title}</h2>
          <dl className='ce-event-facts'><div><dt>Date</dt><dd>{calendarDayLabel(chicagoDateKey(selected.starts_at))}</dd></div><div><dt>Time</dt><dd>{chicagoTimeLabel(selected.starts_at)}{selectedEnd && <><span> to </span>{chicagoTimeLabel(selectedEnd)}{chicagoDateKey(selectedEnd) !== chicagoDateKey(selected.starts_at) && <small>Ends {calendarDayLabel(chicagoDateKey(selectedEnd), { month: 'short', day: 'numeric' })}</small>}</>}</dd></div><div><dt>Game</dt><dd>{selected.game ?? 'Community event'}</dd></div><div><dt>Duration</dt><dd>{selected.duration_minutes === null ? 'Not specified' : `${selected.duration_minutes} minutes`}</dd></div></dl>
          <p className='ce-event-body'>{selected.body || 'No additional briefing has been posted for this event.'}</p><div className='ce-rsvp-counts'><span><strong>{selected.going ?? 'N/R'}</strong>Going</span><span><strong>{selected.maybe ?? 'N/R'}</strong>Maybe</span><small>{selected.demo ? 'No preview attendance counts' : selected.going === null || selected.maybe === null ? 'RSVP totals unavailable' : 'RSVP is intent, not attendance'}</small></div>
          <div className='ce-rsvp'><span className='ce-eyebrow'>Your response</span><div className='ce-rsvp-actions'>{(['going', 'maybe', 'out'] as RsvpStatus[]).map((status) => <button key={status} type='button' aria-pressed={myRsvps[selected.id] === status} disabled={!me || isDemo || rsvpBusy !== null} onClick={() => setRsvp(selected.id, status)}>{myRsvps[selected.id] === status && <FaCheck />}{RSVP_LABELS[status]}</button>)}</div>{rsvpBusy === selected.id && <p role='status'>Saving your response.</p>}{isDemo ? <p>RSVP is disabled in this local design preview.</p> : !me ? <p>Sign in through Discord to respond.</p> : <p>You can change your response here. Attendance comes from the event record and voice-presence samples.</p>}</div>
          {rsvpMessage?.eventId === selected.id && <p className={`ce-rsvp-message${rsvpMessage.error ? ' is-error' : ''}`} role={rsvpMessage.error ? 'alert' : 'status'}>{rsvpMessage.text}</p>}
        </section> : <div className='ce-detail-empty'><FaCalendarAlt aria-hidden='true' /><span className='ce-eyebrow'>The event briefing</span><h2>Pick your next night.</h2><p>Select an event to read the details and choose Going, Maybe or Not Going.</p></div>}
      </aside>
    </div>
  </main>;
}
