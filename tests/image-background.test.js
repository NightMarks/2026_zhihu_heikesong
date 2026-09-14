import test from 'node:test';
import assert from 'node:assert/strict';
import { removeConnectedLightBackground } from '../scripts/remove-white-backgrounds.mjs';

test('removes connected light background and enclosed pure-white gaps', () => {
  const width = 7;
  const height = 7;
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) pixels.set([250, 250, 250, 255], i * 4);
  for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) {
    pixels.set([40, 30, 20, 255], (y * width + x) * 4);
  }
  pixels.set([250, 250, 250, 255], (3 * width + 3) * 4);
  pixels.set([240, 240, 240, 255], (2 * width + 2) * 4);

  removeConnectedLightBackground(pixels, width, height);

  assert.equal(pixels[3], 0);
  assert.equal(pixels[(3 * width + 3) * 4 + 3], 0, 'pure-white interior gap should be transparent');
  assert.equal(pixels[(2 * width + 2) * 4 + 3], 255, 'off-white object highlight must remain opaque');
  assert.equal(pixels[(5 * width + 5) * 4 + 3], 255);
});
