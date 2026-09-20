import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { items } = JSON.parse(await readFile(path.join(root, 'docs/living-hq/shillings-shop-art.json'), 'utf8'));
for (const item of items) {
  const destination = path.join(root, item.output);
  await mkdir(path.dirname(destination), { recursive: true });
  await sharp(item.source).resize(960, 960, {
    fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(destination);
  console.log(item.slug);
}
