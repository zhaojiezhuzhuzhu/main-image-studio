import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { ergonomicChairSingleRules as rules } from '../templates/ergonomic-chair-single';
import { drawErgonomicChairDetails, ergonomicChairDetailCards, ergonomicChairDetailText, normalizeErgonomicChairOptions } from './ergonomicChairSingleLayout';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[\u0100-\uffff]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
const fields = { length: '68.99', width: '62.99/66.99', height: '112.99~122.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 112.9, from: { x: 230, y: 490 }, to: { x: 230, y: 1210 } };
const options = () => normalizeErgonomicChairOptions({ ergonomicChairDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: '测试说明' })) });
function intersects(a: Rect, b: Rect) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

describe('工学椅：P50 image105独立布局', () => {
  it('主图按工学椅的高比例布置，五张细节卡保持三大两小及10px间隔', () => {
    const value = options(), layout = rules.layout([], value), cards = ergonomicChairDetailCards(), slots = rules.accessories!(value, layout);
    expect(layout.modelBadge).toEqual({ x: 90, y: 300, height: 72 });
    expect(layout.productArea).toEqual({ x: 245, y: 475, width: 440, height: 795 });
    expect(layout.subjectSafeArea).toEqual({ x: 30, y: 412, width: 685, height: 928 });
    expect(layout.sellingPoints).toEqual([]); expect(rules.visibleSellingPoints(['旧卖点'], value)).toEqual([]);
    expect(rules.note).toBeUndefined();
    expect(cards).toEqual([
      { x: 726, y: 300, width: 622, height: 252.5 }, { x: 726, y: 562.5, width: 622, height: 252.5 }, { x: 726, y: 825, width: 622, height: 252.5 },
      { x: 726, y: 1087.5, width: 306, height: 252.5 }, { x: 1042, y: 1087.5, width: 306, height: 252.5 },
    ]);
    slots.forEach((slot, index) => {
      expect(slot).toEqual({ id: `ergonomic-detail-${index + 1}`, label: `细节${index + 1}`, area: cards[index], fit: 'cover', clipRadius: 28 });
      expect(intersects(slot.area, layout.subjectSafeArea)).toBe(false);
      for (const other of slots.slice(0, index)) expect(intersects(slot.area, other.area)).toBe(false);
    });
    expect(cards.at(-1)!.x + cards.at(-1)!.width).toBe(1348); expect(cards.at(-1)!.y + cards.at(-1)!.height).toBe(1340);
    expect(rules.accessories!(value, rules.layout([9000, 9000], value))).toEqual(slots);
  });

  it('三行总高标注和主图共同适配左侧，移动缩放后不侵入型号或细节卡', () => {
    const value = options(), layout = rules.layout([], value), labelSize = rules.dimensionLabel(context, annotation, fields, value);
    const fitted = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 4, offsetX: 1000, offsetY: 1000 });
    expect(moved.bounds.x).toBeGreaterThanOrEqual(29.999); expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(715.001);
    expect(moved.bounds.y).toBeGreaterThanOrEqual(411.999); expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(1340.001);
    for (const card of ergonomicChairDetailCards()) expect(intersects(moved.bounds, card)).toBe(false);
  });

  it('型号45pt中黑白字，不因左侧空间有限而缩小或截断完整规格', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.modelBadge(context, 'TEST-01工学椅', layout)).toMatchObject({ fontSize: 45, issue: null });
    expect(context.font).toBe('45px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    const raw = '测试完整型号和规格'.repeat(4), result = rules.modelBadge(context, raw, layout);
    expect(result.text).toBe(raw); expect(result.fontSize).toBe(45); expect(result.issue).toContain('不能省略规格');
    expect(rules.modelBadge(context, '测试\n型号', layout).issue).toContain('单行');
  });

  it('前三标题45pt、后两35pt，完整描述可分三行，行距50/35且图上文字全黑', () => {
    const detail = { title: '测试调节', description: '· 第一项测试\n· 第二项测试\n· 第三项测试' }, text = ergonomicChairDetailText(context, detail, 2);
    expect(text.titleFont).toBe('45px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(text.descriptionFont).toBe('26px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    expect(text.descriptionLines).toEqual(detail.description.split('\n')); expect(text.issues).toEqual([]);
    const small = ergonomicChairDetailText(context, { title: '测试卡片完整标题', description: '' }, 3);
    expect(small.titleFont).toBe('35px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(small.titleLines.join('')).toBe('测试卡片完整标题'); expect(small.titleLines.length).toBeGreaterThan(1); expect(small.issues).toEqual([]);
    const texts: { text: string; x: number; y: number; font: string; color: string }[] = [];
    const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(),
      fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    const value = options(); value.ergonomicChairDetails[0] = { title: '测试第一行\n测试第二行', description: '' }; value.ergonomicChairDetails[2] = detail;
    drawErgonomicChairDetails(draw as unknown as CanvasRenderingContext2D, value);
    expect(texts[0]).toMatchObject({ text: '测试第一行', x: 766, y: 340 }); expect(texts[1].y - texts[0].y).toBe(50);
    const descriptions = texts.filter((item) => item.text.startsWith('·'));
    expect(descriptions[1].y - descriptions[0].y).toBe(35); expect(descriptions[2].y - descriptions[1].y).toBe(35);
    expect(texts.every((item) => item.color === '#000000')).toBe(true);
  });

  it('五个标题必填、说明可空，标题和说明溢出各自提示而保留全部文案', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.extraIssues!(context, value, layout, fields)).toEqual([]);
    expect(rules.extraIssues!(context, rules.createOptions(), layout)).toHaveLength(5);
    value.ergonomicChairDetails[0] = { title: '测试标题', description: '' }; expect(rules.extraIssues!(context, value, layout)).toEqual([]);
    const title = '测试完整标题'.repeat(20), description = '测试完整说明'.repeat(25);
    const tooLong = ergonomicChairDetailText(context, { title, description }, 0);
    expect(tooLong.titleLines.join('')).toBe(title); expect(tooLong.descriptionLines.join('')).toBe(description);
    expect(tooLong.issues.join('')).toContain('细节1标题过长'); expect(tooLong.issues.join('')).toContain('细节1说明过长');
    expect(ergonomicChairDetailText(context, { title: '测试\n标题', description: '说明一\n说明二' }, 0).issues.join('')).toContain('说明过长');
  });

  it('总长总宽带前缀，总高范围分三行且完整截断一位，单高度分两行', () => {
    const value = options();
    expect(rules.parseQuickDimensions('68.99×62.99/66.99×112.99~122.99cm')).toEqual({ length: '68.9', width: '62.9/66.9', height: '112.9~122.9' });
    const label = rules.dimensionLabel(context, annotation, fields, value);
    expect(label.runs.map((run) => run.text)).toEqual(['总高', '112.9~', '122.9cm']); expect(label.height).toBe(125);
    expect(label.runs[1].y - label.runs[0].y).toBe(40); expect(label.runs[0].font).toBe('45px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    expect(rules.dimensionLabel(context, annotation, { ...fields, height: '112.99' }, value).runs.map((run) => run.text)).toEqual(['总高', '112.9cm']);
    expect(rules.dimensionLabel(context, { ...annotation, kind: 'length' }, fields, value).runs.map((run) => run.text)).toEqual(['总长68.9cm']);
    expect(rules.dimensionLabel(context, { ...annotation, kind: 'width' }, fields, value).runs.map((run) => run.text).join('')).toBe('总宽62.9/66.9cm');
  });

  it('缺失尺寸、无效快速输入和过多并列数据均阻止导出，尺寸数据不静默删减', () => {
    const value = options();
    for (const raw of ['', '0', '-1', '未知', '80/']) expect(rules.exportIssues({ ...fields, height: raw }, '', value, null).join('')).toContain('总高尺寸');
    expect(rules.exportIssues(fields, '68×62', value, null).join('')).toContain('快速尺寸无效');
    const many = Array.from({ length: 25 }, (_, index) => String(100 + index)).join('/');
    expect(rules.dimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, value).runs.map((run) => run.text).join('')).toBe(`总宽${many}cm`);
    expect(rules.extraIssues!(context, value, rules.layout([], value), { ...fields, width: many }).join('')).toContain('不可删减规格');
  });

  it('固定五项空白默认值不含样例功能和角度，异常内容归一化且不共享对象', () => {
    const empty = rules.createOptions(); expect(rules.hasOptions(empty)).toBe(false); expect(rules.hasOptions(options())).toBe(true);
    expect(empty).toEqual({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, ergonomicChairDetails: Array.from({ length: 5 }, () => ({ title: '', description: '' })) });
    const source = [{ title: '真实完整文案'.repeat(20), description: '保留\n换行' }], normalized = normalizeErgonomicChairOptions({ ergonomicChairDetails: source });
    expect(normalized.ergonomicChairDetails).toHaveLength(5); expect(normalized.ergonomicChairDetails[0]).toEqual(source[0]);
    normalized.ergonomicChairDetails[0].title = '修改'; expect(source[0].title).not.toBe('修改');
    expect(normalizeErgonomicChairOptions({ ergonomicChairDetails: { title: '错误数组' } })).toEqual(empty);
    expect(normalizeErgonomicChairOptions({ ergonomicChairDetails: [null, { title: 123, description: false }] })).toEqual(empty);
    const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(), fillText: vi.fn() };
    drawErgonomicChairDetails(draw as unknown as CanvasRenderingContext2D, empty); expect(draw.fillText).not.toHaveBeenCalled();
  });
});
