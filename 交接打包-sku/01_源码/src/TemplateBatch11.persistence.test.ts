import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { batch11Fixture, batch11Ids } from './TemplateBatch11.fixtures';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

afterEach(async () => { for (const id of batch11Ids) await clearDraft(templateDraftSlot(id)); });
it.each(batch11Ids)('%s 版本1源文件保留四张素材、取景与全部专属字段', async (id) => {
  const original = batch11Fixture(id), file = await encodeProjectFile(original, 'single', `batch11-${id}`);
  const bytes = new Uint8Array(await file.arrayBuffer()), length = new DataView(bytes.buffer).getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length))); expect(manifest.assets).toHaveLength(4); expect(manifest.version).toBe(1);
  const decoded = await decodeProjectFile(file), restored = decoded.draft as WorkbenchDraft;
  expect(decoded.projectId).toBe(`batch11-${id}`);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...original, image: undefined, accessories: undefined });
  expect(await restored.image!.blob.text()).toBe(await original.image!.blob.text());
  for (const [i, item] of restored.accessories!.entries()) { expect(item.adjustment).toEqual(original.accessories![i].adjustment); expect(await item.image!.blob.text()).toBe(await original.accessories![i].image!.blob.text()); }
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(restored).not.toHaveProperty(id === 'mattress-double' ? 'pillowSingle' : 'mattressDouble'); expect(restored).not.toHaveProperty('mattressSingle'); expect(restored).not.toHaveProperty('sofaFirmness');
});
it('双面床垫、枕头各自的现场和撤销历史互不覆盖，完整文案保留', async () => {
  for (const id of batch11Ids) {
    const draft = batch11Fixture(id), slot = templateDraftSlot(id), rules = SINGLE_TEMPLATE_RULES[id]; await saveDraft(draft, slot);
    const options = rules.restoreOptions(draft), data = options.mattressDouble ?? options.pillowSingle!; data.headline = '完整文案'.repeat(50);
    const changed = { ...draft, ...rules.saveOptions(options) }; await saveDraft(changed, slot);
    expect(await loadDraft(slot)).toEqual(changed); expect(await loadRecoveryHistory(slot, changed)).toEqual([draft, changed]); expect(rules.restoreOptions(draft)).not.toEqual(options);
  }
});
