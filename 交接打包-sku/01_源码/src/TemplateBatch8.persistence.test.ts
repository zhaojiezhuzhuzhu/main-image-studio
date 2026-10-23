import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

const ids = ['dining-chair-single', 'lifting-side-table-single'] as const;
const image = (name: string) => ({ name, blob: new Blob([`测试素材:${name}`], { type: 'image/png' }) });
function fixture(templateId: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[templateId], chair = templateId === ids[0];
  const fields = rules.parseQuickDimensions(chair ? '50.19×55.29×80.99' : '60.19×40.29×52.19~75.99')!;
  return {
    version: 1, templateId, model: chair ? 'TEST餐椅完整型号50cm' : 'TEST升降边桌60cm', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试隐藏卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), sellingPointCount: 2, dimensionGap: 84,
      diningChair: { quantity: 2, widthMode: 'outside', heightNote: '测试软包最高点', outerWidth: '58.4' },
      sideTableDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: index === 4 ? '' : `测试说明${index + 1}` })),
    }),
    annotations: [{ kind: 'height', label: '高', value: chair ? 80.9 : 52.1, from: { x: -.1, y: 0 }, to: { x: -.1, y: 1 }, extensionOffsets: { from: .12, to: -.03 } }],
    subjectAdjustment: { scale: .85, offsetX: 12, offsetY: -8 }, image: image('TEST主图.png'),
    accessories: (chair ? ['chair-rear'] : Array.from({ length: 5 }, (_, index) => `side-detail-${index + 1}`))
      .map((id, index) => ({ id, adjustment: { scale: chair ? .8 : 1.2, offsetX: index + 2, offsetY: index - 4 }, image: image(`TEST-${id}.png`) })),
  };
}

afterEach(async () => { for (const id of ids) await clearDraft(templateDraftSlot(id)); });

it.each(ids)('%s 源文件保留完整型号、专属选项和每份独立图片的位置及内容', async (id) => {
  const original = fixture(id), file = await encodeProjectFile(original, 'single', `batch8-${id}`);
  const bytes = new Uint8Array(await file.arrayBuffer()), length = new DataView(bytes.buffer).getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length))) as { assets: unknown[] };
  expect(manifest.assets).toHaveLength(id === ids[0] ? 2 : 6);
  const result = await decodeProjectFile(file), restored = result.draft as WorkbenchDraft;
  expect(result.projectId).toBe(`batch8-${id}`); expect(result.kind).toBe('single'); expect(restored.version).toBe(1);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...original, image: undefined, accessories: undefined });
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(restored).not.toHaveProperty(id === ids[0] ? 'liftingSideTable' : 'diningChair');
  expect(restored).not.toHaveProperty('studyDeskCombination');
  expect(await restored.image!.blob.text()).toBe('测试素材:TEST主图.png');
  for (const [index, item] of restored.accessories!.entries()) {
    expect(item.id).toBe(original.accessories![index].id); expect(item.adjustment).toEqual(original.accessories![index].adjustment);
    expect(await item.image!.blob.text()).toBe(await original.accessories![index].image!.blob.text());
  }
  if (id === ids[0]) {
    expect(restored).toMatchObject({ diningChair: { quantity: 2, widthMode: 'outside', heightNote: '测试软包最高点', outerWidth: '58.4', sellingPointCount: 2, dimensionGap: 84 } });
    expect(restored.model).not.toMatch(/x[12]/);
    expect(restored.dimensionFields).toEqual({ length: '50.1', width: '55.2', height: '80.9' });
  } else {
    expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored).sideTableDetails).toHaveLength(5);
    expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored).sideTableDetails![4]).toEqual({ title: '测试细节5', description: '' });
    expect(restored.dimensionFields.height).toBe('52.1~75.9');
  }
});

it('餐椅与边桌现场互不覆盖，细节文案与数量设置分别进入对应历史', async () => {
  const originals = ids.map(fixture), slots = ids.map(templateDraftSlot);
  expect(new Set([...slots, templateDraftSlot('study-desk-single'), templateDraftSlot('study-desk-combination')]).size).toBe(4);
  for (const [index, draft] of originals.entries()) await saveDraft(draft, slots[index]);
  const chairRules = SINGLE_TEMPLATE_RULES[ids[0]], tableRules = SINGLE_TEMPLATE_RULES[ids[1]];
  const chairOptions = chairRules.restoreOptions(originals[0]), tableOptions = tableRules.restoreOptions(originals[1]);
  const chair = { ...originals[0], ...chairRules.saveOptions({ ...chairOptions, diningChair: { ...chairOptions.diningChair!, quantity: 1 } }) };
  const details = tableOptions.sideTableDetails!.map((item, index) => index === 2 ? { ...item, title: '测试新标题', description: '测试新说明' } : item);
  const table = { ...originals[1], ...tableRules.saveOptions({ ...tableOptions, sideTableDetails: details }) };
  await saveDraft(chair, slots[0]); await saveDraft(table, slots[1]);
  expect(await loadDraft(slots[0])).toEqual(chair); expect(await loadDraft(slots[1])).toEqual(table);
  expect(await loadRecoveryHistory(slots[0], chair)).toEqual([originals[0], chair]);
  expect(await loadRecoveryHistory(slots[1], table)).toEqual([originals[1], table]);
  expect(chair.sellingPoints[2]).toBe('测试隐藏卖点三'); expect(table.accessories).toEqual(originals[1].accessories);
});

it('单个细节换图后的文件和恢复历史保留其他四张细节及主图，不错配旧图', async () => {
  const original = fixture(ids[1]), slot = templateDraftSlot(ids[1]);
  const changed = { ...original, accessories: original.accessories!.map((item, index) => index === 2 ? {
    ...item, image: image('TEST细节3新图.png'), adjustment: { scale: 1, offsetX: 0, offsetY: 0 },
  } : item) };
  await saveDraft(original, slot); await saveDraft(changed, slot);
  expect(await loadRecoveryHistory(slot, changed)).toEqual([changed]);
  const restored = (await decodeProjectFile(await encodeProjectFile(changed))).draft as WorkbenchDraft;
  expect(restored.model).toBe(original.model); expect(restored.subjectAdjustment).toEqual(original.subjectAdjustment);
  expect(await restored.image!.blob.text()).toBe('测试素材:TEST主图.png');
  for (const [index, item] of restored.accessories!.entries()) {
    expect(item.id).toBe(changed.accessories[index].id); expect(item.adjustment).toEqual(changed.accessories[index].adjustment);
    expect(await item.image!.blob.text()).toBe(await changed.accessories[index].image!.blob.text());
  }
  expect(SINGLE_TEMPLATE_RULES[ids[1]].restoreOptions(restored).sideTableDetails).toEqual(SINGLE_TEMPLATE_RULES[ids[1]].restoreOptions(original).sideTableDetails);
});
