import { describe, expect, it, vi } from 'vitest';
import { adjustAnnotatedProduct, annotationCollisionRects, fitAnnotatedProduct } from './annotatedProductFit';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { drawRoundTableCombinationChair, formatRoundTableCombinationFields, getRoundExtendableTableCombinationLayout, normalizeRoundTableCombinationOptions, parseRoundTableCombinationDimensions, roundTableCombinationChairBadge, roundTableCombinationDimensionIssue, roundTableCombinationDimensionLabel, roundTableCombinationModelBadge, roundTableCombinationNote, roundTableCombinationTextIssues } from './roundExtendableTableCombinationLayout';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, character) => sum + (/[^\x00-\x7f]/.test(character) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
// 以下数值仅为解析与布局测试参数，不代表实物尺寸。
const fields = { length: '', width: '', diameter: '90.99~140.99/100.99~160.99', height: '74.99' };
const annotation: DimensionAnnotation = { kind: 'diameter', label: '直径', value: 90.9, from: { x: 420, y: 560 }, to: { x: 1020, y: 720 } };
const options = normalizeRoundTableCombinationOptions({ diningChairs: { models: ['测试餐椅完整型号'] } });

describe('圆伸缩餐桌组合：第39页独立规范', () => {
  it('直径及高独立解析，支持伸缩范围、多规格并截断1位，不生成长宽值', () => {
    expect(parseRoundTableCombinationDimensions('90.99～140.99/100.99~160.99cm×74.99厘米')).toEqual({ length: '', width: '', diameter: '90.9~140.9/100.9~160.9', height: '74.9' });
    expect(parseRoundTableCombinationDimensions('100.99×74.99')).toEqual({ length: '', width: '', diameter: '100.9', height: '74.9' });
    expect(parseRoundTableCombinationDimensions('90/100×74/75')).toEqual({ length: '', width: '', diameter: '90/100', height: '74/75' });
    expect(formatRoundTableCombinationFields(fields)).toBe('90.99~140.99/100.99~160.99×74.99');
    for (const invalid of ['', '0×75', '-90×75', '140~90×75', '90~110~140×75', '90/×75', '90×75×110', '90×74~75', '90/100×74/75/76']) expect(parseRoundTableCombinationDimensions(invalid), invalid).toBeNull();
    expect(roundTableCombinationDimensionIssue({ ...fields, diameter: '' })).toContain('直径');
    expect(roundTableCombinationDimensionIssue({ ...fields, height: '' })).toContain('高度');
    expect(roundTableCombinationDimensionIssue({ ...fields, height: '74/75/76' })).toContain('逐项对应');
  });

  it('P39桌面直径白字白线，切换外置深色后不改数值，高度始终深色', () => {
    const surface = roundTableCombinationDimensionLabel(context, annotation, fields, options);
    const outside = roundTableCombinationDimensionLabel(context, annotation, fields, { ...options, diameterPlacement: 'outside' });
    expect(surface).toMatchObject({ color: '#ffffff', lineColor: '#ffffff' });
    expect(outside.color).toBeUndefined();
    expect(outside.lineColor).toBeUndefined();
    expect(outside.runs).toEqual(surface.runs);
    expect(surface.runs.every((run) => run.font.startsWith('35px '))).toBe(true);
    const height = roundTableCombinationDimensionLabel(context, { ...annotation, kind: 'height', label: '高' }, fields, { ...options, heightNote: '测试说明' });
    expect(height.color).toBeUndefined();
    expect(height.lineColor).toBeUndefined();
    expect(height.runs.map((run) => run.text)).toEqual(['74.9cm', '（测试说明）']);
  });

  it('长尺寸折行保留全部规格、单位和说明，文字真实边界纳入拖动范围', () => {
    const many = { ...fields, diameter: '90.99~140.99/100.99~160.99/110.99~180.99' };
    const label = roundTableCombinationDimensionLabel(context, annotation, many, options);
    expect(label.runs.length).toBeGreaterThan(1);
    expect(label.runs.map((run) => run.text).join('').replace(/\s/g, '')).toBe('90.9~140.9cm/100.9~160.9cm/110.9~180.9cm');
    expect(label.width).toBeLessThanOrEqual(660);
    const metricContext = { font: '', textBaseline: 'alphabetic' as CanvasTextBaseline, measureText(text: string) { return { width: text.length * 25, actualBoundingBoxAscent: 24, actualBoundingBoxDescent: 18 } as TextMetrics; } };
    expect(roundTableCombinationDimensionLabel(metricContext, annotation, { ...fields, diameter: '90' }, options).height).toBe(48);
    expect(metricContext.textBaseline).toBe('alphabetic');
    const selected = { ...options, diameterPlacement: 'outside' as const, heightNote: '测试说明\n测试第二行' };
    const layout = getRoundExtendableTableCombinationLayout([200, 200, 200]);
    const outside = { ...annotation, from: { x: 420, y: 480 }, to: { x: 1050, y: 480 } };
    const measured = [{ annotation: outside, labelSize: roundTableCombinationDimensionLabel(context, outside, many, selected) }];
    const fitted = fitAnnotatedProduct(layout.productArea, measured, layout.subjectSafeArea);
    const adjusted = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize: measured[0].labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 800, offsetY: 800 });
    for (const item of adjusted.annotations) for (const box of annotationCollisionRects({ annotation: item, labelSize: measured[0].labelSize }, adjusted.productRect)) {
      expect(box.x).toBeGreaterThanOrEqual(29.99);
      expect(box.y).toBeGreaterThanOrEqual(431.99);
      expect(box.x + box.width).toBeLessThanOrEqual(1410.01);
      expect(box.y + box.height).toBeLessThanOrEqual(1090.01);
    }
  });

  it('餐桌与餐椅完整型号独立蓝标，右下椅标按35pt实测文字扩宽且不裁字', () => {
    const layout = getRoundExtendableTableCombinationLayout([200, 200, 200]);
    const table = roundTableCombinationModelBadge(context, '测试餐桌 完整规格', layout);
    const chair = roundTableCombinationChairBadge(context, options);
    expect(table).toMatchObject({ text: '测试餐桌 完整规格', fontSize: 35, box: { x: 70, y: 350, height: 52 }, issue: null });
    expect(chair).toMatchObject({ text: '测试餐椅完整型号', box: { y: 1120, height: 52 }, issue: null });
    expect(chair.box.x + chair.box.width).toBe(1346);
    const longer = roundTableCombinationChairBadge(context, { ...options, diningChairs: { ...options.diningChairs, models: ['测试餐椅完整型号附加规格', ''] } });
    expect(longer.box.width).toBeGreaterThan(chair.box.width);
    expect(longer.box.x + longer.box.width).toBe(1346);
    const drawing = { ...context, beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as unknown as CanvasRenderingContext2D;
    drawRoundTableCombinationChair(drawing, options);
    expect(drawing.roundRect).toHaveBeenCalledWith(chair.box.x, 1120, chair.box.width, 52, 8);
    expect(drawing.fillText).toHaveBeenCalledWith('测试餐椅完整型号', chair.box.x + chair.box.width / 2, 1146);
    expect(drawing.font).toBe('35px Montserrat, "方正兰亭准黑_GBK", sans-serif');
    expect(drawing.fillStyle).toBe('#ffffff');
  });

  it('单矩形安全区避让右下蓝标；卖点间距30px，备注预留完整字面不侵入卖点', () => {
    for (const widths of [[200, 200], [200, 200, 200], [600, 200, 200]]) {
      const layout = getRoundExtendableTableCombinationLayout(widths);
      expect(layout.issue).toBeNull();
      expect(layout.subjectSafeArea.y + layout.subjectSafeArea.height).toBe(1090);
      layout.sellingPoints.forEach((box, index) => {
        expect(box.height).toBe(98);
        expect(1440 - box.y - box.height).toBe(80);
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 50);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
      });
    }
    expect(getRoundExtendableTableCombinationLayout([800, 800, 800]).issue).toContain('超出安全区');
    expect(roundTableCombinationNote(options)).toBeUndefined();
    expect(roundTableCombinationNote({ ...options, noteText: ' 测试备注 ' })).toMatchObject({ text: '测试备注', font: '38px Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#545454', x: 94, y: 1218 });
  });

  it('缺少椅型号、换行、超长型号备注和尺寸容量均提示，未缩写或裁切原文', () => {
    const empty = normalizeRoundTableCombinationOptions(undefined);
    expect(roundTableCombinationTextIssues(context, empty, fields).join()).toContain('请填写组合中的餐椅完整型号');
    const layout = getRoundExtendableTableCombinationLayout([200, 200, 200]);
    const longText = '完整型号规格'.repeat(30);
    expect(roundTableCombinationModelBadge(context, longText, layout)).toMatchObject({ text: longText, fontSize: 35 });
    expect(roundTableCombinationModelBadge(context, longText, layout).issue).toContain('不能省略规格');
    expect(roundTableCombinationChairBadge(context, { ...options, diningChairs: { ...options.diningChairs, models: [longText, ''] } })).toMatchObject({ text: longText, issue: expect.stringContaining('不能省略型号') });
    for (const model of ['型号\n规格', '型号\t规格', '型号\u2028规格']) {
      expect(roundTableCombinationChairBadge(context, { ...options, diningChairs: { ...options.diningChairs, models: [model, ''] } }).issue).toContain('须为单行');
    }
    expect(roundTableCombinationTextIssues(context, { ...options, noteText: longText }, fields).join()).toContain('图示备注超出单行安全区');
    expect(roundTableCombinationTextIssues(context, { ...options, heightNote: longText }, fields).join()).toContain('高度及说明过长');
    expect(roundTableCombinationTextIssues(context, options, { ...fields, diameter: Array(30).fill('90~140').join('/') }).join()).toContain('直径规格过长');
    expect(roundTableCombinationTextIssues(context, options, fields)).toEqual([]);
  });
});
