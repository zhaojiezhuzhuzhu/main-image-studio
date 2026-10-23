import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearDraft, loadDraft, loadDraftSummary, loadRecoveryHistory, saveDraft, type SofaCombinationDraft, type WorkbenchDraft } from './draftStorage';

const draft = (): WorkbenchDraft => ({
  version: 1,
  model: 'G386-A',
  modelManuallyEdited: true,
  sellingPoints: ['舒适坐感', '电动调节', '柔软面料'],
  sizeInput: '240×88×100',
  dimensionFields: { length: '240', width: '88', height: '100' },
  annotations: [{
    kind: 'length',
    label: '长',
    value: 240,
    from: { x: 0.1, y: 0.2 },
    to: { x: 0.9, y: 0.2 },
  }],
  subjectAdjustment: { scale: 0.8, offsetX: 24, offsetY: -12 },
  image: {
    name: 'G386-A-product.png',
    blob: new Blob(['saved-png'], { type: 'image/png' }),
  },
});

afterEach(async () => {
  await clearDraft();
});

describe('工作台操作现场存储', () => {
  it('脚踏和书椅分别恢复现场、历史和专属选项，修改书椅不覆盖脚踏', async () => {
    const footstool: WorkbenchDraft = { ...draft(), templateId: 'footstool-single', model: 'TEST脚踏', sellingPoints: [] };
    const chair = { ...draft(), templateId: 'office-chair-single' as const, model: 'TEST书椅', officeChair: { sellingPointCount: 2, dimensionGap: 80 } };
    const footstoolSlot = 'template:footstool-single', chairSlot = 'template:office-chair-single';
    try {
      await saveDraft(footstool, footstoolSlot);
      await saveDraft(chair, chairSlot);
      const changedChair = { ...chair, officeChair: { ...chair.officeChair, sellingPointCount: 3 } };
      await saveDraft(changedChair, chairSlot);
      expect(await loadDraft(footstoolSlot)).toEqual(footstool);
      expect(await loadDraft(chairSlot)).toEqual(changedChair);
      expect(await loadRecoveryHistory(chairSlot, changedChair)).toEqual([chair, changedChair]);
      expect(await loadDraftSummary(footstoolSlot)).toMatchObject({ templateId: 'footstool-single', model: 'TEST脚踏' });
      expect(await loadDraftSummary(chairSlot)).toMatchObject({ templateId: 'office-chair-single', model: 'TEST书椅' });
    } finally {
      await clearDraft(footstoolSlot);
      await clearDraft(chairSlot);
    }
  });

  it('软床可选字段、双规格和端点进入独立现场及恢复历史，旧沙发不变', async () => {
    const original: WorkbenchDraft = { ...draft(), templateId: 'soft-bed-single',
      dimensionFields: { length: '223', width: '', height: '118', headWidth: '168/198', footWidth: '183/193' },
      softBed: { sizeLabels: ['1.5m床', '1.8m床'], sellingPointCount: 2, dimensionGap: 25 },
      annotations: [{ kind: 'headWidth', label: '床头宽', value: 168, from: { x: 0, y: -.1 }, to: { x: .55, y: -.1 } }] };
    await saveDraft(draft(), 'single');
    await saveDraft(original, 'soft-bed-test');
    expect(await loadDraft('soft-bed-test')).toEqual(original);
    expect(await loadRecoveryHistory('soft-bed-test', original)).toEqual([original]);
    expect((await loadDraft('single'))?.dimensionFields).toEqual({ length: '240', width: '88', height: '100' });
    expect((await loadDraft('single'))?.softBed).toBeUndefined();
    await clearDraft('soft-bed-test');
  });
  it('restores inputs, annotations, adjustment, and the uploaded PNG blob', async () => {
    const original = draft();

    await saveDraft(original);
    const restored = await loadDraft();

    expect(restored).not.toBeNull();
    expect({ ...restored, image: undefined }).toEqual({ ...original, image: undefined });
    expect(restored?.image?.name).toBe('G386-A-product.png');
    expect(restored?.image?.blob.type).toBe('image/png');
    expect(restored?.image?.blob.size).toBe(original.image?.blob.size);
  });

  it('replaces the previous operation site with the latest complete snapshot', async () => {
    await saveDraft(draft());
    await saveDraft({ ...draft(), model: 'PS060-A1', sellingPoints: ['新卖点', '', ''] });

    const restored = await loadDraft();

    expect(restored?.model).toBe('PS060-A1');
    expect(restored?.sellingPoints).toEqual(['新卖点', '', '']);
    await expect(loadDraftSummary('single')).resolves.toMatchObject({ kind: 'single', model: 'PS060-A1', hasContent: true });
  });

  it('does not restore an operation site after the user clears it', async () => {
    await saveDraft(draft());

    await clearDraft();

    await expect(loadDraft()).resolves.toBeNull();
  });

  it('keeps single-product and combination operation sites isolated', async () => {
    const combination: SofaCombinationDraft = {
      version: 1,
      kind: 'functional',
      model: 'G386-A-COMBINATION',
      modelManuallyEdited: false,
      sizeInput: '240×88×100',
      dimensionFields: { length: '240', width: '88', height: '100' },
      annotations: [],
      subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 },
      optionalSizes: [{
        id: 'option-1',
        sizeInput: '210×88×100',
        dimensionFields: { length: '210', width: '88', height: '100' },
        annotations: [{ kind: 'length', label: '长', value: 210, from: { x: .1, y: .1 }, to: { x: .9, y: .1 } }],
        adjustment: { scale: .92, offsetX: 12, offsetY: -8 },
      }],
      optionalLabelOffsetY: 0,
      optionalLabelSide: 'right',
      noteEnabled: true,
      note: '*实际尺寸请以下单规格为准',
    };

    await saveDraft(draft(), 'single');
    await saveDraft(combination, 'combination');

    await expect(loadDraft('single')).resolves.toMatchObject({ model: 'G386-A' });
    await expect(loadDraft('combination')).resolves.toMatchObject({
      model: 'G386-A-COMBINATION',
      kind: 'functional',
      optionalLabelSide: 'right',
      optionalSizes: [{ id: 'option-1', dimensionFields: { length: '210', width: '88', height: '100' }, adjustment: { scale: .92, offsetX: 12, offsetY: -8 } }],
    });

    await clearDraft('combination');
    await expect(loadDraft('combination')).resolves.toBeNull();
    await expect(loadDraft('single')).resolves.toMatchObject({ model: 'G386-A' });
  });

  it('keeps two source projects of the same template isolated', async () => {
    const firstSlot = 'project:single:first';
    const secondSlot = 'project:single:second';
    try {
      await saveDraft({ ...draft(), model: 'FIRST' }, firstSlot);
      await saveDraft({ ...draft(), model: 'SECOND' }, secondSlot);

      await expect(loadDraft(firstSlot)).resolves.toMatchObject({ model: 'FIRST' });
      await expect(loadDraft(secondSlot)).resolves.toMatchObject({ model: 'SECOND' });

      await clearDraft(firstSlot);
      await expect(loadDraft(firstSlot)).resolves.toBeNull();
      await expect(loadDraft(secondSlot)).resolves.toMatchObject({ model: 'SECOND' });
    } finally {
      await clearDraft(firstSlot);
      await clearDraft(secondSlot);
    }
  });

  it('keeps only ten lightweight recovery states without duplicating the active image', async () => {
    const original = draft();
    for (let index = 0; index < 12; index += 1) {
      await saveDraft({ ...original, model: `MODEL-${index}` });
    }
    const current = await loadDraft();
    const history = await loadRecoveryHistory('single', current!);

    expect(history).toHaveLength(10);
    expect(history[0].model).toBe('MODEL-2');
    expect(history[9].model).toBe('MODEL-11');
    expect(history.every((entry) => entry.image?.blob === current?.image?.blob)).toBe(true);
  });

  it('does not offer a recovery state that references a replaced image', async () => {
    await saveDraft(draft());
    const current = { ...draft(), image: { name: 'new.png', blob: new Blob(['new'], { type: 'image/png' }) } };
    await saveDraft(current);

    const history = await loadRecoveryHistory('single', current);

    expect(history.map((entry) => entry.image?.name)).toEqual(['new.png']);
  });
});
