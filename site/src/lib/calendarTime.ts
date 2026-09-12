export const CALENDAR_TIME_ZONE = 'America/Chicago';
export interface CalendarMonth { year: number; month: number }
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const wallFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const keyOfUtc = (date: Date) => date.toISOString().slice(0, 10);
function dayParts(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new RangeError('Expected a calendar date in YYYY-MM-DD form.');
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (keyOfUtc(date) !== key) throw new RangeError('Invalid calendar date.');
  return { year, month, day, date };
}
export function chicagoDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new RangeError('Invalid event timestamp.');
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function chicagoMonth(value: Date | string = new Date()): CalendarMonth {
  const { year, month } = dayParts(chicagoDateKey(value));
  return { year, month };
}
export function addCalendarDays(key: string, amount: number): string {
  const { date } = dayParts(key);
  if (!Number.isInteger(amount)) throw new RangeError('Calendar-day increments must be whole numbers.');
  date.setUTCDate(date.getUTCDate() + amount);
  return keyOfUtc(date);
}
export function shiftCalendarMonth(value: CalendarMonth, amount: number): CalendarMonth {
  const date = new Date(Date.UTC(value.year, value.month - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
export function calendarMonthKey(value: CalendarMonth) { return `${value.year}-${String(value.month).padStart(2, '0')}`; }
export function calendarMonthLabel(value: CalendarMonth) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${calendarMonthKey(value)}-01T12:00:00Z`));
}
export function calendarDays(value: CalendarMonth): string[] {
  const first = `${calendarMonthKey(value)}-01`;
  const mondayOffset = (dayParts(first).date.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(first, index - mondayOffset));
}
// Chicago midnight is unambiguous on DST transition dates. Resolve each
// boundary with Intl rather than assuming every local day lasts 24 hours.
export function chicagoMidnight(key: string): string {
  const { year, month, day } = dayParts(key);
  const target = Date.UTC(year, month - 1, day);
  let timestamp = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(wallFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const adjustment = target - shown;
    timestamp += adjustment;
    if (adjustment === 0) return new Date(timestamp).toISOString();
  }
  throw new RangeError('The Chicago calendar boundary could not be resolved.');
}
export function calendarVisibleRange(value: CalendarMonth) {
  const days = calendarDays(value);
  return { days, start: chicagoMidnight(days[0]), end: chicagoMidnight(addCalendarDays(days[days.length - 1], 1)) };
}
export function calendarDayLabel(key: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  dayParts(key);
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
}
export function chicagoTimeLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: CALENDAR_TIME_ZONE, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
export function eventEnd(value: string, minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const start = new Date(value).valueOf();
  return Number.isFinite(start) ? new Date(start + minutes * 60_000).toISOString() : null;
}

// A datetime-local control carries a wall-clock value, not a timezone. Never
// parse it through the browser's local timezone when scheduling an event.
export function chicagoDateTimeInput(value: Date | string): string {
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    throw new RangeError('An event timestamp must include its timezone.');
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new RangeError('Invalid event timestamp.');
  const parts = Object.fromEntries(wallFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export type ChicagoTimeOccurrence = 'earlier' | 'later';

export function chicagoDateTimeCandidates(value: string): string[] {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Choose a valid event date and start time.');
  dayParts(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) throw new RangeError('Choose a valid event start time.');
  const target = Date.parse(`${value}:00Z`);

  // Collect the zone offsets on either side of a possible clock change, then
  // verify each candidate against Intl. A gap has zero matches and a repeated
  // hour has two. Sorting allows the caller to offer an explicit occurrence.
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const probe = target + hours * 3_600_000;
    const shown = Date.parse(`${chicagoDateTimeInput(new Date(probe))}:00Z`);
    offsets.add(shown - probe);
  }
  return [...offsets]
    .map((offset) => new Date(target - offset).toISOString())
    .filter((candidate) => chicagoDateTimeInput(candidate) === value)
    .sort();
}

export function chicagoDateTimeToIso(value: string, occurrence?: ChicagoTimeOccurrence): string {
  const candidates = chicagoDateTimeCandidates(value);
  if (candidates.length === 0) {
    throw new RangeError('This Chicago time does not exist because clocks move forward. Choose a time before 2:00 AM or at or after 3:00 AM.');
  }
  if (candidates.length > 1) {
    if (occurrence !== 'earlier' && occurrence !== 'later') throw new RangeError('This Chicago time occurs twice when clocks move back. Choose the first occurrence (CDT) or the second occurrence (CST).');
    return occurrence === 'earlier' ? candidates[0] : candidates[candidates.length - 1];
  }
  return candidates[0];
}
