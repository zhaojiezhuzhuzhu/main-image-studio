import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { clearDraft, loadDraft, loadDraftSummary, saveDraft, type WorkbenchDraft } from './draftStorage';
import { templateDraftSlot } from '../domain/templates';

const bedSlot = templateDraftSlot('soft-bed-single');
afterEach(async () => { await clearDraft('single'); await clearDraft(bedSlot); });

it('keeps a soft-bed draft and its summary independent from the original sofa draft', async () => {
  const sofa: WorkbenchDraft = { version: 1, model: 'SOFA', modelManuallyEdited: true, sellingPoints: [], sizeInput: '', dimensionFields: { length: '', width: '', height: '' }, annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };
  await saveDraft(sofa, 'single');
  await saveDraft({ ...sofa, model: 'BED', templateId: 'soft-bed-single' }, bedSlot);
  await expect(loadDraftSummary(bedSlot)).resolves.toMatchObject({ kind: 'single', templateId: 'soft-bed-single', model: 'BED' });
  await clearDraft(bedSlot);
  await expect(loadDraft(bedSlot)).resolves.toBeNull();
  await expect(loadDraft('single')).resolves.toMatchObject({ model: 'SOFA' });
});
