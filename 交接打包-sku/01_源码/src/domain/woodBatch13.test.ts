import { expect, it } from 'vitest';
import { batch13Fixture, batch13Ids } from '../TemplateBatch13.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { normalizeWoodBedside } from './woodBedsideSingleLayout';
import { normalizeDrawerChest } from './drawerChestSingleLayout';
import type { TextMeasure } from '../templates/types';

const measure: TextMeasure = { font: '', measureText(text) { return { width: Array.from(text).length * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) } as TextMetrics; } };
it.each(batch13Ids)('%s 缺省字段不植入商品事实且只保存自己选项', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), saved = rules.saveOptions(options);
  expect(Object.keys(saved)).toEqual([id === 'wood-bedside-single' ? 'woodBedside' : 'drawerChest']);
  expect(Object.values(saved)[0]).toMatchObject({ noteText: '', sellingPointCount: 3, dimensionGap: 60 });
  expect(rules.hasOptions(options)).toBe(false);
  expect(rules.requiredFonts).toContain('方正兰亭中黑_GBK');
  expect(rules.model).toMatchObject({ fontSize: 45, background: '#00586d', radius: 8 });
});
it('两款归一化保留完整文案并限制间距，返回独立对象', () => {
  for (const normalize of [normalizeWoodBedside, normalizeDrawerChest]) {
    expect(normalize({ noteText: '长文案'.repeat(60), dimensionGap: -10, sellingPointCount: 2 })).toMatchObject({ noteText: '长文案'.repeat(60), dimensionGap: 30, sellingPointCount: 2 });
    expect(normalize({ dimensionGap: 900 }).dimensionGap).toBe(120);
    expect(normalize({ dimensionGap: NaN, sellingPointCount: 99 }).dimensionGap).toBe(60);
    expect(normalize(null)).toEqual(normalize(undefined));
    expect(normalize(undefined)).not.toBe(normalize(undefined));
  }
  expect(normalizeDrawerChest({ widthNote: '说明'.repeat(40) }).widthNote).toHaveLength(80);
});
it.each(batch13Ids)('%s 尺寸截断保留一位，拒绝范围与四种规格', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id];
  expect(rules.parseQuickDimensions('44.49×41.89×53.39')).toEqual({ length: '44.4', width: '41.8', height: '53.3' });
  expect(rules.parseQuickDimensions('40/50/60×40×50')?.length).toBe('40/50/60');
  expect(rules.parseQuickDimensions('40/50/60/70×40×50')).toBeNull();
  expect(rules.parseQuickDimensions('40~60×40×50')).toBeNull();
  expect(rules.parseQuickDimensions('0×40×50')).toBeNull();
});
it.each(batch13Ids)('%s 两三卖点、间距与备注不侵入商品区域', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), value = options.woodBedside ?? options.drawerChest!;
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
it.each(batch13Ids)('%s 过长型号与底部备注拦截但不截断输入', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), layout = rules.layout([], options), value = options.woodBedside ?? options.drawerChest!;
  const text = '完整文字'.repeat(30); value.noteText = text;
  expect(rules.modelBadge!(measure, text, layout, options)).toMatchObject({ text, fontSize: 45 });
  expect(rules.modelBadge!(measure, text, layout, options).issue).toContain('蓝标区域');
  expect(rules.extraIssues!(measure, options, layout)).toContain('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  expect(value.noteText).toBe(text);
  value.noteText = '第一行\n第二行'; expect(rules.extraIssues!(measure, options, layout)).toHaveLength(1);
});
it('斗柜宽度说明只接在宽度后方，不套用其他尺寸或床头柜', () => {
  const rules = SINGLE_TEMPLATE_RULES['drawer-chest-single'], draft = batch13Fixture('drawer-chest-single'), options = rules.restoreOptions(draft);
  options.drawerChest!.widthNote = '含拉手';
  const labels = draft.annotations.map((item) => rules.dimensionLabel(measure, item, draft.dimensionFields, options));
  expect(labels.map((label) => label.runs[0].text)).toEqual(['119.5cm', '43.2cm（含拉手）', '74.9cm']);
  expect(labels.every((label) => label.runs[0].font.startsWith('45px'))).toBe(true);
  options.drawerChest!.widthNote = '完整宽度说明'.repeat(40);
  expect(rules.extraIssues!(measure, options, rules.layout([], options), draft.dimensionFields).join()).toContain('完整尺寸及宽度说明');
  const bedside = SINGLE_TEMPLATE_RULES['wood-bedside-single'];
  expect(bedside.dimensionLabel(measure, draft.annotations[1], draft.dimensionFields, options).runs[0].text).toBe('43.2cm');
});
it.each(batch13Ids)('%s 图示说明和尺寸需要有效完整资料', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch13Fixture(id), options = rules.restoreOptions(draft), layout = rules.layout([], options);
  expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields)).toEqual([]);
  expect(rules.extraIssues!(measure, options, layout, { length: '', width: '0', height: '-5' })).toHaveLength(3);
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues(draft.dimensionFields, '不完整', options, null).join()).toContain('快速尺寸');
});
it('板木两款规则对象与软体床头柜完全独立', () => {
  const ids = ['wood-bedside-single', 'drawer-chest-single', 'bedside-cabinet-single'] as const;
  for (const id of ids) for (const other of ids) if (id !== other) {
    expect(SINGLE_TEMPLATE_RULES[id].model).not.toBe(SINGLE_TEMPLATE_RULES[other].model);
    expect(SINGLE_TEMPLATE_RULES[id].lineStyle).not.toBe(SINGLE_TEMPLATE_RULES[other].lineStyle);
    expect(SINGLE_TEMPLATE_RULES[id].layout).not.toBe(SINGLE_TEMPLATE_RULES[other].layout);
  }
});
