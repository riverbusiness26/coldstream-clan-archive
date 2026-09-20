import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = new URL('../../', import.meta.url);
const { items } = JSON.parse(await readFile(new URL('docs/living-hq/shillings-shop-art.json', root)));
const catalogue = JSON.parse(await readFile(new URL('../src/quartermaster-data/seed.json', import.meta.url))).items;
const component = await readFile(new URL('../src/components/QuartermasterItemArt.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/quartermaster-world.css', import.meta.url), 'utf8');

test('every shop item has a unique mapped original illustration', async () => {
  assert.deepEqual(items.map(i => i.slug).sort(), catalogue.map(i => i.slug).sort());
  const hashes = new Set();
  for (const item of items) {
    assert.ok(component.includes(item.slug + ": 'shop/" + item.slug + "-v1'"), item.slug);
    const bytes = await readFile(new URL(item.output, root));
    hashes.add(createHash('sha256').update(bytes).digest('hex'));
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 960, item.slug);
    assert.equal(meta.height, 960, item.slug);
    assert.equal(meta.hasAlpha, true, item.slug);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
    // Resampling can leave a single alpha level at an otherwise transparent corner.
    for (const [x,y] of [[0,0],[959,0],[0,959],[959,959]]) assert.ok(alpha(x,y) <= 1, item.slug + ' corner');
    if (item.slug.startsWith('frame_')) assert.equal(alpha(480,480), 0, item.slug + ' aperture');
  }
  assert.equal(hashes.size, catalogue.length, 'no shared placeholders');
});

test('shop art uses bounded contain boxes and intrinsic image dimensions', () => {
  assert.match(component, /width="960" height="960"/);
  assert.match(css, /\.qm-page \.qm-shop-grid \.qm-product-art > \.qm-item-art\s*\{[^}]*position: absolute;[^}]*inset: 36px 20px 26px;/);
  assert.match(css, /object-fit: contain/);
  assert.ok(css.includes('.qm-dialog[open] > .qm-item-art'));
});
