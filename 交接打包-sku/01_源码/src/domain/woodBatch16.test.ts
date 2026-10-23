import { expect, it } from 'vitest';
import { batch16Fixture, batch16Ids } from '../TemplateBatch16.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { normalizeWoodLongTable } from './woodLongTableSingleLayout';
import { normalizeWoodRoundTable } from './woodRoundTableSingleLayout';
import type { TextMeasure } from '../templates/types';
import type { DimensionAnnotation } from './dimensionAnnotations';

const measure: TextMeasure = { font: '', measureText(text) { return { width: Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? 1 : .55), 0) * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) } as TextMetrics; } };

it('长餐桌保留三种长度并截断，只有并列长度加尺寸可选前缀', () => {
  const rules = SINGLE_TEMPLATE_RULES['wood-long-table-single'], draft = batch16Fixture('wood-long-table-single'), options = rules.createOptions();
  expect(draft.dimensionFields).toEqual({ length: '140/160/180', width: '80', height: '75' });
  expect(draft.annotations.map((item) => rules.dimensionLabel(measure, item, draft.dimensionFields, options).runs[0].text)).toEqual(['尺寸可选:140/160/180cm', '80cm', '75cm']);
  expect(rules.dimensionLabel(measure, draft.annotations[0], { length: '180', width: '80/90', height: '75' }, options).runs[0].text).toBe('180cm');
  expect(rules.dimensionLabel(measure, draft.annotations[1], { length: '180', width: '80/90', height: '75' }, options).runs[0].text).toBe('80/90cm');
  for (const input of ['140~180×80×75', '120/140/160/180×80×75', '0×80×75']) expect(rules.parseQuickDimensions(input)).toBeNull();
});
it('圆餐桌只使用直径与高度，并列高度须共用或逐项对应', () => {
  const rules = SINGLE_TEMPLATE_RULES['wood-round-table-single'], options = rules.createOptions();
  expect(rules.dimensionKinds).toEqual(['diameter', 'height']);
  expect(rules.parseQuickDimensions('110.09×75.39')).toEqual({ length: '', width: '', diameter: '110', height: '75.3' });
  const fields = rules.parseQuickDimensions('100.19/110.29×75.39/76.49')!;
  expect(rules.formatFields(fields)).toBe('100.1/110.2×75.3/76.4');
  expect(rules.parseQuickDimensions('100/110/120×75')).not.toBeNull();
  for (const input of ['110×80×75', '110~140×75', '110×70~75', '100/110/120/130×75', '100/110/120×75/76', '0×75', '110×']) expect(rules.parseQuickDimensions(input)).toBeNull();
  const label = rules.dimensionLabel(measure, { kind: 'diameter', value: 100 } as DimensionAnnotation, fields, options);
  expect(label.runs[0].text).toBe('100.1/110.2cm'); expect(label.runs[0].font).toContain('45px');
  expect(label.lineColor).toBeUndefined(); expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  expect(rules.exportIssues({ ...fields, height: '75/76/77' }, '', options, null).join()).toContain('逐项对应');
});
it.each(batch16Ids)('%s 缺省字段不植入商品事实且只保存自己选项', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), saved = rules.saveOptions(options);
  expect(Object.keys(saved)).toEqual([id === 'wood-long-table-single' ? 'woodLongTable' : 'woodRoundTable']);
  expect(Object.values(saved)[0]).toMatchObject({ noteText: '', sellingPointCount: 3, dimensionGap: 60 });
  expect(rules.hasOptions(options)).toBe(false);
  expect(rules.requiredFonts).toContain('方正兰亭中黑_GBK');
  expect(rules.model).toMatchObject({ fontSize: 45, background: '#00586d', radius: 8 });
});
it('两款归一化保留完整文案并限制间距，返回独立对象', () => {
  for (const normalize of [normalizeWoodLongTable, normalizeWoodRoundTable]) {
    expect(normalize({ noteText: '长文案'.repeat(60), dimensionGap: -10, sellingPointCount: 2 })).toMatchObject({ noteText: '长文案'.repeat(60), dimensionGap: 30, sellingPointCount: 2 });
    expect(normalize({ dimensionGap: 900 }).dimensionGap).toBe(120);
    expect(normalize({ dimensionGap: NaN, sellingPointCount: 99 }).dimensionGap).toBe(60);
    expect(normalize(null)).toEqual(normalize(undefined));
    expect(normalize(undefined)).not.toBe(normalize(undefined));
  }
});
it.each(batch16Ids)('%s 两三卖点、间距与备注不侵入商品区域', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), value = options.woodLongTable ?? options.woodRoundTable!;
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
it.each(batch16Ids)('%s 过长型号与底部备注拦截但不截断输入', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), layout = rules.layout([], options), value = options.woodLongTable ?? options.woodRoundTable!;
  const text = '完整文字'.repeat(30); value.noteText = text;
  expect(rules.modelBadge!(measure, text, layout, options)).toMatchObject({ text, fontSize: 45 });
  expect(rules.modelBadge!(measure, text, layout, options).issue).toContain('蓝标区域');
  expect(rules.extraIssues!(measure, options, layout)).toContain('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  expect(value.noteText).toBe(text);
  value.noteText = '第一行\n第二行'; expect(rules.extraIssues!(measure, options, layout)).toHaveLength(1);
});
it.each(batch16Ids)('%s 图示说明和尺寸需要有效完整资料', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch16Fixture(id), options = rules.restoreOptions(draft), layout = rules.layout([], options);
  expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields)).toEqual([]);
  expect(rules.extraIssues!(measure, options, layout, { length: '', width: '0', height: '-5' })).toHaveLength(id === 'wood-long-table-single' ? 3 : 2);
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues(draft.dimensionFields, '不完整', options, null).join()).toContain('快速尺寸');
});
it('板木餐桌规则对象与原餐桌模板完全独立', () => {
  const ids = ['wood-long-table-single', 'wood-round-table-single', 'long-dining-table-single', 'round-extendable-table-single'] as const;
  for (const id of ids) for (const other of ids) if (id !== other) {
    expect(SINGLE_TEMPLATE_RULES[id].model).not.toBe(SINGLE_TEMPLATE_RULES[other].model);
    expect(SINGLE_TEMPLATE_RULES[id].lineStyle).not.toBe(SINGLE_TEMPLATE_RULES[other].lineStyle);
    expect(SINGLE_TEMPLATE_RULES[id].layout).not.toBe(SINGLE_TEMPLATE_RULES[other].layout);
  }
});
