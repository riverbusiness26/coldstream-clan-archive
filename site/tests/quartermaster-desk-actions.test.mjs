import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/views/Quartermaster.tsx', import.meta.url), 'utf8');

test('keeps the main money actions together near the top of the Quartermaster desk', () => {
  const group = page.indexOf('className="qm-money-desk"');
  const forage = page.indexOf('className="qm-forage-feature"');
  const dailyOrders = page.indexOf('id="qm-daily-orders"');

  assert.ok(group > 0);
  assert.ok(group < forage);
  assert.ok(group < dailyOrders);
  assert.ok(page.indexOf('id="qm-bank"', group) > group);
  assert.ok(page.indexOf('id="qm-billet"', group) > group);
  assert.ok(page.indexOf('title="Send Shillings"', group) > group);
});

test('renders only one working copy of each money action', () => {
  assert.equal(page.match(/id="qm-bank"/g)?.length, 1);
  assert.equal(page.match(/id="qm-billet"/g)?.length, 1);
  assert.equal(page.match(/title="Send Shillings"/g)?.length, 1);
});
