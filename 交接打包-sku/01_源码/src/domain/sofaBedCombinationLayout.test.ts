import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { parseSofaBedQuickDimensions, sofaBedDimensionText, sofaBedDimensionIssues, getSofaBedFeatureBounds, getSofaBedCombinationLayout, getSofaBedSellingPointLayout, restoreSofaBedSellingPoints, type SofaBedCombinationDraft } from './sofaBedCombinationLayout';
import { getSofaCombinationLayout } from './sofaCombinationLayout';
import { decodeProjectFile, encodeProjectFile } from '../project/projectFile';
import { clearDraft, loadDraft, loadRecoveryHistory, saveDraft } from '../storage/draftStorage';

describe('沙发床第 19 页布局', () => {
  it('固定型号、右上标签和底部备注，右列两规格至少间隔 50px', () => {
    const layout = getSofaBedCombinationLayout(2);
    expect(layout.modelBadge).toEqual({ x: 70, y: 250, height: 78 });
    expect(layout.optionalLabel).toEqual({ x: 1110, y: 378, width: 260, height: 56 });
    expect(layout.note.y + layout.note.height).toBe(1380);
    expect(layout.optionalGroups[1].y - layout.optionalGroups[0].y - layout.optionalGroups[0].height).toBe(50);
    expect(layout.optionalGroups[0].x - layout.mainSubjectSafeArea.x - layout.mainSubjectSafeArea.width).toBe(50);
    expect(layout.optionalGroups[0].y - layout.optionalLabel.y - layout.optionalLabel.height).toBe(50);
  });

  it.each([0, 1, 2, 3, 4])('%i 个规格保持画布安全边界，单 SKU 为卖点保留底部', (count) => {
    const layout = getSofaBedCombinationLayout(count);
    expect(layout.optionalGroups).toHaveLength(count);
    for (const rect of [layout.mainSubjectSafeArea, ...layout.optionalGroups]) {
      expect(rect.x).toBeGreaterThanOrEqual(70);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1370);
      expect(rect.y).toBeGreaterThanOrEqual(350);
      expect(rect.y + rect.height).toBeLessThanOrEqual(count ? 1300 : 1132);
    }
  });

  it('不改变普通、功能沙发组合原版式', () => {
    for (const kind of ['standard', 'functional'] as const) {
      const layout = getSofaCombinationLayout(2, kind);
      expect(layout.optionalGroups[0].y).toBe(layout.optionalGroups[1].y);
      expect(layout.modelBadge.y).toBe(270);
      expect(layout.note.y).toBe(1310);
    }
  });

  it.each([[300, 350], [300, 350, 320]])('单 SKU 支持两或三卖点且不压缩字体', (...widths) => {
    const layout = getSofaBedSellingPointLayout(widths);
    expect(layout.issue).toBeNull();
    expect(layout.boxes).toHaveLength(widths.length);
    layout.boxes.forEach((box, index) => {
      expect(box.width).toBeGreaterThanOrEqual(widths[index] + 48);
      expect(box.x).toBeGreaterThanOrEqual(70);
      expect(box.x + box.width).toBeLessThanOrEqual(1370);
      expect(box.y).toBe(1182);
    });
    expect(getSofaBedSellingPointLayout([600, 600, 600]).issue).toContain('缩短');
  });
});

describe('沙发床专属字段保存兼容', () => {
  const draft: SofaBedCombinationDraft = {
    version: 1, templateId: 'sofa-bed-combination', kind: 'standard', model: 'G370-A', modelManuallyEdited: true,
    sizeInput: '162×196×95', dimensionFields: { length: '162', width: '196', height: '95' }, annotations: [],
    subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, optionalSizes: [],
    mainImage: { name: 'G370-A.png', blob: new Blob(['png-fixture'], { type: 'image/png' }) },
    optionalLabelOffsetY: 0, noteEnabled: true, note: '*实际尺寸请以下单规格为准', sofaBedSellingPoints: ['舒适坐感', '沙发床'], sofaBedFeature: { enabled: true, text: '6档调节', x: 780, y: 530 },
  };

  it('源文件保留模板身份、两卖点及图片，旧字段缺省正常', async () => {
    const decoded = await decodeProjectFile(await encodeProjectFile(draft, 'combination', 'sofa-bed-roundtrip'));
    expect(decoded.kind).toBe('combination');
    expect(decoded.draft.templateId).toBe('sofa-bed-combination');
    const restored = decoded.draft as SofaBedCombinationDraft;
    expect(restored.sofaBedFeature).toEqual(draft.sofaBedFeature);
    expect(restoreSofaBedSellingPoints(restored)).toEqual(draft.sofaBedSellingPoints);
    expect(await restored.mainImage?.blob.text()).toBe('png-fixture');
    expect(restoreSofaBedSellingPoints({ ...draft, sofaBedSellingPoints: undefined })).toEqual(['', '', '']);
  });

  it('临时草稿与恢复历史保留卖点，不误判为单品', async () => {
    const slot = 'test:sofa-bed-specific-fields';
    try {
      await saveDraft(draft, slot);
      const changed = { ...draft, sofaBedSellingPoints: ['修改卖点', '沙发床'] };
      await saveDraft(changed, slot);
      const restored = await loadDraft(slot) as SofaBedCombinationDraft;
      expect(restored.sofaBedSellingPoints).toEqual(changed.sofaBedSellingPoints);
      expect(restored.mainImage?.name).toBe('G370-A.png');
      const history = await loadRecoveryHistory(slot, restored) as SofaBedCombinationDraft[];
      expect(history.some((entry) => entry.sofaBedSellingPoints?.[0] === '舒适坐感')).toBe(true);
    } finally { await clearDraft(slot); }
  });
});

it('功能说明整体限制在安全区内', () => {
  const bounds = getSofaBedFeatureBounds({ enabled: true, text: '测试', x: 1400, y: 2000 }, 180, true);
  expect(bounds.x + bounds.width).toBe(1370);
  expect(bounds.y + bounds.height).toBe(1132);
});

describe('沙发床范围尺寸显示', () => {
  it('快速填写保留收起/展开范围并截断，不影响普通组合取整', () => {
    const fields = parseSofaBedQuickDimensions('162.29×100.28～196.39×95.48~54.59')!;
    expect(fields).toEqual({ length: '162.2', width: '100.2~196.3', height: '95.4~54.5' });
    expect(sofaBedDimensionText({ kind: 'width', value: 100.2 }, fields)).toBe('100.2~196.3cm');
    expect(parseSofaBedQuickDimensions('125××')).toEqual({ length: '125', width: '', height: '' });
    expect(parseSofaBedQuickDimensions('abc')).toBeNull();
    expect(sofaBedDimensionIssues({ length: '0', width: '100~', height: '95' }, '0×100~×95', '主产品')).toHaveLength(3);
  });
});
