import { expect, it } from 'vitest';
import { batch12Fixture, batch12Ids } from '../TemplateBatch12.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { BED_COMBINATION_FIRMNESS, normalizeSoftBedCombination, softBedCombinationAreas } from './softBedCombinationLayout';
import { BED_MULTI_FIRMNESS, normalizeSoftBedMulti, softBedMultiAreas } from './softBedMultiCombinationLayout';
import { compactFirmnessBand, compactFirmnessIssues, compactFirmnessMarkers, normalizeCompactFirmness } from './compactFirmness';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';

const context = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55 } as TextMetrics; } };
const setRules = SINGLE_TEMPLATE_RULES['soft-bed-combination'], multiRules = SINGLE_TEMPLATE_RULES['soft-bed-multi-combination'];
it.each([['0', null], ['0.1', 0], ['2', 0], ['2.1', 1], ['4', 1], ['4.1', 2], ['6', 2], ['6.1', 3], ['8', 3], ['8.1', 4], ['10', 4], ['10.1', null], ['2.11', null], ['1e0', null], ['', null]] as const)('小尺寸软硬度%s边界按各模板声明判断', (raw, band) => {
  expect(compactFirmnessBand(raw, BED_COMBINATION_FIRMNESS)).toBe(band); expect(compactFirmnessBand(raw, BED_MULTI_FIRMNESS)).toBe(band);
});
it('小尺寸同档成对、同值合并，面名和数值不交换；单面忽略保留的另一面', () => {
  const value = normalizeCompactFirmness({ mode: 'double', faces: [{ value: '1.7', position: 90 }, { value: '1.1', position: 80 }] }), area = { x: 10, y: 10, width: 420, height: 85 };
  let markers = compactFirmnessMarkers(value, area, BED_MULTI_FIRMNESS); expect(markers[0].x).toBeGreaterThan(markers[1].x); expect(markers[0].label).toBe('正面');
  expect(compactFirmnessIssues(value, area, BED_MULTI_FIRMNESS)).toEqual([]);
  value.faces[1].value = '1.7'; markers = compactFirmnessMarkers(value, area, BED_MULTI_FIRMNESS); expect(markers).toHaveLength(1); expect(markers[0].label).toBe('正反面');
  value.mode = 'single'; value.faces[0].position = 10; value.faces[1].value = '非法隐藏值'; expect(compactFirmnessIssues(value, area, BED_MULTI_FIRMNESS)).toEqual([]); expect(compactFirmnessMarkers(value, area, BED_MULTI_FIRMNESS)[0].label).toBe('');
});
it('数值改变不移动指示位置，错误区间、圆标碰撞均拦截', () => {
  const value = normalizeCompactFirmness({ mode: 'double', faces: [{ value: '1.1', position: 19 }, { value: '2.8', position: 20 }] }), area = { x: 0, y: 0, width: 420, height: 85 };
  expect(compactFirmnessIssues(value, area, BED_MULTI_FIRMNESS).join('')).toContain('过近');
  value.faces[1].value = '8'; expect(value.faces[1].position).toBe(20); expect(compactFirmnessIssues(value, area, BED_MULTI_FIRMNESS).join('')).toContain('60%–80%');
  value.faces[1].position = 75; expect(compactFirmnessIssues(value, area, BED_MULTI_FIRMNESS)).toEqual([]);
});
it.each(['both', 'mattress', 'cabinet'] as const)('单组合%s显示所需搭配，隐藏字段保留且不参与导出检查', (set) => {
  const options = setRules.restoreOptions(batch12Fixture('soft-bed-combination')); options.softBedCombination!.set = set;
  const slots = setRules.accessories!(options, setRules.layout([], options)); expect(slots).toHaveLength(set === 'both' ? 2 : 1);
  if (set === 'cabinet') options.softBedCombination!.mattress.thickness = '隐藏非法内容';
  if (set === 'mattress') options.softBedCombination!.cabinetModel = '';
  expect(setRules.extraIssues!(context, options, setRules.layout([], options))).toEqual([]);
  const restored = setRules.restoreOptions({ ...batch12Fixture('soft-bed-combination'), ...setRules.saveOptions(options) }); expect(restored).toEqual(options);
});
it('单组合按普通/储物床设置建议间距并保持下限', () => {
  expect(normalizeSoftBedCombination(undefined)).toMatchObject({ productGap: 100, noteGap: 80 });
  expect(normalizeSoftBedCombination({ bedKind: 'storage' })).toMatchObject({ productGap: 30, noteGap: 40 });
  expect(normalizeSoftBedCombination({ productGap: 1, noteGap: 1 })).toMatchObject({ productGap: 30, noteGap: 40 });
  const options = setRules.restoreOptions(batch12Fixture('soft-bed-combination')), area = softBedCombinationAreas(options), layout = setRules.layout([], options);
  expect(area.rowTop - (layout.subjectSafeArea.y + layout.subjectSafeArea.height)).toBe(100); expect(1363 - area.rowBottom).toBe(80);
});
it.each(['both', 'mattress'] as const)('单组合%s第三个卖点独占整行，不受第一行半栏宽度限制', (set) => {
  const options = setRules.restoreOptions(batch12Fixture('soft-bed-combination')); options.softBedCombination!.set = set;
  const measure = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) } as TextMetrics; } };
  const points = options.softBedCombination!.mattress.points, layout = setRules.layout([], options);
  points[2] = '人体工学五区弹簧';
  expect(setRules.extraIssues!(measure, options, layout)).toEqual([]);
  points[2] = '垫'.repeat(17);
  expect(setRules.extraIssues!(measure, options, layout)).toEqual([]);
  points[2] = '垫'.repeat(18);
  expect(setRules.extraIssues!(measure, options, layout)).toEqual([expect.stringContaining('床垫卖点3完整内容超出')]);
  points[2] = '人体工学五区弹簧'; points[0] = points[1] = points[2];
  expect(setRules.extraIssues!(measure, options, layout)).toEqual([expect.stringContaining('床垫卖点1完整内容超出'), expect.stringContaining('床垫卖点2完整内容超出')]);
});
it.each([2, 3] as const)('多组合%d款床垫保留30px左右间距和隐藏第三款资料', (count) => {
  const options = multiRules.restoreOptions(batch12Fixture('soft-bed-multi-combination')); options.softBedMultiCombination!.mattressCount = count;
  const area = softBedMultiAreas(options); expect(area.mattresses).toHaveLength(count);
  expect(area.mattresses[1].x - area.mattresses[0].x - area.mattresses[0].width).toBe(30);
  expect(area.mattresses[count - 1].x + area.mattresses[count - 1].width).toBe(1410);
  if (count === 2) { options.softBedMultiCombination!.mattresses[2].thickness = ''; expect(multiRules.extraIssues!(context, options, multiRules.layout([], options))).toEqual([]); }
});
it.each([0, 1, 2] as const)('多组合%d款床头柜保持独立位置并避开床垫区域', (count) => {
  const options = multiRules.restoreOptions(batch12Fixture('soft-bed-multi-combination')); options.softBedMultiCombination!.cabinetCount = count;
  options.softBedMultiCombination!.productGap = 100; options.softBedMultiCombination!.noteGap = 100;
  const area = softBedMultiAreas(options), layout = multiRules.layout([], options);
  expect(area.cabinets).toHaveLength(count);
  for (const item of area.cabinets) { expect(item.image.height).toBeGreaterThan(0); expect(item.image.y + item.image.height).toBeLessThanOrEqual(area.bedBottom); expect(item.image.x).toBeGreaterThan(layout.subjectSafeArea.x + layout.subjectSafeArea.width); }
  expect(multiRules.accessories!(options, layout)).toHaveLength(3 + count);
});
it('多组合间距下限独立，不能改变单组合规则或已有床垫/沙发规则', () => {
  expect(normalizeSoftBedMulti({ productGap: 0, noteGap: 0 })).toMatchObject({ productGap: 30, noteGap: 15 });
  expect(BED_MULTI_FIRMNESS).not.toBe(BED_COMBINATION_FIRMNESS); expect(BED_MULTI_FIRMNESS.bands).not.toBe(BED_COMBINATION_FIRMNESS.bands);
  expect(multiRules.lineStyle).not.toBe(setRules.lineStyle); expect(multiRules.model).not.toBe(setRules.model);
});
it.each(batch12Ids)('%s三规格尺寸截断，斜线独立25pt，拒绝范围与四规格', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch12Fixture(id), options = rules.restoreOptions(draft);
  expect(draft.dimensionFields).toEqual({ length: '223.9', width: '168.9/198.9/208.9', height: '118.9' });
  for (const raw of ['223×168~198×118', '223×150/160/180/200×118', '223×168×0', '223×168']) expect(rules.parseQuickDimensions(raw)).toBeNull();
  const annotation = draft.annotations.find((a) => a.kind === 'width')!, label = rules.dimensionLabel(context, annotation, draft.dimensionFields!, options);
  expect(label.runs.filter((run) => run.text === ' / ')).toHaveLength(2); expect(label.runs[1].font).toContain('25px'); expect(label.runs[0].font).toContain('35px');
});
it.each(batch12Ids)('%s完整文案、空白和厚度校验，主图标注整体避开配件区域', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], draft = batch12Fixture(id), options = rules.restoreOptions(draft), layout = rules.layout([], options);
  expect(rules.extraIssues!(context, options, layout, draft.dimensionFields)).toEqual([]); expect(rules.hasOptions(rules.createOptions())).toBe(false);
  const mattress = options.softBedCombination?.mattress ?? options.softBedMultiCombination!.mattresses[0]; mattress.title = '完整名称'.repeat(40); mattress.thickness = '20~30';
  const issues = rules.extraIssues!(context, options, layout).join(''); expect(issues).toContain('单个厚度'); expect(issues).toContain('完整内容超出');
  expect(rules.restoreOptions({ ...draft, ...rules.saveOptions(options) })).toEqual(options);
  const measured = draft.annotations.map((annotation) => ({ annotation, labelSize: rules.dimensionLabel(context, annotation, draft.dimensionFields!, options) }));
  const fit = fitAnnotatedProduct(layout.productArea, measured, layout.subjectSafeArea);
  const moved = adjustAnnotatedProduct(fit.productRect, measured.map((item, i) => ({ ...item, annotation: fit.annotations[i] })), layout.subjectSafeArea, { scale: 3, offsetX: 1000, offsetY: 1000 });
  expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(1020.001); expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(layout.subjectSafeArea.y + layout.subjectSafeArea.height + .001);
});
it('归一化复制嵌套数据，不把示例硬度或材质当作默认事实', () => {
  const options = multiRules.restoreOptions(batch12Fixture('soft-bed-multi-combination')), value = options.softBedMultiCombination!, copy = normalizeSoftBedMulti(value);
  copy.mattresses[0].firmness.faces[0].value = '8'; expect(value.mattresses[0].firmness.faces[0].value).toBe('1.1');
  expect(normalizeSoftBedMulti({ mattresses: [null], productGap: Infinity })).toEqual(normalizeSoftBedMulti(undefined));
  expect(normalizeSoftBedCombination({ mattress: null, noteGap: Infinity })).toEqual(normalizeSoftBedCombination(undefined));
});
