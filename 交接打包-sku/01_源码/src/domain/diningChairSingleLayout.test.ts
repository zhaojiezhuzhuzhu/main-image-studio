import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { diningChairAccessories, diningChairDimensionIssue, diningChairDimensionLabel, diningChairExtraIssues, diningChairModelBadge, drawDiningChairExtras, getDiningChairSingleLayout, normalizeDiningChairOptions, parseDiningChairDimensions, type DiningChairDraft, type DiningChairOptions } from './diningChairSingleLayout';
import { diningChairSingleRules as rules } from '../templates/dining-chair-single';

const measure = () => ({ font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } });
const fields = { length: '53.99', width: '50.59', height: '82.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 82.9, from: { x: 615, y: 495 }, to: { x: 615, y: 1090 } };
const options = (override: Partial<DiningChairOptions['diningChair']> = {}): DiningChairOptions => {
  const value = normalizeDiningChairOptions(undefined);
  return { ...value, diningChair: { ...value.diningChair, ...override } };
};
const context = () => ({ ...measure(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(), strokeStyle: '', fillStyle: '', lineWidth: 0, lineCap: '', lineJoin: '', textAlign: '', textBaseline: '' });

describe('餐椅双视图 P40–41，数据只作流程测试', () => {
  it('三个正数按cm截断一位小数，不把两视图解释为两个规格', () => {
    expect(parseDiningChairDimensions('53.99×50.59×82.99cm')).toEqual({ length: '53.9', width: '50.5', height: '82.9' });
    expect(diningChairDimensionIssue(fields, options())).toBeNull();
    for (const value of ['', '0', '-1', '50/52', '50~52', '未知']) {
      expect(parseDiningChairDimensions(`53×${value}×82`)).toBeNull();
      expect(diningChairDimensionIssue({ ...fields, width: value }, options())).not.toBeNull();
    }
  });

  it('常规三维标总长总宽总高，全部45号准黑且不默认脚垫说明', () => {
    for (const [kind, text] of [['length', '总长53.9cm'], ['width', '总宽50.5cm'], ['height', '总高82.9cm']] as const) {
      const label = diningChairDimensionLabel(measure(), { ...annotation, kind }, fields, options());
      expect(label.runs.map((run) => run.text)).toEqual([text]); expect(label.height).toBe(45);
      expect(label.runs[0].font).toContain('45px'); expect(label.runs[0].font).toContain('方正兰亭准黑_GBK');
    }
  });

  it('高度补充说明依实际输入另起一行，完整显示且检查容量', () => {
    const value = options({ heightNote: '含脚垫' });
    const label = diningChairDimensionLabel(measure(), annotation, fields, value);
    expect(label.runs.map((run) => run.text)).toEqual(['总高82.9cm', '（含脚垫）']);
    expect(label.runs[1].y - label.runs[0].y).toBe(55); expect(label.height).toBe(100);
    const layout = getDiningChairSingleLayout([200, 200, 200], value);
    expect(diningChairExtraIssues(measure(), value, layout, fields)).toEqual([]);
    expect(diningChairExtraIssues(measure(), options({ heightNote: '测量说明'.repeat(8) }), layout, fields).join('')).toContain('高度补充说明过长');
    expect(diningChairExtraIssues(measure(), options({ heightNote: '含\n脚垫' }), layout).join('')).toContain('单行');
  });

  it('数量只附加到蓝标与导出文件名，保留用户原始型号', () => {
    const model = 'TEST-A餐椅', layout = getDiningChairSingleLayout([200, 200, 200], options());
    for (const quantity of [1, 2] as const) {
      const value = options({ quantity });
      expect(diningChairModelBadge(measure(), model, layout, value)).toMatchObject({ text: `${model}x${quantity}`, fontSize: 45, issue: null });
      expect(rules.exportFileName!(model, value)).toBe(`${model}-餐椅x${quantity}-SKU.jpg`);
    }
    expect(model).toBe('TEST-A餐椅');
    const long = '餐椅完整型号'.repeat(15);
    const badge = diningChairModelBadge(measure(), long, layout, options({ quantity: 2 }));
    expect(badge.text).toBe(`${long}x2`); expect(badge.issue).toContain('不可省略规格');
    expect(diningChairModelBadge(measure(), 'TEST\n餐椅', layout, options()).issue).toContain('一行');
  });

  it('特殊模式区分主图腿间宽与第二视图总宽，两值不能相互推测', () => {
    const value = options({ widthMode: 'outside', outerWidth: '52.49' });
    expect(diningChairDimensionLabel(measure(), { ...annotation, kind: 'width' }, fields, value).runs[0].text).toBe('50.5cm');
    expect(diningChairDimensionIssue(fields, value)).toBeNull();
    expect(diningChairDimensionIssue(fields, options({ widthMode: 'outside' }))).toContain('不能根据腿间宽或图片推测');
    expect(diningChairDimensionIssue(fields, options({ widthMode: 'outside', outerWidth: '52/53' }))).toContain('一个正数');
    expect(diningChairDimensionIssue({ ...fields, width: '' }, value)).toContain('腿间宽');
    expect(diningChairDimensionIssue(fields, options({ outerWidth: '未知' }))).toBeNull();
  });

  it('第二视图总宽线跟随实际图片矩形，不使用主图位置或固定假尺寸', () => {
    const value = options({ widthMode: 'outside', outerWidth: '52.49' }), layout = getDiningChairSingleLayout([200, 200, 200], value);
    for (const rect of [{ x: 860, y: 510, width: 450, height: 575 }, { x: 900, y: 590, width: 350, height: 450 }]) {
      const ctx = context();
      drawDiningChairExtras(ctx as unknown as CanvasRenderingContext2D, value, layout, { x: 100, y: 500, width: 300, height: 500 }, [{ id: 'chair-rear', productRect: rect }]);
      expect(ctx.moveTo).toHaveBeenCalledWith(rect.x + 1, rect.y + rect.height + 18);
      expect(ctx.lineTo).toHaveBeenCalledWith(rect.x + rect.width - 1, rect.y + rect.height + 18);
      expect(ctx.fillText).toHaveBeenCalledWith('总宽52.4cm', rect.x + rect.width / 2, rect.y + rect.height + 58.5);
      expect(ctx.font).toContain('45px'); expect(ctx.font).toContain('方正兰亭准黑_GBK');
      expect(ctx.strokeStyle).toBe('#545454'); expect(ctx.restore).toHaveBeenCalledOnce();
    }
  });

  it('常规模式、缺少第二图或无效总宽时不绘制额外尺寸线', () => {
    const layout = getDiningChairSingleLayout([200, 200, 200], options());
    for (const [value, images] of [
      [options(), [{ id: 'chair-rear', productRect: { x: 860, y: 510, width: 450, height: 575 } }]],
      [options({ widthMode: 'outside', outerWidth: '52.4' }), []],
      [options({ widthMode: 'outside', outerWidth: '未知' }), [{ id: 'chair-rear', productRect: { x: 860, y: 510, width: 450, height: 575 } }]],
    ] as const) {
      const ctx = context();
      drawDiningChairExtras(ctx as unknown as CanvasRenderingContext2D, value, layout, undefined, images);
      expect(ctx.fillText).not.toHaveBeenCalled(); expect(ctx.stroke).not.toHaveBeenCalled();
    }
  });

  it('缩小或平移第二图时总宽文字保持完整并限制于第二图区', () => {
    const value = options({ widthMode: 'outside', outerWidth: '52.4' }), layout = getDiningChairSingleLayout([200, 200, 200], value);
    for (const x of [850, 1324]) {
      const ctx = context();
      drawDiningChairExtras(ctx as unknown as CanvasRenderingContext2D, value, layout, undefined, [{ id: 'chair-rear', productRect: { x, y: 800, width: 20, height: 25 } }]);
      const center = ctx.fillText.mock.calls[0][1], halfWidth = ctx.measureText('总宽52.4cm').width / 2;
      expect(center - halfWidth).toBeGreaterThanOrEqual(850); expect(center + halfWidth).toBeLessThanOrEqual(1346);
    }
  });

  it('第二图始终独立，特殊标线及文本避开卖点区', () => {
    for (const dimensionGap of [60, 97, 180]) {
      const value = { ...options({ widthMode: 'outside', outerWidth: '52.4' }), dimensionGap };
      const layout = getDiningChairSingleLayout([200, 200, 200], value), slot = diningChairAccessories(value, layout)[0];
      expect(slot.id).toBe('chair-rear'); expect(slot.label).toBe('第二视图');
      expect(slot.area.x).toBeGreaterThan(layout.subjectSafeArea.x + layout.subjectSafeArea.width);
      expect(slot.area.y + slot.area.height + 81).toBeLessThanOrEqual(layout.sellingPoints[0].y - 2 - dimensionGap);
    }
  });

  it('P41新版型号坐标独立且无标题，卖点保留98px框高和30px间距', () => {
    for (const widths of [[200, 250, 200], [350, 450], [600, 180, 180]]) {
      const layout = getDiningChairSingleLayout(widths, options());
      expect(layout.modelBadge).toEqual({ x: 70, y: 343, height: 72 }); expect(layout.issue).toBeNull();
      layout.sellingPoints.forEach((box, index) => {
        expect(box.height).toBe(98); expect(box.y).toBe(1262);
        expect(box.x - 2).toBeGreaterThanOrEqual(94 - .0001); expect(box.x + box.width + 2).toBeLessThanOrEqual(1346 + .0001);
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 40);
        if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
      });
    }
    expect(rules.note).toBeUndefined(); expect(rules.createOptions().headline).toBeUndefined();
    expect(getDiningChairSingleLayout([900, 900, 900], options()).issue).toContain('超出安全区');
  });

  it('主图标注整体调整后仍保留第二图空间及卖点间距', () => {
    const value = options({ heightNote: '含脚垫' }), layout = getDiningChairSingleLayout([200, 200, 200], value);
    const labelSize = diningChairDimensionLabel(measure(), annotation, fields, value);
    const fit = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fit.productRect, fit.annotations.map((current) => ({ annotation: current, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 900, offsetY: 900 });
    expect(moved.bounds.x).toBeGreaterThanOrEqual(70 - .001); expect(moved.bounds.y).toBeGreaterThanOrEqual(445 - .001);
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(820 + .001);
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(layout.sellingPoints[0].y - 2 - 60 + .001);
  });

  it('专属草稿保留数量、标法、两个宽度及隐藏卖点设置', () => {
    const value = { ...options({ quantity: 2, widthMode: 'outside', outerWidth: '52.49', heightNote: '  含脚垫  ' }), sellingPointCount: 2 as const, dimensionGap: 97.5 };
    const saved = rules.saveOptions(value);
    expect(saved).toEqual({ diningChair: { quantity: 2, widthMode: 'outside', outerWidth: '52.49', heightNote: '  含脚垫  ', sellingPointCount: 2, dimensionGap: 97.5 } });
    expect(rules.restoreOptions(saved as DiningChairDraft)).toEqual(value);
    const hidden = { ...value, diningChair: { ...value.diningChair, widthMode: 'standard' as const } };
    expect(rules.restoreOptions(rules.saveOptions(hidden) as DiningChairDraft).diningChair?.outerWidth).toBe('52.49');
    expect(rules.visibleSellingPoints(['一', '二', '三'], value)).toEqual(['一', '二']);
    expect(Object.keys(saved)).toEqual(['diningChair']);
  });

  it('新建选项互不影响，非法保存选项恢复为安全默认', () => {
    const first = options(), second = options(); first.diningChair.heightNote = '测试'; first.sizeLabels[0] = '测试';
    expect(second).toEqual({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, diningChair: { quantity: 1, widthMode: 'standard', heightNote: '', outerWidth: '' } });
    expect(rules.hasOptions(second)).toBe(false); expect(rules.hasOptions(first)).toBe(true);
    expect(normalizeDiningChairOptions({ diningChair: { quantity: 8, widthMode: '未知', heightNote: 12, outerWidth: false }, sellingPointCount: 8, dimensionGap: NaN })).toEqual(second);
    expect(normalizeDiningChairOptions({ dimensionGap: 1 }).dimensionGap).toBe(60);
    expect(normalizeDiningChairOptions({ dimensionGap: 999 }).dimensionGap).toBe(180);
  });

  it('主图与第二图超长数值分别拦截，固定字号不静默裁切', () => {
    const value = options({ widthMode: 'outside', outerWidth: '99999999999999' }), layout = getDiningChairSingleLayout([200, 200, 200], value);
    const issues = diningChairExtraIssues(measure(), value, layout, { ...fields, length: '99999999999999' });
    expect(issues.join('')).toContain('第二视图总宽文字过长'); expect(issues.join('')).toContain('餐椅总长尺寸过长');
    expect(rules.exportIssues(fields, '53×50.5×82', options({ widthMode: 'outside' }), null).join('')).toContain('第二视图总宽');
  });
});
