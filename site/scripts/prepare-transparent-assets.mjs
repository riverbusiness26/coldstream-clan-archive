import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(process.cwd(), '..');
const publicDir = path.join(process.cwd(), 'public');
const sourceDir = 'C:\\Users\\thegr\\Desktop\\NEW WEB REDESIGN';

const source = {
  podiums: path.join(sourceDir, 'Codex Image Sep 6, 2026, 03_44_43 PM.png'),
  ornaments: path.join(sourceDir, 'Codex Image Sep 6, 2026, 07_10_55 PM.png'),
  board: path.join(sourceDir, 'exec-344eb056-a10c-4341-b3e0-be298c7e23a2.png'),
  crests: path.join(sourceDir, 'exec-e13edb0f-227a-411a-8037-e53975818ecd.png'),
  frame: path.join(sourceDir, 'exec-f97bf50e-aa77-4edf-b738-d8b3041ec4ed.png'),
  eventIcons: path.join(process.cwd(), 'public', 'event-type-icons.png'),
  mobilePanels: path.join(process.cwd(), 'public', 'mobile-cloth-crops.png'),
};

async function removeConnectedBackground(input, output, threshold = 110) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const { width, height, channels } = info;
  const pixelCount = width * height;
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const corners = [0, width - 1, (height - 1) * width, pixelCount - 1];
  const br = corners.reduce((sum, i) => sum + data[i * channels], 0) / corners.length;
  const bg = corners.reduce((sum, i) => sum + data[i * channels + 1], 0) / corners.length;
  const bb = corners.reduce((sum, i) => sum + data[i * channels + 2], 0) / corners.length;
  const isBackgroundLike = (index) => {
    const offset = index * channels;
    const dr = data[offset] - br;
    const dg = data[offset + 1] - bg;
    const db = data[offset + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= threshold;
  };
  const enqueue = (index) => {
    if (index < 0 || index >= pixelCount || background[index] || !isBackgroundLike(index)) return;
    background[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index + width < pixelCount) enqueue(index + width);
  }
  for (let index = 0; index < pixelCount; index += 1) {
    if (background[index]) data[index * channels + 3] = 0;
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9, palette: false }).toFile(output);
}

async function crop(input, output, left, top, width, height, threshold = 46) {
  const buffer = await sharp(input).extract({ left, top, width, height }).png().toBuffer();
  const temp = `${output}.tmp.png`;
  await removeConnectedBackground(buffer, temp, threshold);
  await sharp(temp).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png({ compressionLevel: 9, palette: false }).toFile(output);
  await fs.unlink(temp);
}

async function removeDarkNeutral(input, output, maxBrightness = 72, maxChroma = 15) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < maxBrightness && max - min < maxChroma) data[offset + 3] = 0;
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9, palette: false }).toFile(output);
}

// The plaque source is a full rectangular artwork, but only the hardware
// around the opening belongs on the site. Keep the frame and lower name rail,
// remove the black outer corners, and make the central opening genuinely
// transparent so the video supplies its own pixels.
async function extractVideoFrame(input, output) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const { width, height, channels } = info;
  const inner = { left: 126, top: 98, right: 1546, bottom: 748 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const insideOpening = x >= inner.left && x <= inner.right && y >= inner.top && y <= inner.bottom;
      const insideArtwork = x >= 26 && x <= width - 28 && y >= 25 && y <= height - 28;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const chroma = max - min;
      const keep = insideArtwork && !insideOpening && (max > 48 || chroma > 14);
      data[i + 3] = keep ? Math.min(255, Math.max(0, Math.round((max - 28) * 3 + chroma * 3))) : 0;
    }
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9, palette: false }).toFile(output);
}

async function cropEvent(input, output, left, top, width, height) {
  const temp = `${output}.event.png`;
  await crop(input, temp, left, top, width, height, 70);
  const cleaned = `${output}.clean.png`;
  await removeDarkNeutral(temp, cleaned);
  await sharp(cleaned).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png({ compressionLevel: 9, palette: false }).toFile(output);
  await fs.unlink(temp);
  await fs.unlink(cleaned);
}

await fs.mkdir(publicDir, { recursive: true });

// Keep the original sheet geometry for the existing CSS sprites, but make the
// cloth outside every object genuinely transparent.
await removeConnectedBackground(source.podiums, path.join(publicDir, 'leaderboard-podiums-transparent.png'));
await removeConnectedBackground(source.ornaments, path.join(publicDir, 'brass-ornaments-transparent.png'));
await removeConnectedBackground(source.board, path.join(publicDir, 'rank-medal-board-transparent.png'), 120);
await removeConnectedBackground(source.crests, path.join(publicDir, 'detachments-crest-sheet-transparent.png'), 120);
await extractVideoFrame(source.frame, path.join(publicDir, 'plaque-frame-transparent.png'));

// Individual high-resolution cuts are useful for cards and mobile layouts.
await crop(source.podiums, path.join(publicDir, 'leaderboard-second.png'), 120, 120, 510, 650);
await crop(source.podiums, path.join(publicDir, 'leaderboard-first.png'), 650, 100, 520, 680);
await crop(source.podiums, path.join(publicDir, 'leaderboard-third.png'), 1220, 120, 520, 650);
await crop(source.crests, path.join(publicDir, 'detachment-line-infantry.png'), 55, 35, 535, 585, 52);
await crop(source.crests, path.join(publicDir, 'detachment-grenadiers.png'), 650, 35, 535, 585, 52);
await crop(source.crests, path.join(publicDir, 'detachment-artillery.png'), 55, 650, 535, 585, 52);
await crop(source.crests, path.join(publicDir, 'detachment-skirmishers.png'), 650, 650, 535, 585, 52);

// Event emblems and mobile panel variants are kept as individually addressable
// transparent assets so each surface can size its artwork without sprite bleed.
await cropEvent(source.eventIcons, path.join(publicDir, 'event-public.png'), 55, 105, 530, 610);
await cropEvent(source.eventIcons, path.join(publicDir, 'event-linebattle.png'), 590, 95, 640, 640);
await cropEvent(source.eventIcons, path.join(publicDir, 'event-competitive.png'), 1215, 105, 545, 620);
await removeConnectedBackground(source.mobilePanels, path.join(publicDir, 'mobile-cloth-crops-transparent.png'), 92);
await crop(source.mobilePanels, path.join(publicDir, 'mobile-phone-left.png'), 25, 112, 180, 1239, 92);
await crop(source.mobilePanels, path.join(publicDir, 'mobile-phone-center.png'), 222, 112, 350, 1239, 92);
await crop(source.mobilePanels, path.join(publicDir, 'mobile-phone-right.png'), 588, 112, 420, 1239, 92);

console.log('Prepared transparent assets in', publicDir);
