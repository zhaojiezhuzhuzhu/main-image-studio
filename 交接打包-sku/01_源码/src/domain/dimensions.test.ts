import { describe, expect, it } from 'vitest';
import {
  dimensionFieldsFromDimensions,
  dimensionsFromFields,
  formatDimensionFields,
  parseDimensions,
  parseDimensionText,
  parseDimensionFields,
} from './dimensions';

describe('parseDimensions', () => {
  it('parses a combined length-width-height value', () => {
    expect(parseDimensions('120×230×59cm')).toEqual({ length: 120, width: 230, height: 59 });
  });

  it('rejects a combined value with a missing dimension', () => {
    expect(parseDimensions('120×230cm')).toBeNull();
  });

  it('synchronizes a valid quick size into the three individual fields', () => {
    expect(dimensionFieldsFromDimensions({ length: 240, width: 88, height: 100 })).toEqual({
      length: '240', width: '88', height: '100',
    });
  });

  it('parses individual fields independently and formats their combined value', () => {
    const fields = { length: '240', width: '88.5', height: '100' };
    expect(dimensionsFromFields(fields)).toEqual({ length: 240, width: 88.5, height: 100 });
    expect(formatDimensionFields(fields)).toBe('240×88.5×100');
  });
});

describe('新模板尺寸兼容', () => {
  it('启用中文说明时保留完整标注，并取有效尺寸首值用于几何', () => {
    expect(parseDimensionText('尺寸可选：140.99/160.99cm', 'truncate', true)).toEqual({ value: 140.9, text: '尺寸可选：140.9/160.9' });
    expect(parseDimensionText('约 80～85 厘米（可调）', 'truncate', true)).toEqual({ value: 80, text: '约80~85（可调）' });
    expect(parseDimensionFields('尺寸可选：140/160×80/85×约75cm', 'truncate', true)).toEqual({ length: '尺寸可选：140/160', width: '80/85', height: '约75' });
    expect(dimensionsFromFields({ length: '尺寸可选140/160', width: '80/85', height: '75（含脚垫）' }, 'truncate', true)).toEqual({ length: 140, width: 80, height: 75 });
    expect(parseDimensionText('尺寸可选：140/160', 'truncate')).toBeNull();
    expect(parseDimensionFields('尺寸可选：140/160×80×75')).toBeNull();
    for (const value of ['尺寸可选', '约0', '约-1', '约0.01', '可选140/', '可选140//160', '约140/0', '约140abc', '约Infinity']) expect(parseDimensionText(value, 'truncate', true)).toBeNull();
  });

  it('直径范围首值供几何使用，不产生空白长宽的数值', () => {
    expect(dimensionsFromFields({ length: '', width: '', height: '75.99', diameter: '81.69~130/91.6~150' }, 'truncate'))
      .toEqual({ height: 75.9, diameter: 81.6 });
    expect(dimensionFieldsFromDimensions({ length: 0, width: 0, height: 75, diameter: 81.6 }).diameter).toBe('81.6');
  });
  it('可选床头床尾宽度保持旧数据形状', () => {
    expect(dimensionsFromFields({ length: '223', width: '', height: '118', headWidth: '168/198', footWidth: '183/193' }, 'truncate'))
      .toEqual({ length: 223, height: 118, headWidth: 168, footWidth: 183 });
    expect(dimensionFieldsFromDimensions({ length: 223, width: 198, height: 118, headWidth: 198, footWidth: 193 }).headWidth).toBe('198');
  });
  it('范围及并列规格保留文本，首值供几何使用，支持降序范围', () => {
    expect(parseDimensionText('100.99～196.89cm', 'truncate')).toEqual({ value: 100.9, text: '100.9~196.8' });
    expect(parseDimensionText('95~54', 'truncate')).toEqual({ value: 95, text: '95~54' });
    expect(parseDimensionText('168.99 / 198.99', 'truncate')).toEqual({ value: 168.9, text: '168.9/198.9' });
    expect(parseDimensionText('168.99')).toEqual({ value: 169, text: '169' });
    expect(parseDimensionFields('100~196×95~54×88.99cm', 'truncate')).toEqual({ length: '100~196', width: '95~54', height: '88.9' });
    for (const value of ['0', '0.01', '-1', '1~', '1//2', '1/0', 'abc', 'Infinity']) expect(parseDimensionText(value, 'truncate')).toBeNull();
  });
});
