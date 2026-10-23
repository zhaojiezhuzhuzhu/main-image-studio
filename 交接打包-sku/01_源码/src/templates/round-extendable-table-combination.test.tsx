// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { roundExtendableTableCombinationRules as rules } from './round-extendable-table-combination';
import type { RoundExtendableTableCombinationDraft } from '../domain/roundExtendableTableCombinationLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from '../project/projectFile';

// 测试参数仅用于验证编辑与持久化，不对应任何实物产品。
const draft: RoundExtendableTableCombinationDraft = { version: 1, templateId: 'round-extendable-table-combination', model: '测试圆桌 完整型号规格', modelManuallyEdited: true, sizeInput: '90.99~140.99/100.99~160.99×74.99', dimensionFields: { length: '', width: '', diameter: '90.99~140.99/100.99~160.99', height: '74.99' }, sellingPoints: ['测试一', '测试二', '测试三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('专属字段隔离保存恢复，默认资料全部留空，创建的嵌套状态互不共享', async () => {
  const initial = rules.createOptions();
  expect(initial).toMatchObject({ sellingPointCount: 3, noteText: '', heightNote: '', diameterPlacement: 'surface', diningChairs: { count: 1, models: ['', ''] } });
  const selected = { ...initial, sellingPointCount: 2 as const, noteText: ' 测试图示备注 ', heightNote: ' 测试高度\n说明 ', diameterPlacement: 'outside' as const, diningChairs: { ...initial.diningChairs!, models: [' 测试餐椅完整型号 ', ''] as [string, string] } };
  const saved = rules.saveOptions(selected);
  expect(Object.keys(saved)).toEqual(['roundExtendableTableCombination']);
  await saveDraft({ ...draft, ...saved }, 'round-table-combination-unit-test');
  expect(rules.restoreOptions(await loadDraft('round-table-combination-unit-test') as RoundExtendableTableCombinationDraft)).toEqual(selected);
  expect(rules.restoreOptions(draft)).toEqual(initial);
  expect(rules.hasOptions(initial)).toBe(false);
  expect(rules.hasOptions(selected)).toBe(true);
  const other = rules.createOptions();
  initial.diningChairs!.models[0] = '不可共享';
  initial.diningChairs!.markers[0].x = .1;
  expect(other.diningChairs).toMatchObject({ models: ['', ''], markers: [{ x: .5 }, { x: .5 }] });
});

it('非法专属字段恢复默认状态，此版固定一款餐椅且不把数量或编号写入画布', () => {
  for (const roundExtendableTableCombination of [null, 'invalid', { diningChairs: { models: '不能当作型号数组' } }, { sellingPointCount: '2', noteText: 12, heightNote: [], diameterPlacement: 'invalid', diningChairs: { count: 2, models: [12, '不会使用'] } }]) {
    expect(rules.restoreOptions({ ...draft, roundExtendableTableCombination } as unknown as RoundExtendableTableCombinationDraft)).toEqual(rules.createOptions());
  }
});

it('编辑器明确整组素材，椅型号、直径样式、说明与2/3卖点可编辑且保留第三项', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const Editor = rules.OptionsEditor!;
  function Harness() {
    const [value, onChange] = useState(rules.createOptions);
    return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify({ value, points: rules.visibleSellingPoints(draft.sellingPoints, value) })}</output></>;
  }
  const state = () => JSON.parse(container.querySelector('output')!.textContent!);
  async function fill(element: HTMLInputElement | HTMLTextAreaElement, text: string) {
    await act(async () => { Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, text); element.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  try {
    await act(async () => root.render(<Harness/>));
    expect(container.textContent).toContain('已包含餐桌和餐椅的整组 PNG');
    expect(container.textContent).toContain('不自动生成餐椅');
    expect(container.textContent).toContain('仍需拖动端点');
    const [chair, note] = container.querySelectorAll('input');
    const [placement, count] = container.querySelectorAll('select');
    expect(chair.closest('label')!.textContent).toContain('餐椅完整型号');
    await fill(chair, '测试椅型号');
    await fill(note, '测试图示备注');
    await fill(container.querySelector('textarea')!, '测试高度\n说明');
    await act(async () => { placement.value = 'outside'; placement.dispatchEvent(new Event('change', { bubbles: true })); count.value = '2'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(state().value).toMatchObject({ diningChairs: { models: ['测试椅型号', ''] }, diameterPlacement: 'outside', noteText: '测试图示备注', heightNote: '测试高度\n说明' });
    expect(state().points).toEqual(['测试一', '测试二']);
    await act(async () => { count.value = '3'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(state().points).toEqual(draft.sellingPoints);
    expect(container.querySelector('input[type="number"]')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it('规则独立声明P39字号与颜色，缺项及实际字体容量阻止导出', () => {
  const options = rules.createOptions();
  const layout = rules.layout([200, 200, 200], options);
  const context = { font: '', measureText(text: string) { return { width: text.length * parseFloat(this.font) } as TextMetrics; } };
  expect(rules.model).toMatchObject({ fontSize: 35, color: '#ffffff', background: '#00586d', radius: 8 });
  expect(rules.sellingPoints).toMatchObject({ fontSize: 50, color: '#00586d', radius: 8 });
  expect(rules.dimensionKinds).toEqual(['diameter', 'height']);
  expect(rules.extraIssues!(context, options, layout, draft.dimensionFields).join()).toContain('餐椅完整型号');
  const selected = { ...options, diningChairs: { ...options.diningChairs!, models: ['测试餐椅', ''] as [string, string] } };
  expect(rules.extraIssues!(context, selected, layout, { ...draft.dimensionFields, diameter: Array(30).fill('90~140').join('/') }).join()).toContain('直径规格过长');
  expect(rules.exportIssues({ ...draft.dimensionFields, height: '' }, '', selected, null).join()).toContain('高度');
  expect(rules.exportIssues(draft.dimensionFields, '90×100×75', selected, '测试型号错误')).toEqual(expect.arrayContaining(['测试型号错误', expect.stringContaining('直径×高')]));
  expect(rules.exportFileName!('测试圆桌', selected)).toBe('测试圆桌-圆伸缩餐桌组合-SKU.jpg');
});

it('工程以整图single类型往返保留原始尺寸、独立椅型号和说明，不迁移旧格式', async () => {
  const initial = rules.createOptions();
  const selected = { ...initial, noteText: ' 测试图示备注 ', heightNote: ' 测试高度\n说明 ', diameterPlacement: 'outside' as const, diningChairs: { ...initial.diningChairs!, models: [' 测试餐椅完整型号 ', ''] as [string, string] } };
  const source = { ...draft, ...rules.saveOptions(selected) };
  const restored = await decodeProjectFile(await encodeProjectFile(source, 'single', 'round-table-combination-test'));
  expect(restored.draft).toEqual(source);
  expect(rules.restoreOptions(restored.draft as RoundExtendableTableCombinationDraft)).toEqual(selected);
});
