import { describe, expect, it } from 'vitest';
import { hitTestDimension, type DimensionHitTarget } from './dimensionHitTest';

describe('画布尺寸选择', () => {
  const targets: DimensionHitTarget[] = [
    { ownerId: 'main', kind: 'length', from: { x: 100, y: 100 }, to: { x: 500, y: 100 }, label: { x: 260, y: 45, width: 80, height: 30 } },
    { ownerId: 'spec-two', kind: 'width', from: { x: 600, y: 700 }, to: { x: 700, y: 750 }, label: { x: 610, y: 765, width: 80, height: 30 } },
  ];
  it('点击文字或斜线都返回对应规格和尺寸，而空白不命中', () => {
    expect(hitTestDimension({ x: 280, y: 60 }, targets, 8)).toMatchObject({ ownerId: 'main', kind: 'length', part: 'label' });
    expect(hitTestDimension({ x: 650, y: 780 }, targets, 8)).toMatchObject({ ownerId: 'spec-two', kind: 'width' });
    expect(hitTestDimension({ x: 650, y: 729 }, targets, 8)).toMatchObject({ ownerId: 'spec-two', kind: 'width', part: 'line' });
    expect(hitTestDimension({ x: 550, y: 600 }, targets, 8)).toBeUndefined();
  });
  it('文字与其他尺寸线重叠时优先选择文字，且不命中延长线', () => {
    const overlapping: DimensionHitTarget = { ...targets[1], from: { x: 200, y: 60 }, to: { x: 400, y: 60 } };
    expect(hitTestDimension({ x: 280, y: 60 }, [targets[0], overlapping], 8)?.ownerId).toBe('main');
    expect(hitTestDimension({ x: 550, y: 100 }, targets, 8)).toBeUndefined();
  });
});
