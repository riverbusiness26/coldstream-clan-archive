import { addCalendarDays, chicagoDateTimeInput, chicagoDateTimeToIso } from './calendarTime';

export type EventRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
// Preview only: the database keeps the schedule going until staff stop it.
export function recurringEventStarts(start: string, repeat: EventRepeat): string[] {
  if (!['none', 'daily', 'weekly', 'monthly'].includes(repeat)) throw new Error('Choose a valid repeat option.');
  if (repeat === 'none') return [start];
  const local = chicagoDateTimeInput(start);
  const date = local.slice(0, 10), time = local.slice(11);
  const [year, month, day] = date.split('-').map(Number);
  return Array.from({ length: 3 }, (_, index) => {
    if (index === 0) return start;
    let nextDate: string;
    if (repeat === 'monthly') {
      const target = new Date(Date.UTC(year, month - 1 + index, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
      nextDate = target.toISOString().slice(0, 10);
    } else nextDate = addCalendarDays(date, index * (repeat === 'weekly' ? 7 : 1));
    try { return chicagoDateTimeToIso(`${nextDate}T${time}`, 'later'); }
    catch {
      // Match PostgreSQL: move a missing spring-forward time one hour later.
      const shifted = new Date(`${nextDate}T${time}:00Z`);
      shifted.setUTCHours(shifted.getUTCHours() + 1);
      return chicagoDateTimeToIso(shifted.toISOString().slice(0, 16), 'later');
    }
  });
}
