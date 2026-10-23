import { expect, it } from 'vitest';
import { batch11Fixture, batch11Ids } from '../TemplateBatch11.fixtures';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { doubleMattressBand, doubleMattressMarkers, doubleMattressMode, normalizeMattressDouble } from './mattressDoubleLayout';
import { normalizePillowSingle, pillowMaterialCards } from './pillowSingleLayout';
import { fitAnnotatedProduct, adjustAnnotatedProduct } from './annotatedProductFit';
import { canvasFontSource } from '../project/useCanvasFonts';

const context = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55 } as TextMetrics; } };
const doubleRules = SINGLE_TEMPLATE_RULES['mattress-double'], pillowRules = SINGLE_TEMPLATE_RULES['pillow-single'];
const validDouble = () => doubleRules.restoreOptions(batch11Fixture('mattress-double'));
const validPillow = () => pillowRules.restoreOptions(batch11Fixture('pillow-single'));
it.each([['0', null], ['0.1', 0], ['2', 0], ['2.1', 1], ['4', 1], ['4.1', 2], ['6', 2], ['6.1', 3], ['8', 3], ['8.1', 4], ['10', 4], ['10.1', null], ['1e0', null], ['2.11', null], ['', null]] as const)('双面床垫数值%s按P10区间判断', (raw, band) => expect(doubleMattressBand(raw)).toBe(band));
it('不同区间分别校验位置和圆标间距，不随数值改写用户位置', () => {
  const options = validDouble(), value = options.mattressDouble!, layout = doubleRules.layout([], options);
  expect(doubleMattressMode(value)).toBe('different-bands'); expect(doubleRules.extraIssues!(context, options, layout)).toEqual([]);
  value.faces[1].value = '8'; expect(value.faces[1].position).toBe(30);
  expect(doubleRules.extraIssues!(context, options, layout).join('')).toContain('反面偏软指示位置须');
  value.faces[1].position = 75; expect(doubleRules.extraIssues!(context, options, layout)).toEqual([]);
  value.faces[1].value = '2.8'; value.faces[1].position = 20; value.faces[0].position = 19;
  expect(doubleRules.extraIssues!(context, options, layout).join('')).toContain('距离过近');
});
it('同区间固定成对位置，反面更硬时仍正确关联面名，数值相同合并正反面', () => {
  const value = validDouble().mattressDouble!; value.faces[0].value = '1.7'; value.faces[1].value = '1.1';
  expect(doubleMattressMode(value)).toBe('same-band');
  const markers = doubleMattressMarkers(value); expect(markers.map((m) => [m.label, m.value, m.x])).toEqual([['正面', '1.7', 380], ['反面', '1.1', 260]]);
  value.faces[0].position = 99; value.faces[1].position = 88; expect(doubleMattressMarkers(value)).toEqual(markers);
  value.faces[1].value = '1.7'; expect(doubleMattressMarkers(value)).toEqual([{ label: '正反面', value: '1.7', band: 0, x: 320 }]);
  value.faces[0].value = '1'; value.faces[1].value = '1.0'; expect(doubleMattressMode(value)).toBe('same-value');
});
it('同值模式切回不同区间保留两面的原位置与说明', () => {
  const options = validDouble(); options.mattressDouble!.faces[1].value = '1.1';
  const restored = doubleRules.restoreOptions({ ...batch11Fixture('mattress-double'), ...doubleRules.saveOptions(options) });
  expect(restored).toEqual(options); restored.mattressDouble!.faces[1].value = '2.8';
  expect(doubleMattressMarkers(restored.mattressDouble!).map((m) => m.x)).toEqual([320, 520]);
});
it('双面床垫说明按前缀中粗黑和完整总宽检查，厚度仅单值', () => {
  const value = validDouble(), layout = doubleRules.layout([], value);
  value.mattressDouble!.faces[1].description = '完整说明'.repeat(50);
  expect(doubleRules.extraIssues!(context, value, layout).join('')).toContain('正反面说明合计');
  expect(doubleRules.requiredFonts).toContain('方正兰亭中粗黑_GBK'); expect(canvasFontSource('方正兰亭中粗黑_GBK')).toContain('FZLTZCHK--GBK1-0');
  expect(doubleRules.parseQuickDimensions('27.99cm')).toEqual({ length: '', width: '', height: '27.9' });
  for (const raw of ['200×180×27', '20~27', '20/27', '0', '-1']) expect(doubleRules.parseQuickDimensions(raw)).toBeNull();
});
it('枕头三尺寸截断、拒绝范围和无效值，50pt常规尺寸字', () => {
  const draft = batch11Fixture('pillow-single'), options = validPillow();
  expect(draft.dimensionFields).toEqual({ length: '57.9', width: '37.9', height: '11.9' });
  for (const raw of ['57×37', '57×37×8~11', '57×37×8/11', '57×37×0']) expect(pillowRules.parseQuickDimensions(raw)).toBeNull();
  expect(pillowRules.dimensionLabel(context, draft.annotations[0], draft.dimensionFields!, options).runs[0]).toMatchObject({ text: '57.9cm', font: '50px Montserrat, "方正兰亭准黑_GBK", sans-serif' });
});
it('数量切换仅影响圆标和文件名，布局与素材槽不变，局部尺寸完整保存', () => {
  const one = validPillow(), two = validPillow(); one.pillowSingle!.quantity = 1;
  expect(pillowRules.layout([], one)).toEqual(pillowRules.layout([], two)); expect(pillowRules.accessories!(one, pillowRules.layout([], one))).toEqual(pillowRules.accessories!(two, pillowRules.layout([], two)));
  expect(pillowRules.exportFileName!('TEST11', one)).toBe('TEST11-枕头单件-SKU.jpg'); expect(pillowRules.exportFileName!('TEST11', two)).toBe('TEST11-枕头双件x2-SKU.jpg');
  expect(two.pillowSingle!.zoneText).toBe('测试区8cm');
  two.pillowSingle!.zoneText = '完整尺寸说明'.repeat(30); expect(pillowRules.extraIssues!(context, two, pillowRules.layout([], two)).join('')).toContain('局部尺寸说明需单行');
});
it('枕头主图及全部标注整体适配，不侵占三卡或数量圆标区', () => {
  const draft = batch11Fixture('pillow-single'), options = validPillow(), layout = pillowRules.layout([], options);
  const measured = draft.annotations.map((annotation) => ({ annotation, labelSize: pillowRules.dimensionLabel(context, annotation, draft.dimensionFields!, options) }));
  const fit = fitAnnotatedProduct(layout.productArea, measured, layout.subjectSafeArea);
  const moved = adjustAnnotatedProduct(fit.productRect, measured.map((item, i) => ({ ...item, annotation: fit.annotations[i] })), layout.subjectSafeArea, { scale: 3, offsetX: 1000, offsetY: 1000 });
  expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(1180.001); expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(1105.001);
  expect(pillowMaterialCards()[0].y - (layout.subjectSafeArea.y + layout.subjectSafeArea.height)).toBe(25);
});
it.each(batch11Ids)('%s 无示例事实默认值、必填及超长检查，恢复不截断文案', (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), layout = rules.layout([], options);
  expect(rules.hasOptions(options)).toBe(false); expect(rules.extraIssues!(context, options, layout).join('')).toContain('请填写');
  const valid = rules.restoreOptions(batch11Fixture(id)), data = valid.mattressDouble ?? valid.pillowSingle!;
  data.headline = '完整标题'.repeat(50); data.materials[0].text = '第一行\n第二行';
  const issues = rules.extraIssues!(context, valid, layout).join(''); expect(issues).toContain('标题需单行'); expect(issues).toContain('材质卖点1文案需单行');
  expect(rules.restoreOptions({ ...batch11Fixture(id), ...rules.saveOptions(valid) })).toEqual(valid);
  expect(rules.modelBadge(context, '超长完整型号'.repeat(20), layout).issue).toContain('不能缩小');
});
it('异常保存字段回落，归一化不复用嵌套对象', () => {
  expect(normalizeMattressDouble({ faces: [null, { value: 99, position: Infinity }], materials: [null] })).toEqual(normalizeMattressDouble(undefined));
  expect(normalizePillowSingle({ zoneX: Infinity, quantity: 5, materials: [null] })).toEqual(normalizePillowSingle(undefined));
  const original = validDouble().mattressDouble!, copy = normalizeMattressDouble(original); copy.faces[0].description = '修改'; copy.materials[0].text = '修改';
  expect(original.faces[0].description).toBe('测试正面说明'); expect(original.materials[0].text).toBe('测试材质');
});
