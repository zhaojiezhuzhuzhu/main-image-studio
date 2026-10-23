// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { studyDeskCombinationRules as rules } from './study-desk-combination';
import { normalizeStudyDeskCombinationOptions, type StudyDeskCombinationDraft } from '../domain/studyDeskCombinationLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: StudyDeskCombinationDraft = { version: 1, model: '测试参数学习桌组合', modelManuallyEdited: true,
  sizeInput: '120/150×62/75×73~122', dimensionFields: { length: '120/150', width: '62/75', height: '73~122' },
  sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('组合只保存专属型号、数量与间距，草稿往返不读取其他模板字段', async () => {
  const value = normalizeStudyDeskCombinationOptions({ studyChairModel: '  测试完整学习椅型号  ', sellingPointCount: 2, dimensionGap: 160 });
  const saved = rules.saveOptions(value);
  expect(Object.keys(saved)).toEqual(['studyDeskCombination']);
  await saveDraft({ ...draft, ...saved }, 'study-desk-set-test');
  expect(rules.restoreOptions(await loadDraft('study-desk-set-test') as StudyDeskCombinationDraft)).toEqual(value);
  expect(rules.restoreOptions({ ...draft, softBed: { sizeLabels: ['旧模板', '无关'], sellingPointCount: 2, dimensionGap: 40 } })).toEqual(rules.createOptions());
  value.studyChairModel = '已修改';
  expect((saved as StudyDeskCombinationDraft).studyDeskCombination!.studyChairModel).toBe('  测试完整学习椅型号  ');
});

it('学习椅型号、卖点数量和间距进入同一撤销历史', () => {
  const before = rules.createOptions(), after = normalizeStudyDeskCombinationOptions({ studyChairModel: '测试学习椅', sellingPointCount: 2, dimensionGap: 90 });
  const history = new HistoryBuffer(before, JSON.stringify(before)); history.commit(after, JSON.stringify(after));
  expect(history.undo(after, JSON.stringify(after))).toEqual(before);
  expect(history.redo(JSON.stringify(before))).toEqual(after);
});

it('专属控件有可见标签，完整型号不截断，切换两卖点后仍保留填写的型号', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'), root = createRoot(container), Editor = rules.OptionsEditor!;
  function Harness() { const [value, onChange] = useState(rules.createOptions); return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify(value)}</output></>; }
  const output = () => JSON.parse(container.querySelector('output')!.textContent!);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const input = (label: string) => [...container.querySelectorAll('label')].find((node) => node.textContent?.startsWith(label))!.querySelector('input')!;
  try {
    await act(async () => root.render(<Harness/>));
    const model = input('学习椅型号'), raw = '测试完整型号'.repeat(20);
    await act(async () => { setValue.call(model, raw); model.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(model.value).toBe(raw); expect(model.hasAttribute('maxlength')).toBe(false);
    const count = container.querySelector('select')!;
    await act(async () => { count.value = '2'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    const gap = input('产品与卖点最小间距');
    await act(async () => { setValue.call(gap, '180'); gap.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(output()).toMatchObject({ studyChairModel: raw, sellingPointCount: 2, dimensionGap: 180 });
    expect(gap.min).toBe('60'); expect(gap.max).toBe('180');
  } finally { await act(async () => root.unmount()); }
});

it('P47组合颜色、字体和导出身份独立声明，不依赖其他模板规则', () => {
  expect(rules.productionNotes.sourcePages).toBe('2–3、44、46–48');
  expect(rules.model).toMatchObject({ fontSize: 35, radius: 8, color: '#ffffff', background: '#00586d' });
  expect(rules.sellingPoints).toMatchObject({ fontSize: 50, radius: 8, color: '#00586d' });
  expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  expect(rules.requiredFonts).toEqual(['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK']);
  expect(rules.exportFileName!('测试学习桌', rules.createOptions())).toBe('测试学习桌-儿童学习桌组合-SKU.jpg');
});
