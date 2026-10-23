import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadDraftSummary, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

const ids = ['study-desk-single', 'study-desk-combination'] as const;
const image = (name: string) => ({ name, blob: new Blob([name], { type: 'image/png' }) });
function fixture(templateId: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[templateId];
  const fields = rules.parseQuickDimensions('120.19/140.99×60.99/65.29×52.19~75.99')!;
  return {
    version: 1, templateId, model: 'TEST学习桌120/140cm', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试隐藏卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), sellingPointCount: 2, dimensionGap: 84, studyChairModel: 'TEST学习椅完整型号' }),
    annotations: [{ kind: 'height', label: '高', value: 52.1, from: { x: -.1, y: 0 }, to: { x: -.1, y: 1 }, extensionOffsets: { from: .12, to: -.03 } }],
    subjectAdjustment: { scale: .85, offsetX: 12, offsetY: -8 }, image: image('TEST学习桌.png'),
    ...(templateId === ids[1] ? { accessories: [{ id: 'study-chair', adjustment: { scale: .7, offsetX: 9, offsetY: -5 }, image: image('TEST学习椅.png') }] } : {}),
  };
}

afterEach(async () => { for (const id of ids) await clearDraft(templateDraftSlot(id)); });

it.each(ids)('%s 的源文件完整保存型号、截断后的并列与升降尺寸、专属选项及独立素材', async (id) => {
  const original = fixture(id);
  const result = await decodeProjectFile(await encodeProjectFile(original, 'single', `batch7-${id}`));
  const restored = result.draft as WorkbenchDraft;
  expect(result.projectId).toBe(`batch7-${id}`); expect(result.kind).toBe('single');
  expect(restored.version).toBe(1);
  expect({ ...restored, image: undefined, accessories: undefined }).toEqual({ ...original, image: undefined, accessories: undefined });
  expect(restored.dimensionFields).toEqual({ length: '120.1/140.9', width: '60.9/65.2', height: '52.1~75.9' });
  expect(await restored.image!.blob.text()).toBe('TEST学习桌.png');
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(restored)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(restored).not.toHaveProperty(id === ids[0] ? 'studyDeskCombination' : 'studyDeskSingle');
  expect(restored).not.toHaveProperty('standingDeskCombination');
  if (id === ids[1]) {
    expect(restored).toMatchObject({ studyDeskCombination: { studyChairModel: 'TEST学习椅完整型号', sellingPointCount: 2, dimensionGap: 84 } });
    expect(restored.accessories![0].id).toBe('study-chair');
    expect(restored.accessories![0].adjustment).toEqual(original.accessories![0].adjustment);
    expect(await restored.accessories![0].image!.blob.text()).toBe('TEST学习椅.png');
  } else {
    expect(restored).toMatchObject({ studyDeskSingle: { sellingPointCount: 2, dimensionGap: 84 } });
    expect(restored).not.toHaveProperty('accessories');
  }
});

it('学习桌单品、组合与已有升降桌现场各自隔离，隐藏第三卖点和学习椅设置保留在历史中', async () => {
  const originals = ids.map(fixture), slots = ids.map(templateDraftSlot);
  expect(new Set([...slots, templateDraftSlot('standing-desk-single'), templateDraftSlot('standing-desk-combination')]).size).toBe(4);
  await saveDraft(originals[0], slots[0]); await saveDraft(originals[1], slots[1]);
  const rules = SINGLE_TEMPLATE_RULES[ids[1]];
  const changed = { ...originals[1], ...rules.saveOptions({ ...rules.restoreOptions(originals[1]), sellingPointCount: 3, dimensionGap: 110, studyChairModel: 'TEST学习椅乙' }) };
  await saveDraft(changed, slots[1]);
  expect(await loadDraft(slots[0])).toEqual(originals[0]);
  expect(await loadDraft(slots[1])).toEqual(changed);
  expect(await loadRecoveryHistory(slots[1], changed)).toEqual([originals[1], changed]);
  expect(changed.sellingPoints[2]).toBe('测试隐藏卖点三');
  expect(changed.accessories).toEqual(originals[1].accessories);
  for (const [index, slot] of slots.entries()) expect(await loadDraftSummary(slot)).toMatchObject({ templateId: ids[index], hasContent: true });
});

it('更换学习椅后重开恢复对应素材与位置，不把旧椅图历史绑定到新图或主图', async () => {
  const original = fixture(ids[1]), slot = templateDraftSlot(ids[1]);
  const changed = { ...original, accessories: [{ id: 'study-chair', adjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: image('TEST学习椅新图.png') }] };
  await saveDraft(original, slot); await saveDraft(changed, slot);
  expect(await loadRecoveryHistory(slot, changed)).toEqual([changed]);
  const restored = (await decodeProjectFile(await encodeProjectFile(changed))).draft as WorkbenchDraft;
  expect(restored.model).toBe(original.model); expect(restored.modelManuallyEdited).toBe(true);
  expect(restored.subjectAdjustment).toEqual(original.subjectAdjustment);
  expect(await restored.image!.blob.text()).toBe('TEST学习桌.png');
  expect(await restored.accessories![0].image!.blob.text()).toBe('TEST学习椅新图.png');
  expect(restored.accessories![0].adjustment).toEqual(changed.accessories[0].adjustment);
});
