import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/views/Quartermaster.tsx', import.meta.url), 'utf8');

test('puts duty, ration and forage in a compact group above money management', () => {
  const group = page.indexOf('className="qm-money-desk"');
  const forage = page.indexOf('className="qm-forage-feature qm-forage-compact"');
  const dailyOrders = page.indexOf('id="qm-daily-orders"');
  const duty = page.indexOf('<h3>Report for duty</h3>');
  const ration = page.indexOf('🪙 Daily Ration');

  assert.ok(group > 0);
  assert.ok(dailyOrders < duty);
  assert.ok(duty < group);
  assert.ok(ration < group);
  assert.ok(forage < group);
  assert.match(page, /className="qm-quick-actions"/);
  assert.ok(page.indexOf('id="qm-bank"', group) > group);
  assert.ok(page.indexOf('id="qm-billet"', group) > group);
  assert.ok(page.indexOf('title="Send Shillings"', group) > group);
});

test('renders only one working copy of each money action', () => {
  assert.equal(page.match(/id="qm-bank"/g)?.length, 1);
  assert.equal(page.match(/id="qm-billet"/g)?.length, 1);
  assert.equal(page.match(/title="Send Shillings"/g)?.length, 1);
});
