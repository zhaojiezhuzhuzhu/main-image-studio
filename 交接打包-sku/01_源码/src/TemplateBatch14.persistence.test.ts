import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { batch14Fixture, batch14Ids } from './TemplateBatch14.fixtures';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

afterEach(async () => { for (const id of batch14Ids) await clearDraft(templateDraftSlot(id)); });
it.each(batch14Ids)('%s 版本1往返保留图片、标注、位置和专属字段', async (id) => {
  const draft = batch14Fixture(id), file = await encodeProjectFile(draft, 'single', `batch14-${id}`), decoded = await decodeProjectFile(file), restored = decoded.draft as WorkbenchDraft;
  expect(decoded.projectId).toBe(`batch14-${id}`);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...draft, image: undefined, accessories: undefined });
  expect(restored.accessories?.map(({ image, ...item }) => ({ ...item, name: image?.name }))).toEqual(draft.accessories?.map(({ image, ...item }) => ({ ...item, name: image?.name })));
  expect(await restored.image!.blob.text()).toBe(await draft.image!.blob.text());
  expect(await restored.accessories![0].image!.blob.text()).toBe('TEST14-open');
  expect(restored.accessories![0].adjustment).toEqual(draft.accessories![0].adjustment);
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(draft));
  expect(restored).not.toHaveProperty(id === 'wardrobe-single' ? 'shoeCabinet' : 'wardrobe');
});
it('两款独立草稿和撤销历史保留隐藏第三卖点及完整文案', async () => {
  for (const id of batch14Ids) {
    const draft = batch14Fixture(id), slot = templateDraftSlot(id), rules = SINGLE_TEMPLATE_RULES[id]; await saveDraft(draft, slot);
    const options = rules.restoreOptions(draft), value = options.wardrobe ?? options.shoeCabinet!; value.sellingPointCount = 2; value.noteText = '完整说明'.repeat(50);
    const changed = { ...draft, ...rules.saveOptions(options) }; await saveDraft(changed, slot);
    expect(await loadDraft(slot)).toEqual(changed); expect(await loadRecoveryHistory(slot, changed)).toEqual([draft, changed]);
    const restored = (await decodeProjectFile(await encodeProjectFile(changed, 'single', 'hidden-selling'))).draft as WorkbenchDraft;
    expect(restored.sellingPoints).toEqual(draft.sellingPoints); expect(rules.restoreOptions(restored)).toEqual(options);
  }
});
