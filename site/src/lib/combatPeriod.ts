import { addCalendarDays, chicagoDateKey, chicagoMidnight } from './calendarTime';

export type CombatPeriod = 'Day' | 'Week' | 'Month' | 'All time';

export interface CombatPeriodRange {
  start: string;
  end: string;
}

// Civil dates are moved before resolving Chicago midnight. A day spanning a
// DST change is not necessarily 24 elapsed hours, and a week starts Monday.
export function combatPeriodRange(period: CombatPeriod, now = new Date()): CombatPeriodRange | null {
  if (period === 'All time') return null;
  const currentDay = chicagoDateKey(now);
  const civilDate = new Date(`${currentDay}T00:00:00Z`);
  let firstDay = currentDay;
  let afterLastDay = addCalendarDays(currentDay, 1);
  if (period === 'Week') {
    firstDay = addCalendarDays(currentDay, -((civilDate.getUTCDay() + 6) % 7));
    afterLastDay = addCalendarDays(firstDay, 7);
  } else if (period === 'Month') {
    firstDay = `${currentDay.slice(0, 7)}-01`;
    afterLastDay = new Date(Date.UTC(civilDate.getUTCFullYear(), civilDate.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  }
  return { start: chicagoMidnight(firstDay), end: chicagoMidnight(afterLastDay) };
}
