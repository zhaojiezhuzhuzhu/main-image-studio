import { describe, expect, it } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import {
  adjustAnnotatedProduct,
  adjustAnnotatedProductAroundObstacles,
  annotatedProductCollisionRects,
  fitAnnotatedProduct,
  pointFromProduct,
  pointHitsProductSilhouette,
  pointRelativeToProduct,
  silhouetteFromAlpha,
} from './annotatedProductFit';

const annotation = (
  kind: DimensionAnnotation['kind'],
  value: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): DimensionAnnotation => ({ kind, value, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', from, to });

describe('产品与尺寸标注联合适配', () => {
  it('把越界的产品和全部标注等比例缩放到主体安全区内', () => {
    const product = { x: 100, y: 430, width: 1200, height: 620 };
    const safeArea = { x: 70, y: 398, width: 1300, height: 734 };
    const annotations = [
      { annotation: annotation('length', 240, { x: 20, y: 360 }, { x: 1390, y: 350 }), labelSize: { width: 160, height: 50 } },
      { annotation: annotation('width', 88, { x: 40, y: 400 }, { x: 35, y: 1110 }), labelSize: { width: 130, height: 50 } },
      { annotation: annotation('height', 100, { x: 100, y: 1070 }, { x: 520, y: 1260 }), labelSize: { width: 150, height: 50 } },
    ];

    const result = fitAnnotatedProduct(product, annotations, safeArea);

    expect(result.scale).toBeLessThan(1);
    expect(result.bounds.x).toBeGreaterThanOrEqual(safeArea.x - 0.01);
    expect(result.bounds.y).toBeGreaterThanOrEqual(safeArea.y - 0.01);
    expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(safeArea.x + safeArea.width + 0.01);
    expect(result.bounds.y + result.bounds.height).toBeLessThanOrEqual(safeArea.y + safeArea.height + 0.01);
    expect(result.productRect.width / result.productRect.height).toBeCloseTo(product.width / product.height);

    const originalRelativeX = (annotations[0].annotation.from.x - product.x) / product.width;
    const fittedRelativeX = (result.annotations[0].from.x - result.productRect.x) / result.productRect.width;
    expect(fittedRelativeX).toBeCloseTo(originalRelativeX);
  });

  it('用产品相对坐标保存端点，使缩放后的端点仍绑定产品', () => {
    const originalProduct = { x: 200, y: 300, width: 800, height: 400 };
    const relative = pointRelativeToProduct({ x: 400, y: 500 }, originalProduct);

    expect(relative).toEqual({ x: 0.25, y: 0.5 });
    expect(pointFromProduct(relative, { x: 100, y: 200, width: 400, height: 200 })).toEqual({ x: 200, y: 300 });
  });

  it('moves the product and confirmed annotations as one group', () => {
    const product = { x: 300, y: 500, width: 600, height: 300 };
    const measured = [{
      annotation: annotation('length', 240, { x: 300, y: 460 }, { x: 900, y: 460 }),
      labelSize: { width: 150, height: 46 },
    }];
    const safeArea = { x: 70, y: 398, width: 1300, height: 734 };

    const result = adjustAnnotatedProduct(product, measured, safeArea, { scale: 1, offsetX: 80, offsetY: 40 });

    expect(result.productRect).toEqual({ x: 380, y: 540, width: 600, height: 300 });
    expect(result.annotations[0].from).toEqual({ x: 380, y: 500 });
    expect(result.annotations[0].to).toEqual({ x: 980, y: 500 });
  });

  it('scales product geometry uniformly while keeping the annotation bound to it', () => {
    const product = { x: 300, y: 500, width: 600, height: 300 };
    const measured = [{
      annotation: annotation('width', 88, { x: 300, y: 500 }, { x: 600, y: 800 }),
      labelSize: { width: 120, height: 46 },
    }];
    const safeArea = { x: 0, y: 0, width: 2000, height: 2000 };

    const result = adjustAnnotatedProduct(product, measured, safeArea, { scale: 0.5, offsetX: 0, offsetY: 0 });

    expect(result.productRect).toEqual({ x: 300, y: 500, width: 300, height: 150 });
    expect(result.productRect.width / result.productRect.height).toBe(2);
    expect(result.annotations[0].from).toEqual({ x: 300, y: 500 });
    expect(result.annotations[0].to).toEqual({ x: 450, y: 650 });
  });

  it('clamps movement and enlargement so the complete visual group stays in the safe area', () => {
    const product = { x: 300, y: 500, width: 600, height: 300 };
    const measured = [{
      annotation: annotation('height', 100, { x: 300, y: 500 }, { x: 900, y: 500 }),
      labelSize: { width: 150, height: 46 },
    }];
    const safeArea = { x: 70, y: 398, width: 900, height: 600 };

    const result = adjustAnnotatedProduct(product, measured, safeArea, { scale: 2, offsetX: 900, offsetY: 900 });

    expect(result.adjustment.scale).toBeLessThan(2);
    expect(result.bounds.x).toBeGreaterThanOrEqual(safeArea.x - 0.01);
    expect(result.bounds.y).toBeGreaterThanOrEqual(safeArea.y - 0.01);
    expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(safeArea.x + safeArea.width + 0.01);
    expect(result.bounds.y + result.bounds.height).toBeLessThanOrEqual(safeArea.y + safeArea.height + 0.01);
  });

  it('allows enlargement into free space and shifts the complete group away from neighboring content', () => {
    const product = { x: 300, y: 420, width: 700, height: 280 };
    const measured = [
      { annotation: annotation('length', 240, { x: 300, y: 370 }, { x: 1000, y: 370 }), labelSize: { width: 150, height: 46 } },
      { annotation: annotation('width', 88, { x: 270, y: 420 }, { x: 270, y: 700 }), labelSize: { width: 120, height: 46 } },
    ];
    const safeArea = { x: 70, y: 250, width: 1300, height: 1020 };
    const neighboringContent = [{ x: 830, y: 780, width: 480, height: 190 }];

    const result = adjustAnnotatedProductAroundObstacles(
      product,
      measured,
      safeArea,
      neighboringContent,
      20,
      { scale: 1.25, offsetX: 0, offsetY: 0 },
    );

    expect(result.adjustment.scale).toBeCloseTo(1.25);
    expect(result.bounds.x).toBeGreaterThanOrEqual(safeArea.x - .01);
    expect(result.bounds.y).toBeGreaterThanOrEqual(safeArea.y - .01);
    expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(safeArea.x + safeArea.width + .01);
    expect(result.bounds.y + result.bounds.height).toBeLessThanOrEqual(safeArea.y + safeArea.height + .01);
    const expandedObstacle = { x: 810, y: 760, width: 520, height: 230 };
    const collisionRects = annotatedProductCollisionRects(
      result.productRect,
      result.annotations.map((resultAnnotation, index) => ({ annotation: resultAnnotation, labelSize: measured[index].labelSize })),
    );
    expect(collisionRects.some((rect) => rect.x < expandedObstacle.x + expandedObstacle.width
      && rect.x + rect.width > expandedObstacle.x
      && rect.y < expandedObstacle.y + expandedObstacle.height
      && rect.y + rect.height > expandedObstacle.y)).toBe(false);
  });

  it('does not treat transparent parts of an irregular PNG rectangle as occupied content', () => {
    const pixels = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 4; x += 1) pixels[(y * 10 + x) * 4 + 3] = 255;
    }
    const silhouette = silhouetteFromAlpha(pixels, 10, 10, { x: 0, y: 0, width: 10, height: 10 }, 5);
    const product = { x: 100, y: 100, width: 500, height: 300 };
    const obstacleInTransparentArea = { x: 430, y: 150, width: 100, height: 100 };

    const result = adjustAnnotatedProductAroundObstacles(
      product,
      [],
      { x: 0, y: 0, width: 1000, height: 800 },
      [obstacleInTransparentArea],
      20,
      { scale: 1, offsetX: 0, offsetY: 0 },
      silhouette,
    );

    expect(result.adjustment).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
    expect(result.constrained).toBe(false);
  });

  it('selects only the visible silhouette when clicking an irregular PNG', () => {
    const silhouette = [{ top: 0, bottom: 1, left: 0, right: .4 }];
    const product = { x: 100, y: 200, width: 500, height: 300 };

    expect(pointHitsProductSilhouette({ x: 250, y: 350 }, product, silhouette)).toBe(true);
    expect(pointHitsProductSilhouette({ x: 500, y: 350 }, product, silhouette)).toBe(false);
    expect(pointHitsProductSilhouette({ x: 50, y: 350 }, product, silhouette)).toBe(false);
  });
});
