import { describe, expect, it } from 'vitest';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { getOfficeChairSingleLayout, normalizeOfficeChairOptions, officeChairDimensionIssue, officeChairDimensionLabel, officeChairModelBadge, parseOfficeChairDimensions } from './officeChairSingleLayout';

const context = { font: '', measureText(text: string) { return { width: text.length * parseFloat(this.font) * .6 } as TextMetrics; } };
const fields = { length: '62.99', width: '58.99', height: '96.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 96.9, from: { x: 100, y: 470 }, to: { x: 100, y: 1090 } };

describe('无功能书椅：PPT第2、3、46、48页', () => {
  it('三卖点和两卖点均在1440画布内，底部留130px并容纳长短文案', () => {
    for (const widths of [[250, 350, 250], [250, 350], [700, 100, 100]]) {
      const layout = getOfficeChairSingleLayout(widths);
      expect(layout.issue).toBeNull();
      expect(layout.sellingPoints).toHaveLength(widths.length);
      expect(layout.sellingPoints[0].x).toBeGreaterThanOrEqual(94);
      layout.sellingPoints.forEach((box, index) => {
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 50);
        expect(box.x + box.width).toBeLessThanOrEqual(1346);
        expect(1440 - box.y - box.height - 2).toBe(130);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
      });
    }
    expect(getOfficeChairSingleLayout([800, 800, 800]).issue).toContain('超出安全区');
  });

  it('恢复小于60px的间距及拖动缩放后，产品仍距卖点边框至少60px', () => {
    for (const requestedGap of [-20, 60, 120, 180, 500]) {
      const layout = getOfficeChairSingleLayout([200, 200, 200], requestedGap);
      const gap = normalizeOfficeChairOptions({ dimensionGap: requestedGap }).dimensionGap;
      const measured = [{ annotation, labelSize: officeChairDimensionLabel(context, annotation, fields) }];
      const fitted = fitAnnotatedProduct(layout.productArea, measured, layout.subjectSafeArea);
      const adjusted = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize: measured[0].labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 900, offsetY: 900 });
      expect(layout.sellingPoints[0].y - 2 - adjusted.productRect.y - adjusted.productRect.height).toBeGreaterThanOrEqual(gap - .001);
      expect(layout.subjectSafeArea.y).toBeGreaterThanOrEqual(layout.modelBadge.y + layout.modelBadge.height + 30);
    }
  });

  it('完整型号规格不加后缀、不缩写，超过普通宽度改35pt，再超安全区则阻止导出', () => {
    const regular = officeChairModelBadge(context, 'BY13-A电脑椅');
    expect(regular.text).toBe('BY13-A电脑椅');
    expect(regular.fontSize).toBe(45);
    const full = 'BY13-ABCDEFGHIJKLMNOPQRSTUVWXYZ电脑椅 62×58×96cm';
    expect(officeChairModelBadge(context, full)).toMatchObject({ text: full, fontSize: 35, issue: null });
    expect(officeChairModelBadge(context, '完整型号规格'.repeat(20)).issue).toContain('不能省略规格');
  });

  it('总长/总宽为单行，总高为两行，中文中黑45pt、基线间距40px', () => {
    for (const kind of ['length', 'width', 'height'] as const) {
      const label = officeChairDimensionLabel(context, { ...annotation, kind }, fields);
      expect(label.runs.map((run) => run.text).join('')).toBe(`${{ length: '总长62.9', width: '总宽58.9', height: '总高96.9' }[kind]}cm`);
      expect(label.runs.every((run) => run.font.includes('45px') && run.font.includes('方正兰亭中黑_GBK'))).toBe(true);
      if (kind === 'height') {
        expect(label.runs[1].y - label.runs[0].y).toBe(40);
        expect(label.height).toBe(85);
      } else expect(label.runs).toHaveLength(1);
    }
  });

  it('cm截断一位小数，缺项、零、负值、并列和范围尺寸均不得导出', () => {
    expect(parseOfficeChairDimensions('62.99×58.99×96.99cm')).toEqual({ length: '62.9', width: '58.9', height: '96.9' });
    expect(officeChairDimensionIssue(fields)).toBeNull();
    for (const value of ['', '0', '-1', '62/68', '62~68', 'abc']) {
      expect(officeChairDimensionIssue({ ...fields, length: value })).not.toBeNull();
      expect(parseOfficeChairDimensions(`${value}×58×96`)).toBeNull();
    }
  });
});
