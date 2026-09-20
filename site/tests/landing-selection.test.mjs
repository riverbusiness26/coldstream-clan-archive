import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const landing = readFileSync(new URL('../src/views/Landing.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/components/SiteShell.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/landing-redesign.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('landing is fixed to the approved full photograph layout', () => {
  assert.match(landing, /className="hq-landing landing-layout-panorama"/);
  assert.doesNotMatch(landing, /Landing study|Quiet split|Compact banner|setLayout|useState/);
  assert.match(landing, /landing-coldstream-formation-v1\.jpg/);
});

test('supplied Coldstream photograph is included as a real site asset', () => {
  const image = new URL('../public/museum/landing-coldstream-formation-v1.jpg', import.meta.url);
  assert.ok(statSync(image).size > 100_000);
});

test('local review chrome is absent from normal site pages', () => {
  assert.doesNotMatch(shell, /Local design preview|Local design review|Draft for review|design-review-nav/);
  assert.doesNotMatch(css, /landing-design-options|design-review-nav|hq-preview-note/);
  assert.match(app, /const localPreview = import\.meta\.env\.DEV && demo/);
  assert.doesNotMatch(app, /<SiteShell[^>]+demo=/);
  assert.doesNotMatch(app, /<Landing[^>]+preview=/);
});
