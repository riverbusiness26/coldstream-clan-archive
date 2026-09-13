import { addCalendarDays, chicagoDateTimeInput, chicagoDateTimeToIso } from './calendarTime';

export type EventRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export function recurringEventStarts(start: string, repeat: EventRepeat, count: number): string[] {
  if (!['none', 'daily', 'weekly', 'monthly'].includes(repeat)) throw new Error('Choose a valid repeat option.');
  if (repeat === 'none') return [start];
  if (!Number.isInteger(count) || count < 2 || count > 104) throw new Error('Choose between 2 and 104 occurrences.');
  const local = chicagoDateTimeInput(start);
  const date = local.slice(0, 10), time = local.slice(11);
  const [year, month, day] = date.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return start;
    let nextDate: string;
    if (repeat === 'monthly') {
      const target = new Date(Date.UTC(year, month - 1 + index, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
      nextDate = target.toISOString().slice(0, 10);
    } else nextDate = addCalendarDays(date, index * (repeat === 'weekly' ? 7 : 1));
    try { return chicagoDateTimeToIso(`${nextDate}T${time}`, 'later'); }
    catch { throw new Error(`The Chicago time on ${nextDate} does not exist because clocks move forward. Choose a different start time for this series.`); }
  });
}
