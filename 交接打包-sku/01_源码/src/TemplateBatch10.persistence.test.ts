import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

const ids = ['study-chair-single', 'mattress-single'] as const;
function fixture(id: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  options.studyChairDetails = Array.from({ length: 5 }, () => ({ title: '完整测试标题', description: '第一行\n第二行' }));
  options.mattressSingle = { headline: '完整床垫标题', subtitle: '测试说明', firmnessValue: '8', firmnessPosition: 75, materials: Array.from({ length: 3 }, (_, i) => ({ text: `完整材质${i}`, textColor: i === 0 ? 'black' : 'white' })) };
  const image = (name: string) => ({ name, blob: new Blob([`TEST:${name}`], { type: 'image/png' }) });
  const fields = rules.parseQuickDimensions(id === 'mattress-single' ? '27.99' : '65.99×70.99×80.99~90.99')!;
  return { version: 1, templateId: id, model: 'TEST10', modelManuallyEdited: true, sellingPoints: [], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: image('main.png'), ...rules.saveOptions(options),
    accessories: rules.accessories!(options, rules.layout([], options)).map((slot) => ({ id: slot.id, image: image(slot.id), adjustment: { scale: 1.5, offsetX: -20, offsetY: -10 } })) };
}
afterEach(async () => { for (const id of ids) await clearDraft(templateDraftSlot(id)); });
it.each(ids)('%s 源文件往返保留全部素材和独立字段', async (id) => {
  const original = fixture(id), file = await encodeProjectFile(original, 'single', `batch10-${id}`);
  const bytes = new Uint8Array(await file.arrayBuffer()), length = new DataView(bytes.buffer).getUint32(8, true);
  expect(JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length))).assets).toHaveLength(id === 'mattress-single' ? 4 : 6);
  const decoded = await decodeProjectFile(file), restored = decoded.draft as WorkbenchDraft;
  expect(decoded.projectId).toBe(`batch10-${id}`);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...original, image: undefined, accessories: undefined });
  for (const [index, item] of restored.accessories!.entries()) {
    expect(item.adjustment).toEqual(original.accessories![index].adjustment);
    expect(await item.image!.blob.text()).toBe(await original.accessories![index].image!.blob.text());
  }
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(restored).not.toHaveProperty(id === 'mattress-single' ? 'studyChair' : 'mattressSingle');
  expect(restored).not.toHaveProperty('sofaFirmness');
});
it('两款新模板现场和历史互相独立，长文本不因保存而丢失', async () => {
  for (const id of ids) {
    const draft = fixture(id), slot = templateDraftSlot(id), rules = SINGLE_TEMPLATE_RULES[id];
    await saveDraft(draft, slot); const options = rules.restoreOptions(draft);
    if (id === 'mattress-single') options.mattressSingle!.headline = '完整文案'.repeat(50);
    else options.studyChairDetails![0].title = '完整文案'.repeat(50);
    const changed = { ...draft, ...rules.saveOptions(options) }; await saveDraft(changed, slot);
    expect(await loadDraft(slot)).toEqual(changed); expect(await loadRecoveryHistory(slot, changed)).toEqual([draft, changed]);
    expect(rules.restoreOptions(draft)).not.toEqual(options);
  }
});
