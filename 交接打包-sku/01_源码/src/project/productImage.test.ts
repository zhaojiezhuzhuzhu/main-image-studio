// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { productImageFromBlob } from './productImage';
import { removeBackground } from './removeBackground';
import { photoshopCutout } from './photoshopCutout';
import * as whiteBackground from './whiteBackground';

vi.mock('./removeBackground', () => ({ removeBackground: vi.fn() }));
vi.mock('./photoshopCutout', () => ({ photoshopCutout: vi.fn() }));
let pixels: Uint8ClampedArray;
let imageWidth = 4, imageHeight = 4;
beforeEach(() => {
  imageWidth = 4; imageHeight = 4;
  pixels = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  vi.stubGlobal('Image', class {
    width = imageWidth; height = imageHeight;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:test');
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage() {}, getImageData: () => ({ data: pixels }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

it('6667×5000 的餐桌 JPG 不因旧像素上限被挡住，原文件完整交给 PS', async () => {
  imageWidth = 6667; imageHeight = 5000;
  vi.spyOn(whiteBackground, 'hasWhiteBackground').mockReturnValue(true);
  const original = new Blob(['jpg with paths'], { type: 'image/jpeg' });
  const png = new Blob(['png'], { type: 'image/png' });
  vi.mocked(photoshopCutout).mockImplementationOnce(async () => {
    imageWidth = 4; imageHeight = 4; pixels[3] = 0;
    return png;
  });
  const result = await productImageFromBlob(original, 'TZ4R-A-1.6米长餐桌 (4).jpg', { removeWhiteBackground: true });
  expect(photoshopCutout).toHaveBeenCalledExactlyOnceWith(original, undefined);
  expect(result.blob).toBe(png);
});

it('超出大图内存保护范围时，在调用 PS 前给出明确尺寸提示', async () => {
  imageWidth = 10000; imageHeight = 10000;
  await expect(productImageFromBlob(new Blob(['jpg'], { type: 'image/jpeg' }), 'large.jpg', { removeWhiteBackground: true })).rejects.toThrow('6400 万像素');
  expect(photoshopCutout).not.toHaveBeenCalled();
});

it('白底 JPG 和不透明 PNG 自动抠图，保存真实 PNG 和同名文件', async () => {
  for (const type of ['image/jpeg', 'image/png']) {
    pixels.fill(255);
    const png = new Blob(['transparent'], { type: 'image/png' });
    vi.mocked(photoshopCutout).mockImplementationOnce(async () => { pixels[3] = 0; return png; });
    const original = new Blob(['white with embedded path'], { type });
    const result = await productImageFromBlob(original, 'YF2A-B床.jpg', { removeWhiteBackground: true });
    expect(photoshopCutout).toHaveBeenLastCalledWith(original, undefined);
    expect(result.blob).toBe(png);
    expect(result.name).toBe('YF2A-B床.png');
  }
  expect(photoshopCutout).toHaveBeenCalledTimes(2);
  expect(removeBackground).not.toHaveBeenCalled();
});

it('透明素材直接使用，已有源文件恢复与细节图片不运行模型', async () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  pixels[3] = 0;
  expect((await productImageFromBlob(blob, '原图.png', { removeWhiteBackground: true })).blob).toBe(blob);
  pixels.fill(255);
  expect((await productImageFromBlob(blob, '旧项目.png')).blob).toBe(blob);
  await productImageFromBlob(blob, '细节.png', { removeWhiteBackground: false });
  expect(removeBackground).not.toHaveBeenCalled();
  expect(photoshopCutout).not.toHaveBeenCalled();
});

it('不支持的格式、非白底图片和取消导入不能启动抠图', async () => {
  await expect(productImageFromBlob(new Blob(['gif'], { type: 'image/gif' }), 'test.gif', { removeWhiteBackground: true })).rejects.toThrow('PNG');
  pixels.fill(100);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const blob = new Blob(['jpg'], { type: 'image/jpeg' });
  await expect(productImageFromBlob(blob, 'test.jpg', { removeWhiteBackground: true })).rejects.toThrow('白底');
  const controller = new AbortController(); controller.abort();
  await expect(productImageFromBlob(blob, 'test.jpg', { removeWhiteBackground: true, signal: controller.signal })).rejects.toThrow('已取消');
  expect(removeBackground).not.toHaveBeenCalled();
  expect(photoshopCutout).not.toHaveBeenCalled();
});

it('模型方案保留为显式内部对比入口，不静默替代 PS 结果', async () => {
  const png = new Blob(['result'], { type: 'image/png' });
  vi.mocked(removeBackground).mockImplementationOnce(async () => { pixels[3] = 0; return png; });
  await productImageFromBlob(new Blob(['jpg'], { type: 'image/jpeg' }), 'bed.jpg', { removeWhiteBackground: true, engine: 'model' });
  expect(removeBackground).toHaveBeenCalledOnce();
  expect(photoshopCutout).not.toHaveBeenCalled();
});
