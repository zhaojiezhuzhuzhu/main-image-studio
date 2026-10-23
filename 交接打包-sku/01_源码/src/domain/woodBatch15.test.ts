import { expect, it } from 'vitest';
import { batch15Fixture, batch15Ids } from '../TemplateBatch15.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { normalizeShapedVanity } from './shapedVanitySingleLayout';
import { normalizeWoodDesk } from './woodDeskSingleLayout';
import type { TextMeasure } from '../templates/types';

const measure: TextMeasure = { font: '', measureText(text) { return { width: Array.from(text).length * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) } as TextMetrics; } };
it.each(batch15Ids)('%s 缺省字段不植入商品事实且只保存自己选项', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), saved = rules.saveOptions(options);
  expect(Object.keys(saved)).toEqual([id === 'shaped-vanity-single' ? 'shapedVanity' : 'woodDesk']);
  expect(Object.values(saved)[0]).toMatchObject({ noteText: '', sellingPointCount: 3, dimensionGap: 60 });
  expect(rules.hasOptions(options)).toBe(false);
  expect(rules.requiredFonts).toContain('方正兰亭中黑_GBK');
  expect(rules.model).toMatchObject({ fontSize: 45, background: '#00586d', radius: 8 });
});
it('两款归一化保留完整文案并限制间距，返回独立对象', () => {
  for (const normalize of [normalizeShapedVanity, normalizeWoodDesk]) {
    expect(normalize({ noteText: '长文案'.repeat(60), dimensionGap: -10, sellingPointCount: 2 })).toMatchObject({ noteText: '长文案'.repeat(60), dimensionGap: 30, sellingPointCount: 2 });
    expect(normalize({ dimensionGap: 900 }).dimensionGap).toBe(120);
    expect(normalize({ dimensionGap: NaN, sellingPointCount: 99 }).dimensionGap).toBe(60);
    expect(normalize(null)).toEqual(normalize(undefined));
    expect(normalize(undefined)).not.toBe(normalize(undefined));
  }
});
it.each(batch15Ids)('%s 尺寸截断保留一位，拒绝范围与四种规格', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id];
  expect(rules.parseQuickDimensions('72.19×60.09×92.29')).toEqual({ length: '72.1', width: '60', height: '92.2' });
  expect(rules.parseQuickDimensions('40/50/60×40×50')?.length).toBe('40/50/60');
  expect(rules.parseQuickDimensions('40/50/60/70×40×50')).toBeNull();
  expect(rules.parseQuickDimensions('40~60×40×50')).toBeNull();
  expect(rules.parseQuickDimensions('0×40×50')).toBeNull();
});
it.each(batch15Ids)('%s 两三卖点、间距与备注不侵入商品区域', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), value = options.shapedVanity ?? options.woodDesk!;
  for (const count of [2, 3] as const) for (const gap of [30, 60, 120]) {
    value.sellingPointCount = count; value.dimensionGap = gap;
    const points = rules.visibleSellingPoints(['一', '二', '三'], options), layout = rules.layout(points.map(() => 300), options);
    expect(layout.modelBadge).toEqual({ x: 100, y: 300, height: 70 });
    expect(layout.subjectSafeArea.y).toBe(470);
    expect(layout.subjectSafeArea.y + layout.subjectSafeArea.height).toBe(1260 - gap);
    expect(layout.sellingPoints).toHaveLength(count);
    expect(layout.sellingPoints.every((box) => box.height === 98 && box.y === 1262)).toBe(true);
    expect(layout.sellingPoints[1].x - layout.sellingPoints[0].x - layout.sellingPoints[0].width).toBe(30);
    expect(layout.issue).toBeNull();
  }
  expect(rules.layout([900, 900, 900], options).issue).toContain('完整文案');
});
it.each(batch15Ids)('%s 过长型号与底部备注拦截但不截断输入', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), layout = rules.layout([], options), value = options.shapedVanity ?? options.woodDesk!;
  const text = '完整文字'.repeat(30); value.noteText = text;
  expect(rules.modelBadge!(measure, text, layout, options)).toMatchObject({ text, fontSize: 45 });
  expect(rules.modelBadge!(measure, text, layout, options).issue).toContain('蓝标区域');
  expect(rules.extraIssues!(measure, options, layout)).toContain('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  expect(value.noteText).toBe(text);
  value.noteText = '第一行\n第二行'; expect(rules.extraIssues!(measure, options, layout)).toHaveLength(1);
});
it.each(batch15Ids)('%s 图示说明和尺寸需要有效完整资料', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch15Fixture(id), options = rules.restoreOptions(draft), layout = rules.layout([], options);
  expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields)).toEqual([]);
  expect(rules.extraIssues!(measure, options, layout, { length: '', width: '0', height: '-5' })).toHaveLength(3);
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues(draft.dimensionFields, '不完整', options, null).join()).toContain('快速尺寸');
});
it('板木两款规则对象与软体妆台完全独立', () => {
  const ids = ['shaped-vanity-single', 'wood-desk-single', 'bedside-cabinet-single'] as const;
  for (const id of ids) for (const other of ids) if (id !== other) {
    expect(SINGLE_TEMPLATE_RULES[id].model).not.toBe(SINGLE_TEMPLATE_RULES[other].model);
    expect(SINGLE_TEMPLATE_RULES[id].lineStyle).not.toBe(SINGLE_TEMPLATE_RULES[other].lineStyle);
    expect(SINGLE_TEMPLATE_RULES[id].layout).not.toBe(SINGLE_TEMPLATE_RULES[other].layout);
  }
});
