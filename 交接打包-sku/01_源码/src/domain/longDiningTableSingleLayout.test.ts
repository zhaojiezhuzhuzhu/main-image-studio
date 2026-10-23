import { describe, expect, it } from 'vitest';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { getLongDiningTableSingleLayout, longDiningTableDimensionIssue, longDiningTableDimensionLabel, longDiningTableModelBadge, longDiningTableNote, normalizeLongDiningTableOptions, parseLongDiningTableDimensions, type LongDiningTableDraft } from './longDiningTableSingleLayout';
import { longDiningTableSingleRules as rules } from '../templates/long-dining-table-single';
import { decodeProjectFile, encodeProjectFile } from '../project/projectFile';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
// 测试参数，不代表任何素材的真实尺寸。
const fields = { length: '140.99/160.99/180.99/200.99/220.99', width: '80/80/85/85/90', height: '74.89' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 74.8, from: { x: 230, y: 620 }, to: { x: 230, y: 1060 } };

describe('长餐桌单品：第35页规范，测试参数', () => {
  it('并列与范围尺寸均截断一位，快速输入完整保留每种规格', () => {
    const parsed = parseLongDiningTableDimensions('140.99/160.99~220.99×80.09/85.99×74.89cm');
    expect(parsed).toEqual({ length: '140.9/160.9~220.9', width: '80/85.9', height: '74.8' });
    expect(rules.formatFields(parsed!)).toBe('140.9/160.9~220.9×80/85.9×74.8');
    for (const value of ['', '0', '-1', 'abc', '80/', '1e3']) {
      expect(parseLongDiningTableDimensions(`${value}×85×74.8`)).toBeNull();
      expect(longDiningTableDimensionIssue({ ...fields, length: value }, rules.createOptions())).not.toBeNull();
    }
    expect(longDiningTableDimensionIssue(fields, rules.createOptions())).toBeNull();
  });

  it('尺寸按测量宽度折行，五种宽度不丢数、不丢斜线和范围', () => {
    for (const value of ['80/80/85/85/90', '80.99/80.99/85.99~90.99/95.99']) {
      const label = longDiningTableDimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: value }, rules.createOptions());
      expect(label.runs.length).toBeGreaterThan(1);
      expect(label.width).toBeLessThanOrEqual(420);
      expect(label.runs.map((run) => run.text).join('')).toBe(value === '80/80/85/85/90' ? `${value}cm` : '80.9/80.9/85.9~90.9/95.9cm');
      expect(label.runs.every((run) => run.font.includes('45px') && run.font.includes('方正兰亭准黑_GBK'))).toBe(true);
    }
  });

  it('高度说明只添加到高标注，并使全部文本进入label bounds', () => {
    const options = { ...rules.createOptions(), heightNote: '含脚垫及可调节支撑结构说明' };
    const label = longDiningTableDimensionLabel(context, annotation, fields, options);
    expect(label.runs.map((run) => run.text).join('')).toBe('74.8cm（含脚垫及可调节支撑结构说明）');
    expect(label.runs.length).toBeGreaterThan(2);
    for (const run of label.runs) {
      context.font = run.font;
      expect(context.measureText(run.text).width).toBeLessThanOrEqual(label.width);
      expect(Math.abs(run.y) + 27).toBeLessThanOrEqual(label.height / 2);
    }
    expect(longDiningTableDimensionLabel(context, { ...annotation, kind: 'length' }, fields, options).runs.map((run) => run.text).join('')).not.toContain('脚垫');
    expect(longDiningTableDimensionLabel(context, annotation, fields, rules.createOptions()).runs.map((run) => run.text)).toEqual(['74.8cm']);
  });

  it('两三卖点框始终98高、横向间距30，过长文案明确阻止导出', () => {
    for (const widths of [[250, 300, 250], [250, 400], [680, 100, 100]]) {
      const layout = getLongDiningTableSingleLayout(widths, rules.createOptions());
      expect(layout.issue).toBeNull();
      layout.sellingPoints.forEach((box, index) => {
        expect(box.height).toBe(98);
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 50);
        expect(box.x - 2).toBeGreaterThanOrEqual(30);
        expect(box.x + box.width + 2).toBeLessThanOrEqual(1410);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
      });
    }
    expect(getLongDiningTableSingleLayout([800, 800, 800], rules.createOptions()).issue).toContain('超出安全区');
  });

  it('备注避让保留30px卖点间隔，拖动缩放后全部标注仍在安全区', () => {
    for (const gap of [30, 60, 100]) {
      const options = { ...rules.createOptions(), noteText: '图示效果以2.0米餐桌为例', heightNote: '含脚垫', dimensionGap: gap };
      const layout = getLongDiningTableSingleLayout([200, 200, 200], options);
      const note = longDiningTableNote(options, layout)!;
      expect(layout.sellingPoints[0].y - 2 - note.y - 12).toBe(30);
      const labelSize = longDiningTableDimensionLabel(context, annotation, fields, options);
      const fit = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
      const moved = adjustAnnotatedProduct(fit.productRect, fit.annotations.map((value) => ({ annotation: value, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 900, offsetY: 900 });
      const bounds = moved.bounds;
      expect(bounds.x).toBeGreaterThanOrEqual(30 - .001);
      expect(bounds.y).toBeGreaterThanOrEqual(layout.subjectSafeArea.y - .001);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(1410 + .001);
      expect(note.y - 38 - bounds.y - bounds.height).toBeGreaterThanOrEqual(gap - .001);
      expect(layout.subjectSafeArea.y - layout.modelBadge.y - layout.modelBadge.height).toBe(50);
    }
  });

  it('长型号仍保留完整45号文字，超出安全区时报错', () => {
    const layout = getLongDiningTableSingleLayout([200, 200, 200], rules.createOptions());
    const model = '测试参数 C01R-A餐桌 2.0米';
    expect(longDiningTableModelBadge(context, model, layout)).toMatchObject({ text: model, fontSize: 45, issue: null });
    const long = '完整型号及全部规格'.repeat(12);
    const badge = longDiningTableModelBadge(context, long, layout);
    expect(badge.text).toBe(long);
    expect(badge.issue).toContain('不能省略规格');
    expect(longDiningTableModelBadge(context, '型号\n规格', layout).issue).toContain('一行');
  });

  it('备注和多规格极长时拦截，原始文本仍可保存，不绘制越界备注', () => {
    const options = { ...rules.createOptions(), noteText: '长备注'.repeat(20), heightNote: '高度说明'.repeat(20) };
    const layout = getLongDiningTableSingleLayout([200, 200, 200], options);
    expect(longDiningTableNote(options, layout)).toBeUndefined();
    expect(rules.exportIssues(fields, '', options, null).join('')).toContain('备注过长');
    expect(rules.exportIssues(fields, '', options, null).join('')).toContain('高度说明');
    expect((rules.saveOptions(options) as LongDiningTableDraft).longDiningTable!.noteText).toBe(options.noteText);
    const many = Array.from({ length: 60 }, (_, i) => String(140 + i)).join('/');
    expect(rules.exportIssues({ ...fields, width: many }, '', rules.createOptions(), null).join('')).toContain('不可删减规格');
    const label = longDiningTableDimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, rules.createOptions());
    expect(label.runs.map((run) => run.text).join('')).toBe(`${many}cm`);
    expect(rules.exportIssues({ ...fields, width: '999999999999999' }, '', rules.createOptions(), null).join('')).toContain('过长');
    expect(rules.exportIssues(fields, '', { ...options, noteText: '第一行\n第二行' }, null).join('')).toContain('单行');
  });

  it('源文件直接往返保留原始小数、备注空格、高度说明和自身字段', async () => {
    const options = { ...rules.createOptions(), noteText: '  测试参数图示备注  ', heightNote: '  含脚垫  ', sellingPointCount: 2 as const, dimensionGap: 75 };
    const draft: LongDiningTableDraft = { version: 1, templateId: 'long-dining-table-single', model: '测试参数餐桌完整规格', modelManuallyEdited: true,
      dimensionFields: fields, sizeInput: '140.99/160.99/180.99/200.99/220.99×80/80/85/85/90×74.89', sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'],
      annotations: [annotation], subjectAdjustment: { scale: .9, offsetX: 12, offsetY: -5 }, ...rules.saveOptions(options) };
    const restored = await decodeProjectFile(await encodeProjectFile(draft, 'single', 'long-dining-table-roundtrip'));
    expect(restored.kind).toBe('single');
    expect(restored.draft).toEqual(draft);
    expect(rules.restoreOptions(restored.draft as LongDiningTableDraft)).toEqual(options);
    expect(restored.draft).not.toHaveProperty('softBed');
    expect(restored.draft).not.toHaveProperty('roundExtendableTable');
  });

  it('旧版本和无效选项恢复独立默认，范围外间距受控，不带示例事实', () => {
    expect(rules.createOptions()).toEqual({ sizeLabels: ['', ''], noteText: '', heightNote: '', sellingPointCount: 3, dimensionGap: 60 });
    for (const value of [undefined, null, 'invalid', { noteText: 200, heightNote: false, sellingPointCount: 4, dimensionGap: NaN }]) {
      expect(normalizeLongDiningTableOptions(value)).toEqual(rules.createOptions());
    }
    expect(normalizeLongDiningTableOptions({ dimensionGap: -1 }).dimensionGap).toBe(30);
    expect(normalizeLongDiningTableOptions({ dimensionGap: 999 }).dimensionGap).toBe(100);
    const first = rules.createOptions(), second = rules.createOptions();
    first.sizeLabels[0] = '独立默认';
    expect(second.sizeLabels).toEqual(['', '']);
    expect(rules.hasOptions(second)).toBe(false);
    expect(rules.hasOptions({ ...second, noteText: ' ' })).toBe(true);
  });
});
