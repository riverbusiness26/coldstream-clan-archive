import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarDays, calendarDays, calendarDayLabel, calendarMonthLabel, calendarVisibleRange, chicagoDateKey, chicagoMidnight, chicagoMonth, chicagoTimeLabel, eventEnd, shiftCalendarMonth } from '../src/lib/calendarTime.ts';
test('Chicago day can differ from UTC and browser calendar day', () => {
  assert.equal(chicagoDateKey('2026-09-13T02:00:00Z'), '2026-09-12');
  assert.equal(chicagoDateKey('2026-09-13T05:00:00Z'), '2026-09-13');
  assert.deepEqual(chicagoMonth('2026-09-01T03:00:00Z'), { year: 2026, month: 8 });
});
test('Chicago midnight observes winter and summer offsets', () => {
  assert.equal(chicagoMidnight('2026-01-15'), '2026-01-15T06:00:00.000Z');
  assert.equal(chicagoMidnight('2026-07-15'), '2026-07-15T05:00:00.000Z');
});
test('spring DST calendar day is 23 hours', () => {
  assert.equal((Date.parse(chicagoMidnight('2026-03-09')) - Date.parse(chicagoMidnight('2026-03-08'))) / 3_600_000, 23);
});
test('fall DST calendar day is 25 hours', () => {
  assert.equal((Date.parse(chicagoMidnight('2026-11-02')) - Date.parse(chicagoMidnight('2026-11-01'))) / 3_600_000, 25);
  assert.equal(chicagoDateKey('2026-11-01T06:30:00Z'), '2026-11-01');
  assert.equal(chicagoDateKey('2026-11-01T07:30:00Z'), '2026-11-01');
});
test('visible September grid includes adjacent months', () => {
  const range = calendarVisibleRange({ year: 2026, month: 9 });
  assert.equal(range.days.length, 42);
  assert.equal(range.days[0], '2026-08-31');
  assert.equal(range.days.at(-1), '2026-10-11');
  assert.equal(range.start, '2026-08-31T05:00:00.000Z');
  assert.equal(range.end, '2026-10-12T05:00:00.000Z');
});
test('visible range resolves DST endpoints independently', () => {
  const range = calendarVisibleRange({ year: 2026, month: 3 });
  assert.equal(range.start, '2026-02-23T06:00:00.000Z');
  assert.equal(range.end, '2026-04-06T05:00:00.000Z');
});
test('navigation handles leap days and year rollover', () => {
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.equal(addCalendarDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addCalendarDays('2028-02-29', 1), '2028-03-01');
  assert.equal(calendarDays({ year: 2028, month: 2 }).length, 42);
});
test('date-only labels stay on the selected day', () => {
  assert.equal(calendarDayLabel('2026-09-12'), 'Saturday, September 12');
  assert.equal(calendarMonthLabel({ year: 2026, month: 9 }), 'September 2026');
});
test('time labels include daylight or standard Central time', () => {
  assert.match(chicagoTimeLabel('2026-07-16T00:00:00Z'), /7:00 PM CDT/);
  assert.match(chicagoTimeLabel('2026-01-16T01:00:00Z'), /7:00 PM CST/);
});
test('elapsed event duration remains accurate over DST', () => {
  assert.equal(eventEnd('2026-03-08T07:30:00Z', 90), '2026-03-08T09:00:00.000Z');
  assert.equal(eventEnd('2026-09-12T23:00:00Z', null), null);
  assert.equal(eventEnd('bad timestamp', 90), null);
});
test('invalid dates are rejected rather than silently normalized', () => {
  assert.throws(() => chicagoMidnight('2026-02-31'), RangeError);
  assert.throws(() => addCalendarDays('not-a-day', 1), RangeError);
  assert.throws(() => chicagoDateKey('bad timestamp'), RangeError);
});
