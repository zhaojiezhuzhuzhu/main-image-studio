// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { standingDeskCombinationRules as rules } from './standing-desk-combination';
import { normalizeStandingDeskCombinationOptions, type StandingDeskCombinationDraft } from '../domain/standingDeskCombinationLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: StandingDeskCombinationDraft = { version: 1, model: '测试参数升降桌组合', modelManuallyEdited: true,
  sizeInput: '120/150×62/75×73~122', dimensionFields: { length: '120/150', width: '62/75', height: '73~122' },
  sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('仅保存专属组合字段，自动保存恢复保留标题、隐藏配件型号和补充说明', async () => {
  const value = normalizeStandingDeskCombinationOptions({ headline: '  测试标题  ', standingDeskSet: { count: 2, riserModel: '测试增高架', chairModel: '  测试电脑椅  ', riserNote: '测试搭配说明' } });
  const saved = rules.saveOptions(value);
  expect(Object.keys(saved)).toEqual(['standingDeskCombination']);
  await saveDraft({ ...draft, ...saved }, 'standing-desk-set-test');
  expect(rules.restoreOptions(await loadDraft('standing-desk-set-test') as StandingDeskCombinationDraft)).toEqual(value);
  expect(rules.restoreOptions({ ...draft, softBed: { sizeLabels: ['旧模板', '无关'], sellingPointCount: 2, dimensionGap: 40 } })).toEqual(rules.createOptions());
  value.standingDeskSet.chairModel = '已修改';
  expect((saved as StandingDeskCombinationDraft).standingDeskCombination!.standingDeskSet.chairModel).toBe('  测试电脑椅  ');
});

it('套装、标题、型号和备注进入同一撤销历史', () => {
  const before = rules.createOptions(), after = normalizeStandingDeskCombinationOptions({ headline: '测试标题', standingDeskSet: { count: 3, riserModel: '测试增高架', chairModel: '测试电脑椅', riserNote: '测试说明' } });
  const history = new HistoryBuffer(before, JSON.stringify(before)); history.commit(after, JSON.stringify(after));
  expect(history.undo(after, JSON.stringify(after))).toEqual(before);
  expect(history.redo(JSON.stringify(before))).toEqual(after);
});

it('两件套隐藏电脑椅与备注字段，切回三件套完整恢复且不截断用户文字', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'), root = createRoot(container), Editor = rules.OptionsEditor!;
  function Harness() { const [value, onChange] = useState(rules.createOptions); return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify(value)}</output></>; }
  const output = () => JSON.parse(container.querySelector('output')!.textContent!);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const input = (label: string) => [...container.querySelectorAll('label')].find((node) => node.textContent?.startsWith(label))!.querySelector('input')!;
  try {
    await act(async () => root.render(<Harness/>));
    const count = container.querySelector('select')!;
    await act(async () => { count.value = '3'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    for (const [label, text] of [['组合标题', '测试标题'], ['电脑椅型号', '测试参数电脑椅'], ['增高架补充说明', '完整备注'.repeat(20)]]) {
      await act(async () => { const node = input(label); setValue.call(node, text); node.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    await act(async () => { count.value = '2'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect([...container.querySelectorAll('label')].some((node) => node.textContent?.startsWith('电脑椅型号'))).toBe(false);
    expect(output().standingDeskSet.chairModel).toBe('测试参数电脑椅');
    expect(output().standingDeskSet.riserNote).toBe('完整备注'.repeat(20));
    await act(async () => { count.value = '3'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(input('电脑椅型号').value).toBe('测试参数电脑椅');
    expect(input('增高架补充说明').value).toBe('完整备注'.repeat(20));
    expect(input('增高架补充说明').hasAttribute('maxlength')).toBe(false);
    expect(input('组合标题').value).toBe('测试标题');
  } finally { await act(async () => root.unmount()); }
});

it('P44–45字体、独立规则与导出名保留套装身份，三个卖点不增删', () => {
  expect(rules.productionNotes.sourcePages).toBe('2–3、44–45');
  expect(rules.model).toMatchObject({ fontSize: 35, radius: 8, color: '#ffffff', background: '#00586d' });
  expect(rules.sellingPoints).toMatchObject({ fontSize: 50, radius: 8, color: '#00586d' });
  expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  expect(rules.requiredFonts).toContain('方正兰亭粗黑_GBK');
  const value = rules.createOptions();
  expect(rules.visibleSellingPoints(draft.sellingPoints, value)).toEqual(draft.sellingPoints);
  expect(rules.exportFileName!('测试升降桌', value)).toBe('测试升降桌-电动升降桌组合-两件套-SKU.jpg');
  value.standingDeskSet!.count = 3;
  expect(rules.exportFileName!('测试升降桌', value)).toBe('测试升降桌-电动升降桌组合-三件套-SKU.jpg');
});
