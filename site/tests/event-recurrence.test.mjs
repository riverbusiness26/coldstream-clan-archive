import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = readFileSync(new URL('../src/lib/eventRecurrence.ts', import.meta.url), 'utf8')
  .replace('./calendarTime', new URL('../src/lib/calendarTime.ts', import.meta.url).href);
const { recurringEventStarts } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
test('daily and weekly repeats preserve Chicago wall time over DST', () => {
  assert.deepEqual(recurringEventStarts('2026-03-07T01:00:00.000Z', 'weekly'), ['2026-03-07T01:00:00.000Z','2026-03-14T00:00:00.000Z','2026-03-21T00:00:00.000Z']);
  assert.deepEqual(recurringEventStarts('2026-10-31T00:00:00.000Z', 'daily'), ['2026-10-31T00:00:00.000Z','2026-11-01T00:00:00.000Z','2026-11-02T01:00:00.000Z']);
});
test('monthly dates clamp February then return to the original day', () => {
  assert.deepEqual(recurringEventStarts('2028-01-31T18:00:00.000Z', 'monthly'), ['2028-01-31T18:00:00.000Z','2028-02-29T18:00:00.000Z','2028-03-31T17:00:00.000Z']);
});
test('spring gaps shift that date one hour and fall repeats use standard time', () => {
  assert.deepEqual(recurringEventStarts('2026-03-07T08:30:00.000Z', 'daily'), ['2026-03-07T08:30:00.000Z','2026-03-08T08:30:00.000Z','2026-03-09T07:30:00.000Z']);
  assert.equal(recurringEventStarts('2026-10-31T06:30:00.000Z', 'daily')[1], '2026-11-01T07:30:00.000Z');
});
test('preview needs no count and never implies an end date', () => {
  for (const repeat of ['daily','weekly','monthly']) assert.equal(recurringEventStarts('2026-09-14T00:00:00Z',repeat).length,3);
  assert.equal(recurringEventStarts('2026-09-14T00:00:00Z','none').length,1);
  assert.throws(() => recurringEventStarts('2026-09-14T00:00:00Z','yearly'), /repeat option/);
});
