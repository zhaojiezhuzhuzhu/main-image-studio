// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { ergonomicChairSingleRules as rules } from './ergonomic-chair-single';
import { normalizeErgonomicChairOptions, type ErgonomicChairDraft } from '../domain/ergonomicChairSingleLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { HistoryBuffer } from '../history/historyBuffer';

const draft: ErgonomicChairDraft = { version: 1, model: '测试参数工学椅', modelManuallyEdited: true,
  sizeInput: '68×62×112~122', dimensionFields: { length: '68', width: '62', height: '112~122' },
  sellingPoints: ['', '', ''], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('专属ergonomicChair.details完整草稿往返且不读取边桌或书椅设置', async () => {
  const value = normalizeErgonomicChairOptions({ ergonomicChairDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试卡${index + 1}\n标题`, description: '测试说明'.repeat(20) })) });
  const saved = rules.saveOptions(value); expect(Object.keys(saved)).toEqual(['ergonomicChair']);
  expect((saved as ErgonomicChairDraft).ergonomicChair!.details).toEqual(value.ergonomicChairDetails);
  await saveDraft({ ...draft, ...saved }, 'ergonomic-chair-own-test');
  expect(rules.restoreOptions(await loadDraft('ergonomic-chair-own-test') as ErgonomicChairDraft)).toEqual(value);
  const otherDraft = { ...draft, liftingSideTable: { details: [{ title: '边桌标题', description: '无关说明' }] }, officeChair: { sellingPointCount: 2, dimensionGap: 100 } };
  expect(rules.restoreOptions(otherDraft)).toEqual(rules.createOptions());
  value.ergonomicChairDetails[0].title = '已修改'; expect((saved as ErgonomicChairDraft).ergonomicChair!.details[0].title).toBe('测试卡1\n标题');
});

it('卡片多行文案与说明进入撤销历史，不因后续编辑污染先前卡片', () => {
  const before = rules.createOptions(), after = normalizeErgonomicChairOptions({ ergonomicChairDetails: [{ title: '测试标题', description: '说明一\n说明二' }] });
  const history = new HistoryBuffer(before, JSON.stringify(before)); history.commit(after, JSON.stringify(after));
  expect(history.undo(after, JSON.stringify(after))).toEqual(before); expect(history.redo(JSON.stringify(before))).toEqual(after);
  expect(rules.createOptions().ergonomicChairDetails![0].title).toBe('');
});

it('五组标题说明都有可见标签，支持多行和长文案且不显示常规卖点控件', async () => {
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
    expect(value.ergonomicChairDetails[0].title).toBe('完整标题\n第二行'); expect(value.ergonomicChairDetails[4].description).toBe('完整说明'.repeat(40));
  } finally { await act(async () => root.unmount()); }
});

it('P49–50规范字体、颜色和工学椅导出身份独立声明', () => {
  expect(rules.productionNotes.sourcePages).toBe('2–3、49–50');
  expect(rules.requiredFonts).toEqual(['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK']);
  expect(rules.model).toMatchObject({ fontSize: 45, color: '#ffffff', background: '#00586d', radius: 8 });
  expect(rules.lineStyle.color).toBe('#545454'); expect(rules.dimensionColor).toBe('#000000');
  expect(rules.exportFileName!('测试工学椅', rules.createOptions())).toBe('测试工学椅-工学椅-SKU.jpg');
});
