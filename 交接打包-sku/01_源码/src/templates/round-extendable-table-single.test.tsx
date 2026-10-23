// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { roundExtendableTableSingleRules as rules } from './round-extendable-table-single';
import { type RoundExtendableTableDraft } from '../domain/roundExtendableTableSingleLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';

// 仅用于测试的参数，不是实物尺寸。
const draft: RoundExtendableTableDraft = { version: 1, model: '测试参数：完整圆桌型号规格', modelManuallyEdited: true, sizeInput: '81.6~130/91.6~150×75.3', dimensionFields: { length: '', width: '', diameter: '81.6~130/91.6~150', height: '75.3' }, sellingPoints: ['测试一', '测试二', '测试三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('独立字段保存恢复全部选项，不覆盖别的模板；旧草稿恢复本模板默认空备注', async () => {
  const options = { ...rules.createOptions(), sellingPointCount: 2 as const, dimensionGap: 48, noteText: '  测试备注  ', heightNote: '测试高度\n第二行' };
  const saved = rules.saveOptions(options);
  expect(Object.keys(saved)).toEqual(['roundExtendableTable']);
  expect(saved).toEqual({ roundExtendableTable: { sellingPointCount: 2, dimensionGap: 48, noteText: '  测试备注  ', heightNote: '测试高度\n第二行' } });
  await saveDraft({ ...draft, ...saved }, 'round-extendable-table-test');
  expect(rules.restoreOptions(await loadDraft('round-extendable-table-test') as RoundExtendableTableDraft)).toEqual(options);
  expect(rules.restoreOptions(draft)).toEqual(rules.createOptions());
  expect(rules.createOptions()).toMatchObject({ sellingPointCount: 3, dimensionGap: 60, noteText: '', heightNote: '' });
  const first = rules.createOptions(), second = rules.createOptions();
  first.sizeLabels[0] = '不可共享';
  expect(second.sizeLabels).toEqual(['', '']);
  expect(rules.hasOptions(second)).toBe(false);
  expect(rules.hasOptions(options)).toBe(true);
  expect(rules.hasOptions({ ...second, noteText: ' ' })).toBe(true);
});

it('非法专属字段使用默认值，间距可以低于建议60但不能超出控件范围', () => {
  for (const roundExtendableTable of [null, 'invalid', { sellingPointCount: '2', dimensionGap: NaN, noteText: 10, heightNote: [] }]) {
    expect(rules.restoreOptions({ ...draft, roundExtendableTable } as unknown as RoundExtendableTableDraft)).toEqual(rules.createOptions());
  }
  const tooSmall: RoundExtendableTableDraft = { ...draft, roundExtendableTable: { sellingPointCount: 2, dimensionGap: 5, noteText: '', heightNote: '' } };
  const tooLarge: RoundExtendableTableDraft = { ...draft, roundExtendableTable: { sellingPointCount: 3, dimensionGap: 500, noteText: '', heightNote: '' } };
  expect(rules.restoreOptions(tooSmall).dimensionGap).toBe(30);
  expect(rules.restoreOptions(tooLarge).dimensionGap).toBe(120);
});

it('两三个卖点切换保留第三项；备注与高度说明可编辑且有可见标签和错误提示', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const Editor = rules.OptionsEditor!;
  function Harness() {
    const [value, onChange] = useState(rules.createOptions);
    return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify({ value, points: rules.visibleSellingPoints(draft.sellingPoints, value) })}</output></>;
  }
  const state = () => JSON.parse(container.querySelector('output')!.textContent!);
  try {
    await act(async () => root.render(<Harness/>));
    const select = container.querySelector('select')!;
    expect(select.closest('label')!.textContent).toContain('卖点数量');
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(state().points).toEqual(['测试一', '测试二']);
    await act(async () => { select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(state().points).toEqual(draft.sellingPoints);
    const note = container.querySelector('input:not([type="range"])')! as HTMLInputElement;
    const height = container.querySelector('textarea')!;
    expect(note.closest('label')!.textContent).toContain('底部备注');
    expect(height.closest('label')!.textContent).toContain('高度说明');
    expect(note.value).toBe('');
    expect(height.value).toBe('');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(height, '测试高度说明');
      height.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(state().value.heightNote).toBe('测试高度说明');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(note, '超长备注'.repeat(20));
      note.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(state().value.noteText).toBe('超长备注'.repeat(20));
    expect(container.querySelector('[role="status"]')!.textContent).toContain('超出单行安全区');
    expect(container.querySelector('input[type="range"]')!.getAttribute('min')).toBe('30');
    expect(container.textContent).toContain('测试参数');
    expect(container.textContent).toContain('双侧可伸缩方向');
  } finally { await act(async () => root.unmount()); }
});

it('导出校验只要求直径与高，独立使用第38页字号颜色并提示溢出', () => {
  const options = rules.createOptions();
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues({ length: '', width: '', diameter: '90', height: '75' }, '90×75', options, null)).toEqual([]);
  expect(rules.exportIssues({ ...draft.dimensionFields, diameter: '' }, '', options, null).join()).toContain('直径');
  expect(rules.exportIssues(draft.dimensionFields, '80×90×75', options, '型号超长').join()).toContain('直径×高');
  expect(rules.exportIssues(draft.dimensionFields, '', options, '型号超长')).toContain('型号超长');
  expect(rules.exportIssues(draft.dimensionFields, '', { ...options, noteText: '备注'.repeat(60) }, null).join()).toContain('备注超出');
  expect(rules.dimensionKinds).toEqual(['diameter', 'height']);
  expect(rules.precision).toBe('truncate');
  expect(rules.allowCompound).toBe(true);
  expect(rules.filenameName).toEqual({ includeSpecification: true });
  expect(rules.model).toMatchObject({ fontSize: 45, color: '#ffffff', background: '#00586d', radius: 8 });
  expect(rules.sellingPoints).toMatchObject({ fontSize: 50, color: '#00586d', radius: 8 });
  expect(rules.dimensionColor).toBe('#000000');
  expect(rules.lineStyle.color).toBe('#545454');
});
