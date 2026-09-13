import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function moduleAt(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const { enlistmentDecisionError, reviewRegimentEnlistment } = await moduleAt('../src/lib/enlistmentAdmin.ts');

test('a denial cannot be saved without the private staff reason', () => {
  assert.match(enlistmentDecisionError('denied', ''), /reason/);
  assert.equal(enlistmentDecisionError('accepted', ''), null);
  assert.match(enlistmentDecisionError('denied', 'x'.repeat(1001)), /1,000/);
});

test('staff review uses the guarded RPC and normalizes the reason', async () => {
  const calls = [];
  const db = { rpc: async (name, args) => { calls.push([name, args]); return { data: 'application-id', error: null }; } };
  assert.equal(await reviewRegimentEnlistment(db, 'application-id', 'denied', '  Not a fit yet.  '), 'application-id');
  assert.deepEqual(calls, [['review_regiment_enlistment', { target_application: 'application-id', decision: 'denied', staff_reason: 'Not a fit yet.' }]]);
});

test('failed and stale review calls are never reported as success', async () => {
  await assert.rejects(reviewRegimentEnlistment({ rpc: async () => ({ data: null, error: { message: 'Denied' } }) }, 'id', 'accepted', ''), /Denied/);
  await assert.rejects(reviewRegimentEnlistment({ rpc: async () => ({ data: null, error: null }) }, 'id', 'accepted', ''), /changed/);
});

test('migration keeps decisions and Discord work in one database transaction', async () => {
  const sql = await readFile(new URL('../db/0057_regiment_enlistment.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function review_regiment_enlistment/);
  assert.match(sql, /for update/);
  assert.match(sql, /insert into discord_enlistment_action/);
  assert.match(sql, /a denial reason is required/);
  assert.match(sql, /revoke update on enlistment from authenticated/);
  assert.match(sql, /where processed_at is null/);
});

test('Admin Panel exposes the enlistment review inbox', async () => {
  const admin = await readFile(new URL('../src/views/Admin.tsx', import.meta.url), 'utf8');
  assert.match(admin, /EnlistmentReview/);
  assert.match(admin, /Regiment applications/);
  assert.match(admin, /reviewRegimentEnlistment/);
});
