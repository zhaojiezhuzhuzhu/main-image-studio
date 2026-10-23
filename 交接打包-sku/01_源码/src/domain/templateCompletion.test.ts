import { expect, it } from 'vitest';
import { completionFixture, completionIds } from '../TemplateCompletion.fixtures';
import { SINGLE_TEMPLATE_RULES, COMBINATION_TEMPLATE_RULES } from '../templates/registry';
import type { SingleTemplateRules } from '../templates/types';
import { getAccessoryScenes } from './singleAccessories';
import { annotatedProductCollisionRects } from './annotatedProductFit';
import { dimensionLabelAngle, dimensionLabelBounds, getDimensionGeometry } from './dimensionGeometry';
import { multilineModelBadge } from './multilineModelBadge';
import { normalizeBedsideDimensions } from './bedsideDimensions';
import { validateSingleWorkbench } from './workbenchValidation';

const measure = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55 } as TextMetrics; } };
it.each(completionIds)('%s 完整有效资料通过并保留各模板状态', (id) => {
  const rules: SingleTemplateRules = SINGLE_TEMPLATE_RULES[id], draft = completionFixture(id), options = rules.restoreOptions(draft), layout = rules.layout([], options);
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.extraIssues?.(measure, options, layout, draft.dimensionFields)).toEqual([]);
  expect(rules.restoreOptions({ ...draft, ...rules.saveOptions(options) })).toEqual(options);
  expect(Object.keys(rules.saveOptions(options))).toHaveLength(1);
  expect(rules.productionNotes.sourcePages).toContain('21');
  expect(rules.parseQuickDimensions('0×-2×oops')).toBeNull();
});
it('斗柜妆台保留两处高度，仅长度接受由小到大的伸缩范围', () => {
  for (const id of ['vanity-dresser-single', 'vanity-dresser-combination'] as const) {
    const rules = SINGLE_TEMPLATE_RULES[id];
    expect(rules.parseQuickDimensions('190.39~211.49×40×74.99×68.79')).toEqual({ length: '190.3~211.4', width: '40', height: '74.9', secondaryHeight: '68.7' });
    for (const text of ['211~190×40×74×68', '190~210×40~50×74×68', '190×40×74', '190~200~210×40×74×68']) expect(rules.parseQuickDimensions(text)).toBeNull();
  }
});
it('副柜尺寸未标注时阻止导出，桌体和副柜高度互不覆盖', () => {
  const draft = completionFixture('wood-desk-multi-combination'), rules = SINGLE_TEMPLATE_RULES['wood-desk-multi-combination'];
  expect(draft.dimensionFields).toMatchObject({ height: '76', secondaryLength: '60', secondaryWidth: '35', secondaryHeight: '196.5' });
  const result = validateSingleWorkbench({ model: draft.model, hasImage: true, dimensionFields: draft.dimensionFields, annotations: draft.annotations.filter((item) => !item.kind.startsWith('secondary')), annotationInProgress: false, sellingPoints: [] });
  expect(result.blockers.join()).toContain('副柜长、副柜宽、副柜高');
  expect(rules.visibleSellingPoints(['保留一','保留二','保留三'], rules.createOptions())).toEqual([]);
  expect(rules.layout([100, 100, 100], rules.createOptions()).sellingPoints).toEqual([]);
});
it('板木床按床头最宽/床尾最宽切换三项或四项，不省略完整规格', () => {
  const rules = SINGLE_TEMPLATE_RULES['wood-bed-single'];
  expect(rules.parseQuickDimensions('223×157/187×106')).toEqual({ length: '223', width: '157/187', height: '106' });
  const special = rules.parseQuickDimensions('223×157/187×163/193×106')!;
  expect(special).toMatchObject({ headWidth: '157/187', footWidth: '163/193', width: '' });
  expect(rules.dimensionKindsForFields!(special)).toEqual(['length', 'headWidth', 'footWidth', 'height']);
  expect(rules.filenameName).toEqual({ includeSpecification: true });
});
it('板木餐椅数量仅改变输出标识，双图不是购买数量', () => {
  const rules = SINGLE_TEMPLATE_RULES['wood-dining-chair-single'], options = rules.createOptions();
  options.woodDiningChair!.quantity = 2;
  expect(rules.modelBadge(measure, 'TEST餐椅', rules.layout([], options), options).text).toBe('TEST餐椅×2');
  expect(rules.accessories!(options, rules.layout([], options))[0].label).toContain('背面45°');
  expect(rules.parseQuickDimensions('50/60×40×80')).toBeNull();
});
it.each(['wood-bed-combination', 'wood-bed-multi-combination'] as const)('%s 床头柜标注随图片整体适配，隐藏数据可恢复', (id) => {
  const rules: SingleTemplateRules = SINGLE_TEMPLATE_RULES[id], draft = completionFixture(id), options = rules.restoreOptions(draft);
  const slots = rules.accessories!(options, rules.layout([], options));
  const slot = slots.find((item) => item.dimensions)!;
  const image = { ...draft.accessories![0].image!, element: {} as HTMLImageElement, visible: { x: 0, y: 0, width: 500, height: 650 }, silhouette: [] };
  const scene = getAccessoryScenes([slot], [{ id: slot.id, image, adjustment: { scale: 5, offsetX: 900, offsetY: -800 } }], undefined, measure)[0];
  const rects = annotatedProductCollisionRects(scene.productRect, scene.annotations.map((annotation, i) => ({ annotation, labelSize: scene.baseAnnotations[i].labelSize })));
  const x = Math.min(...rects.map((rect) => rect.x)), y = Math.min(...rects.map((rect) => rect.y));
  const bounds = { x, y, width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x, height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y };
  expect(bounds.x).toBeGreaterThanOrEqual(slot.area.x - .1); expect(bounds.y).toBeGreaterThanOrEqual(slot.area.y - .1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(slot.area.x + slot.area.width + .1); expect(bounds.y + bounds.height).toBeLessThanOrEqual(slot.area.y + slot.area.height + .1);
  const next = rules.changeAccessoryDimensions!(options, slot.id, { length: '45.7', width: '', height: '58.4' }, slot.dimensions!.annotations.map((a) => ({ ...a, extensionOffsets: { from: .2, to: -.3 } })));
  expect(rules.restoreOptions({ ...draft, ...rules.saveOptions(next) })).toEqual(next);
  const changedSlot = rules.accessories!(next, rules.layout([], next)).find((item) => item.id === slot.id)!;
  expect(changedSlot.dimensions!.fields).toMatchObject({ length: '45.7', height: '58.4' });
  expect(changedSlot.dimensions!.annotations[0].extensionOffsets).toEqual({ from: .2, to: -.3 });
});
it('旋转文字的法向留白和包围框随角度变化，反向端点保持正向阅读', () => {
  const size = { width: 200, height: 35, orientation: 'line' as const }, a = { x: 100, y: 100 }, b = { x: 100, y: 300 };
  expect(dimensionLabelBounds(a, b, size)).toEqual({ width: 35.000000000000014, height: 200 });
  expect(getDimensionGeometry(a, b, '', undefined, size).label.distanceFromLine).toBe(35.5);
  expect(Math.abs(dimensionLabelAngle(b, a, size))).toBeCloseTo(Math.PI / 2);
  expect(dimensionLabelAngle({ x: 0, y: 0 }, { x: -10, y: -1 }, size)).toBeCloseTo(Math.atan(.1));
});
it('长型号自动按搭配分行，手动换行原文保留，超过两行仍阻止导出', () => {
  const layout = { modelBadge: { x: 100, y: 300, height: 50 }, productArea: { x: 0,y: 0,width: 1,height: 1 }, subjectSafeArea: { x: 0,y: 0,width: 1,height: 1 }, sellingPoints: [] };
  const text = 'TEST完整规格'.repeat(3) + '+搭配完整规格'.repeat(3), result = multilineModelBadge(measure, text, layout, 'Montserrat');
  expect(result.lines).toHaveLength(2); expect(result.lines!.join('')).toBe(text); expect(result.box.height).toBe(100); expect(result.issue).toBeNull();
  expect(multilineModelBadge(measure, '一\n二', layout, 'Montserrat').lines).toEqual(['一','二']);
  const overflow = multilineModelBadge(measure, text.repeat(10), layout, 'Montserrat'); expect(overflow.text).toBe(text.repeat(10)); expect(overflow.issue).not.toBeNull();
  const normalized = normalizeBedsideDimensions({ length: '44', height: '52' }); expect(normalized).not.toHaveProperty('annotations');
});
it('功能沙发范围不会丢失，次推规格可以只填写长度', () => {
  const rules = COMBINATION_TEMPLATE_RULES['functional-sofa-combination'];
  const fields = rules.parseQuickDimensions('293.99×100.99~157.99×80.99~91.99')!;
  expect(fields).toEqual({ length: '293.9', width: '100.9~157.9', height: '80.9~91.9' });
  expect(rules.dimensionText({ kind: 'height', value: 80.9 }, fields)).toBe('80.9~\n91.9cm');
  expect(rules.parseQuickDimensions('249××')).toEqual({ length: '249', width: '', height: '' });
  expect(rules.parseQuickDimensions('249×bad×')).toBeNull();
});
it.each([40, 100])('板木多组合两柜三垫在间距 %s 下保留可见柜图与完整尺寸', (gap) => {
  const rules = SINGLE_TEMPLATE_RULES['wood-bed-multi-combination'], draft = completionFixture('wood-bed-multi-combination'), options = rules.restoreOptions(draft);
  Object.assign(options.woodBedMultiCombination!, { cabinetCount: 2, mattressCount: 3, productGap: gap, noteGap: gap, cabinetModels: ['RD2B-O指纹锁款床头柜', 'TEST另一款完整床头柜型号'] });
  const layout = rules.layout([], options), slots = rules.accessories!(options, layout);
  expect(slots).toHaveLength(5); expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields)).toEqual([]);
  for (const slot of slots.filter((item) => item.dimensions)) {
    const scene = getAccessoryScenes([slot], [{ id: slot.id, adjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'TEST', blob: new Blob(), element: {} as HTMLImageElement, visible: { x: 0, y: 0, width: 400, height: 500 }, silhouette: [] } }], undefined, measure)[0];
    expect(scene.productRect.height).toBeGreaterThan(35);
    expect(scene.bounds.y).toBeGreaterThanOrEqual(slot.area.y - .1);
    expect(scene.bounds.y + scene.bounds.height).toBeLessThanOrEqual(slot.area.y + slot.area.height + .1);
  }
});
it('板木床三种搭配形式只校验可见搭配，同时保留隐藏资料', () => {
  const rules = SINGLE_TEMPLATE_RULES['wood-bed-combination'], draft = completionFixture('wood-bed-combination'), options = rules.restoreOptions(draft);
  for (const set of ['cabinet', 'mattress', 'both'] as const) {
    options.woodBedCombination!.set = set;
    expect(rules.accessories!(options, rules.layout([], options))).toHaveLength(set === 'both' ? 2 : 1);
    expect(rules.extraIssues!(measure, options, rules.layout([], options), draft.dimensionFields)).toEqual([]);
    expect(rules.restoreOptions({ ...draft, ...rules.saveOptions(options) })).toEqual(options);
  }
});
