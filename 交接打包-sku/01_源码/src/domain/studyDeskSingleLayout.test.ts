import { describe, expect, it } from 'vitest';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { getStudyDeskSingleLayout, normalizeStudyDeskSingleOptions, parseStudyDeskSingleDimensions, studyDeskSingleDimensionIssue, studyDeskSingleDimensionLabel, studyDeskSingleModelBadge, type StudyDeskSingleDraft } from './studyDeskSingleLayout';
import { studyDeskSingleRules as rules } from '../templates/study-desk-single';

const measure = () => ({ font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } });
const fields = { length: '120.99/150.99', width: '62.09/75.99', height: '53.99~76.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 53.9, from: { x: 420, y: 545 }, to: { x: 420, y: 1110 } };

describe('儿童学习桌单品：P47，尺寸均为测试参数', () => {
  it('并列规格和升降范围完整保留，换算截断一位小数', () => {
    const result = parseStudyDeskSingleDimensions('120.99/150.99×62.09/75.99×53.99~76.99cm');
    expect(result).toEqual({ length: '120.9/150.9', width: '62/75.9', height: '53.9~76.9' });
    expect(rules.formatFields(result!)).toBe('120.9/150.9×62/75.9×53.9~76.9');
    expect(studyDeskSingleDimensionIssue(fields, measure())).toBeNull();
    for (const value of ['', '0', '-1', 'abc', '80/', '1e3', '~122']) {
      expect(parseStudyDeskSingleDimensions(`120×62×${value}`)).toBeNull();
      expect(studyDeskSingleDimensionIssue({ ...fields, height: value })).not.toBeNull();
    }
  });

  it('高度范围按40px基线分行，不添加书椅总高前缀或删去上限', () => {
    const label = studyDeskSingleDimensionLabel(measure(), annotation, fields);
    expect(label.runs.map((run) => run.text)).toEqual(['53.9~', '76.9cm']);
    expect(label.runs[1].y - label.runs[0].y).toBe(40); expect(label.height).toBe(85);
    expect(label.runs.every((run) => run.font.includes('45px') && run.font.includes('方正兰亭中黑_GBK'))).toBe(true);
    expect(studyDeskSingleDimensionLabel(measure(), annotation, { ...fields, height: '73.99' }).runs.map((run) => run.text)).toEqual(['73.9cm']);
    expect(studyDeskSingleDimensionLabel(measure(), { ...annotation, kind: 'length' }, fields).runs.map((run) => run.text)).toEqual(['120.9/150.9cm']);
  });

  it('多规格在分隔符处折行，完整文字超出容量时明确拦截', () => {
    const width = '60/62/65/70/72/75';
    const label = studyDeskSingleDimensionLabel(measure(), { ...annotation, kind: 'width' }, { ...fields, width });
    expect(label.runs.length).toBeGreaterThan(1);
    expect(label.runs.map((run) => run.text).join('')).toBe(`${width}cm`);
    expect(label.width).toBeLessThanOrEqual(460);
    const length = Array.from({ length: 40 }, (_, index) => String(120 + index)).join('/');
    const overfull = { ...fields, length };
    expect(rules.extraIssues!(measure(), rules.createOptions(), getStudyDeskSingleLayout([200, 200, 200]), overfull).join('')).toContain('不可删减规格');
    expect(studyDeskSingleDimensionLabel(measure(), { ...annotation, kind: 'length' }, overfull).runs.map((run) => run.text).join('')).toBe(`${length}cm`);
    expect(studyDeskSingleDimensionIssue({ ...fields, height: '999999999999999' }, measure())).toContain('超出标注区域');
  });

  it('型号先用45号，长型号改35号后仍测量并保留完整原文', () => {
    const context = measure(), layout = getStudyDeskSingleLayout([200, 200, 200]);
    const shortModel = 'TEST 1.2m儿童学习桌';
    expect(studyDeskSingleModelBadge(context, shortModel, layout)).toMatchObject({ text: shortModel, fontSize: 45, issue: null });
    const longerModel = 'TEST儿童学习桌'.repeat(2);
    expect(studyDeskSingleModelBadge(context, longerModel, layout)).toMatchObject({ text: longerModel, fontSize: 35, issue: null });
    const overfull = longerModel.repeat(5);
    expect(studyDeskSingleModelBadge(context, overfull, layout)).toMatchObject({ text: overfull, fontSize: 35 });
    expect(studyDeskSingleModelBadge(context, overfull, layout).issue).toContain('不能省略规格');
    expect(studyDeskSingleModelBadge(context, 'TEST\n儿童学习桌', layout).issue).toContain('一行');
  });

  it('没有大标题或备注，型号避让270px价格区并保留80px间距', () => {
    const layout = getStudyDeskSingleLayout([200, 200, 200]);
    expect(layout.modelBadge.y).toBe(270 + 80);
    expect(layout.subjectSafeArea.y - layout.modelBadge.y - layout.modelBadge.height).toBe(30);
    expect(rules.drawExtras).toBeUndefined(); expect(rules.note).toBeUndefined(); expect(rules.accessories).toBeUndefined();
    expect(rules.requiredFonts).toEqual(['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK']);
  });

  it('两个或三个卖点保持固定框高间距及130px底留白，描边也不越界', () => {
    for (const widths of [[200, 250, 200], [350, 450], [600, 180, 180]]) {
      const layout = getStudyDeskSingleLayout(widths);
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
    expect(getStudyDeskSingleLayout([900, 900, 900]).issue).toContain('超出安全区');
  });

  it('间距归一化为60至180且保留小数，布局同步避让卖点描边', () => {
    for (const [raw, expected] of [[0, 60], [60, 60], [97.5, 97.5], [999, 180], [NaN, 60], [Infinity, 60]]) {
      expect(normalizeStudyDeskSingleOptions({ dimensionGap: raw }).dimensionGap).toBe(expected);
      const layout = getStudyDeskSingleLayout([200, 200, 200], raw);
      expect(layout.subjectSafeArea.y + layout.subjectSafeArea.height).toBe(1210 - 2 - expected);
      expect(layout.productArea.y + layout.productArea.height).toBe(1210 - 2 - expected);
    }
  });

  it('产品和完整高度范围标注在拖动缩放后仍位于型号与卖点间安全区', () => {
    const layout = getStudyDeskSingleLayout([200, 200, 200], 97);
    const labelSize = studyDeskSingleDimensionLabel(measure(), annotation, fields);
    const fit = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fit.productRect, fit.annotations.map((value) => ({ annotation: value, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: -900, offsetY: 900 });
    expect(moved.bounds.x).toBeGreaterThanOrEqual(94 - .001);
    expect(moved.bounds.y).toBeGreaterThanOrEqual(452 - .001);
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(1346 + .001);
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(layout.sellingPoints[0].y - 2 - 97 + .001);
  });

  it('选项使用独立默认对象；两个卖点只隐藏第三项，不改写原内容', () => {
    const defaults = { sizeLabels: ['', ''], dimensionGap: 60, sellingPointCount: 3 };
    expect(rules.createOptions()).toEqual(defaults);
    for (const value of [undefined, null, false, { sellingPointCount: 8, dimensionGap: '97' }]) expect(normalizeStudyDeskSingleOptions(value)).toEqual(defaults);
    const first = rules.createOptions(), second = rules.createOptions(); first.sizeLabels[0] = '独立';
    expect(second.sizeLabels).toEqual(['', '']); expect(rules.hasOptions(second)).toBe(false);
    expect(rules.hasOptions({ ...second, dimensionGap: 97 })).toBe(true);
    const points = ['测试一', '测试二', '测试三'];
    expect(rules.visibleSellingPoints(points, { ...second, sellingPointCount: 2 })).toEqual(['测试一', '测试二']);
    expect(points).toEqual(['测试一', '测试二', '测试三']);
  });

  it('只保存studyDeskSingle专属选项，不写标题或其他模板字段', () => {
    const options = { ...rules.createOptions(), sellingPointCount: 2 as const, dimensionGap: 97.5 };
    expect(rules.saveOptions(options)).toEqual({ studyDeskSingle: { sellingPointCount: 2, dimensionGap: 97.5 } });
    const draft = { studyDeskSingle: { sellingPointCount: 2, dimensionGap: 97.5 } } as StudyDeskSingleDraft;
    expect(rules.restoreOptions(draft)).toEqual(options);
    expect(rules.exportIssues(fields, '120×62×53~76', options, null)).toEqual([]);
    expect(rules.exportIssues(fields, '缺少尺寸', options, '型号过长')).toEqual(['型号过长', '快速尺寸无效，请按长×宽×高填写，并列规格用 /、升降范围用 ~ 分隔']);
  });
});
