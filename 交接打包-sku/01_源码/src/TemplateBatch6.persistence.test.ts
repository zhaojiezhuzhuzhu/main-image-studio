import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { clearDraft, loadDraft, loadDraftSummary, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { decodeProjectFile, encodeProjectFile } from './project/projectFile';

const slot = 'test:batch6-accessories';
const image = (name: string, content = name) => ({ name, blob: new Blob([content], { type: 'image/png' }) });
function fixture(accessoryCount = 2): WorkbenchDraft {
  return {
    version: 1, templateId: 'standing-desk-combination',
    model: 'TEST升降桌', modelManuallyEdited: true, sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'],
    sizeInput: '120/140×60/70×73~122', dimensionFields: { length: '120/140', width: '60/70', height: '73~122' },
    annotations: [], subjectAdjustment: { scale: .9, offsetX: 12, offsetY: -8 }, image: image('TEST桌.png'),
    accessories: [
      { id: 'riser', adjustment: { scale: .85, offsetX: 5, offsetY: -2 }, image: image('TEST增高架.png') },
      { id: 'chair', adjustment: { scale: .95, offsetX: -4, offsetY: 6 }, image: image('TEST电脑椅.png') },
    ].slice(0, accessoryCount),
  };
}

type TestManifest = {
  version: number;
  draft: { accessories?: Array<{ id: string; image?: { name: string; assetId: string } }> };
  assets: Array<{ id: string; name: string }>;
};
async function projectParts(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const length = new DataView(bytes.buffer).getUint32(8, true);
  return { manifest: JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length))) as TestManifest, assets: bytes.slice(12 + length) };
}
async function editManifest(file: Blob, edit: (manifest: TestManifest) => void) {
  const { manifest, assets } = await projectParts(file);
  edit(manifest);
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('SKUWORK1'));
  new DataView(header.buffer).setUint32(8, bytes.length, true);
  return new Blob([header, bytes, assets]);
}

afterEach(async () => { await clearDraft(slot); });

it.each([1, 2])('%i 张配件图片连同主图、独立位置和升降范围保存在版本1源文件', async (count) => {
  const original = fixture(count);
  const file = await encodeProjectFile(original, 'single', 'batch6-source');
  const { manifest } = await projectParts(file);
  expect(manifest.version).toBe(1);
  expect(manifest.assets).toHaveLength(count + 1);
  const result = await decodeProjectFile(file);
  expect(result.projectId).toBe('batch6-source');
  expect(result.kind).toBe('single');
  const restored = result.draft as WorkbenchDraft;
  expect(restored.templateId).toBe(original.templateId);
  expect(restored.dimensionFields).toEqual(original.dimensionFields);
  expect(await restored.image!.blob.text()).toBe('TEST桌.png');
  for (const [index, item] of restored.accessories!.entries()) {
    expect(item.id).toBe(original.accessories![index].id);
    expect(item.adjustment).toEqual(original.accessories![index].adjustment);
    expect(item.image!.name).toBe(original.accessories![index].image!.name);
    expect(await item.image!.blob.text()).toBe(await original.accessories![index].image!.blob.text());
  }
});

it('主图与多个配件复用同一 Blob 时源文件只嵌入一份资源且保留各自文件名', async () => {
  const original = fixture();
  for (const item of original.accessories!) item.image!.blob = original.image!.blob;
  const file = await encodeProjectFile(original);
  expect((await projectParts(file)).manifest.assets).toHaveLength(1);
  const restored = (await decodeProjectFile(file)).draft as WorkbenchDraft;
  expect(restored.accessories!.every((item) => item.image!.blob === restored.image!.blob)).toBe(true);
  expect(restored.accessories!.map((item) => item.image!.name)).toEqual(['TEST增高架.png', 'TEST电脑椅.png']);
});

it('配件引用缺失资源时明确拒绝重开', async () => {
  const file = await editManifest(await encodeProjectFile(fixture()), (manifest) => {
    manifest.draft.accessories![1].image!.assetId = 'missing-chair';
  });
  await expect(decodeProjectFile(file)).rejects.toThrow('项目缺少图片资源：TEST电脑椅.png');
});

it('配件资源损坏或截断时拒绝重开', async () => {
  const file = await encodeProjectFile(fixture());
  const bytes = new Uint8Array(await file.arrayBuffer());
  bytes[bytes.length - 1] ^= 0xff;
  await expect(decodeProjectFile(new Blob([bytes]))).rejects.toThrow('项目图片资源校验失败：TEST电脑椅.png');
  await expect(decodeProjectFile(file.slice(0, file.size - 1))).rejects.toThrow('项目图片资源不完整：TEST电脑椅.png');
});

it('旧单品源文件及恢复历史不新增配件属性', async () => {
  const { accessories: _accessories, ...original } = fixture();
  original.templateId = 'sofa-single';
  const file = await encodeProjectFile(original);
  expect((await projectParts(file)).manifest.draft).not.toHaveProperty('accessories');
  expect((await decodeProjectFile(file)).draft).not.toHaveProperty('accessories');
  await saveDraft(original, slot);
  expect((await loadRecoveryHistory(slot, original))[0]).not.toHaveProperty('accessories');
});

it('仅上传配件也作为有内容的独立制作现场保存', async () => {
  const original: WorkbenchDraft = { ...fixture(), model: '', sellingPoints: ['', '', ''], sizeInput: '', image: undefined };
  await saveDraft(original, slot);
  const restored = await loadDraft(slot) as WorkbenchDraft;
  expect(await restored.accessories![1].image!.blob.text()).toBe('TEST电脑椅.png');
  expect(await loadDraftSummary(slot)).toMatchObject({ templateId: original.templateId, hasContent: true });
});

it('切回两件套保存后保留隐藏电脑椅图片、型号和调整参数', async () => {
  const original = { ...fixture(), standingDeskCombination: {
    headline: 'TEST升降桌系列', sellingPointCount: 3, dimensionGap: 25,
    standingDeskSet: { count: 3, riserModel: 'TEST增高架100cm', chairModel: 'TEST电脑椅A', riserNote: '测试适配说明' },
  } };
  const changed = { ...original, standingDeskCombination: { ...original.standingDeskCombination,
    standingDeskSet: { ...original.standingDeskCombination.standingDeskSet, count: 2 },
  } };
  await saveDraft(original, slot); await saveDraft(changed, slot);
  expect(await loadDraft(slot)).toEqual(changed);
  expect(await loadRecoveryHistory(slot, changed)).toEqual([original, changed]);
  const restored = (await decodeProjectFile(await encodeProjectFile(changed))).draft as WorkbenchDraft;
  expect(restored).toMatchObject({ standingDeskCombination: changed.standingDeskCombination });
  expect(restored.accessories![1].adjustment).toEqual(original.accessories![1].adjustment);
  expect(await restored.accessories![1].image!.blob.text()).toBe('TEST电脑椅.png');
});

it('配件历史不重复存储 Blob，并按相同 id 使用当前素材恢复各自位置', async () => {
  const original = fixture();
  const changed = { ...original, accessories: original.accessories!.map((item) => ({ ...item, adjustment: { ...item.adjustment, offsetX: 20 } })).reverse() };
  await saveDraft(original, slot); await saveDraft(changed, slot);
  const request = indexedDB.open('sofa-sku-workbench', 2);
  const database = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
  try {
    const historyRequest = database.transaction('recovery-history', 'readonly').objectStore('recovery-history').get(slot);
    const stored = await new Promise<{ entries: Array<{ accessories: Array<{ image: unknown }> }> }>((resolve) => { historyRequest.onsuccess = () => resolve(historyRequest.result); });
    expect(stored.entries[0].accessories[0].image).toEqual({ name: 'TEST增高架.png', size: original.accessories![0].image!.blob.size, type: 'image/png' });
    const history = await loadRecoveryHistory(slot, changed);
    expect(history).toHaveLength(2);
    expect(history[0].accessories![0].adjustment.offsetX).toBe(5);
    expect(history[1].accessories![0].adjustment.offsetX).toBe(20);
    expect(history[0].accessories![0].image!.blob).toBe(changed.accessories[1].image!.blob);
  } finally { database.close(); }
});

it.each(['replace', 'remove', 'rename'] as const)('配件素材 %s 后不把旧历史错绑到现有图片', async (change) => {
  const original = fixture();
  await saveDraft(original, slot);
  const changed = { ...original, accessories: original.accessories!.map((item) => item.id !== 'chair' ? item : {
    ...item, id: change === 'rename' ? 'other-chair' : item.id,
    image: change === 'replace' ? image('TEST新电脑椅.png') : change === 'remove' ? undefined : item.image,
  }) };
  await saveDraft(changed, slot);
  expect(await loadRecoveryHistory(slot, changed)).toEqual([changed]);
});
