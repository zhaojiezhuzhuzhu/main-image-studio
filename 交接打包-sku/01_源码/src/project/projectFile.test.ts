import { describe, expect, it } from 'vitest';
import type { SofaCombinationDraft, WorkbenchDraft } from '../storage/draftStorage';
import { decodeProjectFile, encodeProjectFile, suggestedProjectName } from './projectFile';

const singleDraft = (): WorkbenchDraft => ({
  version: 1,
  model: 'G386-A',
  modelManuallyEdited: true,
  sellingPoints: ['舒适坐感', '电动调节', '柔软面料'],
  sizeInput: '240×88×100',
  dimensionFields: { length: '240', width: '88', height: '100' },
  annotations: [{ kind: 'length', label: '长', value: 240, from: { x: .1, y: .2 }, to: { x: .9, y: .2 } }],
  subjectAdjustment: { scale: .9, offsetX: 12, offsetY: -8 },
  image: { name: 'G386-A.png', blob: new Blob(['png-binary'], { type: 'image/png' }) },
});

describe('SKU 项目源文件', () => {
  it('固定尺寸线模式及参考位置随主产品、配件和附加规格保存重开', async () => {
    const original = singleDraft();
    const dimensionFrame = { x: 120, y: 420, width: 800, height: 400 };
    original.subjectAdjustment.dimensionFrame = dimensionFrame;
    original.accessories = [{ id: 'cabinet', adjustment: { ...original.subjectAdjustment, dimensionFrame: { ...dimensionFrame, x: 950 } }, image: original.image }];
    const restored = await decodeProjectFile(await encodeProjectFile(original));
    expect(restored.draft.subjectAdjustment).toEqual(original.subjectAdjustment);
    expect((restored.draft as WorkbenchDraft).accessories?.[0].adjustment).toEqual(original.accessories[0].adjustment);
    const combo: SofaCombinationDraft = { ...original, kind: 'standard', mainImage: original.image,
      optionalSizes: [{ id: 'optional', sizeInput: original.sizeInput, dimensionFields: original.dimensionFields, annotations: original.annotations, adjustment: original.subjectAdjustment, image: original.image }],
      optionalLabelOffsetY: 0, noteEnabled: true, note: '' };
    const reopened = await decodeProjectFile(await encodeProjectFile(combo, 'combination'));
    expect((reopened.draft as SofaCombinationDraft).optionalSizes[0].adjustment).toEqual(original.subjectAdjustment);
  });
  it('源文件重开保留两端各自的辅助线长度', async () => {
    const original = singleDraft();
    original.annotations[0].extensionOffsets = { from: .23, to: -.17 };
    const restored = await decodeProjectFile(await encodeProjectFile(original));
    expect(restored.draft.annotations).toEqual(original.annotations);
  });
  it.each(['footstool-single', 'office-chair-single'] as const)('保留第二批 %s 的模板身份、专属选项与图片', async (templateId) => {
    const original = { ...singleDraft(), templateId,
      ...(templateId === 'office-chair-single' ? { officeChair: { sellingPointCount: 2, dimensionGap: 80 } } : {}) };
    const restored = await decodeProjectFile(await encodeProjectFile(original, 'single', `batch2-${templateId}`));
    expect(restored.projectId).toBe(`batch2-${templateId}`);
    expect({ ...restored.draft, image: undefined }).toEqual({ ...original, image: undefined });
    expect(await (restored.draft as WorkbenchDraft).image?.blob.text()).toBe('png-binary');
  });

  it('preserves the soft-bed template when reopening a source file', async () => {
    const original: WorkbenchDraft = { ...singleDraft(), templateId: 'soft-bed-single' };
    const restored = await decodeProjectFile(await encodeProjectFile(original, 'single'));
    expect(restored.draft.templateId).toBe('soft-bed-single');
    expect((restored.draft as WorkbenchDraft).annotations).toEqual(original.annotations);
  });

  it('refuses to save a combination template inside a single-product file', async () => {
    await expect(encodeProjectFile({ ...singleDraft(), templateId: 'sofa-bed-combination' }, 'single')).rejects.toThrow('不匹配');
  });

  it('round-trips one editable single-product project', async () => {
    const original = singleDraft();
    const file = await encodeProjectFile(original, 'single', 'project-single-1');
    const restored = await decodeProjectFile(file);

    expect(file.type).toBe('application/x-skuwork');
    expect(restored.projectId).toBe('project-single-1');
    expect(restored.kind).toBe('single');
    expect(restored.draft).toMatchObject({ model: 'G386-A', sizeInput: '240×88×100' });
    expect((restored.draft as WorkbenchDraft).image?.name).toBe('G386-A.png');
    expect(await (restored.draft as WorkbenchDraft).image?.blob.text()).toBe('png-binary');
  });

  it('stores a reused image only once inside one combination file', async () => {
    const shared = new Blob(['shared-png'], { type: 'image/png' });
    const draft: SofaCombinationDraft = {
      version: 1,
      kind: 'standard',
      model: 'PS060',
      modelManuallyEdited: false,
      sizeInput: '240×88×100',
      dimensionFields: { length: '240', width: '88', height: '100' },
      annotations: [],
      subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 },
      mainImage: { name: 'main.png', blob: shared },
      optionalSizes: [{
        id: 'one', sizeInput: '210×88×100', dimensionFields: { length: '210', width: '88', height: '100' },
        annotations: [], adjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'reused.png', blob: shared },
      }],
      optionalLabelOffsetY: 0,
      optionalLabelSide: 'left',
      noteEnabled: true,
      note: '*实际尺寸请以下单规格为准',
    };
    const file = await encodeProjectFile(draft, 'combination', 'project-combination-1');
    const restored = await decodeProjectFile(file);

    expect(restored.kind).toBe('combination');
    expect(restored.projectId).toBe('project-combination-1');
    const result = restored.draft as SofaCombinationDraft;
    expect(await result.mainImage?.blob.text()).toBe('shared-png');
    expect(result.optionalSizes[0].image?.blob).toBe(result.mainImage?.blob);
  });

  it('rejects a file whose embedded image was corrupted', async () => {
    const encoded = await encodeProjectFile(singleDraft());
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    bytes[bytes.length - 1] ^= 0xff;

    await expect(decodeProjectFile(new Blob([bytes]))).rejects.toThrow('校验失败');
  });

  it('gives legacy files without a project id one stable identity', async () => {
    const encoded = await encodeProjectFile(singleDraft(), 'single', 'temporary-id');
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const headerSize = 'SKUWORK1'.length + 4;
    const manifestLength = new DataView(bytes.buffer).getUint32('SKUWORK1'.length, true);
    const manifest = JSON.parse(new TextDecoder().decode(bytes.slice(headerSize, headerSize + manifestLength)));
    delete manifest.projectId;
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    const header = new Uint8Array(headerSize);
    header.set(new TextEncoder().encode('SKUWORK1'));
    new DataView(header.buffer).setUint32('SKUWORK1'.length, manifestBytes.length, true);
    const legacy = new Blob([header, manifestBytes, bytes.slice(headerSize + manifestLength)]);

    const first = await decodeProjectFile(legacy);
    const second = await decodeProjectFile(legacy);
    expect(first.projectId).toMatch(/^legacy-[a-f0-9]{64}$/);
    expect(second.projectId).toBe(first.projectId);
  });

  it('creates a Windows-safe source file name', () => {
    expect(suggestedProjectName(' PS:060/A* ', 'combination')).toBe('PS-060-A--组合.skuwork');
    expect(suggestedProjectName('', 'single')).toBe('未命名SKU.skuwork');
  });
});
