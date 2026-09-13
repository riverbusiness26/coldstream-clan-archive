import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = readFileSync(new URL('../src/lib/eventRecurrence.ts', import.meta.url), 'utf8')
  .replace('./calendarTime', new URL('../src/lib/calendarTime.ts', import.meta.url).href);
const { recurringEventStarts } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
test('daily and weekly repeats preserve Chicago wall time over DST', () => {
  assert.deepEqual(recurringEventStarts('2026-03-07T01:00:00.000Z', 'weekly', 2), ['2026-03-07T01:00:00.000Z','2026-03-14T00:00:00.000Z']);
  assert.deepEqual(recurringEventStarts('2026-10-31T00:00:00.000Z', 'daily', 3), ['2026-10-31T00:00:00.000Z','2026-11-01T00:00:00.000Z','2026-11-02T01:00:00.000Z']);
});
test('monthly dates clamp February then return to the original day', () => {
  assert.deepEqual(recurringEventStarts('2028-01-31T18:00:00.000Z', 'monthly', 3), ['2028-01-31T18:00:00.000Z','2028-02-29T18:00:00.000Z','2028-03-31T17:00:00.000Z']);
});
test('missing spring times reject the series and fall repeats use standard time', () => {
  assert.throws(() => recurringEventStarts('2026-03-07T08:30:00.000Z', 'daily', 2), /does not exist/);
  assert.equal(recurringEventStarts('2026-10-31T06:30:00.000Z', 'daily', 2)[1], '2026-11-01T07:30:00.000Z');
});
test('recurrence rejects unbounded and invalid counts', () => {
  for (const count of [0,1,105,2.5,NaN]) assert.throws(() => recurringEventStarts('2026-09-14T00:00:00Z','weekly',count));
  assert.equal(recurringEventStarts('2026-09-14T00:00:00Z','none',1).length,1);
});
