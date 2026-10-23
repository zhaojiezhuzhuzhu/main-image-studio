// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { longDiningTableSingleRules as rules } from './long-dining-table-single';
import type { LongDiningTableDraft } from '../domain/longDiningTableSingleLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: LongDiningTableDraft = { version: 1, templateId: 'long-dining-table-single', model: '测试参数餐桌', modelManuallyEdited: true,
  sizeInput: '200.99×85.99×74.89', dimensionFields: { length: '200.99', width: '85.99', height: '74.89' },
  sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('专属草稿只保存四个真实选项，自动保存和恢复不冒用其他模板字段', async () => {
  const options = { ...rules.createOptions(), noteText: '  测试参数图示备注  ', heightNote: '含脚垫', sellingPointCount: 2 as const, dimensionGap: 72 };
  const saved = rules.saveOptions(options);
  expect(saved).toEqual({ longDiningTable: { noteText: options.noteText, heightNote: '含脚垫', sellingPointCount: 2, dimensionGap: 72 } });
  await saveDraft({ ...draft, ...saved }, 'long-dining-table-test');
  const restored = await loadDraft('long-dining-table-test');
  expect(rules.restoreOptions(restored as LongDiningTableDraft)).toEqual(options);
  expect(rules.restoreOptions({ ...draft, softBed: { sizeLabels: ['旧规格', '其他模板'], sellingPointCount: 2, dimensionGap: 25 } })).toEqual(rules.createOptions());
});

it('选项历史一次撤销和重做恢复备注、高度说明、间距及卖点数量', () => {
  const before = rules.createOptions();
  const after = { ...before, noteText: '测试参数图示备注', heightNote: '含脚垫', sellingPointCount: 2 as const, dimensionGap: 80 };
  const history = new HistoryBuffer(before, JSON.stringify(before));
  history.commit(after, JSON.stringify(after));
  expect(history.undo(after, JSON.stringify(after))).toEqual(before);
  expect(history.redo(JSON.stringify(before))).toEqual(after);
});

it('卖点两三切换不会清空隐藏内容，备注输入无截断并即时给出溢出提示', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const Editor = rules.OptionsEditor!;
  function Harness() {
    const [value, onChange] = useState(rules.createOptions);
    return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify({ ...value, visible: rules.visibleSellingPoints(draft.sellingPoints, value) })}</output></>;
  }
  const output = () => JSON.parse(container.querySelector('output')!.textContent!);
  try {
    await act(async () => root.render(<Harness/>));
    const select = container.querySelector('select')!;
    const [note, height] = [...container.querySelectorAll<HTMLInputElement>('input:not([type="range"])')];
    expect(note.closest('label')!.textContent).toContain('图示备注');
    expect(height.closest('label')!.textContent).toContain('高度补充说明');
    expect(note.value).toBe('');
    expect(height.value).toBe('');
    expect(note.hasAttribute('maxlength')).toBe(false);
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(output().visible).toEqual(['测试卖点一', '测试卖点二']);
    await act(async () => { select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(output().visible).toEqual(draft.sellingPoints);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setValue.call(note, '长备注'.repeat(20)); note.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(output().noteText).toBe('长备注'.repeat(20));
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('备注过长');
    expect(note.getAttribute('aria-invalid')).toBe('true');
    await act(async () => { setValue.call(height, '按实际脚垫说明'); height.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(output().heightNote).toBe('按实际脚垫说明');
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.min).toBe('30');
    expect(slider.max).toBe('100');
  } finally { await act(async () => root.unmount()); }
});

it('规则仅提供长宽高单品，规范字体颜色独立，缺项不得推测', () => {
  expect(rules.dimensionKinds).toEqual(['length', 'width', 'height']);
  expect(rules.allowCompound).toBe(true);
  expect(rules.precision).toBe('truncate');
  expect(rules.filenameName.includeSpecification).toBe(true);
  expect(rules.model.fontSize).toBe(45);
  expect(rules.model.fontFamily).toContain('方正兰亭准黑_GBK');
  expect(rules.sellingPoints.fontSize).toBe(50);
  expect(rules.sellingPoints.color).toBe('#00586d');
  expect(rules.sellingPoints.fontFamily).toContain('方正兰亭中黑_GBK');
  expect(rules.dimensionColor).toBe('#000000');
  expect(rules.lineStyle.color).toBe('#545454');
  const options = rules.createOptions(), layout = rules.layout([200, 200, 200], options);
  const note = typeof rules.note === 'function' ? rules.note({ ...options, noteText: '测试参数图示备注' }, layout) : undefined;
  expect(note).toMatchObject({ text: '测试参数图示备注', font: '38px Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#545454' });
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues({ length: '', width: '', height: '' }, '', options, null).join('')).toContain('不能根据图片推测');
  expect(rules.exportIssues(draft.dimensionFields, '200×85', options, null).join('')).toContain('快速尺寸无效');
  expect(rules.exportIssues(draft.dimensionFields, '', options, '型号溢出')).toContain('型号溢出');
});
