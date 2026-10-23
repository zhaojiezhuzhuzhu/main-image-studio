import { describe, expect, it } from 'vitest';
import { completeDimension, nextDimension, updateAnnotationValues } from './dimensionAnnotations';

const dimensions = { length: 120, width: 230, height: 59 };

describe('continuous dimensions', () => {
  it('直径独立于长宽标注，修改直径不移动端点或改变高度', () => {
    const fields = { diameter: 81.6, height: 75 };
    const diameter = completeDimension([], fields, { x: 0, y: .2 }, { x: 1, y: .6 }, 'diameter');
    expect(diameter[0]).toMatchObject({ label: '直径', value: 81.6 });
    expect(nextDimension(fields, diameter)).toMatchObject({ kind: 'height', value: 75 });
    const both = completeDimension(diameter, fields, { x: 0, y: .3 }, { x: 0, y: 1 }, 'height');
    const updated = updateAnnotationValues(both, { ...fields, diameter: 91.6 });
    expect(updated[0]).toEqual({ ...diameter[0], value: 91.6 });
    expect(updated[1]).toEqual(both[1]);
    expect(nextDimension(fields, updated)).toBeNull();
  });
  it('床头床尾可独立标注、更新和重标', () => {
    const fields = { headWidth: 168, footWidth: 183 };
    const head = completeDimension([], fields, { x: 0, y: 0 }, { x: 1, y: 0 }, 'headWidth');
    expect(head[0]).toMatchObject({ label: '床头宽', value: 168 });
    expect(nextDimension(fields, head)).toMatchObject({ kind: 'footWidth', label: '床尾宽' });
    const both = completeDimension(head, fields, { x: 0, y: 1 }, { x: 1, y: 1 }, 'footWidth');
    const changed = updateAnnotationValues(both, { headWidth: 198, footWidth: 193 });
    expect(changed.map((item) => item.value)).toEqual([198, 193]);
    expect(changed[0].from).toBe(head[0].from);
  });
  it('advances from length to width to height', () => {
    expect(nextDimension(dimensions, [])).toEqual({ kind: 'length', value: 120, label: '长' });
    const one = completeDimension([], dimensions, { x: 1, y: 2 }, { x: 3, y: 4 });
    expect(nextDimension(dimensions, one)).toEqual({ kind: 'width', value: 230, label: '宽' });
    const two = completeDimension(one, dimensions, { x: 5, y: 6 }, { x: 7, y: 8 });
    expect(nextDimension(dimensions, two)).toEqual({ kind: 'height', value: 59, label: '高' });
  });

  it('preserves previous annotations when completing the next', () => {
    const one = completeDimension([], dimensions, { x: 1, y: 2 }, { x: 3, y: 4 });
    const two = completeDimension(one, dimensions, { x: 5, y: 6 }, { x: 7, y: 8 });
    expect(two).toHaveLength(2);
    expect(two[0].value).toBe(120);
    expect(two[1].value).toBe(230);
  });

  it('updates dimension text without changing annotation endpoints', () => {
    const one = completeDimension([], dimensions, { x: 1, y: 2 }, { x: 3, y: 4 });
    const updated = updateAnnotationValues(one, { length: 999 });
    expect(updated[0]).toEqual({ ...one[0], value: 999 });
    expect(updated[0].from).toBe(one[0].from);
    expect(updated[0].to).toBe(one[0].to);
  });

  it('replaces only the requested dimension annotation', () => {
    const one = completeDimension([], dimensions, { x: 1, y: 2 }, { x: 3, y: 4 });
    const two = completeDimension(one, dimensions, { x: 5, y: 6 }, { x: 7, y: 8 });
    const replaced = completeDimension(two, dimensions, { x: 20, y: 30 }, { x: 40, y: 50 }, 'length');
    expect(replaced).toHaveLength(2);
    expect(replaced[0]).toMatchObject({ kind: 'length', from: { x: 20, y: 30 }, to: { x: 40, y: 50 } });
    expect(replaced[1]).toBe(two[1]);
  });

  it('finds the first missing dimension by kind instead of annotation count', () => {
    const widthOnly = completeDimension([], dimensions, { x: 5, y: 6 }, { x: 7, y: 8 }, 'width');
    expect(nextDimension(dimensions, widthOnly)).toEqual({ kind: 'length', value: 120, label: '长' });
  });
});
