import { expect, it, vi } from 'vitest';
import { drawSofaFirmness, hasSofaFirmness, normalizeSofaFirmness, SOFA_FIRMNESS_GEOMETRY, sofaFirmnessCenter, sofaFirmnessIssues } from './sofaFirmness';
import { sofaSingleRules } from '../templates/sofa-single';
import { getSofaSingleLayout } from './sofaSingleLayout';
import { encodeProjectFile, decodeProjectFile } from '../project/projectFile';
import type { SofaFirmnessDraft } from './sofaFirmness';

const measure = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55 }; } } as Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;
const valid = { enabled: true, value: '6.5', label: '舒软', position: 69.4 };

it('旧项目及默认选项不增加产品事实、保存字段或任何绘图', () => {
  const defaults = normalizeSofaFirmness(undefined);
  expect(defaults).toEqual({ enabled: false, value: '', label: '', position: 50 });
  expect(hasSofaFirmness(defaults)).toBe(false);
  expect(sofaSingleRules.saveOptions(sofaSingleRules.createOptions())).toEqual({});
  expect(sofaSingleRules.layout([100, 120, 140], sofaSingleRules.createOptions())).toEqual(getSofaSingleLayout([100, 120, 140]));
  const context = { save: vi.fn() } as unknown as CanvasRenderingContext2D;
  drawSofaFirmness(context, defaults); expect(context.save).not.toHaveBeenCalled();
});

it.each(['', '-1', '10.1', '100', 'NaN', '5.55', '5/6', '5~6', '00.0'])('拒绝无效或不能完整显示的数值 %s，保留输入便于修正', (value) => {
  const normalized = normalizeSofaFirmness({ ...valid, value });
  expect(normalized.value).toBe(value);
  expect(sofaFirmnessIssues(measure, normalized).join()).toContain('坐感数值');
});

it('数值显示与校验共同去除首尾空白，草稿原文不被改写', () => {
  const value = { ...valid, value: ' 6.5                 ' };
  const context = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, roundRect() {}, clip() {}, arc() {}, fillText: vi.fn() } as unknown as CanvasRenderingContext2D;
  expect(sofaFirmnessIssues(measure, value)).toEqual([]);
  drawSofaFirmness(context, value);
  expect(context.fillText).toHaveBeenCalledWith('6.5', expect.any(Number), SOFA_FIRMNESS_GEOMETRY.valueBaseline);
  expect(value.value).toBe(' 6.5                 ');
});
it.each(['0', '3.5', '5', '6.5', '8', '10'])('允许资料中的有效数值 %s，不根据数值重写说明或位置', (value) => {
  const normalized = normalizeSofaFirmness({ ...valid, value });
  expect(sofaFirmnessIssues(measure, normalized)).toEqual([]);
  expect(normalized.label).toBe('舒软'); expect(normalized.position).toBe(69.4);
});

it('说明必填且不能溢出；关闭后不阻止旧图导出，内容仍保留', () => {
  expect(sofaFirmnessIssues(measure, { ...valid, label: '' }).join()).toContain('请填写');
  for (const label of ['完整说明不能被静默裁掉', '第一行\n第二行']) expect(sofaFirmnessIssues(measure, { ...valid, label }).join()).toContain('不截断');
  const hidden = normalizeSofaFirmness({ ...valid, enabled: false, label: '保留完整输入' });
  expect(sofaFirmnessIssues(measure, hidden)).toEqual([]);
  expect(hasSofaFirmness(hidden)).toBe(true);
});

it('指示位置有独立安全边界，0与100仍为圆及端点文字留白', () => {
  const g = SOFA_FIRMNESS_GEOMETRY;
  expect(normalizeSofaFirmness({ position: -10 }).position).toBe(0);
  expect(normalizeSofaFirmness({ position: 110 }).position).toBe(100);
  expect(normalizeSofaFirmness({ position: NaN }).position).toBe(50);
  expect(sofaFirmnessCenter(0) - g.outerStrokeRadius - 2.25).toBeGreaterThan(g.lineLeft);
  expect(sofaFirmnessCenter(100) + g.outerStrokeRadius + 2.25).toBeLessThan(g.lineRight);
});

it('源文件保存独立数值、说明和位置，隐藏开关后重开也不丢值', async () => {
  const options = { ...sofaSingleRules.createOptions(), sofaFirmness: { ...valid, enabled: false } };
  const draft: SofaFirmnessDraft = { version: 1, templateId: 'sofa-single', model: 'TEST', modelManuallyEdited: true, sellingPoints: [], sizeInput: '', dimensionFields: { length: '', width: '', height: '' }, annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, ...sofaSingleRules.saveOptions(options) };
  const restored = (await decodeProjectFile(await encodeProjectFile(draft))).draft as SofaFirmnessDraft;
  expect(restored.sofaFirmness).toEqual(options.sofaFirmness);
  expect(sofaSingleRules.restoreOptions(restored).sofaFirmness).toEqual(options.sofaFirmness);
  expect(restored.model).toBe('TEST');
});

it('开启时为组件保留独立行，全部主图标注安全区在圆弧上方', () => {
  const layout = sofaSingleRules.layout([100, 120, 140], { ...sofaSingleRules.createOptions(), sofaFirmness: valid });
  expect(layout.subjectSafeArea.y + layout.subjectSafeArea.height).toBeLessThan(SOFA_FIRMNESS_GEOMETRY.top);
  expect(layout.sellingPoints).toEqual(getSofaSingleLayout([100, 120, 140]).sellingPoints);
  expect(layout.modelBadge).toEqual(getSofaSingleLayout([100, 120, 140]).modelBadge);
});
