import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { studyDeskCombinationRules as rules } from '../templates/study-desk-combination';
import { drawStudyDeskCombinationExtras, normalizeStudyDeskCombinationOptions, studyDeskCombinationChairBadge, studyDeskCombinationNote } from './studyDeskCombinationLayout';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[\u0100-\uffff]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
const fields = { length: '120.99/150.99', width: '62.99/75.99', height: '73.99~122.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 73.9, from: { x: 250, y: 550 }, to: { x: 250, y: 950 } };
const options = () => normalizeStudyDeskCombinationOptions({ studyChairModel: '测试A学习椅' });
function intersects(a: Rect, b: Rect) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

describe('儿童学习桌组合：P47组合图及P48间距要求', () => {
  it('并列数据及升降范围截断一位，高度强制在~后折行，保留35pt与40px基线间距', () => {
    expect(rules.parseQuickDimensions('120.99/150.99×62.99/75.99×73.99~122.99cm')).toEqual({ length: '120.9/150.9', width: '62.9/75.9', height: '73.9~122.9' });
    const value = options(), label = rules.dimensionLabel(context, annotation, fields, value);
    expect(label.runs.map((run) => run.text)).toEqual(['73.9~', '122.9cm']);
    expect(label.runs[1].y - label.runs[0].y).toBe(40); expect(label.height).toBe(80);
    expect(label.runs.every((run) => run.font === '35px Montserrat, "方正兰亭中黑_GBK", sans-serif')).toBe(true);
    expect(rules.dimensionKinds).toEqual(['length', 'width', 'height']);
    expect(rules.exportIssues(fields, '', value, null)).toEqual([]);
    expect(rules.extraIssues!(context, value, rules.layout([200, 200, 200], value), fields)).toEqual([]);
  });

  it('无效或缺失尺寸阻止导出，过多并列规格完整保留并提示分图', () => {
    const value = options(), layout = rules.layout([], value);
    for (const raw of ['', '0', '-1', '未知', '80/']) expect(rules.exportIssues({ ...fields, height: raw }, '', value, null).join('')).toContain('高尺寸');
    expect(rules.exportIssues(fields, '120×62', value, null).join('')).toContain('快速尺寸无效');
    const many = Array.from({ length: 30 }, (_, index) => String(100 + index)).join('/');
    const label = rules.dimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, value);
    expect(label.runs.map((run) => run.text).join('')).toBe(`${many}cm`);
    expect(rules.extraIssues!(context, value, layout, { ...fields, width: many }).join('')).toContain('不可删减规格');
  });

  it('主桌和学习椅型号按实际35pt字宽检查，不截断完整型号或降字号', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.modelBadge(context, '测试桌完整型号', layout).fontSize).toBe(35);
    expect(rules.modelBadge(context, '完整型号'.repeat(12), layout).issue).toContain('不能省略规格');
    expect(rules.modelBadge(context, '学习桌\n规格', layout).issue).toContain('单行');
    expect(studyDeskCombinationChairBadge(context, rules.createOptions()).issue).toContain('请填写学习椅');
    value.studyChairModel = '完整型号'.repeat(12);
    expect(studyDeskCombinationChairBadge(context, value).text).toBe(value.studyChairModel);
    expect(rules.extraIssues!(context, value, layout).join('')).toContain('不可省略型号或规格');
    value.studyChairModel = '学习椅\n规格';
    expect(studyDeskCombinationChairBadge(context, value).issue).toContain('单行');
  });

  it('独立学习椅区与主桌标注、型号互不碰撞，60到180px间距均包含卖点描边', () => {
    for (const dimensionGap of [60, 140, 180]) {
      const value = { ...options(), dimensionGap }, layout = rules.layout([200, 200, 200], value);
      const [chair] = rules.accessories!(value, layout), badge = studyDeskCombinationChairBadge(context, value);
      expect(chair.id).toBe('study-chair'); expect(chair.label).toBe('学习椅');
      expect(layout.modelBadge).toEqual({ x: 94, y: 350, height: 52 });
      expect(intersects(chair.area, layout.subjectSafeArea)).toBe(false);
      expect(intersects(badge.box, layout.subjectSafeArea)).toBe(false);
      expect(intersects(chair.area, badge.box)).toBe(false);
      expect(chair.area.height).toBeGreaterThan(0);
      expect(chair.area.x + chair.area.width).toBe(1346);
      expect(chair.area.y + chair.area.height + dimensionGap).toBe(1210);
      expect(layout.subjectSafeArea.y + layout.subjectSafeArea.height + dimensionGap).toBe(1210);
      const labelSize = rules.dimensionLabel(context, annotation, fields, value);
      const fitted = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
      const moved = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 4, offsetX: 1000, offsetY: 1000 });
      expect(intersects(moved.bounds, chair.area)).toBe(false);
      expect(intersects(moved.bounds, badge.box)).toBe(false);
      expect(moved.bounds.y + moved.bounds.height + dimensionGap).toBeLessThanOrEqual(1210.001);
      expect(rules.accessories!(value, rules.layout([], value))).toEqual([chair]);
    }
  });

  it('三卖点和特殊两卖点保持98px高、30px横向间隔，超宽明确阻止导出', () => {
    for (const count of [2, 3] as const) {
      const value = { ...options(), sellingPointCount: count }, points = rules.visibleSellingPoints(['测试一', '测试二', '测试三'], value);
      const layout = rules.layout(points.map(() => 200), value);
      expect(points).toHaveLength(count); expect(layout.issue).toBeNull();
      layout.sellingPoints.forEach((box, index) => {
        expect(box.height).toBe(98); expect(box.y).toBe(1212);
        expect(box.x - 2).toBeGreaterThanOrEqual(94); expect(box.x + box.width + 2).toBeLessThanOrEqual(1346);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBe(30);
      });
    }
    expect(rules.layout([800, 800, 800], options()).issue).toContain('超出安全区');
  });

  it('仅绘学习椅蓝底白字标签，无大标题，底部固定40pt搭配说明', () => {
    const texts: { text: string; x: number; y: number; font: string; color: string }[] = [], boxes: number[][] = [];
    const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), roundRect: (...args: number[]) => boxes.push(args),
      fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    const value = options(); drawStudyDeskCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, rules.layout([], value));
    expect(texts).toEqual([{ text: '测试A学习椅', x: 957, y: 629, font: '35px Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#ffffff' }]);
    expect(boxes).toHaveLength(1); expect(boxes[0][4]).toBe(8);
    expect(studyDeskCombinationNote).toEqual({ text: '*学习椅为推荐搭配，产品发货数量以最终下单选择为准', font: '40px "方正兰亭准黑_GBK", sans-serif', color: '#000000', x: 228, y: 1380 });
  });

  it('空白默认值不预填产品事实，默认140px及异常间距归一化不会污染另一个现场', () => {
    const value = rules.createOptions();
    expect(value).toEqual({ sizeLabels: ['', ''], studyChairModel: '', sellingPointCount: 3, dimensionGap: 140 });
    expect(rules.hasOptions(value)).toBe(false); expect(rules.hasOptions(options())).toBe(true);
    expect(normalizeStudyDeskCombinationOptions({ studyChairModel: 123, sellingPointCount: 7, dimensionGap: NaN })).toEqual(value);
    expect(normalizeStudyDeskCombinationOptions({ dimensionGap: -1 }).dimensionGap).toBe(60);
    expect(normalizeStudyDeskCombinationOptions({ dimensionGap: 999 }).dimensionGap).toBe(180);
    value.sizeLabels[0] = '不应带入'; expect(rules.createOptions().sizeLabels[0]).toBe('');
  });
});
