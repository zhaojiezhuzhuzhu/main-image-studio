import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { standingDeskCombinationRules as rules } from '../templates/standing-desk-combination';
import { drawStandingDeskCombinationExtras, normalizeStandingDeskCombinationOptions, standingDeskCombinationAccessoryBadges, standingDeskCombinationHeadlineIssue, standingDeskCombinationNote } from './standingDeskCombinationLayout';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[\u0100-\uffff]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
const fields = { length: '120.99/150.99/180.99', width: '62.99/75.99/75.99', height: '73.99~122.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 73.9, from: { x: 250, y: 620 }, to: { x: 250, y: 1000 } };
const options = (count: 2 | 3 = 3) => normalizeStandingDeskCombinationOptions({ headline: '测试参数标题', standingDeskSet: { count, riserModel: '测试A增高架', chairModel: '测试B电脑椅', riserNote: '测试搭配说明' } });
function intersects(a: Rect, b: Rect) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

describe('电动升降桌组合：第44–45页，测试参数', () => {
  it('并列长宽与升降范围截断一位，35pt中黑与40px行距保留全部数字', () => {
    expect(rules.parseQuickDimensions('120.99/150.99×62.99/75.99×73.99~122.99cm')).toEqual({ length: '120.9/150.9', width: '62.9/75.9', height: '73.9~122.9' });
    const value = options(), label = rules.dimensionLabel(context, annotation, fields, value);
    expect(label.runs.map((run) => run.text)).toEqual(['73.9~', '122.9cm']);
    expect(rules.dimensionLabel(context, annotation, { ...fields, height: '73~122' }, value).runs.map((run) => run.text)).toEqual(['73~', '122cm']);
    expect(label.runs[1].y - label.runs[0].y).toBe(40); expect(label.height).toBe(80);
    expect(label.runs.every((run) => run.font === '35px Montserrat, "方正兰亭中黑_GBK", sans-serif')).toBe(true);
    expect(rules.exportIssues(fields, '', value, null)).toEqual([]);
    expect(rules.extraIssues!(context, value, rules.layout([200, 200, 200], value), fields)).toEqual([]);
  });

  it('缺失或无效尺寸阻止导出，超长完整规格不静默截断或缩小', () => {
    const value = options(), layout = rules.layout([200, 200, 200], value);
    for (const raw of ['', '0', '-1', '未知', '80/']) expect(rules.exportIssues({ ...fields, height: raw }, '', value, null).join('')).toContain('高尺寸');
    const many = Array.from({ length: 40 }, (_, index) => String(100 + index)).join('/');
    const label = rules.dimensionLabel(context, { ...annotation, kind: 'width' }, { ...fields, width: many }, value);
    expect(label.runs.map((run) => run.text).join('')).toBe(`${many}cm`);
    expect(rules.extraIssues!(context, value, layout, { ...fields, width: many }).join('')).toContain('不可删减规格');
    expect(rules.exportIssues(fields, '120x75', value, null).join('')).toContain('快速尺寸无效');
  });

  it('标题、配件型号和小备注按实际字体度量，超限完整文本继续保存', () => {
    const value = options(), layout = rules.layout([], value);
    expect(standingDeskCombinationHeadlineIssue(context, '')).toContain('请填写');
    expect(standingDeskCombinationHeadlineIssue(context, '测试\n标题')).toContain('单行');
    value.headline = '标题'.repeat(12); value.standingDeskSet.riserModel = '完整型号'.repeat(12); value.standingDeskSet.riserNote = '完整备注'.repeat(12);
    expect(rules.extraIssues!(context, value, layout).join('')).toContain('80号');
    expect(rules.extraIssues!(context, value, layout).join('')).toContain('不可省略型号');
    expect(rules.extraIssues!(context, value, layout).join('')).toContain('20号');
    expect(standingDeskCombinationAccessoryBadges(context, value)[0].text).toBe(value.standingDeskSet.riserModel);
    expect(rules.saveOptions(value)).toHaveProperty('standingDeskCombination.headline', value.headline);
    value.headline = '测试标题'; value.standingDeskSet.riserModel = '测试增高架'; value.standingDeskSet.riserNote = '换行\n说明';
    expect(rules.extraIssues!(context, value, layout).join('')).toContain('补充说明请填写单行');
  });

  it('只验证当前可见配件，底部固定搭配说明随两件套与三件套切换', () => {
    const value = options(2); value.standingDeskSet.chairModel = ''; value.standingDeskSet.riserNote = '隐藏的\n说明';
    let layout = rules.layout([], value);
    expect(rules.accessories!(value, layout).map((item) => item.id)).toEqual(['riser']);
    expect(rules.extraIssues!(context, value, layout)).toEqual([]);
    expect(standingDeskCombinationNote(value, layout)).toMatchObject({ text: '*增高架为推荐搭配，产品发货数量以最终下单选择为准', color: '#000000', y: 1380 });
    value.standingDeskSet.count = 3; layout = rules.layout([], value);
    expect(rules.accessories!(value, layout).map((item) => item.id)).toEqual(['riser', 'chair']);
    expect(rules.extraIssues!(context, value, layout).join('')).toContain('电脑椅');
    expect(standingDeskCombinationNote(value, layout).text).toBe('*增高架/电脑椅为推荐搭配，产品发货数量以最终下单选择为准');
    expect(standingDeskCombinationNote(value, layout).font).toBe('40px "方正兰亭准黑_GBK", sans-serif');
  });

  it('主桌与标注整体限制在安全区，各配件图片避开标题、型号、卖点及其他配件', () => {
    for (const count of [2, 3] as const) {
      const value = options(count), layout = rules.layout([200, 200, 200], value);
      const labelSize = rules.dimensionLabel(context, annotation, fields, value);
      const fitted = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
      const moved = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 1200, offsetY: 1200 });
      const accessories = rules.accessories!(value, layout), badges = standingDeskCombinationAccessoryBadges(context, value);
      for (const [index, accessory] of accessories.entries()) {
        expect(intersects(accessory.area, moved.bounds)).toBe(false);
        expect(intersects(accessory.area, layout.subjectSafeArea)).toBe(false);
        expect(intersects(badges[index].box, layout.subjectSafeArea)).toBe(false);
        expect(intersects(accessory.area, badges[index].box)).toBe(false);
        expect(accessory.area.y).toBeGreaterThan(462);
        expect(accessory.area.x + accessory.area.width).toBeLessThanOrEqual(1346);
        expect(accessory.area.y + accessory.area.height + value.dimensionGap).toBeLessThanOrEqual(1212);
        if (index) expect(intersects(accessory.area, accessories[index - 1].area)).toBe(false);
      }
      expect(layout.modelBadge).toEqual({ x: 94, y: 410, height: 52 });
      layout.sellingPoints.forEach((box, index) => { expect(box.x - 2).toBeGreaterThanOrEqual(94); expect(box.x + box.width + 2).toBeLessThanOrEqual(1346); expect(box.height).toBe(98); if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBe(30); });
    }
    expect(rules.layout([800, 800, 800], options()).issue).toContain('超出安全区');
  });

  it('绘制80pt标题、35pt白字圆角型号和20pt三件套备注，空白默认值不虚构材质', () => {
    const texts: { text: string; x: number; y: number; font: string; color: string }[] = [], boxes: number[][] = [];
    const draw = { ...context, fillStyle: '', textBaseline: '', textAlign: '', save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), roundRect: (...args: number[]) => boxes.push(args),
      fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    const value = options(); drawStandingDeskCombinationExtras(draw as unknown as CanvasRenderingContext2D, value, rules.layout([], value));
    expect(texts[0]).toEqual({ text: '测试参数标题', x: 94, y: 340, font: '80px "Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif', color: '#000000' });
    expect(texts.filter((item) => item.font.startsWith('35px ')).every((item) => item.color === '#ffffff')).toBe(true);
    expect(boxes).toHaveLength(2); expect(boxes.every((box) => box[4] === 8)).toBe(true);
    expect(texts.at(-1)).toMatchObject({ text: '测试搭配说明', font: '20px Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#000000', y: 1152 });
    const empty = rules.createOptions(); expect(empty.headline).toBe(''); expect(empty.standingDeskSet).toEqual({ count: 2, riserModel: '', chairModel: '', riserNote: '' });
    expect(rules.hasOptions(empty)).toBe(false); expect(rules.hasOptions(value)).toBe(true);
    empty.standingDeskSet!.riserModel = '已填写'; expect(rules.createOptions().standingDeskSet!.riserModel).toBe('');
    expect(normalizeStandingDeskCombinationOptions({ headline: 123, standingDeskSet: { count: 99, riserModel: false } })).toEqual(rules.createOptions());
  });
});
