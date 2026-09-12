import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Test the real helper without credentials, network access or generated files.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/medalVisibility.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const { loadPersonnelDisplayRows, partitionMedals, saveMedalVisibility } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const id = value => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const MEMBER = id(900001);
const success = data => ({ data, error: null });
const failure = (code = '42501', message = 'Fixture read failed') => ({ data: null, error: { code, message } });
const medal = (index, changes = {}) => ({
  id: id(index), member_id: MEMBER, item_id: id(800000 + index), item_kind: 'medal',
  assigned_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), removed_at: null,
  note: null, display_on_profile: true, ...changes,
});

function mockClient(options = {}) {
  const records = options.records ?? [];
  const queries = [];
  const calls = [];
  const pages = { base: 0, preferences: 0 };
  const client = {
    from(table) {
      const request = { table, fields: '', filters: [], orderBy: null, size: Infinity };
      const chain = {
        select(fields) { request.fields = fields; return chain; },
        eq(field, value) { request.filters.push(['eq', field, value]); return chain; },
        gt(field, value) { request.filters.push(['gt', field, value]); return chain; },
        order(field, value) { request.orderBy = { field, options: value }; return chain; },
        limit(size) { request.size = size; return chain; },
        then(resolve, reject) {
          queries.push(request);
          return Promise.resolve().then(() => {
            assert.equal(table, 'personnel_assignment');
            const preferences = request.fields === 'id,display_on_profile';
            const kind = preferences ? 'preferences' : 'base';
            pages[kind] += 1;
            if (options.reject === kind) throw new Error('Fixture network rejection');
            if (options.nullData === kind) return success(null);
            if (options.failedBasePage === pages.base && !preferences) return failure();
            if (options.failedPreferencePage === pages.preferences && preferences) return options.preferenceError ?? failure();
            if (options.missingColumn && preferences) return failure('42703', 'column personnel_assignment.display_on_profile does not exist');
            if (options.repeatedPage === kind && pages[kind] > 1) return success(records.slice(0, 250));
            const source = preferences ? options.preferences ?? records : records;
            const rows = source.filter(row => request.filters.every(([operation, field, value]) => (
              operation === 'eq' ? row[field] === value : row[field] > value
            ))).sort((a, b) => a.id.localeCompare(b.id)).slice(0, request.size);
            return success(rows.map(row => Object.fromEntries(request.fields.split(',').map(field => [field, row[field]]))));
          }).then(resolve, reject);
        },
      };
      return chain;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (options.rejectRpc) throw new Error('Fixture network rejection');
      return options.rpcResult ?? success(args.visible_on_profile);
    },
  };
  return { client, queries, calls, pages };
}

test('Ranks, active medals and history load separately from display preferences', async () => {
  const records = [medal(1), medal(2, { display_on_profile: false }), medal(3, { removed_at: '2026-04-01T00:00:00Z' }), medal(4, { item_kind: 'rank' })];
  const fake = mockClient({ records });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.equal(result.visibilityAvailable, true);
  assert.equal(result.visibilityStatus, 'available');
  assert.equal(result.visibilityError, null);
  assert.deepEqual(result.rows.map(row => row.id), [id(4), id(3), id(2), id(1)]);
  assert.deepEqual(result.rows.map(row => row.display_on_profile), [true, true, false, true]);
  assert.equal(fake.queries.length, 2);
  assert.equal(fake.queries[0].fields.includes('display_on_profile'), false);
  assert.equal(fake.queries[1].fields, 'id,display_on_profile');
  for (const query of fake.queries) {
    assert.ok(query.filters.some(filter => filter[0] === 'eq' && filter[1] === 'member_id' && filter[2] === MEMBER));
    assert.equal(query.filters.some(filter => filter[1] === 'removed_at'), false, 'Historical records are retained');
    assert.deepEqual(query.orderBy, { field: 'id', options: { ascending: true } });
    assert.equal(query.size, 250);
  }
  assert.deepEqual(fake.calls, []);
});

test('Both reads page beyond 1,000 awards without dropping records or preferences', async () => {
  const records = Array.from({ length: 1003 }, (_, index) => medal(index + 1, { display_on_profile: index % 2 === 0 }));
  const fake = mockClient({ records });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.equal(result.rows.length, 1003);
  assert.deepEqual(fake.pages, { base: 5, preferences: 5 });
  assert.equal(result.rows[0].id, id(1003));
  assert.equal(result.rows.at(-1).id, id(1));
  assert.equal(result.rows.filter(row => row.display_on_profile === false).length, 501);
  assert.equal(fake.queries.filter(query => query.filters.some(filter => filter[0] === 'gt')).length, 8);
});

test('An exact page boundary makes one final empty read', async () => {
  const fake = mockClient({ records: Array.from({ length: 250 }, (_, index) => medal(index + 1)) });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.equal(result.rows.length, 250);
  assert.deepEqual(fake.pages, { base: 2, preferences: 2 });
});

test('Non-advancing pages fail instead of looping forever or duplicating awards', async () => {
  const records = Array.from({ length: 260 }, (_, index) => medal(index + 1));
  const base = mockClient({ records, repeatedPage: 'base' });
  await assert.rejects(loadPersonnelDisplayRows(base.client, MEMBER), /member record could not be loaded/);
  assert.equal(base.pages.base, 2);
  const preferences = mockClient({ records, repeatedPage: 'preferences' });
  const result = await loadPersonnelDisplayRows(preferences.client, MEMBER);
  assert.equal(result.visibilityStatus, 'error');
  assert.ok(result.rows.every(row => row.display_on_profile === null));
  assert.equal(preferences.pages.preferences, 2);
});

test('Missing migration keeps rank and award records but never assumes visible medals', async () => {
  const fake = mockClient({ records: [medal(1, { display_on_profile: false }), medal(2, { item_kind: 'rank' })], missingColumn: true });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.equal(result.visibilityStatus, 'unavailable');
  assert.equal(result.visibilityAvailable, false);
  assert.match(result.visibilityError, /remain in your record/);
  assert.equal(result.rows.find(row => row.item_kind === 'rank').display_on_profile, true);
  assert.equal(result.rows.find(row => row.item_kind === 'medal').display_on_profile, null);
  const groups = partitionMedals(result.rows);
  assert.equal(groups.unknown.length, 1);
  assert.deepEqual(groups.visible, []);
  assert.deepEqual(groups.overflow, []);
});

test('A stale schema-cache column error also fails closed', async () => {
  const fake = mockClient({ records: [medal(1)], failedPreferencePage: 1, preferenceError: failure('PGRST204', "Could not find the 'display_on_profile' column in the schema cache") });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.equal(result.visibilityStatus, 'unavailable');
  assert.equal(result.rows[0].display_on_profile, null);
});

test('Permission and network failures are errors, not claims the migration is missing', async () => {
  for (const settings of [{ failedPreferencePage: 1 }, { reject: 'preferences' }, { nullData: 'preferences' }]) {
    const result = await loadPersonnelDisplayRows(mockClient({ records: [medal(1)], ...settings }).client, MEMBER);
    assert.equal(result.visibilityStatus, 'error');
    assert.equal(result.visibilityAvailable, false);
    assert.equal(result.rows[0].display_on_profile, null);
    assert.match(result.visibilityError, /could not be loaded/);
    assert.doesNotMatch(result.visibilityError, /Fixture/);
  }
});

test('A later preference-page failure does not expose even successfully read medals', async () => {
  const fake = mockClient({ records: Array.from({ length: 260 }, (_, index) => medal(index + 1)), failedPreferencePage: 2 });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.equal(result.rows.length, 260);
  assert.equal(result.visibilityStatus, 'error');
  assert.ok(result.rows.every(row => row.display_on_profile === null));
  assert.equal(partitionMedals(result.rows).visible.length, 0);
});

test('Malformed or incomplete preference values cannot publish partial guesses', async () => {
  for (const preferences of [[medal(1, { display_on_profile: 'false' })], [], [medal(1, { display_on_profile: null })]]) {
    const result = await loadPersonnelDisplayRows(mockClient({ records: [medal(1)], preferences }).client, MEMBER);
    assert.equal(result.visibilityStatus, 'error');
    assert.equal(result.rows[0].display_on_profile, null);
  }
});

test('A newly awarded extra preference row is safe while a missing base preference is not', async () => {
  const result = await loadPersonnelDisplayRows(mockClient({ records: [medal(1)], preferences: [medal(1, { display_on_profile: false }), medal(2)] }).client, MEMBER);
  assert.equal(result.visibilityAvailable, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].display_on_profile, false);
});

test('Base-query failures reject rather than return partial rank or award history', async () => {
  for (const settings of [{ failedBasePage: 1 }, { reject: 'base' }, { nullData: 'base' }, { failedBasePage: 2 }]) {
    const fake = mockClient({ records: Array.from({ length: 260 }, (_, index) => medal(index + 1)), ...settings });
    await assert.rejects(loadPersonnelDisplayRows(fake.client, MEMBER), /member record could not be loaded/);
  }
});

test('Malformed base dates, item kinds and notes are not rendered as trustworthy records', async () => {
  for (const changes of [{ assigned_at: 'not-a-date' }, { item_kind: 'other' }, { note: 12 }, { removed_at: '' }, { item_id: 'bad-id' }]) {
    await assert.rejects(loadPersonnelDisplayRows(mockClient({ records: [medal(1, changes)] }).client, MEMBER), /member record could not be loaded/);
  }
});

test('No member history and no medals are valid available results', async () => {
  assert.deepEqual(await loadPersonnelDisplayRows(mockClient().client, MEMBER), {
    rows: [], visibilityAvailable: true, visibilityStatus: 'available', visibilityError: null,
  });
  const onlyRank = await loadPersonnelDisplayRows(mockClient({ records: [medal(1, { item_kind: 'rank' })] }).client, MEMBER);
  assert.equal(onlyRank.rows.length, 1);
  assert.equal(onlyRank.visibilityAvailable, true);
  assert.equal(partitionMedals(onlyRank.rows).visible.length, 0);
});

test('Member validation rejects empty, malformed and cross-member requests before reading', async () => {
  for (const value of ['', 'member', 'x'.repeat(36)]) {
    const fake = mockClient();
    await assert.rejects(loadPersonnelDisplayRows(fake.client, value), /valid member/);
    assert.equal(fake.queries.length, 0);
  }
  const fake = mockClient({ records: [medal(1, { member_id: id(900002) }), medal(2)] });
  const result = await loadPersonnelDisplayRows(fake.client, MEMBER);
  assert.deepEqual(result.rows.map(row => row.id), [id(2)]);
});

test('Ten shown medals plus overflow excludes deliberately hidden and historical awards', () => {
  const shown = Array.from({ length: 13 }, (_, index) => medal(index + 1));
  const rows = [medal(20, { item_kind: 'rank' }), medal(21, { display_on_profile: false }), ...shown, medal(22, { display_on_profile: null }), medal(23, { removed_at: '2026-04-01T00:00:00Z' })];
  const before = structuredClone(rows);
  const result = partitionMedals(rows);
  assert.deepEqual(result.visible, shown.slice(0, 10));
  assert.deepEqual(result.overflow, shown.slice(10));
  assert.deepEqual(result.hidden.map(row => row.id), [id(21)]);
  assert.deepEqual(result.unknown.map(row => row.id), [id(22)]);
  assert.deepEqual(result.historical.map(row => row.id), [id(23)]);
  assert.deepEqual([...result.visible, ...result.overflow], shown, 'Show all must never include hidden medals');
  assert.deepEqual(rows, before, 'Partitioning must not mutate the source record');
});

test('Hidden historical medals remain in history rather than the active hidden group', () => {
  const result = partitionMedals([medal(1, { display_on_profile: false, removed_at: '2026-02-01T00:00:00Z' }), medal(2, { display_on_profile: null, removed_at: '2026-03-01T00:00:00Z' })]);
  assert.equal(result.historical.length, 2);
  assert.equal(result.hidden.length, 0);
  assert.equal(result.unknown.length, 0);
});

test('Display limit is explicit and invalid values are rejected', () => {
  const rows = [medal(1), medal(2), medal(3)];
  assert.equal(partitionMedals(rows, 2).visible.length, 2);
  assert.equal(partitionMedals(rows, 2).overflow.length, 1);
  for (const value of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => partitionMedals(rows, value), /positive whole number/);
});

test('Show and hide use only the authorized RPC and return the confirmed boolean', async () => {
  const fake = mockClient();
  assert.equal(await saveMedalVisibility(fake.client, id(1), true), true);
  assert.equal(await saveMedalVisibility(fake.client, id(1), false), false);
  assert.deepEqual(fake.calls, [
    { name: 'set_personnel_medal_visibility', args: { target_assignment: id(1), visible_on_profile: true } },
    { name: 'set_personnel_medal_visibility', args: { target_assignment: id(1), visible_on_profile: false } },
  ]);
  assert.equal(fake.queries.length, 0, 'A save must not attempt a direct table write');
});

test('Invalid saves are rejected before RPC dispatch', async () => {
  const fake = mockClient();
  await assert.rejects(saveMedalVisibility(fake.client, '', true), /valid medal/);
  await assert.rejects(saveMedalVisibility(fake.client, id(1), null), /show or hide/);
  await assert.rejects(saveMedalVisibility(fake.client, id(1), 'false'), /show or hide/);
  assert.equal(fake.calls.length, 0);
});

test('An HTTP success without the exact boolean is not a confirmed save', async () => {
  for (const value of [null, [], [false], 0, 'false', true]) {
    await assert.rejects(saveMedalVisibility(mockClient({ rpcResult: success(value) }).client, id(1), false), /could not be confirmed/);
  }
});

test('Failed or uncertain saves never return success and do not retry automatically', async () => {
  for (const options of [{ rejectRpc: true }, { rpcResult: failure('XX000') }]) {
    const fake = mockClient(options);
    await assert.rejects(saveMedalVisibility(fake.client, id(1), true), /could not be confirmed/);
    assert.equal(fake.calls.length, 1);
  }
  for (const code of ['PGRST202', '42883']) {
    await assert.rejects(saveMedalVisibility(mockClient({ rpcResult: failure(code) }).client, id(1), true), /not available yet/);
  }
  await assert.rejects(saveMedalVisibility(mockClient({ rpcResult: failure('42501') }).client, id(1), true), /cannot change/);
  await assert.rejects(saveMedalVisibility(mockClient({ rpcResult: failure('P0002') }).client, id(1), true), /no longer an active award/);
});

// These are draft-contract checks, not an executed PostgreSQL permission test.
const sql = await readFile(new URL('../db/0048_medal_profile_visibility.sql', import.meta.url), 'utf8');
const rpc = sql.slice(sql.indexOf('create or replace function public.set_personnel_medal_visibility'));
test('SQL draft is transactional, default-visible and leaves base grants and RLS untouched', () => {
  assert.match(sql, /\bbegin;[\s\S]+\bcommit;/);
  assert.match(sql, /add column if not exists display_on_profile boolean not null default true/);
  assert.doesNotMatch(sql, /create policy|drop policy|disable row level security|grant\s+(?:all|insert|update|delete|select)\s+on\s+(?:table\s+)?public\.personnel_assignment/i);
  assert.doesNotMatch(sql, /delete from public\.personnel_assignment|delete from public\.personnel_audit|create or replace function public\.trim_personnel_audit/i);
});

test('SQL draft limits the new RPC to authenticated owner or staff with null-safe status checks', () => {
  assert.match(rpc, /security definer set search_path = public, pg_temp/);
  assert.match(rpc, /target_assignment is null or visible_on_profile is null/);
  assert.match(rpc, /auth\.uid\(\) is null or actor is null or actor_role is null/);
  assert.match(rpc, /m\.id = actor and m\.auth_user_id = auth\.uid\(\)/);
  assert.match(rpc, /actor_status is null or actor_status not in \('applicant', 'active', 'reserve'\)/);
  assert.match(rpc, /awarded\.member_id is distinct from actor and actor_role not in \('moderator', 'admin'\)/);
  assert.match(rpc, /revoke all on function public\.set_personnel_medal_visibility\(uuid, boolean\) from public, anon/);
  assert.match(rpc, /grant execute on function public\.set_personnel_medal_visibility\(uuid, boolean\) to authenticated/);
});

test('SQL draft locks active medals, skips no-op updates and relies on one audited change', () => {
  assert.match(rpc, /where a\.id = target_assignment\s+for update/);
  assert.match(rpc, /awarded\.item_kind <> 'medal' or awarded\.removed_at is not null/);
  assert.match(rpc, /i\.id = awarded\.item_id and i\.kind = 'medal'/);
  const noOp = rpc.indexOf('if awarded.display_on_profile = visible_on_profile then');
  const update = rpc.indexOf('update public.personnel_assignment');
  assert.ok(noOp > 0 && update > noOp);
  assert.match(rpc.slice(noOp, update), /return awarded\.display_on_profile/);
  assert.doesNotMatch(rpc, /insert into public\.personnel_audit/);
  assert.match(sql, /'personnel.medal_visibility'/);
  assert.match(sql, /'before', jsonb_build_object\('display_on_profile'/);
  assert.match(sql, /'after', jsonb_build_object\('display_on_profile'/);
  assert.match(sql, /before_json - 'display_on_profile' = row_json - 'display_on_profile'/);
  assert.match(sql, /tgname = 'personnel_assignment_audit'/);
  assert.match(sql, /tgname = 'personnel_audit_keep_latest'/);
  assert.match(sql, /tgenabled in \('O', 'A'\)/);
});
