import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

const ids = ['computer-chair-single', 'ergonomic-chair-single'] as const;
function fixture(templateId: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[templateId], key = templateId === ids[0] ? 'computerChairDetails' : 'ergonomicChairDetails';
  const options = { ...rules.createOptions(), [key]: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: index === 4 ? '' : '第一行\n第二行', textColor: index === 1 ? 'white' : 'black' })) };
  const image = (name: string) => ({ name, blob: new Blob([`TEST:${name}`], { type: 'image/png' }) });
  const fields = rules.parseQuickDimensions('65.29×70.99×105.19~115.99')!;
  return { version: 1, templateId, model: 'TEST完整型号', modelManuallyEdited: true, sellingPoints: [],
    sizeInput: rules.formatFields(fields), dimensionFields: fields, annotations: [], subjectAdjustment: { scale: .9, offsetX: 1, offsetY: -2 },
    image: image(`${templateId}-main.png`), ...rules.saveOptions(options),
    accessories: rules.accessories!(options, rules.layout([], options)).map((slot, index) => ({ id: slot.id, image: image(`${slot.id}.png`), adjustment: { scale: 1.5, offsetX: -20 - index, offsetY: -10 } })) };
}
afterEach(async () => { for (const id of ids) await clearDraft(templateDraftSlot(id)); });

it.each(ids)('%s 打包全部六张素材并保留专属文案、范围尺寸及取景', async (id) => {
  const original = fixture(id), file = await encodeProjectFile(original, 'single', `batch9-${id}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const length = new DataView(bytes.buffer).getUint32(8, true);
  expect(JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length))).assets).toHaveLength(6);
  const decoded = await decodeProjectFile(file), restored = decoded.draft as WorkbenchDraft;
  expect(decoded.projectId).toBe(`batch9-${id}`);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...original, image: undefined, accessories: undefined });
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(restored.dimensionFields.height).toBe('105.1~115.9');
  expect(await restored.image!.blob.text()).toBe(await original.image!.blob.text());
  for (const [index, accessory] of restored.accessories!.entries()) {
    expect(accessory.id).toBe(original.accessories![index].id);
    expect(accessory.adjustment).toEqual(original.accessories![index].adjustment);
    expect(await accessory.image!.blob.text()).toBe(await original.accessories![index].image!.blob.text());
  }
  expect(restored).not.toHaveProperty(id === ids[0] ? 'ergonomicChair' : 'computerChair');
  expect(restored).not.toHaveProperty('liftingSideTable');
});

it('两款椅子的现场与历史独立，修改文案不会污染旧状态或丢失图片', async () => {
  for (const id of ids) {
    const original = fixture(id), rules = SINGLE_TEMPLATE_RULES[id], slot = templateDraftSlot(id);
    const key = id === ids[0] ? 'computerChairDetails' : 'ergonomicChairDetails';
    await saveDraft(original, slot);
    const options = rules.restoreOptions(original);
    const changed = { ...original, ...rules.saveOptions({ ...options, [key]: options[key]!.map((detail, index) => index === 2 ? { ...detail, title: '新标题' } : detail) }) };
    await saveDraft(changed, slot);
    expect(await loadDraft(slot)).toEqual(changed);
    expect(await loadRecoveryHistory(slot, changed)).toEqual([original, changed]);
    expect(rules.restoreOptions(original)[key]![2].title).toBe('测试细节3');
  }
  expect((await loadDraft(templateDraftSlot(ids[0])))!.templateId).toBe(ids[0]);
  expect((await loadDraft(templateDraftSlot(ids[1])))!.templateId).toBe(ids[1]);
});
