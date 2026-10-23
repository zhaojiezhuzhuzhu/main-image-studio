// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { liftingSideTableSingleRules as rules } from './lifting-side-table-single';
import { normalizeLiftingSideTableOptions, type LiftingSideTableDraft } from '../domain/liftingSideTableSingleLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: LiftingSideTableDraft = { version: 1, model: '测试参数升降边桌', modelManuallyEdited: true,
  sizeInput: '80×50×72~107', dimensionFields: { length: '80', width: '50', height: '72~107' },
  sellingPoints: ['', '', ''], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('仅保存liftingSideTable.details，五张卡片完整文案经草稿往返恢复且不污染历史', async () => {
  const value = normalizeLiftingSideTableOptions({ sideTableDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试卡${index + 1}\n标题`, description: '测试说明'.repeat(20) })) });
  const saved = rules.saveOptions(value);
  expect(Object.keys(saved)).toEqual(['liftingSideTable']);
  expect((saved as LiftingSideTableDraft).liftingSideTable!.details).toEqual(value.sideTableDetails);
  await saveDraft({ ...draft, ...saved }, 'lifting-side-table-own-test');
  expect(rules.restoreOptions(await loadDraft('lifting-side-table-own-test') as LiftingSideTableDraft)).toEqual(value);
  expect(rules.restoreOptions({ ...draft, softBed: { sizeLabels: ['旧模板', '无关'], sellingPointCount: 2, dimensionGap: 40 } })).toEqual(rules.createOptions());
  const history = new HistoryBuffer(rules.createOptions(), JSON.stringify(rules.createOptions())); history.commit(value, JSON.stringify(value));
  expect(history.undo(value, JSON.stringify(value))).toEqual(rules.createOptions());
  expect(history.redo(JSON.stringify(rules.createOptions()))).toEqual(value);
  value.sideTableDetails[0].title = '已修改'; expect((saved as LiftingSideTableDraft).liftingSideTable!.details[0].title).toBe('测试卡1\n标题');
});

it('五组标题和说明都有可见标签，可编辑多行且不截断，也不显示无关卖点数量', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'), root = createRoot(container), Editor = rules.OptionsEditor!;
  function Harness() { const [value, onChange] = useState(rules.createOptions); return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify(value)}</output></>; }
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  try {
    await act(async () => root.render(<Harness/>));
    const labels = [...container.querySelectorAll('label')], headings = [...container.querySelectorAll('details summary')];
    expect(labels).toHaveLength(10); expect(headings.map((node) => node.textContent)).toEqual(['填写提示', ...Array.from({ length: 5 }, (_, i) => `细节${i + 1} · 标题与说明`)]);
    expect(container.querySelector('select')).toBeNull();
    const title = labels.find((node) => node.textContent === '细节1标题')!.querySelector('textarea')!;
    const description = labels.find((node) => node.textContent === '细节5说明（可留空）')!.querySelector('textarea')!;
    for (const [node, text] of [[title, '完整标题\n第二行'], [description, '完整说明'.repeat(40)]] as const) {
      await act(async () => { setValue.call(node, text); node.dispatchEvent(new Event('input', { bubbles: true })); });
      expect(node.value).toBe(text); expect(node.hasAttribute('maxlength')).toBe(false);
    }
    const value = JSON.parse(container.querySelector('output')!.textContent!);
    expect(value.sideTableDetails[0].title).toBe('完整标题\n第二行'); expect(value.sideTableDetails[4].description).toBe('完整说明'.repeat(40));
  } finally { await act(async () => root.unmount()); }
});

it('P49规范字体及单品导出名独立声明，无固定商品功能说明', () => {
  expect(rules.productionNotes.sourcePages).toBe('2–3、49');
  expect(rules.requiredFonts).toEqual(['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK']);
  expect(rules.model).toMatchObject({ fontSize: 45, color: '#ffffff', background: '#00586d', radius: 8 });
  expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  expect(rules.exportFileName!('测试升降边桌', rules.createOptions())).toBe('测试升降边桌-升降边桌-SKU.jpg');
  expect(rules.exportIssues(draft.dimensionFields, '无效快速尺寸', rules.createOptions(), null).join('')).toContain('快速尺寸无效');
});
