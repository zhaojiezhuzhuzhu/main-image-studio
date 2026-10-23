// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { officeChairSingleRules as rules } from './office-chair-single';
import { type OfficeChairDraft } from '../domain/officeChairSingleLayout';
import { loadDraft, saveDraft } from '../storage/draftStorage';
import { resolveModelOnUpload } from '../domain/modelFromFilename';

const draft: OfficeChairDraft = { version: 1, model: 'BY13-A电脑椅', modelManuallyEdited: true, sizeInput: '62×58×96', dimensionFields: { length: '62', width: '58', height: '96' }, sellingPoints: ['卖点一', '卖点二', '卖点三'], annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };

it('专属顶层officeChair保存并恢复，不写入softBed且默认状态没有共享引用', async () => {
  const options = { ...rules.createOptions(), sellingPointCount: 2 as const, dimensionGap: 120 };
  const saved = rules.saveOptions(options);
  expect(saved).toEqual({ officeChair: { sellingPointCount: 2, dimensionGap: 120 } });
  expect(saved).not.toHaveProperty('softBed');
  await saveDraft({ ...draft, ...saved }, 'office-chair-test');
  const restored = await loadDraft('office-chair-test');
  expect(rules.restoreOptions(restored as OfficeChairDraft)).toEqual(options);
  expect(rules.restoreOptions(draft)).toEqual(rules.createOptions());
  const a = rules.createOptions(), b = rules.createOptions();
  a.sizeLabels[0] = '不应共享';
  a.dimensionGap = 180;
  expect(b.sizeLabels).toEqual(['', '']);
  expect(b.dimensionGap).toBe(60);
  expect(rules.hasOptions(b)).toBe(false);
  expect(rules.hasOptions(options)).toBe(true);
});

it('恢复不可信专属字段时校验类型，间距不能低于60或超出控件范围', () => {
  for (const officeChair of [null, 'invalid', { sellingPointCount: 9, dimensionGap: '100' }, { sellingPointCount: '2', dimensionGap: NaN }]) {
    expect(rules.restoreOptions({ ...draft, officeChair } as unknown as OfficeChairDraft)).toEqual(rules.createOptions());
  }
  const tooSmall: OfficeChairDraft = { ...draft, officeChair: { sellingPointCount: 2, dimensionGap: -1 } };
  const tooLarge: OfficeChairDraft = { ...draft, officeChair: { sellingPointCount: 3, dimensionGap: 999 } };
  expect(rules.restoreOptions(tooSmall).dimensionGap).toBe(60);
  expect(rules.restoreOptions(tooLarge).dimensionGap).toBe(180);
});

it('卖点切换保留第三项，选项控件具备可见标签和60px下限', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const Editor = rules.OptionsEditor!;
  function Harness() {
    const [value, onChange] = useState(rules.createOptions);
    return <><Editor value={value} onChange={onChange}/><output>{rules.visibleSellingPoints(draft.sellingPoints, value).join(',')}</output></>;
  }
  try {
    await act(async () => root.render(<Harness/>));
    const select = container.querySelector('select')!;
    expect(select.closest('label')!.textContent).toContain('卖点数量');
    expect(container.querySelector('input[type="range"]')!.getAttribute('min')).toBe('60');
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelector('output')!.textContent).toBe('卖点一,卖点二');
    await act(async () => { select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelector('output')!.textContent).toBe('卖点一,卖点二,卖点三');
  } finally { await act(async () => root.unmount()); }
});

it('导出校验保留完整规格及尺寸要求，字体、颜色和精度采用书椅规则', () => {
  const options = rules.createOptions();
  expect(rules.exportIssues(draft.dimensionFields, draft.sizeInput, options, null)).toEqual([]);
  expect(rules.exportIssues({ ...draft.dimensionFields, height: '' }, '', options, null)).toContain('请填写总高尺寸');
  expect(rules.exportIssues(draft.dimensionFields, '62×58', options, null)).toContain('快速尺寸无效，请按总长×总宽×总高填写');
  expect(rules.exportIssues(draft.dimensionFields, '', options, '型号溢出')).toContain('型号溢出');
  expect(resolveModelOnUpload('', false, 'BY13-A-透明素材-电脑椅.png', rules.filenameName)).toBe('BY13-A 电脑椅');
  expect(rules.requiredFonts).toEqual(['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK']);
  expect(rules.precision).toBe('truncate');
  expect(rules.lineStyle.color).toBe('#545454');
  expect(rules.sellingPoints.fontSize).toBe(50);
});
