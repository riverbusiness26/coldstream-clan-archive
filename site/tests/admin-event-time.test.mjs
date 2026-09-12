import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chicagoDateTimeCandidates, chicagoDateTimeInput, chicagoDateTimeToIso } from '../src/lib/calendarTime.ts';

test('Chicago inputs resolve winter CST and summer CDT without browser offsets', () => {
  assert.equal(chicagoDateTimeToIso('2026-01-15T19:00'), '2026-01-16T01:00:00.000Z');
  assert.equal(chicagoDateTimeToIso('2026-07-15T19:00'), '2026-07-16T00:00:00.000Z');
  assert.equal(chicagoDateTimeToIso('2026-07-15T00:00'), '2026-07-15T05:00:00.000Z');
});

test('the editor shows Chicago wall-clock values and preserves ordinary instants', () => {
  for (const instant of ['2026-01-16T01:00:00.000Z', '2026-07-16T00:00:00.000Z', '2028-02-29T06:00:00.000Z']) {
    assert.equal(chicagoDateTimeToIso(chicagoDateTimeInput(instant)), instant);
  }
  assert.equal(chicagoDateTimeInput('2026-07-16T02:00:00+02:00'), '2026-07-15T19:00');
  assert.equal(chicagoDateTimeInput(new Date('2026-01-16T01:00:00Z')), '2026-01-15T19:00');
});

test('spring-forward nonexistent times are rejected rather than moved to 3 AM', () => {
  for (const time of ['02:00', '02:15', '02:30', '02:59']) {
    assert.deepEqual(chicagoDateTimeCandidates(`2026-03-08T${time}`), []);
    assert.throws(() => chicagoDateTimeToIso(`2026-03-08T${time}`), /does not exist.*before 2:00 AM.*3:00 AM/);
  }
  assert.equal(chicagoDateTimeToIso('2026-03-08T01:59'), '2026-03-08T07:59:00.000Z');
  assert.equal(chicagoDateTimeToIso('2026-03-08T03:00'), '2026-03-08T08:00:00.000Z');
});

test('fall-back repeated times require an explicit occurrence', () => {
  assert.deepEqual(chicagoDateTimeCandidates('2026-11-01T01:30'), ['2026-11-01T06:30:00.000Z', '2026-11-01T07:30:00.000Z']);
  assert.throws(() => chicagoDateTimeToIso('2026-11-01T01:30'), /occurs twice.*first occurrence.*second occurrence/);
  assert.throws(() => chicagoDateTimeToIso('2026-11-01T01:30', 'unknown'), /occurs twice/);
  assert.equal(chicagoDateTimeToIso('2026-11-01T01:30', 'earlier'), '2026-11-01T06:30:00.000Z');
  assert.equal(chicagoDateTimeToIso('2026-11-01T01:30', 'later'), '2026-11-01T07:30:00.000Z');
  assert.equal(chicagoDateTimeToIso('2026-11-01T00:59'), '2026-11-01T05:59:00.000Z');
  assert.equal(chicagoDateTimeToIso('2026-11-01T02:00'), '2026-11-01T08:00:00.000Z');
});

test('editing either repeated occurrence can round-trip without shifting an hour', () => {
  for (const [occurrence, instant] of [['earlier', '2026-11-01T06:30:00.000Z'], ['later', '2026-11-01T07:30:00.000Z']]) {
    const input = chicagoDateTimeInput(instant);
    const candidates = chicagoDateTimeCandidates(input);
    const restoredOccurrence = Date.parse(candidates[0]) === Date.parse(instant) ? 'earlier' : 'later';
    assert.equal(restoredOccurrence, occurrence);
    assert.equal(chicagoDateTimeToIso(input, restoredOccurrence), instant);
  }
});

test('invalid calendar dates, times and ambiguous timestamp formats are rejected', () => {
  for (const input of ['', 'bad', '2026-02-30T19:00', '2026-02-29T19:00', '2026-13-01T19:00', '2026-00-01T19:00', '2026-01-00T19:00', '2026-01-01T24:00', '2026-01-01T19:60', '2026-01-01T9:00', '2026-01-01T19:00Z', '2026-01-01T19:00:00']) {
    assert.throws(() => chicagoDateTimeToIso(input), RangeError, input);
  }
  assert.throws(() => chicagoDateTimeInput('2026-01-15T19:00'), /must include its timezone/);
  assert.throws(() => chicagoDateTimeInput('not-a-timestampZ'), RangeError);
  assert.throws(() => chicagoDateTimeInput(new Date(NaN)), RangeError);
});

test('Chicago results are identical in UTC, London, Los Angeles and Tokyo hosts', () => {
  const moduleUrl = new URL('../src/lib/calendarTime.ts', import.meta.url).href;
  const source = `import { chicagoDateTimeInput, chicagoDateTimeToIso } from ${JSON.stringify(moduleUrl)};
    const results = ['2026-01-15T19:00', '2026-07-15T19:00', '2026-03-08T03:00'].map(value => chicagoDateTimeToIso(value));
    results.push(chicagoDateTimeInput('2026-07-16T00:00:00Z'));
    results.push(chicagoDateTimeToIso('2026-11-01T01:30', 'earlier'));
    results.push(chicagoDateTimeToIso('2026-11-01T01:30', 'later'));
    try { chicagoDateTimeToIso('2026-03-08T02:30'); } catch (error) { results.push(error.message); }
    process.stdout.write(JSON.stringify(results));`;
  const results = ['UTC', 'Europe/London', 'America/Los_Angeles', 'Asia/Tokyo'].map((timezone) => execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', source], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' }));
  for (const result of results) assert.equal(result, results[0]);
});

test('Admin create and edit use the validated ISO timestamp and explicit Chicago labels', () => {
  const admin = readFileSync(new URL('../src/views/Admin.tsx', import.meta.url), 'utf8');
  assert.equal((admin.match(/event_starts_at: startsAt/g) || []).length, 2);
  assert.ok(admin.includes('starts_at: startsAt'));
  assert.ok(admin.includes('chicagoDateTimeInput(currentEvent.starts_at)'));
  assert.ok(admin.includes('chicagoDateTimeToIso(eventStartValue, eventOccurrence || undefined)'));
  assert.ok(admin.includes('Which occurrence?'));
  assert.ok(admin.includes('Start time (Chicago)'));
  assert.ok(admin.includes('catch (cause)'));
  assert.ok(!admin.includes('new Date(eventStartValue)'));
  assert.ok(!admin.includes('getTimezoneOffset'));
  assert.ok(!admin.includes('device’s local timezone'));
});
