export function hasTransparency(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return true;
  return false;
}

// Only the outside border is used to recognize a white studio background.
// White areas inside the product are preserved by the cutout path or model.
export function hasWhiteBackground(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  let white = 0, samples = 0;
  function sample(x: number, y: number) {
    const i = (y * width + x) * 4;
    const low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (low >= 240 && high - low <= 12) white++;
    samples++;
  }
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { sample(0, y); sample(width - 1, y); }
  return samples > 0 && white / samples >= 0.85;
}

export function cutoutAlpha(probability: number): number {
  const alpha = Math.round(255 * probability);
  // Eliminate almost invisible haze so it cannot expand the product bounds.
  return alpha <= 8 ? 0 : alpha >= 247 ? 255 : alpha;
}
