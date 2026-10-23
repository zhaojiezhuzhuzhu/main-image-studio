import { describe, expect, it } from 'vitest';
import { cutoutAlpha, hasTransparency, hasWhiteBackground } from './whiteBackground';

describe('白底图片识别', () => {
  it('只根据外围判断白底，保留产品内部的白色、浅色区域', () => {
    const pixels = new Uint8ClampedArray(4 * 5 * 5).fill(255);
    pixels.set([233, 228, 219, 255], (2 * 5 + 2) * 4);
    expect(hasWhiteBackground(pixels, 5, 5)).toBe(true);
    expect(hasTransparency(pixels)).toBe(false);
    pixels[3] = 128;
    expect(hasTransparency(pixels)).toBe(true);
  });
  it('不把有色背景当白底，也不只凭文件扩展名判断', () => {
    const pixels = new Uint8ClampedArray(4 * 5 * 5);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([245, 180, 180, 255], i);
    expect(hasWhiteBackground(pixels, 5, 5)).toBe(false);
    expect(hasTransparency(pixels)).toBe(false);
  });
  it('清除近透明残影，保留柔和边缘和不透明主体', () => {
    expect(cutoutAlpha(0.02)).toBe(0);
    expect(cutoutAlpha(0.5)).toBe(128);
    expect(cutoutAlpha(0.98)).toBe(255);
  });
});
