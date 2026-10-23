import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { liftingSideTableSingleRules as rules } from '../templates/lifting-side-table-single';
import { drawLiftingSideTableDetails, liftingSideTableDetailCards, liftingSideTableDetailText, normalizeLiftingSideTableOptions } from './liftingSideTableSingleLayout';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[\u0100-\uffff]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
const fields = { length: '80.99/90.99', width: '50.99', height: '72.99~107.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 72.9, from: { x: 130, y: 700 }, to: { x: 130, y: 1200 } };
const options = () => normalizeLiftingSideTableOptions({ sideTableDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: '测试说明' })) });
function intersects(a: Rect, b: Rect) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

describe('升降边桌：P49独立细节图布局', () => {
  it('五张卡片为三大两小，间隔10px、下边1340，图片按各自区域铺满圆角裁切', () => {
    const value = options(), layout = rules.layout([], value), cards = liftingSideTableDetailCards(), slots = rules.accessories!(value, layout);
    expect(layout.modelBadge).toEqual({ x: 94, y: 302, height: 72 });
    expect(layout.sellingPoints).toEqual([]); expect(rules.visibleSellingPoints(['旧卖点'], value)).toEqual([]);
    expect(rules.note).toBeUndefined(); expect(rules.sellingPointIssue([], layout)).toBeNull();
    expect(cards).toEqual([
      { x: 725, y: 302, width: 621, height: 252 }, { x: 725, y: 564, width: 621, height: 252 }, { x: 725, y: 826, width: 621, height: 252 },
      { x: 725, y: 1088, width: 305.5, height: 252 }, { x: 1040.5, y: 1088, width: 305.5, height: 252 },
    ]);
    slots.forEach((slot, index) => {
      expect(slot).toEqual({ id: `side-detail-${index + 1}`, label: `细节${index + 1}`, area: cards[index], fit: 'cover', clipRadius: 28 });
      expect(intersects(slot.area, layout.subjectSafeArea)).toBe(false);
      for (const other of slots.slice(0, index)) expect(intersects(slot.area, other.area)).toBe(false);
    });
    expect(cards.at(-1)!.x + cards.at(-1)!.width).toBe(1346);
    expect(cards.at(-1)!.y + cards.at(-1)!.height).toBe(1340);
    expect(rules.accessories!(value, rules.layout([9000, 9000], value))).toEqual(slots);
  });

  it('主图和所有尺寸拖放适配后仍在左侧，不能侵入五张细节卡', () => {
    const value = options(), layout = rules.layout([], value), labelSize = rules.dimensionLabel(context, annotation, fields, value);
    const fitted = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 4, offsetX: 1000, offsetY: 1000 });
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(685.001);
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(1340.001);
    for (const card of liftingSideTableDetailCards()) expect(intersects(moved.bounds, card)).toBe(false);
  });

  it('型号固定45pt中黑并限制左侧宽度，不因长型号变小或省略规格', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.modelBadge(context, 'TEST-01升降边桌', layout)).toMatchObject({ fontSize: 45, issue: null });
    expect(context.font).toBe('45px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    const raw = '测试完整型号和规格'.repeat(4), result = rules.modelBadge(context, raw, layout);
    expect(result.text).toBe(raw); expect(result.fontSize).toBe(45); expect(result.issue).toContain('不能省略规格');
    expect(rules.modelBadge(context, '测试\n型号', layout).issue).toContain('单行');
  });

  it('标题和描述分别按规范字号及行距折行，保留手动换行和全部内容', () => {
    const detail = { title: '测试第一行\n测试第二行', description: '测试说明' }, text = liftingSideTableDetailText(context, detail, 0);
    expect(text.titleFont).toBe('45px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(text.descriptionFont).toBe('26px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    expect(text.titleLines).toEqual(['测试第一行', '测试第二行']); expect(text.descriptionY).toBe(302 + 40 + 95 + 20);
    expect(text.issues).toEqual([]);
    const small = liftingSideTableDetailText(context, { title: '测试卡片完整标题', description: '' }, 3);
    expect(small.titleFont).toBe('35px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(small.titleLines.join('')).toBe('测试卡片完整标题'); expect(small.titleLines.length).toBeGreaterThan(1);
    expect(small.issues).toEqual([]);
  });

  it('五个标题必填，说明可空；标题和说明各自报告实际文字容量超限', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.extraIssues!(context, value, layout, fields)).toEqual([]);
    expect(rules.extraIssues!(context, rules.createOptions(), layout)).toHaveLength(5);
    value.sideTableDetails[0] = { title: '测试标题', description: '' };
    expect(rules.extraIssues!(context, value, layout)).toEqual([]);
    const title = '测试完整标题'.repeat(20), description = '测试完整说明'.repeat(25);
    const tooLong = liftingSideTableDetailText(context, { title, description }, 0);
    expect(tooLong.titleLines.join('')).toBe(title); expect(tooLong.descriptionLines.join('')).toBe(description);
    expect(tooLong.issues.join('')).toContain('细节1标题过长'); expect(tooLong.issues.join('')).toContain('细节1说明过长');
    expect(liftingSideTableDetailText(context, { title: '测试\n标题', description: '说明一\n说明二' }, 0).issues.join('')).toContain('说明过长');
  });

  it('图上文字从卡片内40px开始，前三45pt后两35pt，说明26pt且不预画商品事实', () => {
    const texts: { text: string; x: number; y: number; font: string; color: string }[] = [];
    const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(),
      fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    drawLiftingSideTableDetails(draw as unknown as CanvasRenderingContext2D, rules.createOptions()); expect(texts).toEqual([]);
    const value = options(); value.sideTableDetails[0].description = '第一行\n第二行';
    drawLiftingSideTableDetails(draw as unknown as CanvasRenderingContext2D, value);
    expect(texts[0]).toEqual({ text: '测试细节1', x: 765, y: 342, font: '45px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif', color: '#000000' });
    expect(texts[1].y).toBe(407); expect(texts[2].y - texts[1].y).toBe(35);
    expect(texts.find((item) => item.text === '测试细节4')!.font).toBe('35px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(texts.every((item) => item.color === '#000000')).toBe(true);
  });

  it('尺寸保留45pt中黑、40px行距和所有范围数据，截断一位并拒绝无效尺寸', () => {
    const value = options();
    expect(rules.parseQuickDimensions('80.99/90.99×50.99×72.99~107.99cm')).toEqual({ length: '80.9/90.9', width: '50.9', height: '72.9~107.9' });
    const label = rules.dimensionLabel(context, annotation, fields, value);
    expect(label.runs.map((run) => run.text)).toEqual(['72.9~', '107.9cm']); expect(label.height).toBe(85);
    expect(label.runs[1].y - label.runs[0].y).toBe(40); expect(label.runs[0].font).toBe('45px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    for (const raw of ['', '0', '-1', '未知', '80/']) expect(rules.exportIssues({ ...fields, height: raw }, '', value, null).join('')).toContain('高尺寸');
    const many = Array.from({ length: 25 }, (_, index) => String(100 + index)).join('/');
    expect(rules.dimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, value).runs.map((run) => run.text).join('')).toBe(`${many}cm`);
    expect(rules.extraIssues!(context, value, rules.layout([], value), { ...fields, width: many }).join('')).toContain('不可删减规格');
  });

  it('固定五卡空白默认值不共享引用，非法或缺失字段归一化且保留真实长文案', () => {
    const empty = rules.createOptions(); expect(rules.hasOptions(empty)).toBe(false); expect(rules.hasOptions(options())).toBe(true);
    expect(empty).toEqual({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, sideTableDetails: Array.from({ length: 5 }, () => ({ title: '', description: '' })) });
    const source = [{ title: '真实完整文案'.repeat(20), description: '保留\n换行' }], normalized = normalizeLiftingSideTableOptions({ sideTableDetails: source });
    expect(normalized.sideTableDetails).toHaveLength(5); expect(normalized.sideTableDetails[0]).toEqual(source[0]);
    normalized.sideTableDetails[0].title = '修改'; expect(source[0].title).not.toBe('修改');
    expect(normalizeLiftingSideTableOptions({ sideTableDetails: { title: '错误数组' } })).toEqual(empty);
    expect(normalizeLiftingSideTableOptions({ sideTableDetails: [null, { title: 123, description: false }] })).toEqual(empty);
  });
});
