import { describe, expect, it, vi } from 'vitest';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { BEDSIDE_CABINET_QUANTITY_BADGE, bedsideCabinetDimensionIssue, bedsideCabinetModelBadge, getBedsideCabinetSingleLayout, normalizeBedsideCabinetOptions, parseBedsideCabinetDimensions, type BedsideCabinetDraft } from './bedsideCabinetSingleLayout';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { bedsideCabinetSingleRules as rules } from '../templates/bedside-cabinet-single';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
// 所有尺寸和卖点都是测试参数，不表示素材的真实产品资料。
const fields = { length: '50.99', width: '45.09', height: '55.88' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 55.8, from: { x: 388, y: 560 }, to: { x: 388, y: 1016 } };

describe('软体床头柜：第9页独立规则', () => {
  it('长宽高均截断一位小数，只接收单个真实尺寸', () => {
    expect(parseBedsideCabinetDimensions('50.99×45.09×55.88cm')).toEqual({ length: '50.9', width: '45', height: '55.8' });
    expect(bedsideCabinetDimensionIssue(fields)).toBeNull();
    for (const value of ['', '0', '-1', 'abc', '50/60', '50~60']) {
      expect(parseBedsideCabinetDimensions(`${value}×45×55`)).toBeNull();
      expect(bedsideCabinetDimensionIssue({ ...fields, length: value })).not.toBeNull();
    }
    const label = rules.dimensionLabel(context, annotation, fields, rules.createOptions());
    expect(label.runs).toHaveLength(1);
    expect(label.runs[0]).toMatchObject({ text: '55.8cm' });
    expect(label.runs[0].font).toContain('45px');
  });

  it('45号型号居中，保留手动名称，不因数量改写或缩小', () => {
    const layout = getBedsideCabinetSingleLayout([150, 200, 250]);
    const badge = bedsideCabinetModelBadge(context, '手动型号及规格', layout);
    expect(badge.text).toBe('手动型号及规格');
    expect(badge.fontSize).toBe(45);
    expect(badge.box.x + badge.box.width / 2).toBe(720);
    expect(badge.box.y).toBe(378);
    expect(badge.issue).toBeNull();
    expect(bedsideCabinetModelBadge(context, '完整型号及规格'.repeat(20), layout).issue).toContain('超出安全区');
    expect(bedsideCabinetModelBadge(context, '型号\n规格', layout).issue).toContain('一行');
  });

  it('数量切换保留产品位置，移动缩放后标注整体避让x2及卖点', () => {
    const one = rules.createOptions(), two = { ...one, quantity: 2 as const };
    const layout = rules.layout([150, 200, 250], one);
    expect(rules.layout([150, 200, 250], two)).toEqual(layout);
    const labelSize = rules.dimensionLabel(context, annotation, fields, two);
    const fit = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fit.productRect, fit.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 800, offsetY: 800 });
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(BEDSIDE_CABINET_QUANTITY_BADGE.x - 30);
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(layout.sellingPoints[0].y - 62 + .001);
    expect(moved.bounds.y).toBeGreaterThanOrEqual(layout.modelBadge.y + layout.modelBadge.height + 50 - .001);
  });

  it('单件不绘数量，双件绘独立100px圆标、60号白色x2并使用不同文件名', () => {
    const drawing = { beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn(), font: '', fillStyle: '', textAlign: '', textBaseline: '' };
    const one = rules.createOptions(), two = { ...one, quantity: 2 as const };
    const layout = rules.layout([], one);
    rules.drawExtras!(drawing as unknown as CanvasRenderingContext2D, one, layout);
    expect(drawing.fillText).not.toHaveBeenCalled();
    rules.drawExtras!(drawing as unknown as CanvasRenderingContext2D, two, layout);
    expect(drawing.roundRect).toHaveBeenCalledWith(1055, 722, 100, 100, 100);
    expect(drawing.fillText).toHaveBeenCalledWith('x2', 1105, 772);
    expect(drawing.font).toContain('60px');
    expect(drawing.fillStyle).toBe('#ffffff');
    expect(rules.exportFileName!('手动名称', one)).toBe('手动名称-单件-SKU.jpg');
    expect(rules.exportFileName!('手动名称', two)).toBe('手动名称-双件x2-SKU.jpg');
  });

  it('三个与特殊两个卖点始终保持固定框高间距，过宽明确拦截', () => {
    for (const widths of [[200, 250, 280], [200, 280]]) {
      const layout = getBedsideCabinetSingleLayout(widths);
      expect(layout.issue).toBeNull();
      layout.sellingPoints.forEach((box, index) => {
        expect(box.height).toBe(98);
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 50);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
      });
    }
    const layout = getBedsideCabinetSingleLayout([800, 800, 800]);
    expect(rules.sellingPointIssue([800, 800, 800], layout)).toContain('超出');
    const points = ['测试卖点一', '测试卖点二', '测试卖点三'];
    expect(rules.visibleSellingPoints(points, { ...rules.createOptions(), sellingPointCount: 2 })).toEqual(points.slice(0, 2));
    expect(points).toHaveLength(3);
  });

  it('仅保存自己的数量和卖点选项，恢复缺失或非法值使用独立默认', () => {
    const options = { ...rules.createOptions(), quantity: 2 as const, sellingPointCount: 2 as const };
    const saved = rules.saveOptions(options);
    expect(saved).toEqual({ bedsideCabinet: { quantity: 2, sellingPointCount: 2 } });
    expect(rules.restoreOptions(saved as BedsideCabinetDraft)).toEqual(options);
    expect(rules.hasOptions(options)).toBe(true);
    expect(rules.hasOptions(rules.createOptions())).toBe(false);
    for (const value of [undefined, null, 'invalid', { quantity: 3, sellingPointCount: 1 }]) {
      expect(normalizeBedsideCabinetOptions(value)).toEqual(rules.createOptions());
    }
    const first = rules.createOptions(), second = rules.createOptions();
    first.sizeLabels[0] = '独立对象';
    expect(second.sizeLabels).toEqual(['', '']);
    expect(rules.productionNotes.sourcePages).toContain('9');
  });
});
