import { expect, it } from 'vitest';
import { batch17Fixture, batch17Ids } from '../TemplateBatch17.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { normalizeWoodLongTableSet, woodLongTableSetBadges } from './woodLongTableSetLayout';
import { normalizeWoodRoundTableSet, woodRoundTableSetBadges } from './woodRoundTableSetLayout';
import type { DimensionAnnotation } from './dimensionAnnotations';

const measure = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55 } as TextMetrics; } };
it.each(batch17Ids)('%s 正数规格截断、多规格限制和单品隔离', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch17Fixture(id), options = rules.restoreOptions(draft), layout = rules.layout([], options);
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.extraIssues!(measure, options, layout, draft.dimensionFields)).toEqual([]);
  const valid = id === 'wood-long-table-combination' ? '140.09/160.99×80.09×75.09' : '110.09/120.99×75.39';
  expect(rules.parseQuickDimensions(valid)).toMatchObject({ height: id === 'wood-long-table-combination' ? '75' : '75.3' });
  for (const input of ['0×80×75', '140~180×80×75', '1/2/3/4×80×75', '110~140×75', '110×0', 'abc']) expect(rules.parseQuickDimensions(input)).toBeNull();
  expect(rules.model.fontSize).toBe(35); expect(layout.modelBadge).toEqual({ x: 100, y: 320, height: 50 });
  expect(rules.lineStyle).not.toBe(SINGLE_TEMPLATE_RULES[id.replace('combination', 'single') as 'wood-long-table-single' | 'wood-round-table-single'].lineStyle);
});
it('长桌组合多长度前缀、圆桌桌面白线与高度灰线分别处理', () => {
  const long = SINGLE_TEMPLATE_RULES['wood-long-table-combination'], draft = batch17Fixture('wood-long-table-combination');
  expect(long.dimensionLabel(measure, draft.annotations[0], draft.dimensionFields, long.createOptions()).runs[0].text).toBe('尺寸可选:140/160/180cm');
  const round = SINGLE_TEMPLATE_RULES['wood-round-table-combination'], options = round.createOptions(), fields = round.parseQuickDimensions('110/120×75.39')!;
  expect(round.dimensionLabel(measure, { kind: 'diameter', value: 110 } as DimensionAnnotation, fields, options)).toMatchObject({ color: '#ffffff', lineColor: '#ffffff' });
  expect(round.dimensionLabel(measure, { kind: 'height', value: 75.3 } as DimensionAnnotation, fields, options)).toMatchObject({ color: undefined, lineColor: undefined });
  options.woodRoundTableSet!.diameterPlacement = 'outside';
  expect(round.dimensionLabel(measure, { kind: 'diameter', value: 110 } as DimensionAnnotation, fields, options)).toMatchObject({ color: undefined, lineColor: undefined });
  expect(round.parseQuickDimensions('110×75×80')).toBeNull();
  expect(round.parseQuickDimensions('110/120×75/76/77')).toBeNull(); expect(round.parseQuickDimensions('110/120×75/76')).not.toBeNull();
});
it.each(batch17Ids)('%s 保留隐藏款式，输入归一化后不共享嵌套对象', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], a = rules.createOptions(), b = rules.createOptions();
  const value = a.woodLongTableSet ?? a.woodRoundTableSet!, other = b.woodLongTableSet ?? b.woodRoundTableSet!;
  expect(rules.hasOptions(a)).toBe(false); value.chairs[0].model = '完整型号'.repeat(30); value.chairs[0].x = .42;
  expect(other.chairs[0]).toMatchObject({ model: '', x: 1 });
  const restored = rules.restoreOptions({ ...batch17Fixture(id), ...rules.saveOptions(a) });
  expect(restored).toEqual(a); expect(Object.keys(rules.saveOptions(a))).toEqual([id === 'wood-long-table-combination' ? 'woodLongTableSet' : 'woodRoundTableSet']);
  value.chairs[0].model = '改变'; expect((restored.woodLongTableSet ?? restored.woodRoundTableSet!).chairs[0].model).toBe('完整型号'.repeat(30));
});
it('限制非法款数和坐标，长桌编号位置与标签位置独立', () => {
  for (const normalize of [normalizeWoodLongTableSet, normalizeWoodRoundTableSet]) {
    expect(normalize({ chairCount: 99, dimensionGap: NaN, chairs: [{ model: '完整资料', x: -4, y: Infinity }] })).toMatchObject({ chairCount: 1, dimensionGap: 60 });
    expect(normalize({ chairs: [{ model: '完整资料', x: -4, y: 7 }] }).chairs[0]).toEqual({ model: '完整资料', x: 0, y: 1 });
    expect(normalize({ dimensionGap: 3 }).dimensionGap).toBe(30); expect(normalize({ dimensionGap: 500 }).dimensionGap).toBe(120);
  }
  expect(normalizeWoodLongTableSet({ markers: [{ x: -1, y: 4 }] }).markers[0]).toEqual({ x: 0, y: 1 });
});
it.each(batch17Ids)('%s 标签保持蓝框内并拦截空型号、文字溢出及标签重叠', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch17Fixture(id), options = rules.restoreOptions(draft), value = options.woodLongTableSet ?? options.woodRoundTableSet!;
  const badges = id === 'wood-long-table-combination' ? woodLongTableSetBadges : woodRoundTableSetBadges;
  for (const gap of [30, 120]) {
    value.dimensionGap = gap;
    for (const x of [0, 1]) for (const y of [0, 1]) {
      value.chairs[0].x = x; value.chairs[0].y = y; const box = badges(measure, options)[0].box;
      expect(box.x).toBeGreaterThanOrEqual(60); expect(box.x + box.width).toBeLessThanOrEqual(1380);
      expect(box.y).toBeGreaterThanOrEqual(400); expect(box.y + box.height).toBeLessThanOrEqual(1260 - gap);
    }
  }
  value.chairs[0] = { ...value.chairs[1] }; expect(rules.extraIssues!(measure, options, rules.layout([], options)).join()).toContain('重叠');
  value.chairs[0].model = ''; expect(rules.extraIssues!(measure, options, rules.layout([], options)).join()).toContain('完整型号');
  value.chairs[0].model = '完整型号'.repeat(30); const badge = badges(measure, options)[0]; expect(badge.text).toBe(value.chairs[0].model); expect(badge.issue).toContain('不会缩字或截断');
  value.noteText = '图示备注'.repeat(30); expect(rules.extraIssues!(measure, options, rules.layout([], options)).join()).toContain('图示备注');
});
