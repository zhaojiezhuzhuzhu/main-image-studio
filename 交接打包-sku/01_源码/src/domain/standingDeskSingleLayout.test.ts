import { describe, expect, it, vi } from 'vitest';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { drawStandingDeskHeadline, getStandingDeskSingleLayout, normalizeStandingDeskOptions, parseStandingDeskDimensions, STANDING_DESK_HEADLINE, standingDeskDimensionIssue, standingDeskDimensionLabel, standingDeskHeadlineIssue, standingDeskModelBadge, type StandingDeskDraft } from './standingDeskSingleLayout';
import { standingDeskSingleRules as rules } from '../templates/standing-desk-single';
import { decodeProjectFile, encodeProjectFile } from '../project/projectFile';

const measure = () => ({ font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } });
const fields = { length: '120.99/150.99', width: '62.09/75.99', height: '73.99~122.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 73.9, from: { x: 340, y: 650 }, to: { x: 340, y: 1080 } };
const options = () => ({ ...rules.createOptions(), headline: 'TEST款－测试标题' });

describe('电动升降桌单品：P43，尺寸均为测试参数', () => {
  it('完整保存并列规格与升降上下限，数值截断保留一位小数', () => {
    const result = parseStandingDeskDimensions('120.99/150.99×62.09/75.99×73.99~122.99cm');
    expect(result).toEqual({ length: '120.9/150.9', width: '62/75.9', height: '73.9~122.9' });
    expect(rules.formatFields(result!)).toBe('120.9/150.9×62/75.9×73.9~122.9');
    expect(standingDeskDimensionIssue(fields, measure())).toBeNull();
    for (const value of ['', '0', '-1', 'abc', '80/', '1e3', '~122']) {
      expect(parseStandingDeskDimensions(`150×75×${value}`)).toBeNull();
      expect(standingDeskDimensionIssue({ ...fields, height: value })).not.toBeNull();
    }
  });

  it('升降高度按40px基线间距分为两行，45号中黑保留完整范围', () => {
    const label = standingDeskDimensionLabel(measure(), annotation, fields);
    expect(label.runs.map((run) => run.text)).toEqual(['73.9~', '122.9cm']);
    expect(label.runs[1].y - label.runs[0].y).toBe(40);
    expect(label.height).toBe(85);
    expect(label.runs.every((run) => run.font.includes('45px') && run.font.includes('方正兰亭中黑_GBK'))).toBe(true);
    const fixed = standingDeskDimensionLabel(measure(), annotation, { ...fields, height: '73.99' });
    expect(fixed.runs.map((run) => run.text)).toEqual(['73.9cm']); expect(fixed.height).toBe(45);
  });

  it('多规格在分隔符处折行，超出实测容量拦截导出而不删减数字', () => {
    const width = '60/62/65/70/72/75';
    const label = standingDeskDimensionLabel(measure(), { ...annotation, kind: 'width' }, { ...fields, width });
    expect(label.runs.length).toBeGreaterThan(1);
    expect(label.runs.map((run) => run.text).join('')).toBe(`${width}cm`);
    expect(label.width).toBeLessThanOrEqual(460);
    const many = Array.from({ length: 40 }, (_, index) => String(120 + index)).join('/');
    const tooMany = { ...fields, length: many };
    expect(rules.extraIssues!(measure(), options(), getStandingDeskSingleLayout([200, 200, 200]), tooMany).join('')).toContain('不可删减规格');
    expect(standingDeskDimensionLabel(measure(), { ...annotation, kind: 'length' }, tooMany).runs.map((run) => run.text).join('')).toBe(`${many}cm`);
    expect(standingDeskDimensionIssue({ ...fields, height: '999999999999999' }, measure())).toContain('超出标注区域');
  });

  it('标题与型号按规定字号独立实测，长文本保留原文并拦截', () => {
    const context = measure(), layout = getStandingDeskSingleLayout([200, 200, 200]);
    expect(standingDeskHeadlineIssue(options().headline, context)).toBeNull();
    expect(context.font).toContain('80px'); expect(context.font).toContain('Montserrat Semi Bold'); expect(context.font).toContain('方正兰亭粗黑_GBK');
    expect(standingDeskHeadlineIssue('')).toContain('请填写');
    expect(standingDeskHeadlineIssue('测试\n标题', context)).toContain('单行');
    expect(standingDeskHeadlineIssue('测试标题'.repeat(30), context)).toContain('超出安全区');
    const model = 'TEST 1.2m/1.5m电动升降桌';
    expect(standingDeskModelBadge(context, model, layout)).toMatchObject({ text: model, fontSize: 45, issue: null });
    const long = model.repeat(10);
    expect(standingDeskModelBadge(context, long, layout)).toMatchObject({ text: long, fontSize: 45 });
    expect(standingDeskModelBadge(context, long, layout).issue).toContain('不能省略规格');
  });

  it('标题绘图避让价格区，异常标题不绘制到安全区外', () => {
    const context = { ...measure(), save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), fillStyle: '', textAlign: '', textBaseline: '' };
    drawStandingDeskHeadline(context as unknown as CanvasRenderingContext2D, options());
    expect(context.fillText).toHaveBeenCalledWith(options().headline, 94, 340);
    expect(context.fillStyle).toBe('#000000');
    expect(STANDING_DESK_HEADLINE.y).toBe(270 + 30);
    expect(getStandingDeskSingleLayout([]).modelBadge.y - STANDING_DESK_HEADLINE.y - STANDING_DESK_HEADLINE.height).toBe(30);
    context.fillText.mockClear();
    drawStandingDeskHeadline(context as unknown as CanvasRenderingContext2D, { ...options(), headline: '超长'.repeat(40) });
    expect(context.fillText).not.toHaveBeenCalled(); expect(context.restore).toHaveBeenCalledTimes(2);
  });

  it('两个或三个卖点保持固定框高与间距，按文字调整框宽且计入描边', () => {
    for (const widths of [[200, 250, 200], [350, 450], [600, 180, 180]]) {
      const layout = getStandingDeskSingleLayout(widths);
      expect(layout.issue).toBeNull();
      layout.sellingPoints.forEach((box, index) => {
        expect(box.height).toBe(98); expect(box.y).toBe(1210);
        expect(box.x - 2).toBeGreaterThanOrEqual(94 - .0001);
        expect(box.x + box.width + 2).toBeLessThanOrEqual(1346 + .0001);
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 40);
        expect(1440 - box.y - box.height - 2).toBe(130);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
      });
    }
    expect(getStandingDeskSingleLayout([900, 900, 900]).issue).toContain('超出安全区');
  });

  it('拖动缩放后产品和完整范围标注共同避让型号及卖点', () => {
    const layout = getStandingDeskSingleLayout([200, 200, 200]);
    const labelSize = standingDeskDimensionLabel(measure(), annotation, fields);
    const fit = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fit.productRect, fit.annotations.map((value) => ({ annotation: value, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: -900, offsetY: 900 });
    expect(moved.bounds.x).toBeGreaterThanOrEqual(94 - .001);
    expect(moved.bounds.y).toBeGreaterThanOrEqual(512 - .001);
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(1346 + .001);
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(layout.sellingPoints[0].y - 2 - 60 + .001);
  });

  it('选项默认空白且独立，两个卖点隐藏第三项但不改写原内容', () => {
    const defaults = { sizeLabels: ['', ''], dimensionGap: 60, headline: '', sellingPointCount: 3 };
    expect(rules.createOptions()).toEqual(defaults);
    for (const value of [undefined, null, false, { headline: 42, sellingPointCount: 8 }]) expect(normalizeStandingDeskOptions(value)).toEqual(defaults);
    const first = rules.createOptions(), second = rules.createOptions(); first.sizeLabels[0] = '独立';
    expect(second.sizeLabels).toEqual(['', '']); expect(rules.hasOptions(second)).toBe(false);
    expect(rules.hasOptions({ ...second, headline: ' ' })).toBe(true);
    const points = ['测试一', '测试二', '测试三'];
    expect(rules.visibleSellingPoints(points, { ...options(), sellingPointCount: 2 })).toEqual(['测试一', '测试二']);
    expect(points).toEqual(['测试一', '测试二', '测试三']);
  });

  it('专属源文件往返保留原始标题、完整小数及隐藏卖点，不写其他模板字段', async () => {
    const savedOptions = { ...options(), headline: '  TEST测试标题  ', sellingPointCount: 2 as const };
    const draft: StandingDeskDraft = { version: 1, templateId: 'standing-desk-single', model: 'TEST完整型号与规格', modelManuallyEdited: true,
      sizeInput: '120.99/150.99×62.09/75.99×73.99~122.99', dimensionFields: fields, sellingPoints: ['测试卖点一', '测试卖点二', '测试隐藏卖点三'],
      annotations: [annotation], subjectAdjustment: { scale: .85, offsetX: 8, offsetY: -10 }, ...rules.saveOptions(savedOptions) };
    const restored = await decodeProjectFile(await encodeProjectFile(draft, 'single', 'test-standing-desk'));
    expect(restored.kind).toBe('single'); expect(restored.draft).toEqual(draft);
    expect(rules.restoreOptions(restored.draft as StandingDeskDraft)).toEqual(savedOptions);
    expect(Object.keys(rules.saveOptions(savedOptions))).toEqual(['standingDesk']);
    const invalidTitle = { ...savedOptions, headline: '过长标题'.repeat(40) };
    expect(rules.restoreOptions({ ...draft, ...rules.saveOptions(invalidTitle) }).headline).toBe(invalidTitle.headline);
  });
});
