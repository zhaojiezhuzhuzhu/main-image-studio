import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { batch12Fixture, batch12Ids } from './TemplateBatch12.fixtures';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

afterEach(async () => { for (const id of batch12Ids) await clearDraft(templateDraftSlot(id)); });
it.each(batch12Ids)('%s 版本1源文件保留独立素材、取景与全部专属字段', async (id) => {
  const original = batch12Fixture(id), file = await encodeProjectFile(original, 'single', `batch12-${id}`);
  const bytes = new Uint8Array(await file.arrayBuffer()), length = new DataView(bytes.buffer).getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length))); expect(manifest.assets).toHaveLength(id === 'soft-bed-combination' ? 3 : 6); expect(manifest.version).toBe(1);
  const decoded = await decodeProjectFile(file), restored = decoded.draft as WorkbenchDraft;
  expect(decoded.projectId).toBe(`batch12-${id}`);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...original, image: undefined, accessories: undefined });
  expect(await restored.image!.blob.text()).toBe(await original.image!.blob.text());
  for (const [i, item] of restored.accessories!.entries()) { expect(item.adjustment).toEqual(original.accessories![i].adjustment); expect(await item.image!.blob.text()).toBe(await original.accessories![i].image!.blob.text()); }
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(restored).not.toHaveProperty(id === 'soft-bed-combination' ? 'softBedMultiCombination' : 'softBedCombination'); expect(restored).not.toHaveProperty('mattressSingle'); expect(restored).not.toHaveProperty('sofaFirmness');
});
it('单组合、多组合各自的现场和撤销历史互不覆盖，完整文案保留', async () => {
  for (const id of batch12Ids) {
    const draft = batch12Fixture(id), slot = templateDraftSlot(id), rules = SINGLE_TEMPLATE_RULES[id]; await saveDraft(draft, slot);
    const options = rules.restoreOptions(draft), data = options.softBedCombination?.mattress ?? options.softBedMultiCombination!.mattresses[0]; data.title = '完整文案'.repeat(50);
    const changed = { ...draft, ...rules.saveOptions(options) }; await saveDraft(changed, slot);
    expect(await loadDraft(slot)).toEqual(changed); expect(await loadRecoveryHistory(slot, changed)).toEqual([draft, changed]); expect(rules.restoreOptions(draft)).not.toEqual(options);
  }
});

it.each(batch12Ids)('%s 减少搭配后版本1源文件仍包含隐藏素材与原始字段', async (id) => {
  const draft = batch12Fixture(id), rules = SINGLE_TEMPLATE_RULES[id], options = rules.restoreOptions(draft);
  if (options.softBedCombination) options.softBedCombination.set = 'cabinet';
  if (options.softBedMultiCombination) { options.softBedMultiCombination.mattressCount = 2; options.softBedMultiCombination.cabinetCount = 0; }
  const reduced = { ...draft, ...rules.saveOptions(options) }, decoded = await decodeProjectFile(await encodeProjectFile(reduced, 'single', 'hidden-batch12'));
  const restored = decoded.draft as WorkbenchDraft;
  expect(restored.accessories).toHaveLength(id === 'soft-bed-combination' ? 2 : 5);
  expect(rules.restoreOptions(restored)).toEqual(options);
  for (const [i, item] of restored.accessories!.entries()) expect(await item.image!.blob.text()).toBe(await draft.accessories![i].image!.blob.text());
});
