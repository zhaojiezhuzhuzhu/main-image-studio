import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadDraftSummary, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

const ids = ['long-dining-table-combination', 'round-extendable-table-combination'] as const;
function fixture(templateId: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[templateId];
  const fields = rules.parseQuickDimensions(templateId === ids[0] ? '140/160×80×74.8' : '81.6~130/91.6~150×75.3')!;
  const options = { ...rules.createOptions(), noteText: '测试图示说明', heightNote: '测试脚垫', diameterPlacement: 'outside' as const,
    diningChairs: { count: (templateId === ids[0] ? 2 : 1) as 1 | 2, models: ['TEST餐椅甲', 'TEST长凳乙'] as [string, string], markers: [{ x: .25, y: .15 }, { x: .7, y: .75 }] as [{ x: number; y: number }, { x: number; y: number }] } };
  return { version: 1, templateId, model: 'TEST手动餐桌名称', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: [{ kind: templateId === ids[0] ? 'length' : 'diameter', label: templateId === ids[0] ? '长' : '直径', value: 140, from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 }, extensionOffsets: { from: .12, to: -.03 } }],
    subjectAdjustment: { scale: .9, offsetX: 12, offsetY: -8 }, ...rules.saveOptions(options),
    image: { name: 'TEST-整组素材.png', blob: new Blob(['batch5-fixture'], { type: 'image/png' }) } };
}

afterEach(async () => { for (const id of ids) await clearDraft(templateDraftSlot(id)); });

it.each(ids)('%s 源文件保留整组素材、完整型号、专属选项、辅助线与版本1', async (id) => {
  const original = fixture(id);
  const restored = await decodeProjectFile(await encodeProjectFile(original, 'single', `test-${id}`));
  expect(restored.projectId).toBe(`test-${id}`);
  expect(restored.kind).toBe('single');
  const draft = restored.draft as WorkbenchDraft;
  expect({ ...draft, image: undefined }).toEqual({ ...original, image: undefined });
  expect(await draft.image!.blob.text()).toBe('batch5-fixture');
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(draft)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(draft).not.toHaveProperty(id === ids[0] ? 'roundExtendableTableCombination' : 'longDiningTableCombination');
});

it('两款组合现场与单品现场隔离，修改款式与样式保留恢复历史', async () => {
  const drafts = ids.map(fixture);
  const slots = ids.map(templateDraftSlot);
  expect(new Set([...slots, templateDraftSlot('long-dining-table-single'), templateDraftSlot('round-extendable-table-single')]).size).toBe(4);
  await saveDraft(drafts[0], slots[0]); await saveDraft(drafts[1], slots[1]);
  const rules = SINGLE_TEMPLATE_RULES[ids[0]], options = rules.restoreOptions(drafts[0]);
  const changed = { ...drafts[0], ...rules.saveOptions({ ...options, diningChairs: { ...options.diningChairs!, count: 1 } }) };
  await saveDraft(changed, slots[0]);
  expect(await loadDraft(slots[0])).toEqual(changed);
  expect(await loadDraft(slots[1])).toEqual(drafts[1]);
  expect(await loadRecoveryHistory(slots[0], changed)).toEqual([drafts[0], changed]);
  expect(rules.restoreOptions(changed).diningChairs!.models[1]).toBe('TEST长凳乙');
  for (const [index, slot] of slots.entries()) expect(await loadDraftSummary(slot)).toMatchObject({ templateId: ids[index], hasContent: true });
});
