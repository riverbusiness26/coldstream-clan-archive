import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partitionMedals } from '../src/lib/medalVisibility.ts';

const compactLimit = 8;
const medals = (count = 20) => Array.from({ length: count }, (_, index) => ({
  id: `medal-${index + 1}`, item_kind: 'medal', removed_at: null, display_on_profile: true,
}));
const expanded = (partition) => [...partition.visible, ...partition.overflow];

test('selected profile component uses the verified eight-medal compact limit', () => {
  const source = readFileSync(new URL('../src/components/ProfileDisplayCase.tsx', import.meta.url), 'utf8');
  assert.match(source, /const COMPACT_MEDAL_LIMIT = 8;/);
  assert.match(source, /partitionMedals\(rows, COMPACT_MEDAL_LIMIT\)/);
  assert.match(source, /forcePreview \|\| !supa/);
});

test('twenty medals start at eight and expand to all twenty in their original order', () => {
  const rows = medals();
  const parts = partitionMedals(rows, compactLimit);
  assert.equal(parts.visible.length, 8);
  assert.equal(parts.overflow.length, 12);
  assert.deepEqual(expanded(parts), rows);
});

test('hiding a compact medal fills its place and does not leak it into the expanded display', () => {
  const rows = medals();
  rows[2].display_on_profile = false;
  const parts = partitionMedals(rows, compactLimit);
  assert.equal(parts.visible.length, 8);
  assert.equal(parts.overflow.length, 11);
  assert.equal(parts.hidden.length, 1);
  assert.equal(parts.visible[7].id, 'medal-9');
  assert.ok(expanded(parts).every(row => row.id !== 'medal-3'));
});

test('hiding an overflow medal keeps it out of both compact and expanded displays', () => {
  const rows = medals();
  rows[18].display_on_profile = false;
  const parts = partitionMedals(rows, compactLimit);
  assert.equal(expanded(parts).length, 19);
  assert.equal(parts.hidden[0].id, 'medal-19');
  assert.ok(expanded(parts).every(row => row.id !== 'medal-19'));
});

test('showing a hidden medal restores the collection without modifying the award record', () => {
  const rows = medals();
  const hidden = rows.map(row => row.id === 'medal-3' ? { ...row, display_on_profile: false } : row);
  const shown = hidden.map(row => row.id === 'medal-3' ? { ...row, display_on_profile: true } : row);
  assert.equal(expanded(partitionMedals(hidden, compactLimit)).length, 19);
  assert.deepEqual(expanded(partitionMedals(shown, compactLimit)), rows);
  assert.equal(hidden[2].removed_at, null);
});

test('an entirely hidden collection remains available only in hidden award records', () => {
  const rows = medals().map(row => ({ ...row, display_on_profile: false }));
  const parts = partitionMedals(rows, compactLimit);
  assert.equal(expanded(parts).length, 0);
  assert.deepEqual(parts.hidden, rows);
});

test('unavailable preferences and historical awards never enter the display', () => {
  const rows = medals();
  rows[0].display_on_profile = null;
  rows[1].removed_at = '2026-09-12T17:00:00Z';
  rows.push({ id: 'current-rank', item_kind: 'rank', removed_at: null, display_on_profile: true });
  const parts = partitionMedals(rows, compactLimit);
  assert.equal(expanded(parts).length, 18);
  assert.deepEqual(parts.unknown.map(row => row.id), ['medal-1']);
  assert.deepEqual(parts.historical.map(row => row.id), ['medal-2']);
  assert.ok(expanded(parts).every(row => !['current-rank', 'medal-1', 'medal-2'].includes(row.id)));
});

test('a large collection has no display cap and partitioning does not mutate the records', () => {
  const rows = Object.freeze(medals(250).map(row => Object.freeze(row)));
  const parts = partitionMedals(rows, compactLimit);
  assert.equal(parts.visible.length, 8);
  assert.equal(parts.overflow.length, 242);
  assert.deepEqual(expanded(parts), rows);
});
