import { describe, expect, it } from 'vitest';
import { getDimensionStyleGeometry } from './dimensionStyle';

describe('尺寸标注像素规范', () => {
  it('延长两端辅助线时保持主线、箭头及虚线间隔，支持正负方向', () => {
    const base = getDimensionStyleGeometry({ x: 100, y: 200 }, { x: 600, y: 200 }, 'diameter');
    const extended = getDimensionStyleGeometry({ x: 100, y: 200 }, { x: 600, y: 200 }, 'diameter', undefined, { from: 120, to: -80 });
    expect(extended.line).toEqual(base.line); expect(extended.arrows).toEqual(base.arrows);
    expect(extended.extensions[0].at(-1)!.to.y).toBe(320);
    expect(extended.extensions[1][0].from.y).toBe(120);
    for (const segments of extended.extensions) for (let i = 0; i < segments.length; i++) {
      expect(segments[i].to.y - segments[i].from.y).toBeLessThanOrEqual(6);
      if (i) expect(segments[i].from.y - segments[i - 1].to.y).toBe(3);
    }
  });
  it('uses 2px lines, 15x9px arrows, and a 1px tip gap', () => {
    const geometry = getDimensionStyleGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 'length');

    expect(geometry.lineWidth).toBe(2);
    expect(geometry.color).toBe('#545454');
    expect(geometry.line).toEqual({ from: { x: 1, y: 0 }, to: { x: 99, y: 0 } });
    expect(geometry.arrows[1].tip).toEqual({ x: 99, y: 0 });
    expect(geometry.arrows[1].baseCenter).toEqual({ x: 84, y: 0 });
    expect(geometry.arrows[1].corners).toEqual([{ x: 84, y: 4.5 }, { x: 84, y: -4.5 }]);
  });

  it('creates five perpendicular 6px dashes separated by 3px gaps', () => {
    const geometry = getDimensionStyleGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 'width');
    const endExtension = geometry.extensions[1];

    expect(endExtension).toHaveLength(5);
    expect(endExtension).toEqual([
      { from: { x: 100, y: -21 }, to: { x: 100, y: -15 } },
      { from: { x: 100, y: -12 }, to: { x: 100, y: -6 } },
      { from: { x: 100, y: -3 }, to: { x: 100, y: 3 } },
      { from: { x: 100, y: 6 }, to: { x: 100, y: 12 } },
      { from: { x: 100, y: 15 }, to: { x: 100, y: 21 } },
    ]);
  });

  it('keeps length and width extension dashes vertical for inclined lines', () => {
    const length = getDimensionStyleGeometry({ x: 10, y: 20 }, { x: 100, y: 80 }, 'length');
    const width = getDimensionStyleGeometry({ x: 10, y: 20 }, { x: 100, y: 80 }, 'width');

    expect(length.extensions[1][0]).toEqual({ from: { x: 100, y: 59 }, to: { x: 100, y: 65 } });
    expect(width.extensions[1][0]).toEqual({ from: { x: 100, y: 59 }, to: { x: 100, y: 65 } });
  });

  it('keeps height extension dashes horizontal for inclined lines', () => {
    const geometry = getDimensionStyleGeometry({ x: 10, y: 20 }, { x: 100, y: 80 }, 'height');

    expect(geometry.extensions[1][0]).toEqual({ from: { x: 79, y: 80 }, to: { x: 85, y: 80 } });
  });
});
