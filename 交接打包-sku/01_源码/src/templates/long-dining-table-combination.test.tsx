// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { longDiningTableCombinationRules as rules } from './long-dining-table-combination';
import { normalizeLongDiningTableCombinationOptions, type LongDiningTableCombinationDraft } from '../domain/longDiningTableCombinationLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: LongDiningTableCombinationDraft = { version: 1, model: '测试参数长餐桌组合', modelManuallyEdited: true,
  sizeInput: '200.99×85.99×74.89', dimensionFields: { length: '200.99', width: '85.99', height: '74.89' },
  sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('仅保存专属组合字段，自动保存恢复保留两款型号、编号、备注和隐藏卖点设置', async () => {
  const value = normalizeLongDiningTableCombinationOptions({ noteText: '  测试图示  ', heightNote: '按实物填写', dimensionGap: 72, sellingPointCount: 2,
    diningChairs: { count: 2, models: ['测试A餐椅', '  测试B长凳  '], markers: [{ x: .12, y: .34 }, { x: .67, y: .89 }] } });
  const saved = rules.saveOptions(value);
  expect(Object.keys(saved)).toEqual(['longDiningTableCombination']);
  await saveDraft({ ...draft, ...saved }, 'long-dining-set-test');
  expect(rules.restoreOptions(await loadDraft('long-dining-set-test') as LongDiningTableCombinationDraft)).toEqual(value);
  expect(rules.restoreOptions({ ...draft, softBed: { sizeLabels: ['旧模板', '无关'], sellingPointCount: 2, dimensionGap: 40 } })).toEqual(rules.createOptions());
  value.diningChairs.models[0] = '已修改';
  expect((saved as LongDiningTableCombinationDraft).longDiningTableCombination!.diningChairs.models[0]).toBe('测试A餐椅');
});

it('款数、第二款内容和编号位置进入同一撤销历史', () => {
  const before = rules.createOptions(), after = normalizeLongDiningTableCombinationOptions({ diningChairs: { count: 2, models: ['A款', 'B款'], markers: [{ x: .3, y: .4 }, { x: .6, y: .7 }] } });
  const history = new HistoryBuffer(before, JSON.stringify(before));
  history.commit(after, JSON.stringify(after));
  expect(history.undo(after, JSON.stringify(after))).toEqual(before);
  expect(history.redo(JSON.stringify(before))).toEqual(after);
});

it('款数切换保留隐藏型号与位置，整组素材提示和编号含义明确', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'), root = createRoot(container), Editor = rules.OptionsEditor!;
  function Harness() { const [value, onChange] = useState(rules.createOptions); return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify(value)}</output></>; }
  const output = () => JSON.parse(container.querySelector('output')!.textContent!);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const input = (label: string) => [...container.querySelectorAll('label')].find((node) => node.textContent?.startsWith(label))!.querySelector('input')!;
  try {
    await act(async () => root.render(<Harness/>));
    expect(container.textContent).toContain('完整');
    expect(container.textContent).toContain('不生成或复制椅子');
    const count = container.querySelector('select')!;
    await act(async () => { count.value = '2'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.textContent).not.toContain('对应编号位置');
    await act(async () => { const model = input('第2款餐椅/长凳型号'); setValue.call(model, '测试参数长凳'); model.dispatchEvent(new Event('input', { bubbles: true })); });
    const marker = output().diningChairs.markers[1];
    await act(async () => { count.value = '1'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.textContent).not.toContain('第2款餐椅/长凳型号');
    expect(output().diningChairs.models[1]).toBe('测试参数长凳');
    expect(output().diningChairs.markers[1]).toEqual(marker);
    await act(async () => { count.value = '2'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(input('第2款餐椅/长凳型号').value).toBe('测试参数长凳');
    expect(output().diningChairs.markers[1]).toEqual(marker);
    const note = input('图示备注');
    expect(note.hasAttribute('maxlength')).toBe(false);
    await act(async () => { setValue.call(note, '完整备注'.repeat(10)); note.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(output().noteText).toBe('完整备注'.repeat(10));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('超过后移至卖点下方居中');
  } finally { await act(async () => root.unmount()); }
});

it('P36–37字体、规则和导出名称独立，两三卖点切换保留原始第三项', () => {
  expect(rules.productionNotes.sourcePages).toBe('2–3、36–37');
  expect(rules.model).toMatchObject({ fontSize: 35, radius: 8, color: '#ffffff', background: '#00586d' });
  expect(rules.sellingPoints).toMatchObject({ fontSize: 50, radius: 8, color: '#00586d' });
  expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  const value = rules.createOptions();
  expect(rules.visibleSellingPoints(draft.sellingPoints, { ...value, sellingPointCount: 2 })).toEqual(draft.sellingPoints.slice(0, 2));
  expect(rules.visibleSellingPoints(draft.sellingPoints, value)).toEqual(draft.sellingPoints);
  expect(rules.exportFileName!('测试餐桌', value)).toBe('测试餐桌-长餐桌组合-一款搭配-SKU.jpg');
  value.diningChairs!.count = 2;
  expect(rules.exportFileName!('测试餐桌', value)).toBe('测试餐桌-长餐桌组合-两款搭配-SKU.jpg');
});
