import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadDraftSummary, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';
import { defaultFunctionalCurve } from './domain/functionalSofaCurve';

const ids = ['functional-sofa-single', 'bedside-cabinet-single'] as const;
function fixture(templateId: typeof ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[templateId];
  const fields = rules.parseQuickDimensions(templateId === 'functional-sofa-single' ? '92×105~162×98~77' : '50×45×55')!;
  const options = { ...rules.createOptions(), quantity: 2 as const,
    rocking: { enabled: true, text: '测试摇动', x: 870, y: 440 },
    rotation: { enabled: true, text: '测试旋转', x: 650, y: 1050 } };
  return { version: 1, templateId, model: 'TEST手动保留名称', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: [{ kind: 'length', label: '长', value: 92, from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 }, extensionOffsets: { from: .12, to: -.03 } }],
    subjectAdjustment: { scale: .9, offsetX: 12, offsetY: -8 }, ...rules.saveOptions(options),
    image: { name: 'TEST-fixture.png', blob: new Blob(['batch4-fixture'], { type: 'image/png' }) } };
}

afterEach(async () => { for (const id of ids) await clearDraft(templateDraftSlot(id)); });

it('编辑后的两个功能曲线经过源文件、草稿和恢复历史往返保持三点坐标', async () => {
  const rules = SINGLE_TEMPLATE_RULES['functional-sofa-single'], original = fixture('functional-sofa-single');
  const options = rules.restoreOptions(original);
  const edited = { ...original, ...rules.saveOptions({ ...options,
    rocking: { ...options.rocking!, curve: { ...defaultFunctionalCurve('rocking'), bend: { x: 120, y: -30 } } },
    rotation: { ...options.rotation!, curve: { ...defaultFunctionalCurve('rotation'), from: { x: 15, y: 40 } } } }) };
  const decoded = await decodeProjectFile(await encodeProjectFile(edited, 'single', 'curve-roundtrip'));
  expect(rules.restoreOptions(decoded.draft as WorkbenchDraft)).toEqual(rules.restoreOptions(edited));
  const slot = templateDraftSlot('functional-sofa-single');
  await saveDraft(original, slot); await saveDraft(edited, slot);
  expect(await loadDraft(slot)).toEqual(edited);
  expect(await loadRecoveryHistory(slot, edited)).toEqual([original, edited]);
});

it.each(ids)('%s 保留版本1、手动名称、图片、辅助线和独立选项', async (id) => {
  const original = fixture(id);
  const restored = await decodeProjectFile(await encodeProjectFile(original, 'single', `test-${id}`));
  expect(restored.projectId).toBe(`test-${id}`);
  expect(restored.kind).toBe('single');
  const draft = restored.draft as WorkbenchDraft;
  expect({ ...draft, image: undefined }).toEqual({ ...original, image: undefined });
  expect(await draft.image!.blob.text()).toBe('batch4-fixture');
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(draft)).toEqual(SINGLE_TEMPLATE_RULES[id].restoreOptions(original));
  expect(draft).not.toHaveProperty(id === 'functional-sofa-single' ? 'bedsideCabinet' : 'functionalSofa');
});

it('两个新模板分别保存现场、摘要和恢复历史，修改一款不会覆盖另一款', async () => {
  const sofa = fixture('functional-sofa-single'), cabinet = fixture('bedside-cabinet-single');
  const sofaSlot = templateDraftSlot(ids[0]), cabinetSlot = templateDraftSlot(ids[1]);
  await saveDraft(sofa, sofaSlot); await saveDraft(cabinet, cabinetSlot);
  const rules = SINGLE_TEMPLATE_RULES['bedside-cabinet-single'];
  const changed = { ...cabinet, ...rules.saveOptions({ ...rules.restoreOptions(cabinet), quantity: 1 }) };
  await saveDraft(changed, cabinetSlot);
  expect(await loadDraft(sofaSlot)).toEqual(sofa);
  expect(await loadDraft(cabinetSlot)).toEqual(changed);
  expect(await loadRecoveryHistory(cabinetSlot, changed)).toEqual([cabinet, changed]);
  expect(await loadDraftSummary(sofaSlot)).toMatchObject({ templateId: ids[0], hasContent: true });
  expect(await loadDraftSummary(cabinetSlot)).toMatchObject({ templateId: ids[1], hasContent: true });
});
