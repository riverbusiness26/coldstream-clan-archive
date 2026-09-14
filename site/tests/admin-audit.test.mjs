import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function moduleAt(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { readAdminRows, loadAdminSections, mergeDetachmentDrafts, parseRoundCount } = await moduleAt('../src/lib/adminData.ts');
const { reviewWeeklyContent, deleteArchivedWeeklyContent } = await moduleAt('../src/lib/adminWeekly.ts');
const success = (data) => ({ data, error: null });

test('admin queues load every page, including submissions past the old 200-row limit', async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await readAdminRows((from, to) => { ranges.push([from, to]); return Promise.resolve(success(rows.slice(from, to + 1))); });
  assert.equal(result.data.length, 1001);
  assert.equal(ranges.length, 5);
});
test('failed later page does not publish a misleading partial queue', async () => {
  const result = await readAdminRows((from) => Promise.resolve(from ? { data: null, error: { message: 'Denied' } } : success([1, 2])), 2);
  assert.equal(result.data, null);
  assert.equal(result.error.message, 'Denied');
});
test('network rejection becomes a visible load error', async () => {
  const result = await readAdminRows(() => { throw new Error('Offline'); });
  assert.equal(result.error.message, 'Offline');
});
test('one broken admin section cannot block weekly or member records', async () => {
  const completed = [];
  const errors = await loadAdminSections([
    { name: 'Artwork', run: () => { throw new Error('Unavailable'); } },
    { name: 'Weekly', run: async () => { completed.push('weekly'); return success([]); } },
    { name: 'Members', run: async () => { completed.push('members'); return success([]); } },
  ]);
  assert.deepEqual(completed.sort(), ['members', 'weekly']);
  assert.deepEqual(errors, { Artwork: 'Unavailable' });
});
test('refresh preserves dirty detachment selections and updates untouched selections', () => {
  assert.deepEqual(mergeDetachmentDrafts({ a: 'new', b: 'old' }, [{ id: 'a', company_id: 'old' }, { id: 'b', company_id: 'old' }], [{ id: 'a', company_id: 'old' }, { id: 'b', company_id: 'remote' }]), { a: 'new', b: 'remote' });
});
test('blank, decimal and overflowing round values cannot silently become zero', () => {
  for (const value of ['', ' ', '-1', '2.5', '1e3', '2147483648']) assert.equal(parseRoundCount(value), null);
  assert.equal(parseRoundCount('0'), 0);
  assert.equal(parseRoundCount('123'), 123);
});

function weeklyDb({ reviewError = null, publicationError = null, throws = false, missing = false } = {}) {
  const calls = [];
  const chain = {
    update(value) { calls.push(['update', value.status]); return chain; },
    delete() { calls.push(['delete']); return chain; },
    eq(key, value) { calls.push(['eq', key, value]); return chain; },
    select(value) { calls.push(['select', value]); return chain; },
    single() { return Promise.resolve({ data: missing ? null : { id: 'test' }, error: reviewError }); },
  };
  return { calls, from() { return chain; }, rpc(name) { calls.push(['rpc', name]); if (throws) throw new Error('Offline'); return Promise.resolve({ error: publicationError }); } };
}
test('weekly acceptance persists the decision then publishes immediately', async () => {
  const db = weeklyDb();
  assert.deepEqual(await reviewWeeklyContent(db, 'test', 'approved', 'staff'), { publicationError: null });
  assert.deepEqual(db.calls[0], ['update', 'approved']);
  assert.ok(db.calls.some((row) => row.join(':') === 'eq:status:pending'));
  assert.deepEqual(db.calls.at(-1), ['rpc', 'deploy_weekly_content']);
});
test('failed or stale weekly decision never reports success or publishes', async () => {
  for (const options of [{ reviewError: { message: 'Permission denied' } }, { missing: true }]) {
    const db = weeklyDb(options);
    await assert.rejects(reviewWeeklyContent(db, 'test', 'approved', 'staff'));
    assert.ok(!db.calls.some((row) => row[0] === 'rpc'));
  }
});
test('publication failure preserves approval and supports a retry without another decision', async () => {
  for (const options of [{ publicationError: { message: 'Unavailable' } }, { throws: true }]) {
    assert.ok((await reviewWeeklyContent(weeklyDb(options), 'test', 'approved', 'staff')).publicationError);
  }
});
test('rejection only removes pending content; archive only changes approved content', async () => {
  for (const status of ['rejected', 'archived']) {
    const db = weeklyDb();
    await reviewWeeklyContent(db, 'test', status, 'staff');
    assert.ok(db.calls.some((row) => row.join(':') === `eq:status:${status === 'archived' ? 'approved' : 'pending'}`));
    assert.ok(!db.calls.some((row) => row[0] === 'rpc'));
  }
});
test('archived content can be reinstated to the review queue', async () => {
  const db = weeklyDb();
  await reviewWeeklyContent(db, 'test', 'pending', 'staff');
  assert.ok(db.calls.some((row) => row.join(':') === 'eq:status:archived'));
  assert.deepEqual(db.calls[0], ['update', 'pending']);
});
test('only archived content can be permanently deleted', async () => {
  const db = weeklyDb();
  assert.equal(await deleteArchivedWeeklyContent(db, 'test'), 'test');
  assert.deepEqual(db.calls[0], ['delete']);
  assert.ok(db.calls.some((row) => row.join(':') === 'eq:status:archived'));
  const stale = weeklyDb({ missing: true });
  await assert.rejects(deleteArchivedWeeklyContent(stale, 'test'), /no longer available/);
});
test('legacy CSS must not hide the weekly and gallery submission lists', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.evidence-shell\s+\.stat-review-list\s*\{\s*display\s*:\s*none/);
});
