// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { computerChairSingleRules as rules } from './computer-chair-single';
import { normalizeComputerChairOptions, type ComputerChairDraft } from '../domain/computerChairSingleLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: ComputerChairDraft = { version: 1, model: '测试参数电脑椅', modelManuallyEdited: true,
  sizeInput: '62×60×85', dimensionFields: { length: '62', width: '60', height: '85' }, sellingPoints: ['', '', ''], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('只保存computerChair.details，草稿恢复完整文案与黑白字选项，编辑不污染已保存数据', async () => {
  const value = normalizeComputerChairOptions({ computerChairDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试卡${index + 1}\n标题`, description: '测试说明'.repeat(20), textColor: index === 0 ? 'white' : 'black' })) });
  const saved = rules.saveOptions(value);
  expect(Object.keys(saved)).toEqual(['computerChair']);
  expect((saved as ComputerChairDraft).computerChair!.details).toEqual(value.computerChairDetails);
  await saveDraft({ ...draft, ...saved }, 'computer-chair-own-test');
  expect(rules.restoreOptions(await loadDraft('computer-chair-own-test') as ComputerChairDraft)).toEqual(value);
  expect(rules.restoreOptions({ ...draft, softBed: { sizeLabels: ['旧模板', '无关'], sellingPointCount: 2, dimensionGap: 40 } })).toEqual(rules.createOptions());
  const history = new HistoryBuffer(rules.createOptions(), JSON.stringify(rules.createOptions())); history.commit(value, JSON.stringify(value));
  expect(history.undo(value, JSON.stringify(value))).toEqual(rules.createOptions()); expect(history.redo(JSON.stringify(rules.createOptions()))).toEqual(value);
  value.computerChairDetails[0].title = '已修改'; value.computerChairDetails[0].textColor = 'black';
  expect((saved as ComputerChairDraft).computerChair!.details[0]).toMatchObject({ title: '测试卡1\n标题', textColor: 'white' });
});

it('五组标题、说明和颜色都有可见标签，多行长文本不截断，颜色单独切换', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'), root = createRoot(container), Editor = rules.OptionsEditor!;
  function Harness() { const [value, onChange] = useState(rules.createOptions); return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify(value)}</output></>; }
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  try {
    await act(async () => root.render(<Harness/>));
    const labels = [...container.querySelectorAll('label')]; expect(labels).toHaveLength(10);
    expect([...container.querySelectorAll('details summary')].map((node) => node.textContent)).toEqual(['填写提示', ...Array.from({ length: 5 }, (_, i) => `细节${i + 1} · 标题与说明`)]);
    const title = labels.find((node) => node.textContent === '细节1标题')!.querySelector('textarea')!;
    const description = labels.find((node) => node.textContent === '细节5说明（可留空）')!.querySelector('textarea')!;
    for (const [node, text] of [[title, '完整标题\n第二行'], [description, '完整说明'.repeat(40)]] as const) {
      await act(async () => { setValue.call(node, text); node.dispatchEvent(new Event('input', { bubbles: true })); });
      expect(node.value).toBe(text); expect(node.hasAttribute('maxlength')).toBe(false);
    }
    const colors = [...container.querySelectorAll('[role=group]')]; expect(colors).toHaveLength(5); expect(colors[1].getAttribute('aria-label')).toBe('细节2文字颜色'); expect(colors[1].querySelector('[aria-pressed=true]')?.textContent).toBe('白字');
    await act(async () => { (colors[1].querySelector('button') as HTMLButtonElement).click(); });
    const value = JSON.parse(container.querySelector('output')!.textContent!);
    expect(value.computerChairDetails[0].title).toBe('完整标题\n第二行'); expect(value.computerChairDetails[4].description).toBe('完整说明'.repeat(40)); expect(value.computerChairDetails[1].textColor).toBe('black');
  } finally { await act(async () => root.unmount()); }
});

it('P50电脑椅规则独立声明字体、导出名和总尺寸，不预置材质功能事实', () => {
  expect(rules.productionNotes.sourcePages).toBe('2–3、49–50');
  expect(rules.requiredFonts).toEqual(['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK']);
  expect(rules.model).toMatchObject({ fontSize: 45, color: '#ffffff', background: '#00586d', radius: 8 });
  expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  expect(rules.exportFileName!('测试电脑椅', rules.createOptions())).toBe('测试电脑椅-电脑椅-SKU.jpg');
  expect(rules.exportIssues(draft.dimensionFields, '无效快速尺寸', rules.createOptions(), null).join('')).toContain('快速尺寸无效');
  expect(normalizeComputerChairOptions(undefined).computerChairDetails.every((detail) => !detail.title && !detail.description)).toBe(true);
});
