import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Bundle the actual TypeScript helpers in memory. Nothing talks to Supabase,
// starts a browser or writes generated test artifacts into the checkout.
async function loadModule(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { loadCombatStats, EMPTY_COMBAT_STATS, displayStat } = await loadModule('../src/lib/combatStats.ts');
const { combatPeriodRange } = await loadModule('../src/lib/combatPeriod.ts');

const success = (data) => ({ data, error: null });
const failure = () => ({ data: null, error: { message: 'Fixture query failed' } });
function mockClient(options = {}) {
  const { totals = [], submissions = [], statsError = false, hoursError = false, failedSubmissionPage = 0, rejectedStats = false, rejectedHours = false } = options;
  const hours = Object.hasOwn(options, 'hours') ? options.hours : 0;
  const queries = [];
  const calls = [];
  let submissionPage = 0;
  const client = {
    from(table) {
      const request = { table, fields: null, filters: [], orderBy: null, size: Infinity };
      const chain = {
        select(fields) { request.fields = fields; return chain; },
        eq(field, value) { request.filters.push(['eq', field, value]); return chain; },
        gte(field, value) { request.filters.push(['gte', field, value]); return chain; },
        gt(field, value) { request.filters.push(['gt', field, value]); return chain; },
        lt(field, value) { request.filters.push(['lt', field, value]); return chain; },
        order(field, options) { request.orderBy = { field, options }; return chain; },
        limit(size) { request.size = size; return chain; },
        then(resolve, reject) {
          queries.push(request);
          return Promise.resolve().then(() => {
            if (rejectedStats) throw new Error('Fixture network rejected');
            if (statsError) return failure();
            if (table === 'stat_leaderboard') return success(totals);
            assert.equal(table, 'stat_submission', 'Only existing approved-stat relations may be read');
            submissionPage += 1;
            if (submissionPage === failedSubmissionPage) return failure();
            const result = submissions.filter((row) => request.filters.every(([operation, field, value]) => {
              const actual = field.split('.').reduce((node, key) => node?.[key], row);
              if (operation === 'eq') return actual === value;
              if (actual == null) return false;
              return operation === 'gte' ? actual >= value : operation === 'gt' ? actual > value : actual < value;
            })).sort((a, b) => a.id.localeCompare(b.id)).slice(0, request.size);
            return success(result);
          }).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc(name, args) {
      calls.push({ name, args });
      if (name === 'member_profile_activity') return Promise.resolve(options.activity ? success(options.activity) : failure());
      assert.equal(name, 'member_attendance_hours');
      return rejectedHours ? Promise.reject(new Error('Fixture hours rejected')) : Promise.resolve(hoursError ? failure() : success(hours));
    },
  };
  return { client, queries, calls };
}
const round = (kills = 10, deaths = 2, is_mvp = false, is_top5 = true) => ({ kills, deaths, is_mvp, is_top5 });
function submission(index, values = {}) {
  return {
    id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    submitter_id: 'member-fixture', status: 'approved', created_at: '1900-01-01T00:00:00.000Z',
    event: { starts_at: new Date().toISOString() }, stat_round: [round()], ...values,
  };
}

test('Chicago days are independent of the viewer timezone at midnight', () => {
  assert.deepEqual(combatPeriodRange('Day', new Date('2026-09-12T02:00:00Z')), { start: '2026-09-11T05:00:00.000Z', end: '2026-09-12T05:00:00.000Z' });
  assert.deepEqual(combatPeriodRange('Day', new Date('2026-01-02T04:00:00Z')), { start: '2026-01-01T06:00:00.000Z', end: '2026-01-02T06:00:00.000Z' });
});
test('Chicago week is Monday-based and handles a year boundary', () => {
  assert.deepEqual(combatPeriodRange('Week', new Date('2026-01-01T18:00:00Z')), { start: '2025-12-29T06:00:00.000Z', end: '2026-01-05T06:00:00.000Z' });
  assert.deepEqual(combatPeriodRange('Week', new Date('2026-09-14T03:00:00Z')), { start: '2026-09-07T05:00:00.000Z', end: '2026-09-14T05:00:00.000Z' });
});
test('DST transitions produce 23-hour and 25-hour days, not fixed offsets', () => {
  const spring = combatPeriodRange('Day', new Date('2026-03-08T18:00:00Z'));
  const autumn = combatPeriodRange('Day', new Date('2026-11-01T18:00:00Z'));
  assert.equal((Date.parse(spring.end) - Date.parse(spring.start)) / 3_600_000, 23);
  assert.equal((Date.parse(autumn.end) - Date.parse(autumn.start)) / 3_600_000, 25);
  assert.deepEqual(spring, { start: '2026-03-08T06:00:00.000Z', end: '2026-03-09T05:00:00.000Z' });
  assert.deepEqual(autumn, { start: '2026-11-01T05:00:00.000Z', end: '2026-11-02T06:00:00.000Z' });
});
test('Month boundaries follow Chicago with DST and leap years', () => {
  assert.deepEqual(combatPeriodRange('Month', new Date('2026-03-15T18:00:00Z')), { start: '2026-03-01T06:00:00.000Z', end: '2026-04-01T05:00:00.000Z' });
  assert.deepEqual(combatPeriodRange('Month', new Date('2028-02-29T18:00:00Z')), { start: '2028-02-01T06:00:00.000Z', end: '2028-03-01T06:00:00.000Z' });
  assert.equal(combatPeriodRange('All time'), null);
});
test('All-time totals preserve the existing approved aggregate and sampled-hours RPC', async () => {
  const fake = mockClient({ totals: [{ kills: 10, deaths: 2, mvps: 1, top5: 2 }, { kills: 20, deaths: 4, mvps: 2, top5: 3 }], hours: '3.4' });
  const result = await loadCombatStats(fake.client, 'member-fixture');
  assert.deepEqual(result, { kills: 30, deaths: 6, mvps: 3, top5: 5, kdr: 5, attendanceHours: 3.4, eventsAttended: null, attendancePercent: null });
  assert.equal(fake.queries[0].table, 'stat_leaderboard');
  assert.deepEqual(fake.queries[0].filters, [['eq', 'member_id', 'member-fixture']]);
  assert.deepEqual(fake.calls, [{ name: 'member_attendance_hours', args: { target_member: 'member-fixture' } }, { name: 'member_profile_activity', args: { target_member: 'member-fixture' } }]);
});
test('The zero-deaths K/D rule remains kills, and genuine zero is not unknown', async () => {
  const first = await loadCombatStats(mockClient({ totals: [{ kills: 17, deaths: 0, mvps: 0, top5: 0 }], hours: 0 }).client, 'member-fixture');
  assert.equal(first.kdr, 17);
  assert.equal(first.attendanceHours, 0);
  const zero = await loadCombatStats(mockClient({ totals: [{ kills: 0, deaths: 0, mvps: 0, top5: 0 }] }).client, 'member-fixture');
  assert.equal(zero.kills, 0);
  assert.equal(zero.kdr, 0);
});

test('verified activity supplies event and contribution totals without inventing a percentage', async () => {
  const fake = mockClient({ activity: {attendance_hours: 1.25, events_attended: 3, weekly_features: 2, weekly_submissions: 4, gallery_uploads: 5} });
  const result = await loadCombatStats(fake.client, 'member-fixture');
  assert.equal(result.attendanceHours, 1.25);
  assert.equal(result.eventsAttended, 3);
  assert.equal(result.weeklyFeatures, 2);
  assert.equal(result.weeklySubmissions, 4);
  assert.equal(result.galleryUploads, 5);
  assert.equal(result.attendancePercent, null);
});
test('Filtered totals use linked event occurrence, not submission creation or RSVP intent', async () => {
  const current = combatPeriodRange('Month');
  const beforeStart = new Date(Date.parse(current.start) - 1).toISOString();
  const fake = mockClient({
    submissions: [
      submission(1, { event: { starts_at: current.start }, created_at: '1900-01-01T00:00:00.000Z', stat_round: [round(7, 2, true, false)] }),
      submission(2, { event: { starts_at: beforeStart }, created_at: new Date().toISOString() }),
      submission(3, { event: null }),
      submission(4, { status: 'rejected' }),
      submission(5, { submitter_id: 'another-member' }),
      submission(6, { event: { starts_at: current.end } }),
    ], hours: 99,
  });
  const result = await loadCombatStats(fake.client, 'member-fixture', 'Month');
  assert.equal(result.kills, 7);
  assert.equal(result.deaths, 2);
  assert.equal(result.mvps, 1);
  assert.equal(result.top5, 0);
  assert.equal(result.attendanceHours, null);
  assert.equal(result.eventsAttended, null);
  assert.equal(result.attendancePercent, null);
  assert.equal(fake.calls.length, 0, 'Do not ask an all-time hours RPC for a monthly card');
  assert.ok(fake.queries[0].fields.includes('event!inner(starts_at)'));
  assert.ok(!fake.queries[0].fields.includes('created_at'));
  assert.deepEqual(fake.queries[0].filters.slice(-2), [['gte', 'event.starts_at', current.start], ['lt', 'event.starts_at', current.end]]);
  assert.ok(fake.queries.every((query) => !/rsvp|presence/.test(query.table)));
});
test('Keyset pagination totals more than the default 1,000-row API cap', async () => {
  const fake = mockClient({ submissions: Array.from({ length: 1003 }, (_, index) => submission(index + 1, { stat_round: [round(1, 1, false, false)] })) });
  const result = await loadCombatStats(fake.client, 'member-fixture', 'Week');
  assert.equal(result.kills, 1003);
  assert.equal(result.deaths, 1003);
  assert.equal(fake.queries.length, 5);
  assert.deepEqual(fake.queries[1].filters.at(-1), ['gt', 'id', '00000000-0000-0000-0000-000000000250']);
});
test('Failure on a later page returns unknown, never a partial statistic', async () => {
  const fake = mockClient({ submissions: Array.from({ length: 251 }, (_, index) => submission(index + 1)), failedSubmissionPage: 2 });
  assert.deepEqual(await loadCombatStats(fake.client, 'member-fixture', 'Day'), EMPTY_COMBAT_STATS);
});
test('Query errors and rejected requests do not become zero or discard independent hours', async () => {
  const responseError = await loadCombatStats(mockClient({ statsError: true, hours: 2.7 }).client, 'member-fixture');
  assert.equal(responseError.kills, null);
  assert.equal(responseError.attendanceHours, 2.7);
  assert.deepEqual(await loadCombatStats(mockClient({ rejectedStats: true, rejectedHours: true }).client, 'member-fixture'), EMPTY_COMBAT_STATS);
  const hoursError = await loadCombatStats(mockClient({ totals: [{ kills: 5, deaths: 1, mvps: 0, top5: 1 }], hoursError: true }).client, 'member-fixture');
  assert.equal(hoursError.kills, 5);
  assert.equal(hoursError.attendanceHours, null);
});
test('Malformed, missing, negative and nonfinite metrics remain unknown', async () => {
  for (const invalid of [null, undefined, '', 'invalid', '0x10', -1, Infinity, NaN, true]) {
    const result = await loadCombatStats(mockClient({ totals: [{ kills: invalid, deaths: 2, mvps: 0, top5: 1 }], hours: invalid }).client, 'member-fixture');
    assert.equal(result.kills, null);
    assert.equal(result.kdr, null);
    assert.equal(result.attendanceHours, null);
    assert.equal(result.deaths, 2);
  }
  const incomplete = await loadCombatStats(mockClient({ submissions: [submission(1, { stat_round: undefined })] }).client, 'member-fixture', 'Day');
  assert.deepEqual(incomplete, EMPTY_COMBAT_STATS);
});
test('Empty approved totals stay unknown while a successful sampled zero stays zero', async () => {
  const result = await loadCombatStats(mockClient().client, 'member-fixture');
  assert.equal(result.kills, null);
  assert.equal(result.deaths, null);
  assert.equal(result.attendanceHours, 0);
  assert.equal(result.eventsAttended, null);
});
test('An empty member identity does not issue an unscoped request', async () => {
  const fake = mockClient();
  assert.deepEqual(await loadCombatStats(fake.client, '  '), EMPTY_COMBAT_STATS);
  assert.equal(fake.queries.length, 0);
  assert.equal(fake.calls.length, 0);
});
test('Presentation helper refuses NaN and infinity instead of displaying corrupt values', () => {
  assert.equal(displayStat(null), 'Not recorded');
  assert.equal(displayStat(NaN), 'Not recorded');
  assert.equal(displayStat(Infinity), 'Not recorded');
  assert.equal(displayStat(0, 'h'), '0h');
  assert.equal(displayStat(2.5, 'h'), '2.5h');
});
