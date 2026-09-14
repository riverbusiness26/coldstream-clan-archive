import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const built = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/quartermasterMotion.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const { actionFeedback } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const previous = [{ id: 1, type: 'duty', purseDelta: 14 }];
const result = { snapshot: { ledger: [{ id: 3, type: 'transfer', purseDelta: 70 }, { id: 2, type: 'duty', purseDelta: 12 }, ...previous] } };
test('duty feedback uses only new duty ledger rewards, not unrelated balance changes', () => {
  assert.deepEqual(actionFeedback('duty', previous, result), { title: 'Duty complete', earned: 12 });
});
test('replayed receipts never celebrate a second payout', () => {
  assert.equal(actionFeedback('duty', previous, { ...result, replayed: true }), null);
});
test('purchases and game actions do not invent earned Shillings', () => {
  for (const action of ['buy', 'anchor', 'vingt', 'forage']) assert.equal(actionFeedback(action, previous, result).earned, 0);
});
