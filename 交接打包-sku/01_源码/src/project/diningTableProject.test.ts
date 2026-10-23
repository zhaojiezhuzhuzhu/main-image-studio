import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from '../templates/registry';
import { templateDraftSlot } from '../domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from '../storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './projectFile';

const ids = ['long-dining-table-single', 'round-extendable-table-single'] as const;
function fixture(id: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id];
  const fields = rules.parseQuickDimensions(id === 'long-dining-table-single' ? '140/160×80×74.8' : '81.6~130/91.6~150×75')!;
  return { version: 1, templateId: id, model: 'TEST餐桌', modelManuallyEdited: true,
    sellingPoints: ['测试一', '测试二', '测试三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), noteText: '测试备注', heightNote: '高度测试', sellingPointCount: 2 }),
    annotations: [], subjectAdjustment: { scale: .9, offsetX: 4, offsetY: 7 }, image: { name: 'test.png', blob: new Blob(['test-png'], { type: 'image/png' }) } };
}

it.each(ids)('%s 源文件保留独立身份、完整规格、备注、选项与图片', async (id) => {
  const original = fixture(id);
  const document = await decodeProjectFile(await encodeProjectFile(original, 'single', `batch3-${id}`));
  expect(document.projectId).toBe(`batch3-${id}`);
  expect({ ...document.draft, image: undefined }).toEqual({ ...original, image: undefined });
  expect(await (document.draft as WorkbenchDraft).image?.blob.text()).toBe('test-png');
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(document.draft as WorkbenchDraft).noteText).toBe('测试备注');
});

it('餐桌现场与恢复历史各自隔离，修改长桌备注不覆盖圆桌', async () => {
  const [long, round] = ids.map(fixture);
  const [longSlot, roundSlot] = ids.map(templateDraftSlot);
  try {
    await saveDraft(long, longSlot); await saveDraft(round, roundSlot);
    const rules = SINGLE_TEMPLATE_RULES['long-dining-table-single'];
    const changed = { ...long, ...rules.saveOptions({ ...rules.restoreOptions(long), noteText: '长桌新备注' }) };
    await saveDraft(changed, longSlot);
    expect(await loadDraft(roundSlot)).toEqual(round);
    expect(await loadDraft(longSlot)).toEqual(changed);
    expect(await loadRecoveryHistory(longSlot, changed)).toEqual([long, changed]);
    expect(await loadRecoveryHistory(roundSlot, round)).toEqual([round]);
  } finally { await clearDraft(longSlot); await clearDraft(roundSlot); }
});
