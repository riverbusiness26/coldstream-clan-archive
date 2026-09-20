import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/views/Quartermaster.tsx', import.meta.url), 'utf8');
const profile = await readFile(new URL('../src/components/QuartermasterBillet.tsx', import.meta.url), 'utf8');

test('the Shillings navigation uses the approved desk and profile names', () => {
  assert.match(page, /label: "Quartermaster's Desk"/);
  assert.match(page, /label: 'Your Profile'/);
  assert.doesNotMatch(page, /label: 'Your Billet'/);
});

test('the unreleased linebattle card system is absent from member profiles', () => {
  for (const copy of ['Featured cards', 'Campaign collection', 'Linebattle record', 'Your favorite line', 'formation builder']) {
    assert.ok(!profile.includes(copy), copy);
  }
  assert.match(profile, /Profile display/);
  assert.match(profile, /Badges on record/);
});
