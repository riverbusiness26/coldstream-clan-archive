import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scene = await readFile(new URL('../src/lib/shillingScene.ts', import.meta.url), 'utf8');
const coin = await readFile(new URL('../src/components/ShillingCoin.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/views/Quartermaster.tsx', import.meta.url), 'utf8');

test('the hero coin continuously turns when atmosphere motion is enabled', () => {
  assert.match(scene, /setMotion/);
  assert.match(scene, /coin\.rotation\.y \+= elapsed/);
  assert.match(page, /<ShillingCoin motion=\{motionOn\}/);
});

test('coin motion stops for reduced-motion and when atmosphere is paused', () => {
  assert.match(coin, /prefers-reduced-motion: reduce/);
  assert.match(coin, /motion && !reduced/);
  assert.match(scene, /cancelAnimationFrame/);
  assert.match(scene, /visibilityState/);
});
