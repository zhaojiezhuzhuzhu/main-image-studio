import { expect, it } from 'vitest';
import { batch14Fixture, batch14Ids } from '../TemplateBatch14.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { getAccessoryScenes } from './singleAccessories';
import type { ProductImage } from '../project/productImage';

const measure = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) * .55 } as TextMetrics; } };
it.each(batch14Ids)('%s 默认不注入商品事实且模板字段独立', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], a = rules.createOptions(), b = rules.createOptions(), value = a.wardrobe ?? a.shoeCabinet!;
  expect(value).toEqual({ noteText: '', sellingPointCount: 3, dimensionGap: 60 });
  value.noteText = '独立备注'; expect(b.wardrobe ?? b.shoeCabinet).not.toEqual(value);
  expect(Object.keys(rules.saveOptions(a))).toEqual([id === 'wardrobe-single' ? 'wardrobe' : 'shoeCabinet']);
  expect(rules.restoreOptions({ ...batch14Fixture(id), ...rules.saveOptions(a) })).toEqual(a);
});
it('衣柜只读取长高，鞋柜必须读取长宽高，精度均截断', () => {
  const wardrobe = SINGLE_TEMPLATE_RULES['wardrobe-single'], shoe = SINGLE_TEMPLATE_RULES['shoe-cabinet-single'];
  expect(wardrobe.parseQuickDimensions('159.39×200.39')).toEqual({ length: '159.3', width: '', height: '200.3' });
  expect(wardrobe.dimensionKinds).toEqual(['length', 'height']);
  expect(wardrobe.parseQuickDimensions('159×60×200')).toBeNull();
  expect(shoe.parseQuickDimensions('122.39×37.09×101.69')).toEqual({ length: '122.3', width: '37', height: '101.6' });
  expect(shoe.parseQuickDimensions('122×101')).toBeNull();
  for (const id of batch14Ids) {
    const rules = SINGLE_TEMPLATE_RULES[id], valid = rules.formatFields(batch14Fixture(id).dimensionFields);
    expect(rules.parseQuickDimensions(valid.replace(/^\d+(\.\d+)?/, '100/120/140'))).not.toBeNull();
    for (const invalid of ['0', '-1', '1~2', '1/2/3/4', '非数字']) expect(rules.parseQuickDimensions(valid.replace(/^\d+(\.\d+)?/, invalid))).toBeNull();
  }
});
it.each(batch14Ids)('%s 两个视图安全区分开，间距变化及高矮图均保持比例', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), value = options.wardrobe ?? options.shoeCabinet!;
  for (const gap of [30, 60, 120]) {
    value.dimensionGap = gap;
    const layout = rules.layout([200, 200, 200], options), slots = rules.accessories!(options, layout), main = layout.subjectSafeArea!, area = slots[0].area;
    expect(slots).toHaveLength(1); expect(slots[0].id).toBe(`${id}-open`);
    expect(main.x + main.width).toBeLessThan(area.x);
    expect(area.y + area.height).toBeLessThanOrEqual(layout.sellingPoints[0].y - gap);
    expect(main.y + main.height).toBeLessThanOrEqual(layout.sellingPoints[0].y - gap);
    for (const [width, height] of [[400, 640], [600, 400]]) {
      const image = { visible: { x: 0, y: 0, width, height } } as ProductImage;
      const [scene] = getAccessoryScenes(slots, [{ id: slots[0].id, image, adjustment: { scale: 1, offsetX: 0, offsetY: 0 } }]);
      expect(scene.productRect.width / scene.productRect.height).toBeCloseTo(width / height);
      expect(scene.productRect.x).toBeGreaterThanOrEqual(area.x);
      expect(scene.productRect.x + scene.productRect.width).toBeLessThanOrEqual(area.x + area.width + 1e-8);
    }
  }
});
it.each(batch14Ids)('%s 完整文案保留并拦截溢出，减少卖点只隐藏', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch14Fixture(id), options = rules.restoreOptions(draft), value = options.wardrobe ?? options.shoeCabinet!;
  value.sellingPointCount = 2;
  expect(rules.visibleSellingPoints(draft.sellingPoints, options)).toEqual(draft.sellingPoints.slice(0, 2));
  value.sellingPointCount = 3; expect(rules.visibleSellingPoints(draft.sellingPoints, options)).toEqual(draft.sellingPoints);
  const layout = rules.layout([200, 200, 200], options);
  expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields)).toEqual([]);
  expect(rules.modelBadge(measure, '完整型号'.repeat(30), layout, options).issue).toContain('蓝标区域');
  value.noteText = '完整备注'.repeat(40);
  expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields).join()).toContain('图示备注');
  expect((rules.restoreOptions({ ...draft, ...rules.saveOptions(options) }).wardrobe ?? rules.restoreOptions({ ...draft, ...rules.saveOptions(options) }).shoeCabinet)!.noteText).toBe(value.noteText);
  expect(rules.layout([800, 800, 800], options).issue).toContain('卖点');
});
it.each(batch14Ids)('%s 非法选项归一化与尺寸缺失拦截', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch14Fixture(id), key = id === 'wardrobe-single' ? 'wardrobe' : 'shoeCabinet';
  const restored = rules.restoreOptions({ ...draft, [key]: { noteText: 9, sellingPointCount: 8, dimensionGap: Infinity } });
  expect(restored[key]).toEqual({ noteText: '', sellingPointCount: 3, dimensionGap: 60 });
  expect(rules.exportIssues({ ...draft.dimensionFields, height: '' }, '', restored, null).join()).toContain('有效');
  expect(rules.exportIssues(draft.dimensionFields, '无效', restored, null).join()).toContain('快速尺寸');
});
it('两款与先前板木模板各自维护规则，不互相继承', () => {
  for (const id of batch14Ids) for (const other of [...batch14Ids, 'wood-bedside-single', 'drawer-chest-single'] as const) if (id !== other) {
    expect(SINGLE_TEMPLATE_RULES[id].model).not.toBe(SINGLE_TEMPLATE_RULES[other].model);
    expect(SINGLE_TEMPLATE_RULES[id].lineStyle).not.toBe(SINGLE_TEMPLATE_RULES[other].lineStyle);
    expect(SINGLE_TEMPLATE_RULES[id].layout).not.toBe(SINGLE_TEMPLATE_RULES[other].layout);
  }
});
