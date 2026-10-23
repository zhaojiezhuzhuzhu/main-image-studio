// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { functionalSofaSingleRules as rules } from './functional-sofa-single';
import type { FunctionalSofaDraft } from '../domain/functionalSofaSingleLayout';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: FunctionalSofaDraft = { version: 1, templateId: 'functional-sofa-single', model: 'TEST-A', modelManuallyEdited: true,
  sizeInput: '92×105~162×98~77', dimensionFields: { length: '92', width: '105~162', height: '98~77' },
  sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('仅保存functionalSofa专属选项，撤销恢复两个功能和隐藏文案，不共享保存对象', () => {
  const before = rules.createOptions();
  const after = { ...before, sellingPointCount: 2 as const, rocking: { ...before.rocking!, enabled: true, text: '测试摇动', x: 860 }, rotation: { ...before.rotation!, text: '待确认功能' } };
  const saved = rules.saveOptions(after) as Partial<FunctionalSofaDraft>;
  expect(Object.keys(saved)).toEqual(['functionalSofa']);
  expect(rules.restoreOptions({ ...draft, ...saved })).toEqual(after);
  saved.functionalSofa!.rocking.x = 900;
  expect(after.rocking.x).toBe(860);
  expect(rules.restoreOptions(draft)).toEqual(before);
  expect(rules.hasOptions(before)).toBe(false); expect(rules.hasOptions(after)).toBe(true);
  const history = new HistoryBuffer(before, JSON.stringify(before));
  history.commit(after, JSON.stringify(after));
  expect(history.undo(after, JSON.stringify(after))).toEqual(before);
  expect(history.redo(JSON.stringify(before))).toEqual(after);
});

it('选项可用键盘表单编辑，功能关闭后保留说明和位置，复位只改坐标', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'), root = createRoot(container), Editor = rules.OptionsEditor!;
  function Harness() {
    const [value, onChange] = useState(rules.createOptions);
    return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify({ ...value, points: rules.visibleSellingPoints(draft.sellingPoints, value) })}</output></>;
  }
  const output = () => JSON.parse(container.querySelector('output')!.textContent!);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const input = async (element: HTMLInputElement, value: string) => act(async () => { setValue.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); });
  try {
    await act(async () => root.render(<Harness/>));
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => checkbox.click());
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('请填写摇动');
    const text = container.querySelector<HTMLInputElement>('input:not([type])')!;
    expect(text.closest('label')!.textContent).toBe('摇动功能说明');
    await input(text, '测试摇动');
    const x = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    await input(x, '830');
    expect(output().rocking).toMatchObject({ enabled: true, text: '测试摇动', x: 830 });
    await act(async () => checkbox.click());
    expect(output().rocking).toMatchObject({ enabled: false, text: '测试摇动', x: 830 });
    await act(async () => checkbox.click());
    const reset = container.querySelector<HTMLButtonElement>('button')!;
    expect(reset.className).toBe('quick-secondary');
    await act(async () => reset.click());
    expect(output().rocking).toEqual({ ...rules.createOptions().rocking, enabled: true, text: '测试摇动' });
    const select = container.querySelector('select')!;
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(output().points).toHaveLength(2);
    await act(async () => { select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(output().points).toEqual(draft.sellingPoints);
  } finally { await act(async () => root.unmount()); }
});

it('规范、尺寸缺项、功能空文案和型号溢出进入本模板导出校验', () => {
  const options = rules.createOptions();
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues({ ...draft.dimensionFields, height: '' }, '', options, null).join()).toContain('高尺寸');
  expect(rules.exportIssues(draft.dimensionFields, '92×105', options, null).join()).toContain('快速尺寸无效');
  expect(rules.exportIssues(draft.dimensionFields, '', { ...options, rocking: { ...options.rocking!, enabled: true } }, null).join()).toContain('请填写摇动');
  expect(rules.exportIssues(draft.dimensionFields, '', options, '型号溢出')).toContain('型号溢出');
  expect(rules.productionNotes.sourcePages).toContain('18');
  expect(rules.filenameName.includeSpecification).toBe(false);
  expect(rules.model.fontSize).toBe(60); expect(rules.sellingPoints.fontSize).toBe(50);
  expect(rules.precision).toBe('truncate'); expect(rules.allowCompound).toBe(true);
});
