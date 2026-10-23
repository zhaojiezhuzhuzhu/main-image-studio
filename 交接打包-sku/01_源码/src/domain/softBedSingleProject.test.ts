import { describe, expect, it } from 'vitest';
import { decodeProjectFile, encodeProjectFile } from '../project/projectFile';
import type { WorkbenchDraft } from '../storage/draftStorage';

describe('软床源文件兼容', () => {
  it('往返保留模板、床头床尾双规格、布局和标注端点', async () => {
    const draft: WorkbenchDraft = { version: 1, templateId: 'soft-bed-single', model: 'BC553-A床', modelManuallyEdited: true,
      sellingPoints: ['透气生态牛皮', '静音加宽排骨架', '鹅毛混充靠包'],
      sizeInput: '223×168/198×183/193×118', dimensionFields: { length: '223', width: '', height: '118', headWidth: '168/198', footWidth: '183/193' },
      annotations: [{ kind: 'footWidth', label: '床尾宽', value: 183, from: { x: .4, y: 1.1 }, to: { x: 1, y: 1 } }],
      subjectAdjustment: { scale: .9, offsetX: 10, offsetY: -5 },
      softBed: { sizeLabels: ['1.5m床', '1.8m床'], sellingPointCount: 2, dimensionGap: 25 },
      image: { name: 'test.png', blob: new Blob(['png-fixture'], { type: 'image/png' }) } };
    const restored = await decodeProjectFile(await encodeProjectFile(draft, 'single', 'soft-bed-roundtrip'));
    expect(restored.kind).toBe('single');
    expect({ ...restored.draft, image: undefined }).toEqual({ ...draft, image: undefined });
    expect(await (restored.draft as WorkbenchDraft).image!.blob.text()).toBe('png-fixture');
  });
});
