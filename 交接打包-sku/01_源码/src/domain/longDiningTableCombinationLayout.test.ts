import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { longDiningTableCombinationRules as rules } from '../templates/long-dining-table-combination';
import { drawLongDiningTableCombinationExtras, longDiningTableCombinationChairBadges, longDiningTableCombinationDimensionLabel, longDiningTableCombinationExtraIssues, longDiningTableCombinationModelBadge, longDiningTableCombinationNote, longDiningTableCombinationFooterLines, normalizeLongDiningTableCombinationOptions, parseLongDiningTableCombinationDimensions } from './longDiningTableCombinationLayout';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[\u0100-\uffff]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
// 仅用于验证的尺寸参数，不代表真实产品。
const fields = { length: '140.99/160.99~220.99', width: '80.99/80.99/85.99/85.99/90.99', height: '74.89' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 74.8, from: { x: 250, y: 620 }, to: { x: 250, y: 1000 } };
const options = () => normalizeLongDiningTableCombinationOptions({ diningChairs: { count: 2, models: ['测试款A餐椅', '测试款B长凳'], markers: [{ x: .25, y: .3 }, { x: .75, y: .8 }] } });

describe('长餐桌组合：第36–37页，测试参数', () => {
  it('中文说明完整显示和折行，单位放在数字后，支持快速尺寸且仍校验有效数值', () => {
    const fields = { length: '尺寸可选：140.99/160.99', width: '尺寸可选：80/85cm', height: '75厘米（含脚垫）' };
    const expected = { length: '尺寸可选：140.9/160.9cm', width: '尺寸可选：80/85cm', height: '75cm（含脚垫）' };
    for (const kind of ['length', 'width', 'height'] as const) {
      const label = rules.dimensionLabel(context, { ...annotation, kind }, fields, options());
      expect(label.runs.map((run) => run.text).join('')).toBe(expected[kind]);
      expect(label.runs.every((run) => run.font.startsWith('35px '))).toBe(true);
    }
    expect(rules.allowDimensionText).toBe(true);
    expect(parseLongDiningTableCombinationDimensions('尺寸可选：140/160×80/85×约75cm')).toEqual({ length: '尺寸可选：140/160', width: '80/85', height: '约75' });
    expect(rules.exportIssues(fields, '', options(), null)).toEqual([]);
    expect(rules.extraIssues!(context, options(), rules.layout([200, 200, 200], options()), fields)).toEqual([]);
    for (const value of ['尺寸可选', '尺寸可选：0', '约-1', '约140//160']) expect(rules.exportIssues({ ...fields, length: value }, '', options(), null).join('')).toContain('尺寸无效');
  });
  it('长宽高支持多规格和范围，截断一位，35号尺寸折行不遗漏数据', () => {
    expect(parseLongDiningTableCombinationDimensions('140.99/160.99~220.99×80.09/85.99×74.89cm')).toEqual({ length: '140.9/160.9~220.9', width: '80/85.9', height: '74.8' });
    const label = longDiningTableCombinationDimensionLabel(context, { ...annotation, kind: 'width' }, fields, options());
    expect(label.runs.length).toBeGreaterThan(1);
    expect(label.runs.map((run) => run.text).join('')).toBe('80.9/80.9/85.9/85.9/90.9cm');
    expect(label.runs.every((run) => run.font.startsWith('35px '))).toBe(true);
    expect(label.width).toBeLessThanOrEqual(360);
    expect(rules.exportIssues(fields, '', options(), null)).toEqual([]);
    expect(rules.extraIssues!(context, options(), rules.layout([200, 200, 200], options()), fields)).toEqual([]);
  });

  it('缺失或无效尺寸阻止导出，高度说明只加到高标注并完整纳入范围', () => {
    for (const value of ['', '0', '-1', 'abc', '80/']) expect(rules.exportIssues({ ...fields, length: value }, '', options(), null).length).toBeGreaterThan(0);
    const withNote = { ...options(), heightNote: '含实际脚垫及可调节支撑说明' };
    const label = rules.dimensionLabel(context, annotation, fields, withNote);
    expect(label.runs.map((run) => run.text).join('')).toBe('74.8cm（含实际脚垫及可调节支撑说明）');
    expect(label.runs.length).toBeGreaterThan(2);
    expect(label.height).toBe(label.runs.length * 44);
    expect(rules.dimensionLabel(context, { ...annotation, kind: 'length' }, fields, withNote).runs.map((run) => run.text).join('')).not.toContain('脚垫');
  });

  it('根据实际字体检查容量，不删减长尺寸、长型号与图示备注', () => {
    const value = options(), layout = rules.layout([200, 200, 200], value);
    const many = Array.from({ length: 60 }, (_, i) => String(140 + i)).join('/');
    const label = rules.dimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, value);
    expect(label.runs.map((run) => run.text).join('')).toBe(`${many}cm`);
    expect(longDiningTableCombinationExtraIssues(context, value, layout, { ...fields, width: many }).join('')).toContain('不可删减规格');
    value.diningChairs.models[0] = '完整型号'.repeat(20);
    expect(longDiningTableCombinationChairBadges(context, value)[0].text).toBe(value.diningChairs.models[0]);
    expect(longDiningTableCombinationExtraIssues(context, value, layout).join('')).toContain('不可省略型号');
    value.noteText = '备注'.repeat(20);
    expect(rules.exportIssues(fields, '', value, null)).toEqual([]);
    expect(longDiningTableCombinationNote(value, layout)).toBeUndefined();
    expect(longDiningTableCombinationFooterLines(value, context).join('')).toBe(value.noteText);
    expect(rules.saveOptions(value)).toHaveProperty('longDiningTableCombination.noteText', value.noteText);
  });

  it('单款无编号，双款型号按1/2对应、行距15，实际字号和字宽决定容量', () => {
    const value = options();
    const two = longDiningTableCombinationChairBadges(context, value);
    expect(two.map((badge) => badge.number)).toEqual(['1', '2']);
    expect(two[1].box.y - two[0].box.y - two[0].box.height).toBe(15);
    expect(two.every((badge) => badge.box.height === 52 && badge.box.x + badge.box.width === 1340)).toBe(true);
    value.diningChairs.count = 1; value.diningChairs.models[1] = '';
    const one = longDiningTableCombinationChairBadges(context, value);
    expect(one).toHaveLength(1); expect(one[0].number).toBe('');
    expect(longDiningTableCombinationExtraIssues(context, value, rules.layout([], value))).toEqual([]);
    value.diningChairs.count = 2;
    expect(longDiningTableCombinationExtraIssues(context, value, rules.layout([], value)).join('')).toContain('第2款');
  });

  it('圆形编号随实际产品框平移缩放，半径不会因中心靠近边缘而溢出产品框', () => {
    const circles: number[][] = [], texts: { text: string; x: number; y: number; font: string; color: string }[] = [];
    const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(),
      arc: (...args: number[]) => circles.push(args), fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    const value = options(), layout = rules.layout([200, 200, 200], value);
    drawLongDiningTableCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, layout, { x: 100, y: 200, width: 800, height: 600 });
    expect(circles.filter((call) => call[2] === 20).map((call) => call.slice(0, 2))).toEqual([[300, 380], [700, 680]]);
    expect(texts.filter((text) => text.text === '1').map((text) => [text.font, text.color])).toEqual([['25px Montserrat, sans-serif', '#00586d'], ['35px Montserrat, sans-serif', '#ffffff']]);
    circles.length = 0;
    drawLongDiningTableCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, layout, { x: 200, y: 300, width: 400, height: 300 });
    expect(circles.filter((call) => call[2] === 20).map((call) => call.slice(0, 2))).toEqual([[300, 390], [500, 540]]);
    value.diningChairs.markers = [{ x: 0, y: 0 }, { x: 1, y: 1 }]; circles.length = 0;
    drawLongDiningTableCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, layout, { x: 100, y: 200, width: 800, height: 600 });
    expect(circles.filter((call) => call[2] === 20).map((call) => call.slice(0, 2))).toEqual([[120, 220], [880, 780]]);
    circles.length = 0;
    drawLongDiningTableCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, layout);
    expect(circles.every((call) => call[2] === 15)).toBe(true);
    circles.length = 0; value.diningChairs.count = 1;
    drawLongDiningTableCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, layout, { x: 100, y: 200, width: 800, height: 600 });
    expect(circles).toEqual([]);
  });

  it('产品可覆盖餐椅型号区，仍避开卖点；单双款不改变主图可用空间', () => {
    for (const count of [1, 2] as const) {
      const value = options(); value.diningChairs.count = count;
      const layout = rules.layout([200, 400, 200], value);
      const firstBadge = longDiningTableCombinationChairBadges(context, value)[0];
      const labelSize = rules.dimensionLabel(context, annotation, fields, value);
      const fitted = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
      const moved = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 900, offsetY: 900 });
      expect(moved.bounds.y + moved.bounds.height).toBeGreaterThan(firstBadge.box.y);
      expect(moved.bounds.y + moved.bounds.height + value.dimensionGap).toBeLessThanOrEqual(layout.sellingPoints[0].y - 2 + .001);
      layout.sellingPoints.forEach((box, index) => { expect(box.height).toBe(98); if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBe(30); });
    }
    const one = options(); one.diningChairs.count = 1;
    expect(rules.layout([200, 400, 200], one)).toEqual(rules.layout([200, 400, 200], options()));
    expect(rules.layout([800, 800, 800], options()).issue).toContain('超出安全区');
    const layout = rules.layout([200, 200], options());
    expect(longDiningTableCombinationModelBadge(context, '测试型号完整规格', layout)).toMatchObject({ fontSize: 35, issue: null });
    expect(longDiningTableCombinationModelBadge(context, '完整型号'.repeat(30), layout).issue).toContain('不能省略规格');
  });

  it('短备注保持原位，长备注在卖点下方居中；换行保留全文并给底部留足空间', () => {
    const value = options();
    for (const text of ['备'.repeat(16), '备'.repeat(17), '*图示效果以1.6m餐桌为例，餐椅为不同系列搭配产品，存在色差', '完整备注'.repeat(18)]) {
      value.noteText = text;
      const layout = rules.layout([200, 200, 200], value, context);
      const lines = longDiningTableCombinationFooterLines(value, context);
      if (text.length <= 16) {
        expect(lines).toEqual([]);
        expect(longDiningTableCombinationNote(value, layout)).toMatchObject({ text, x: 94, y: 1218 });
      } else {
        expect(longDiningTableCombinationNote(value, layout)).toBeUndefined();
        expect(lines.join('')).toBe(text);
        context.font = `38px test`;
        expect(lines.every((line) => context.measureText(line).width <= 1320)).toBe(true);
        const texts: Array<{ text: string; x: number; y: number; align: string; font: string }> = [];
        const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, arc() {},
          fillText(text: string, x: number, y: number) { texts.push({ text, x, y, align: this.textAlign, font: this.font }); } };
        drawLongDiningTableCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, layout);
        const footer = texts.slice(-lines.length);
        expect(footer.map((item) => item.text)).toEqual(lines);
        expect(footer.every((item) => item.x === 720 && item.align === 'center' && item.font.startsWith('38px'))).toBe(true);
        expect(footer[0].y - 38).toBeGreaterThan(layout.sellingPoints[0].y + 98);
        expect(footer.at(-1)!.y).toBe(1404);
        expect(longDiningTableCombinationChairBadges(context, value).at(-1)!.box.y + 52).toBeLessThan(layout.sellingPoints[0].y);
      }
      expect(rules.exportIssues(fields, '', value, null)).toEqual([]);
      expect(longDiningTableCombinationExtraIssues(context, value, layout)).toEqual([]);
    }
    value.noteText = '完整备注'.repeat(1000);
    const overfull = rules.layout([200, 200, 200], value, context);
    expect(overfull.productArea.height).toBeGreaterThan(0);
    expect(overfull.issue).toContain('备注行数过多');
  });

  it('独立默认值不预填型号或备注，恢复无效值并深度复制编号状态', () => {
    const first = rules.createOptions(), second = rules.createOptions();
    expect(first.noteText).toBe(''); expect(first.heightNote).toBe(''); expect(first.diningChairs!.models).toEqual(['', '']);
    first.diningChairs!.models[0] = '测试参数'; first.diningChairs!.markers[0].x = .9;
    expect(second.diningChairs!.models).toEqual(['', '']); expect(second.diningChairs!.markers[0].x).toBe(.2);
    expect(rules.hasOptions(second)).toBe(false); expect(rules.hasOptions(first)).toBe(true);
    expect(normalizeLongDiningTableCombinationOptions({ diningChairs: { count: 9, models: [false], markers: [{ x: -1, y: 2 }, { x: NaN }] }, dimensionGap: 1000 }).diningChairs).toEqual({ count: 1, models: ['', ''], markers: [{ x: 0, y: 1 }, { x: .5, y: .8 }] });
    expect(normalizeLongDiningTableCombinationOptions(null)).toEqual(second);
  });
});
