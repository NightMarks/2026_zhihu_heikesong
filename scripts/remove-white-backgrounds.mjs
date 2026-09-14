import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export function removeConnectedLightBackground(pixels, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = [];
  const isLight = index => {
    const p = index * 4;
    const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2], a = pixels[p + 3];
    return a > 0 && Math.min(r, g, b) >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 28;
  };
  const enqueue = index => {
    if (index < 0 || index >= width * height || seen[index] || !isLight(index)) return;
    seen[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    pixels[index * 4 + 3] = 0;
    const x = index % width;
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    enqueue(index - width);
    enqueue(index + width);
  }
  // The photographed background can also appear as a fully enclosed gap
  // (for example between two figures). Remove only near-pure neutral white
  // there, preserving the warmer/off-white highlights on the object itself.
  for (let index = 0; index < width * height; index += 1) {
    const p = index * 4;
    const channels = [pixels[p], pixels[p + 1], pixels[p + 2]];
    if (Math.min(...channels) >= 247 && Math.max(...channels) - Math.min(...channels) <= 12) {
      pixels[p + 3] = 0;
    }
  }
  return pixels;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }));
  return nested.flat();
}

export async function processAssets(sourceDir, publicDir) {
  const files = (await walk(sourceDir)).filter(file => /\.(?:jpe?g|png)$/i.test(file) && path.basename(file) !== 'sandboard.jpg');
  for (const source of files) {
    const relative = path.relative(sourceDir, source);
    const destination = path.join(publicDir, relative.replace(/\.(?:jpe?g|png)$/i, '.webp'));
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeConnectedLightBackground(data, info.width, info.height);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await sharp(data, { raw: info }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(destination);
  }
  return files.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const count = await processAssets(path.join(repo, 'images'), path.join(repo, 'public', 'images'));
  console.log(`Prepared ${count} transparent web assets.`);
}
