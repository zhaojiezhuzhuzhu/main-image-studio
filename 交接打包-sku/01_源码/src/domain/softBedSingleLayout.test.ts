import { describe, expect, it } from 'vitest';
import { DEFAULT_SOFT_BED_OPTIONS, formatSoftBedModel, getSoftBedSingleLayout, parseSoftBedDimensions, softBedDimensionIssue, softBedDimensionLabel, softBedModelBadge } from './softBedSingleLayout';
import { getSofaSingleLayout } from './sofaSingleLayout';

const fields = { length: '223', width: '', height: '118', headWidth: '168/198', footWidth: '183/193' };
const options = { ...DEFAULT_SOFT_BED_OPTIONS, sizeLabels: ['1.5m床', '1.8m床'] as [string, string] };
const context = { font: '', measureText(text: string) { return { width: text.length * parseFloat(this.font) * .6 } as TextMetrics; } };

describe('软床单品第5页规范', () => {
  it('独立布局与固定卖点框高、间距，不改变沙发布局', () => {
    const bed = getSoftBedSingleLayout([350, 400, 350]);
    expect(bed.sellingPoints.map((box) => box.height)).toEqual([98, 98, 98]);
    expect(bed.sellingPoints[0].y).toBe(1262);
    expect(bed.sellingPoints[1].x - bed.sellingPoints[0].x - bed.sellingPoints[0].width).toBe(30);
    expect(bed.subjectSafeArea.y + bed.subjectSafeArea.height).toBe(1202);
    const narrowGap = getSoftBedSingleLayout([0, 0, 0], 1);
    expect(narrowGap.subjectSafeArea.y + narrowGap.subjectSafeArea.height).toBe(1237);
    expect(getSoftBedSingleLayout([400, 400]).sellingPoints).toHaveLength(2);
    expect(getSoftBedSingleLayout([900, 100, 100]).issue).toBeNull();
    expect(getSoftBedSingleLayout([800, 800, 800]).issue).toContain('排骨架名称须保留完整');
    expect(getSofaSingleLayout([0, 0, 0]).modelBadge).toEqual({ x: 70, y: 270, height: 78 });
  });
  it('型号简写床、长型号35pt，普通45pt', () => {
    expect(formatSoftBedModel('BC553-A')).toBe('BC553-A床');
    expect(formatSoftBedModel('BC553-A床')).toBe('BC553-A床');
    expect(softBedModelBadge(context, 'BC553-A').fontSize).toBe(45);
    expect(softBedModelBadge(context, 'BC553-ABCDEFGHIJKLMN').fontSize).toBe(35);
  });
  it('数字45pt、斜线30pt、规格说明37pt，并纳入文字避让区域', () => {
    const label = softBedDimensionLabel(context, { kind: 'headWidth', label: '床头宽', value: 168, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, fields, options);
    expect(label.height).toBe(90);
    expect(label.runs.filter((run) => run.text.endsWith('cm')).map((run) => run.font)).toEqual([expect.stringContaining('45px'), expect.stringContaining('45px')]);
    expect(label.runs.find((run) => run.text === ' / ')!.font).toContain('30px');
    expect(label.runs.find((run) => run.text === '(1.5m床)')!.font).toContain('37px');
  });
  it('四项尺寸及双规格截断、无效和缺项输入禁止导出', () => {
    expect(parseSoftBedDimensions('223.99×168.99/198.99×183.99/193.99×118.99cm')).toEqual({ length: '223.9', headWidth: '168.9/198.9', footWidth: '183.9/193.9', height: '118.9', width: '' });
    expect(parseSoftBedDimensions('223×168/×183×118')).toBeNull();
    expect(softBedDimensionIssue(fields, options)).toBeNull();
    expect(softBedDimensionIssue({ ...fields, headWidth: '168/' }, options)).toContain('床头宽尺寸无效');
    expect(softBedDimensionIssue({ ...fields, footWidth: '' }, options)).toContain('请填写床尾宽');
    expect(softBedDimensionIssue(fields, DEFAULT_SOFT_BED_OPTIONS)).toContain('规格说明');
    expect(softBedDimensionIssue({ ...fields, footWidth: '183' }, options)).toContain('同时填写');
  });
});
