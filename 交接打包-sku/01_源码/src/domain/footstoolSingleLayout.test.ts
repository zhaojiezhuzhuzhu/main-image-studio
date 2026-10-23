import { describe, expect, it } from 'vitest';
import { footstoolDimensionIssue, formatFootstoolModel, getFootstoolSingleLayout, parseFootstoolDimensions } from './footstoolSingleLayout';
import { footstoolSingleRules as rules } from '../templates/footstool-single';
import { validateSingleWorkbench } from './workbenchValidation';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { resolveModelOnUpload } from './modelFromFilename';

const fields = { length: '75', width: '65.5', height: '40' };
const annotation: DimensionAnnotation = { kind: 'width', label: '宽', value: 65.59, from: { x: 0, y: 1 }, to: { x: .5, y: 1.2 } };
const context = { font: '', measureText(text: string) { return { width: text.length * parseFloat(this.font) * .6, actualBoundingBoxAscent: 36, actualBoundingBoxDescent: 10 } as TextMetrics; } };

describe('脚踏第2、3、15、16、18页规范', () => {
  it('保留完整规格，只有缺少脚踏字眼时才追加', () => {
    expect(formatFootstoolModel(' PS060-A1 ')).toBe('PS060-A1脚踏');
    expect(formatFootstoolModel('PS060-A1大号脚踏（75×65.5）')).toBe('PS060-A1大号脚踏（75×65.5）');
    expect(resolveModelOnUpload('', false, 'PS060-A1-透明素材-大号脚踏.png', rules.filenameName)).toBe('PS060-A1 大号脚踏');
    expect(resolveModelOnUpload('', true, 'PS060-A1-透明素材.png', rules.filenameName)).toBe('');
    const badge = rules.modelBadge(context, 'PS060-A1', getFootstoolSingleLayout());
    expect(badge).toMatchObject({ text: 'PS060-A1脚踏', fontSize: 60, box: { x: 70, y: 250, height: 74 }, issue: null });
    const longBadge = rules.modelBadge(context, 'PS060-A1超长完整规格'.repeat(5), getFootstoolSingleLayout());
    expect(longBadge.fontSize).toBe(60);
    expect(longBadge.issue).toContain('顶部安全区');
  });

  it('三尺寸以cm截断一位，不接受缺项、多项、范围、并列或非正数', () => {
    expect(parseFootstoolDimensions('75.99×65.59×40.09cm')).toEqual({ length: '75.9', width: '65.5', height: '40' });
    expect(parseFootstoolDimensions('75cm X 65.5厘米 x 40')).toEqual(fields);
    for (const input of ['75×65.5', '75×65.5×40×10', '75/80×65.5×40', '75×65~70×40', '75×0×40', '75×-2×40', '75×NaN×40']) expect(parseFootstoolDimensions(input)).toBeNull();
    expect(footstoolDimensionIssue(fields)).toBeNull();
    expect(footstoolDimensionIssue({ ...fields, height: '' })).toContain('请填写脚踏高');
    expect(footstoolDimensionIssue({ ...fields, width: '65/70' })).toContain('脚踏宽尺寸无效');
    const label = rules.dimensionLabel(context, annotation, { ...fields, width: '65.59' }, rules.createOptions());
    expect(label.runs).toEqual([{ text: '65.5cm', font: '46px Montserrat, Arial, sans-serif', x: 0, y: 0 }]);
    expect(rules.formatFields(fields)).toBe('75×65.5×40');
  });

  it('主体安全区避开顶部活动区、型号和底部固定备注', () => {
    const layout = getFootstoolSingleLayout();
    const area = layout.subjectSafeArea;
    expect(layout.productArea.x).toBeGreaterThanOrEqual(area.x);
    expect(layout.productArea.y).toBeGreaterThan(area.y);
    expect(layout.productArea.x + layout.productArea.width).toBeLessThanOrEqual(area.x + area.width);
    expect(layout.productArea.y + layout.productArea.height).toBeLessThanOrEqual(area.y + area.height);
    expect(area.y).toBeGreaterThan(348);
    expect(area.y).toBeGreaterThan(layout.modelBadge.y + layout.modelBadge.height);
    const note = typeof rules.note === 'function' ? rules.note(rules.createOptions(), layout) : rules.note;
    expect(area.y + area.height).toBeLessThan(note!.y - 40);
    expect(rules.note).toEqual({ text: '*实际尺寸请以下单规格为准', font: '40px "方正兰亭准黑_GBK", sans-serif', color: '#545454', x: 70, y: 1376 });
    expect(rules.requiredFonts).toEqual(['Montserrat', '方正兰亭准黑_GBK']);
    expect(rules.lineStyle.color).toBe('#545454');
  });

  it('隐藏旧源文件卖点，选项独立且不写其他品类字段', () => {
    const first = rules.createOptions(), second = rules.createOptions();
    first.sizeLabels[0] = '旧规格';
    expect(second.sizeLabels).toEqual(['', '']);
    expect(rules.saveOptions(first)).toEqual({});
    expect(rules.hasOptions(first)).toBe(false);
    expect(rules.visibleSellingPoints(['旧卖点一', '旧卖点二', '旧卖点三'], first)).toEqual([]);
    expect(rules.layout([200, 300, 400], first).sellingPoints).toEqual([]);
    expect(rules.sellingPointIssue([10000], getFootstoolSingleLayout())).toBeNull();
  });

  it('全部三尺寸和标注完成才可导出，无卖点不产生阻止或警告', () => {
    const options = rules.createOptions();
    expect(rules.exportIssues(fields, '75×65.5×40', options, null)).toEqual([]);
    expect(rules.exportIssues({ ...fields, length: '' }, '', options, null)).toContain('请填写脚踏长尺寸');
    expect(rules.exportIssues(fields, '75×65.5', options, null)).toContain('快速尺寸无效，请按脚踏长×宽×高填写');
    expect(rules.exportIssues(fields, '', options, '型号过长')).toContain('型号过长');
    const annotations: DimensionAnnotation[] = [{ ...annotation, kind: 'length', label: '长', value: 75 }, annotation, { ...annotation, kind: 'height', label: '高', value: 40 }];
    const input = { model: 'PS060-A1脚踏', hasImage: true, dimensionFields: fields, annotations, annotationInProgress: false, sellingPoints: rules.visibleSellingPoints(['旧卖点'], options) };
    expect(validateSingleWorkbench(input)).toMatchObject({ blockers: [], warnings: [] });
    expect(validateSingleWorkbench({ ...input, annotations: annotations.slice(0, 2) }).blockers).toContain('请完成已填写尺寸的标注：高');
  });
});
