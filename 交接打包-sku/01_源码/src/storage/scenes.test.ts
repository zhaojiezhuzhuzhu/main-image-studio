import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { clearDraft, createSceneSlot, hasDraftContent, loadDraft, loadDraftSummaries, loadRecoveryHistory, saveDraft, type SofaCombinationDraft, type WorkbenchDraft } from './draftStorage';
import { SINGLE_TEMPLATE_RULES, COMBINATION_TEMPLATE_RULES } from '../templates/registry';

const blank: WorkbenchDraft = { version: 1, model: '', modelManuallyEdited: false, sellingPoints: ['', '', ''], sizeInput: '', dimensionFields: { length: '', width: '', height: '' }, annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };
const combination: SofaCombinationDraft = { version: 1, model: '', modelManuallyEdited: false, kind: 'standard', sizeInput: '', dimensionFields: blank.dimensionFields, annotations: [], subjectAdjustment: blank.subjectAdjustment, optionalSizes: [], optionalLabelOffsetY: 0, noteEnabled: true, note: '' };
const slots = new Set<string>();
function scene() { const slot = createSceneSlot(); slots.add(slot); return slot; }
afterEach(async () => { for (const slot of slots) await clearDraft(slot); slots.clear(); });

it.each(Object.entries(SINGLE_TEMPLATE_RULES))('%s 的默认选项不产生空白缓存', async (id, rules) => {
  const draft = { ...blank, templateId: id as WorkbenchDraft['templateId'], ...rules.saveOptions(rules.createOptions()) };
  expect(hasDraftContent(draft)).toBe(false);
  const slot = scene();
  await saveDraft(draft, slot);
  expect(await loadDraft(slot)).toBeNull();
  expect(await loadRecoveryHistory(slot, draft)).toEqual([]);
});

it.each(Object.entries(COMBINATION_TEMPLATE_RULES))('%s 的默认备注不产生空白缓存', async (id, rules) => {
  const draft = { ...combination, templateId: id as SofaCombinationDraft['templateId'], note: rules.note.defaultText, ...rules.saveOptions(rules.createOptions()) };
  expect(hasDraftContent(draft)).toBe(false);
  const slot = scene();
  await saveDraft(draft, slot);
  expect(await loadDraft(slot)).toBeNull();
});

it('同一模板的多个现场独立保留，源文件不混入临时现场', async () => {
  const first = scene(), second = scene(), project = 'project:single:saved'; slots.add(project);
  await saveDraft({ ...blank, model: '甲' }, first);
  await saveDraft({ ...blank, model: '乙' }, second);
  await saveDraft({ ...blank, model: '已保存' }, project);
  const summaries = await loadDraftSummaries();
  expect(summaries.map((item) => item.slot).sort()).toEqual([first, second].sort());
  expect(await loadDraft(first)).toMatchObject({ model: '甲' });
  expect(await loadDraft(second)).toMatchObject({ model: '乙' });
});

it('清空内容也清除现场和恢复历史', async () => {
  const slot = scene();
  await saveDraft({ ...blank, model: '有内容' }, slot);
  await saveDraft(blank, slot);
  expect(await loadDraft(slot)).toBeNull();
  expect(await loadRecoveryHistory(slot, blank)).toEqual([]);
});

it('无图片时也保留手填尺寸、卖点、配件图片和专属内容', () => {
  expect(hasDraftContent({ ...blank, dimensionFields: { ...blank.dimensionFields, width: '80' } })).toBe(true);
  expect(hasDraftContent({ ...blank, sellingPoints: ['柔软', '', ''] })).toBe(true);
  expect(hasDraftContent({ ...blank, accessories: [{ id: 'accessory', adjustment: blank.subjectAdjustment, image: { name: 'test.png', blob: new Blob(['image']) } }] })).toBe(true);
  expect(hasDraftContent({ ...blank, templateId: 'soft-bed-single', softBed: { sizeLabels: ['1.5m床', ''], sellingPointCount: 3, dimensionGap: 25 } })).toBe(true);
  expect(hasDraftContent({ ...combination, note: '自行填写的备注' })).toBe(true);
  expect(hasDraftContent({ ...blank, model: '  ', sellingPoints: [' ', '', ''] })).toBe(false);
});

it('保留旧版本有内容的现场，删除旧的空现场', async () => {
  const database = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open('sofa-sku-workbench', 2);
    request.onsuccess = () => resolve(request.result);
  });
  slots.add('single'); slots.add('template:footstool-single');
  await new Promise<void>((resolve) => {
    const transaction = database.transaction('drafts', 'readwrite');
    const store = transaction.objectStore('drafts');
    store.put({ ...blank, id: 'current', model: '旧版现场' });
    store.put({ ...blank, id: 'template:footstool-single', templateId: 'footstool-single' });
    transaction.oncomplete = () => resolve();
  });
  database.close();
  expect(await loadDraftSummaries()).toEqual([expect.objectContaining({ slot: 'single', model: '旧版现场' })]);
  expect(await loadDraft('template:footstool-single')).toBeNull();
  expect(await loadDraft('single')).toMatchObject({ model: '旧版现场' });
});
