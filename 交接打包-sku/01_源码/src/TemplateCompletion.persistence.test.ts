import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { completionFixture, completionIds, functionalCompletionFixture } from './TemplateCompletion.fixtures';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { SingleTemplateRules } from './templates/types';
import { templateDraftSlot } from './domain/templates';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

afterEach(async () => { for (const id of completionIds) await clearDraft(templateDraftSlot(id)); });
it.each(completionIds)('%s 独立v1工程保存所有图片、尺寸和专属状态', async (id) => {
  const draft = completionFixture(id), rules: SingleTemplateRules = SINGLE_TEMPLATE_RULES[id];
  const decoded = await decodeProjectFile(await encodeProjectFile(draft, 'single', `completion-${id}`)), restored = decoded.draft as WorkbenchDraft;
  expect(restored.dimensionFields).toEqual(draft.dimensionFields); expect(restored.annotations).toEqual(draft.annotations);
  expect(restored.subjectAdjustment).toEqual(draft.subjectAdjustment); expect(rules.restoreOptions(restored)).toEqual(rules.restoreOptions(draft));
  expect(await restored.image!.blob.text()).toBe(await draft.image!.blob.text());
  expect(restored.accessories?.map((item) => [item.id, item.adjustment])).toEqual(draft.accessories?.map((item) => [item.id, item.adjustment]));
  for (const item of restored.accessories ?? []) expect(await item.image!.blob.text()).toBe(await draft.accessories!.find((original) => original.id === item.id)!.image!.blob.text());
  await saveDraft(draft, templateDraftSlot(id));
  const edited = { ...draft, model: draft.model + '\n完整搭配型号', sellingPoints: ['保留第一条','保留第二条','隐藏仍保留第三条'] };
  await saveDraft(edited, templateDraftSlot(id));
  expect(await loadDraft(templateDraftSlot(id))).toEqual(edited);
  expect(await loadRecoveryHistory(templateDraftSlot(id), edited)).toEqual([draft, edited]);
});
it('功能沙发多规格的范围和每个素材在v1往返后保持完整', async () => {
  const draft = functionalCompletionFixture(), decoded = await decodeProjectFile(await encodeProjectFile(draft, 'combination', 'completion-functional'));
  expect(decoded.draft.templateId).toBe('functional-sofa-combination');
  expect(decoded.draft.dimensionFields).toEqual({ length: '293', width: '100~157', height: '80~91' });
  expect(decoded.kind).toBe('combination');
});
