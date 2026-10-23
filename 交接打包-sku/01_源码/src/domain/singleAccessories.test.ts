import { expect, it, vi } from 'vitest';
import { adjustAccessoryProduct, drawAccessoryScenes, getAccessoryScenes, pointInAccessoryClip } from './singleAccessories';
import type { ProductImage } from '../project/productImage';
import type { SingleAccessorySlot } from '../templates/types';

const image = { element: {}, visible: { x: 0, y: 0, width: 800, height: 400 } } as ProductImage;
const slot: SingleAccessorySlot = { id: 'detail', label: '细节', area: { x: 200, y: 300, width: 200, height: 200 }, fit: 'cover', clipRadius: 28 };
const item = { id: 'detail', image, adjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('细节图等比例填满卡片，普通配件仍完整放入区域', () => {
  const [cover] = getAccessoryScenes([slot], [item]);
  expect(cover.productRect).toEqual({ x: 100, y: 300, width: 400, height: 200 });
  const [contain] = getAccessoryScenes([{ ...slot, fit: undefined, clipRadius: undefined }], [item]);
  expect(contain.productRect).toEqual({ x: 200, y: 350, width: 200, height: 100 });
});

it('过度平移及缩小在松手后回到满铺范围，取景不露出卡片外空白', () => {
  const [scene] = getAccessoryScenes([slot], [item]);
  for (const request of [{ scale: .2, offsetX: 999, offsetY: -999 }, { scale: 2, offsetX: -999, offsetY: 999 }, { scale: 99, offsetX: 0, offsetY: 0 }]) {
    const result = adjustAccessoryProduct(scene.base, slot, request);
    expect(result.adjustment.scale).toBeGreaterThanOrEqual(1);
    expect(result.adjustment.scale).toBeLessThanOrEqual(5);
    expect(result.productRect.x).toBeLessThanOrEqual(200);
    expect(result.productRect.y).toBeLessThanOrEqual(300);
    expect(result.productRect.x + result.productRect.width).toBeGreaterThanOrEqual(400);
    expect(result.productRect.y + result.productRect.height).toBeGreaterThanOrEqual(500);
  }
  const requested = { scale: 2, offsetX: -80, offsetY: -40 };
  expect(adjustAccessoryProduct(scene.base, slot, requested).adjustment).toEqual(requested);
});

it('越界拖动只生成预览，不改变保存值；卡片外和圆角外不命中', () => {
  const request = { scale: .5, offsetX: -1000, offsetY: -1000 };
  const [preview] = getAccessoryScenes([slot], [item], { id: item.id, adjustment: request });
  expect(preview.adjustment).toEqual(request);
  expect(item.adjustment).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  expect(pointInAccessoryClip({ x: 201, y: 301 }, slot)).toBe(false);
  expect(pointInAccessoryClip({ x: 199, y: 400 }, slot)).toBe(false);
  expect(pointInAccessoryClip({ x: 202, y: 400 }, slot)).toBe(true);
});

it('每张卡片独立圆角裁切并恢复画布，后续普通素材不被裁切', () => {
  const events: string[] = [];
  const context = { save: () => events.push('save'), restore: () => events.push('restore'), beginPath: vi.fn(), roundRect: vi.fn(), clip: () => events.push('clip'), drawImage: () => events.push('image') };
  const plain = { ...slot, id: 'plain', fit: undefined, clipRadius: undefined };
  drawAccessoryScenes(context as unknown as CanvasRenderingContext2D, getAccessoryScenes([slot, plain], [item, { ...item, id: 'plain' }]));
  expect(events).toEqual(['save', 'clip', 'image', 'restore', 'image']);
  expect(context.roundRect).toHaveBeenCalledWith(200, 300, 200, 200, 28);
});
