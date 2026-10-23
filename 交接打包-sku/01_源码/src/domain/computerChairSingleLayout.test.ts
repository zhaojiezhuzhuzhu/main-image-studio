import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { computerChairSingleRules as rules } from '../templates/computer-chair-single';
import { computerChairDetailCards, computerChairDetailText, drawComputerChairDetails, normalizeComputerChairOptions, type ComputerChairDetail } from './computerChairSingleLayout';

const measure = () => ({ font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } });
const fields = { length: '62.99', width: '60.99', height: '85.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 85.9, from: { x: 210, y: 565 }, to: { x: 210, y: 1115 } };
const options = () => normalizeComputerChairOptions({ computerChairDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: '测试说明' })) });
function intersects(a: Rect, b: Rect) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

describe('电脑椅：P50 image104独立卡片版式，数据均为测试参数', () => {
  it('采用电脑椅自己的主图和卡片坐标，卡片间隔10px且底部留100px', () => {
    const value = options(), layout = rules.layout([], value), cards = computerChairDetailCards(), slots = rules.accessories!(value, layout);
    expect(layout.modelBadge).toEqual({ x: 90, y: 300, height: 72 });
    expect(layout.productArea).toEqual({ x: 224, y: 523, width: 460, height: 725 });
    expect(cards).toEqual([
      { x: 726, y: 300, width: 622, height: 252 }, { x: 726, y: 562, width: 622, height: 253 }, { x: 726, y: 825, width: 622, height: 253 },
      { x: 726, y: 1088, width: 306, height: 252 }, { x: 1042, y: 1088, width: 306, height: 252 },
    ]);
    slots.forEach((slot, index) => {
      expect(slot).toEqual({ id: `computer-detail-${index + 1}`, label: `细节图${index + 1}`, area: cards[index], fit: 'cover', clipRadius: 28 });
      expect(intersects(slot.area, layout.subjectSafeArea)).toBe(false);
      for (const other of slots.slice(0, index)) expect(intersects(slot.area, other.area)).toBe(false);
    });
    for (let i = 1; i < 4; i += 1) expect(cards[i].y - cards[i - 1].y - cards[i - 1].height).toBe(10);
    expect(cards[4].x - cards[3].x - cards[3].width).toBe(10);
    expect(cards[4].y + cards[4].height).toBe(1340);
    expect(layout.sellingPoints).toEqual([]); expect(rules.visibleSellingPoints(['旧卖点'], value)).toEqual([]);
    expect(rules.note).toBeUndefined(); expect(rules.sellingPointIssue([], layout)).toBeNull();
  });

  it('主图及全部标注经拖移缩放后仍在左侧，不挤入细节图区', () => {
    const value = options(), layout = rules.layout([], value), labelSize = rules.dimensionLabel(measure(), annotation, fields, value);
    const fitted = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 4, offsetX: 1000, offsetY: 1000 });
    expect(moved.bounds.x).toBeGreaterThanOrEqual(30 - .001); expect(moved.bounds.y).toBeGreaterThanOrEqual(412 - .001);
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(706.001);
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(1340.001);
    for (const card of computerChairDetailCards()) expect(intersects(moved.bounds, card)).toBe(false);
  });

  it('型号固定45pt中黑，完整规格过长时拦截而不缩小或删字', () => {
    const context = measure(), layout = rules.layout([], options());
    expect(rules.modelBadge(context, 'TEST-01电脑椅', layout)).toMatchObject({ fontSize: 45, issue: null });
    expect(context.font).toBe('45px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    const raw = '电脑椅完整型号与规格'.repeat(4), badge = rules.modelBadge(context, raw, layout);
    expect(badge.text).toBe(raw); expect(badge.fontSize).toBe(45); expect(badge.issue).toContain('不能省略规格');
    expect(rules.modelBadge(context, 'TEST\n电脑椅', layout).issue).toContain('单行');
  });

  it('总长总宽带前缀，总高名称与数值分行，维持45pt与40px基线', () => {
    const value = options(), context = measure();
    for (const [kind, expected] of [['length', ['总长62.9cm']], ['width', ['总宽60.9cm']], ['height', ['总高', '85.9cm']]] as const) {
      const label = rules.dimensionLabel(context, { ...annotation, kind }, fields, value);
      expect(label.runs.map((run) => run.text)).toEqual(expected);
      expect(label.runs.every((run) => run.font === '45px Montserrat, "方正兰亭中黑_GBK", sans-serif')).toBe(true);
      if (kind === 'height') { expect(label.height).toBe(85); expect(label.runs[1].y - label.runs[0].y).toBe(40); }
    }
    const range = rules.dimensionLabel(context, annotation, { ...fields, height: '85.99~107.99' }, value);
    expect(range.runs.map((run) => run.text)).toEqual(['总高', '85.9~', '107.9cm']); expect(range.height).toBe(125);
  });

  it('范围和并列规格完整截断保存，容量不足时提示保留全部真实尺寸', () => {
    const value = options(), context = measure(), layout = rules.layout([], value);
    expect(rules.parseQuickDimensions('62.99/65.99×60.99×85.99~107.99cm')).toEqual({ length: '62.9/65.9', width: '60.9', height: '85.9~107.9' });
    expect(rules.extraIssues!(context, value, layout, fields)).toEqual([]);
    for (const raw of ['', '0', '-1', '未知', '80/']) expect(rules.exportIssues({ ...fields, height: raw }, '', value, null).join('')).toContain('总高尺寸');
    const many = Array.from({ length: 25 }, (_, index) => String(100 + index)).join('/');
    const label = rules.dimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, value);
    expect(label.runs.map((run) => run.text).join('')).toBe(`总宽${many}cm`);
    expect(rules.extraIssues!(context, value, layout, { ...fields, width: many }).join('')).toContain('不可删减规格');
  });

  it('标题与说明固定字号独立折行，完整保留手动换行与长文案', () => {
    const context = measure(), detail: ComputerChairDetail = { title: '测试第一行\n测试第二行', description: '测试说明', textColor: 'black' };
    const text = computerChairDetailText(context, detail, 0);
    expect(text.titleFont).toBe('45px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(text.descriptionFont).toBe('26px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    expect(text.titleLines).toEqual(['测试第一行', '测试第二行']); expect(text.descriptionY).toBe(300 + 40 + 95 + 20);
    expect(text.issues).toEqual([]);
    const small = computerChairDetailText(context, { ...detail, title: '测试完整卡片标题', description: '' }, 3);
    expect(small.titleFont).toBe('35px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif');
    expect(small.titleLines.join('')).toBe('测试完整卡片标题'); expect(small.titleLines.length).toBeGreaterThan(1);
    expect(small.issues).toEqual([]);
  });

  it('五个标题必填，说明可空；按实测容量拦截标题和说明，原文均未截断', () => {
    const value = options(), context = measure(), layout = rules.layout([], value);
    expect(rules.extraIssues!(context, rules.createOptions(), layout)).toHaveLength(5);
    value.computerChairDetails[0].description = ''; expect(rules.extraIssues!(context, value, layout)).toEqual([]);
    const title = '测试完整标题'.repeat(20), description = '测试完整说明'.repeat(25);
    const text = computerChairDetailText(context, { title, description, textColor: 'white' }, 1);
    expect(text.titleLines.join('')).toBe(title); expect(text.descriptionLines.join('')).toBe(description);
    expect(text.issues.join('')).toContain('细节2标题过长'); expect(text.issues.join('')).toContain('细节2说明过长');
  });

  it('P50第二卡默认白字，其余黑字，切换后标题和说明一起变色且不改字号', () => {
    const texts: { text: string; x: number; y: number; font: string; color: string }[] = [];
    const draw = { ...measure(), fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(),
      fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    drawComputerChairDetails(draw as unknown as CanvasRenderingContext2D, rules.createOptions()); expect(texts).toEqual([]);
    const value = options(); drawComputerChairDetails(draw as unknown as CanvasRenderingContext2D, value);
    expect(texts[0]).toEqual({ text: '测试细节1', x: 766, y: 340, font: '45px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif', color: '#000000' });
    expect(texts[2].color).toBe('#ffffff'); expect(texts[3].color).toBe('#ffffff');
    expect(texts[4].color).toBe('#000000'); expect(texts[6].font).toContain('35px');
    value.computerChairDetails[1].textColor = 'black'; texts.length = 0;
    drawComputerChairDetails(draw as unknown as CanvasRenderingContext2D, value);
    expect(texts[2].color).toBe('#000000'); expect(texts[3].color).toBe('#000000'); expect(texts[2].font).toContain('45px');
  });

  it('固定五卡默认文案为空，选项和数组互不共享，也不误读边桌字段', () => {
    const empty = normalizeComputerChairOptions(undefined);
    expect(empty).toEqual({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, computerChairDetails: Array.from({ length: 5 }, (_, index) => ({ title: '', description: '', textColor: index === 1 ? 'white' : 'black' })) });
    expect(rules.hasOptions(empty)).toBe(false);
    const second = normalizeComputerChairOptions(undefined); second.computerChairDetails[0].textColor = 'white'; expect(rules.hasOptions(second)).toBe(true);
    const source = [{ title: '真实完整文案'.repeat(20), description: '保留\n换行', textColor: 'white' }], normalized = normalizeComputerChairOptions({ computerChairDetails: source });
    expect(normalized.computerChairDetails).toHaveLength(5); expect(normalized.computerChairDetails[0]).toEqual(source[0]);
    normalized.computerChairDetails[0].title = '修改'; expect(source[0].title).not.toBe('修改');
    for (const raw of [{ computerChairDetails: '错误数组' }, { computerChairDetails: [null, { title: 123, description: false, textColor: 'red' }] }, { sideTableDetails: source }]) expect(normalizeComputerChairOptions(raw)).toEqual(empty);
  });

  it('卡片文字从边缘40px开始，标题说明间隔20px，说明行距35px', () => {
    const detail: ComputerChairDetail = { title: '测试标题', description: '第一行\n第二行', textColor: 'black' }, text = computerChairDetailText(measure(), detail, 0);
    expect(text.descriptionY).toBe(300 + 40 + 45 + 20); expect(text.descriptionLines).toEqual(['第一行', '第二行']); expect(text.issues).toEqual([]);
    const positions: number[] = [], draw = { ...measure(), fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(), fillText(_text: string, _x: number, y: number) { positions.push(y); } };
    const value = normalizeComputerChairOptions({ computerChairDetails: [detail] }); drawComputerChairDetails(draw as unknown as CanvasRenderingContext2D, value);
    expect(positions).toEqual([340, 405, 440]);
  });
});
