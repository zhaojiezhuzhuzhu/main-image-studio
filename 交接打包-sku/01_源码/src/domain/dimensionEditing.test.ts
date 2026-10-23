import { describe, expect, it } from 'vitest';
import { adjustAnnotatedProduct, adjustAnnotatedProductAroundObstacles, annotationCollisionRects, annotationFromProduct, pointFromProduct, fitAnnotatedProduct } from './annotatedProductFit';
import { changeDimensionLink, commitDimensionEndpoint, previewDimensionEndpoint, previewDimensionExtension, previewDimensionTranslation, preserveManualLabelPosition, dimensionExtensionPoint, snapDimensionPoint, parseDimensionEdit, type DimensionEditScene } from './dimensionEditing';
import { getDimensionGeometry } from './dimensionGeometry';

describe('尺寸直接编辑', () => {
  it('接受正数、小数并保留既有一位小数精度，拒绝非法输入', () => {
    expect(parseDimensionEdit(' 258.56 ')).toBe('258.6');
    expect(parseDimensionEdit('.5')).toBe('0.5');
    for (const value of ['', ' ', '0', '-1', 'abc', '12cm', '1e3', 'Infinity', '0.01']) expect(parseDimensionEdit(value)).toBeUndefined();
  });
  it('新模板可启用范围文本和不四舍五入，旧编辑入口不接受范围', () => {
    expect(parseDimensionEdit('100.99~196.99', 'truncate', true)).toBe('100.9~196.9');
    expect(parseDimensionEdit('168.99/198.99', 'truncate', true)).toBe('168.9/198.9');
    expect(parseDimensionEdit('118.99', 'truncate')).toBe('118.9');
    expect(parseDimensionEdit('100~196')).toBeUndefined();
  });
  it('画布编辑按模板开关接受中文说明，保留尺寸校验和精度', () => {
    expect(parseDimensionEdit('尺寸可选：140.99/160.99', 'truncate', true, true)).toBe('尺寸可选：140.9/160.9');
    expect(parseDimensionEdit('75（含脚垫）', 'truncate', true, true)).toBe('75（含脚垫）');
    expect(parseDimensionEdit('约75', 'truncate', false, true)).toBe('约75');
    expect(parseDimensionEdit('约75/80', 'truncate', false, true)).toBeUndefined();
    expect(parseDimensionEdit('尺寸可选：140/160', 'truncate', true)).toBeUndefined();
    for (const value of ['尺寸可选', '尺寸可选：0', '约-1', '可选140//160']) expect(parseDimensionEdit(value, 'truncate', true, true)).toBeUndefined();
  });

  const scene: DimensionEditScene = {
    productRect: { x: 250, y: 550, width: 600, height: 300 },
    baseProductRect: { x: 70, y: 390, width: 1200, height: 600 },
    fitArea: { x: 70, y: 398, width: 1300, height: 734 },
    safeArea: { x: 70, y: 398, width: 1300, height: 734 },
    annotations: [{ annotation: { kind: 'length', label: '长', value: 240, from: { x: 250, y: 530 }, to: { x: 850, y: 530 } }, labelSize: { width: 120, height: 46 } }],
  };
  it('固定后单独修改端点、辅助线和整线，不改变产品位置；切回联动不跳位', () => {
    const original = { ...scene.annotations[0].annotation, extensionOffsets: { from: 60, to: -45 }, labelOffset: { x: 15, y: -10 }, labelColor: 'white' as const };
    const measured = [{ annotation: original, labelSize: scene.annotations[0].labelSize }];
    const fixed = changeDimensionLink({ ...scene, annotations: measured }, true);
    const fixedScene = { ...scene, annotations: measured, adjustment: fixed.adjustment };
    const result = adjustAnnotatedProduct(scene.baseProductRect, measured, scene.safeArea, { ...fixed.adjustment, scale: .3, offsetX: 300, offsetY: 200 });
    expect(result.annotations).toEqual([original]);
    expect(result.productRect).not.toEqual(scene.productRect);
    for (const changed of [previewDimensionEndpoint(original, 'to', { x: 800, y: 510 }), previewDimensionExtension(fixedScene, original, 'from', { x: 250, y: 610 }), previewDimensionTranslation(fixedScene, original, { x: 20, y: 10 })]) {
      const committed = commitDimensionEndpoint(fixedScene, changed);
      expect(committed.adjustment).toEqual(fixed.adjustment);
      const absolute = annotationFromProduct(committed.annotations[0], fixed.adjustment.dimensionFrame!);
      expect(absolute.from.x).toBeCloseTo(changed.from.x); expect(absolute.to.y).toBeCloseTo(changed.to.y);
      expect(absolute.labelColor).toBe('white');
    }
    const linked = changeDimensionLink({ ...fixedScene, productRect: result.productRect, adjustment: result.adjustment }, false);
    expect(linked.adjustment.dimensionFrame).toBeUndefined();
    const rebased = annotationFromProduct(linked.annotations[0], result.productRect);
    expect(rebased.from.x).toBeCloseTo(original.from.x); expect(rebased.to.y).toBeCloseTo(original.to.y);
    expect(rebased.extensionOffsets?.from).toBeCloseTo(60);
  });
  it('切换联动不丢失当前隐藏的标注，也保留模板自动生成的可见标注', () => {
    const hidden = { kind: 'width' as const, label: '宽' as const, value: 80, from: { x: 0, y: 1.1 }, to: { x: .4, y: 1.3 } };
    const fixed = changeDimensionLink(scene, true, [hidden]);
    expect(fixed.annotations.map((item) => item.kind)).toEqual(['width', 'length']);
    expect(fixed.annotations[0].from.y).toBeCloseTo(hidden.from.y);
    const changed = previewDimensionEndpoint(scene.annotations[0].annotation, 'to', { x: 5000, y: -3000 });
    const committed = commitDimensionEndpoint({ ...scene, adjustment: fixed.adjustment }, changed);
    expect(committed.adjustment).toEqual(fixed.adjustment);
    const positioned = annotationFromProduct(committed.annotations[0], fixed.adjustment.dimensionFrame!);
    expect(positioned.from.x).toBeGreaterThanOrEqual(scene.safeArea.x);
    expect(positioned.to.x).toBeLessThanOrEqual(scene.safeArea.x + scene.safeArea.width);
    expect(positioned.to.y).toBeGreaterThanOrEqual(scene.safeArea.y);
  });
  it.each([undefined, 'line'] as const)('手动文字保持画布锚点，包括倾斜文字与整线跨过产品中心：%s', (orientation) => {
    const annotation = { ...scene.annotations[0].annotation, labelOffset: { x: 0, y: 0 } };
    const labelSize = { ...scene.annotations[0].labelSize, orientation };
    const fixedScene = { ...scene, annotations: [{ annotation, labelSize }] };
    const before = getDimensionGeometry(annotation.from, annotation.to, '240cm', scene.productRect, labelSize, annotation.labelOffset).label;
    for (const changed of [previewDimensionEndpoint(annotation, 'from', { x: 300, y: 720 }), previewDimensionTranslation(fixedScene, annotation, { x: -130, y: 600 })]) {
      const fixed = preserveManualLabelPosition(fixedScene, changed);
      const after = getDimensionGeometry(fixed.from, fixed.to, '240cm', scene.productRect, labelSize, fixed.labelOffset).label;
      expect(after.x).toBeCloseTo(before.x, 7); expect(after.y).toBeCloseTo(before.y, 7);
      expect(fixed.from).toEqual(changed.from); expect(fixed.to).toEqual(changed.to);
    }
    const automatic = previewDimensionTranslation(scene, scene.annotations[0].annotation, { x: 20, y: 30 });
    expect(preserveManualLabelPosition(scene, automatic)).toBe(automatic);
  });

  it.each(['endpoint', 'extension', 'line'] as const)('%s越界整体适配后，已手动移动的文字仍保持画布位置', (mode) => {
    const annotation = { ...scene.annotations[0].annotation, labelOffset: { x: 75, y: 25 } };
    const labelSize = scene.annotations[0].labelSize;
    const fixedScene = { ...scene, annotations: [{ annotation, labelSize }] };
    const before = getDimensionGeometry(annotation.from, annotation.to, '240cm', scene.productRect, labelSize, annotation.labelOffset).label;
    const changed = mode === 'endpoint' ? previewDimensionEndpoint(annotation, 'from', { x: -1500, y: 1800 })
      : mode === 'line' ? previewDimensionTranslation(fixedScene, annotation, { x: -1500, y: 1800 })
      : previewDimensionExtension(fixedScene, annotation, 'from', { x: 250, y: 3000 });
    const committed = commitDimensionEndpoint(fixedScene, preserveManualLabelPosition(fixedScene, changed));
    const measured = committed.annotations.map((item) => ({ annotation: annotationFromProduct(item, scene.baseProductRect), labelSize }));
    const fitted = fitAnnotatedProduct(scene.baseProductRect, measured, scene.fitArea);
    const restored = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item) => ({ annotation: item, labelSize })), scene.safeArea, committed.adjustment);
    const actual = restored.annotations[0];
    const after = getDimensionGeometry(actual.from, actual.to, '240cm', restored.productRect, labelSize, actual.labelOffset).label;
    expect(restored.productRect.width).toBeLessThan(scene.productRect.width);
    expect(after.x).toBeCloseTo(before.x, 5); expect(after.y).toBeCloseTo(before.y, 5);
    expect(annotation.labelOffset).toEqual({ x: 75, y: 25 });
  });
  it('Shift 按最接近方向锁定，松开后恢复任意角度', () => {
    const anchor = { x: 200, y: 300 }, cursor = { x: 100, y: 320 };
    expect(snapDimensionPoint(anchor, cursor, true)).toEqual({ x: 100, y: 300 });
    expect(snapDimensionPoint(anchor, { x: 180, y: 50 }, true)).toEqual({ x: 200, y: 50 });
    expect(snapDimensionPoint(anchor, cursor, false)).toEqual(cursor);
    const slanted = { ...scene.annotations[0].annotation, from: { x: 280, y: 580 } };
    const bounded = previewDimensionEndpoint(slanted, 'from', { x: -500, y: 550 }, true);
    expect(bounded.from.y).toBe(slanted.to.y);
    expect(bounded.from.x).toBe(-500);
    expect(bounded.to).toEqual(slanted.to);
  });
  it('两端辅助线独立拉长，只沿原有方向移动，预览允许超出安全区', () => {
    const original = scene.annotations[0].annotation;
    expect(previewDimensionExtension(scene, original, 'from', dimensionExtensionPoint(original, 'from', scene.productRect))).toBe(original);
    const first = previewDimensionExtension(scene, original, 'from', { x: 999, y: 700 });
    const both = previewDimensionExtension(scene, first, 'to', { x: 999, y: 810 });
    expect(both.extensionOffsets).toEqual({ from: 170, to: 280 });
    expect(both.from).toEqual(original.from); expect(both.to).toEqual(original.to);
    expect(dimensionExtensionPoint(both, 'from', scene.productRect)).toEqual({ x: original.from.x, y: 700 });
    const bounded = previewDimensionExtension(scene, both, 'to', { x: 850, y: 5000 });
    expect(dimensionExtensionPoint(bounded, 'to', scene.productRect).y).toBe(5000);
  });
  it('高度辅助线预览可经过其他对象，主线端点保持不动', () => {
    const annotation = { ...scene.annotations[0].annotation, kind: 'height' as const, label: '高' as const, from: { x: 900, y: 560 }, to: { x: 900, y: 850 } };
    const heightScene = { ...scene, annotations: [{ ...scene.annotations[0], annotation }], obstacles: [{ x: 400, y: 810, width: 100, height: 100 }] };
    const changed = previewDimensionExtension(heightScene, annotation, 'to', { x: 300, y: 990 });
    const end = dimensionExtensionPoint(changed, 'to', scene.productRect);
    expect(end.y).toBe(850); expect(end.x).toBe(300);
    expect(changed.from).toEqual(annotation.from); expect(changed.to).toEqual(annotation.to);
  });
  it('辅助线保存后恢复位置，随产品等比缩放', () => {
    const original = scene.annotations[0].annotation;
    const changed = previewDimensionExtension(scene, original, 'from', { x: 250, y: 730 });
    const committed = commitDimensionEndpoint(scene, changed);
    expect(committed.annotations[0].extensionOffsets!.from).toBeCloseTo(200 / scene.productRect.height);
    const measured = committed.annotations.map((annotation, index) => ({ annotation: annotationFromProduct(annotation, scene.baseProductRect), labelSize: scene.annotations[index].labelSize }));
    const fitted = fitAnnotatedProduct(scene.baseProductRect, measured, scene.fitArea);
    const fittedMeasured = fitted.annotations.map((annotation, index) => ({ annotation, labelSize: measured[index].labelSize }));
    const restored = adjustAnnotatedProduct(fitted.productRect, fittedMeasured, scene.safeArea, committed.adjustment);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(restored.productRect[key]).toBeCloseTo(scene.productRect[key], 5);
    expect(restored.annotations[0].extensionOffsets!.from).toBeCloseTo(200);
    const scaled = adjustAnnotatedProduct(fitted.productRect, fittedMeasured, scene.safeArea, { ...committed.adjustment, scale: committed.adjustment.scale * .5 });
    expect(scaled.annotations[0].extensionOffsets!.from).toBeCloseTo(100);
  });
  it('端点预览不受安全区和相邻对象限制', () => {
    const original = scene.annotations[0].annotation;
    const changed = previewDimensionEndpoint(original, 'from', { x: -500, y: -500 });
    expect(changed.from).toEqual({ x: -500, y: -500 });
    expect(changed.to).toEqual(original.to);
    const avoided = previewDimensionEndpoint(original, 'to', { x: 1000, y: 530 });
    expect(avoided.to.x).toBe(1000);
    expect(avoided.from).toEqual(original.from);
  });
  it.each(['length', 'width', 'height', 'secondaryHeight'] as const)('%s整体平移保留角度、数值与两端辅助线，经过产品中心也不翻转', (kind) => {
    const original = { ...scene.annotations[0].annotation, kind, to: { x: 820, y: 590 } };
    const delta = { x: 700, y: 800 };
    const moved = previewDimensionTranslation(scene, original, delta);
    for (const end of ['from', 'to'] as const) {
      expect(moved[end]).toEqual({ x: original[end].x + delta.x, y: original[end].y + delta.y });
      const before = dimensionExtensionPoint(original, end, scene.productRect);
      expect(dimensionExtensionPoint(moved, end, scene.productRect)).toEqual({ x: before.x + delta.x, y: before.y + delta.y });
    }
    expect(moved.value).toBe(original.value);
    expect(moved.to.x - moved.from.x).toBe(original.to.x - original.from.x);
    expect(moved.to.y - moved.from.y).toBe(original.to.y - original.from.y);
    expect(original.extensionOffsets).toBeUndefined();
  });
  it('整线平移保留自定义辅助线，Shift只限制位移方向，不改变原线角度', () => {
    const original = { ...scene.annotations[0].annotation, to: { x: 800, y: 580 }, extensionOffsets: { from: -30, to: 80 } };
    expect(previewDimensionTranslation(scene, original, { x: 0, y: 0 })).toBe(original);
    const moved = previewDimensionTranslation(scene, original, { x: 12, y: 5 }, true);
    expect(moved.from).toEqual({ x: original.from.x + 12, y: original.from.y });
    expect(moved.to).toEqual({ x: original.to.x + 12, y: original.to.y });
    expect(moved.extensionOffsets).toEqual(original.extensionOffsets);
    const vertical = previewDimensionTranslation(scene, original, { x: 5, y: 12 }, true);
    expect(vertical.from).toEqual({ x: original.from.x, y: original.from.y + 12 });
  });
  it.each(['endpoint', 'extension', 'line'] as const)('%s越界后提交整体适配，保留相对坐标、另一端和字号', (mode) => {
    const original = scene.annotations[0].annotation;
    const changed = mode === 'endpoint'
      ? previewDimensionEndpoint(original, 'from', { x: -1500, y: 1800 })
      : mode === 'line' ? previewDimensionTranslation(scene, original, { x: -1500, y: 1800 })
      : previewDimensionExtension(scene, original, 'from', { x: 250, y: 3000 });
    const committed = commitDimensionEndpoint(scene, changed);
    const measured = committed.annotations.map((annotation, i) => ({ annotation: annotationFromProduct(annotation, scene.baseProductRect), labelSize: scene.annotations[i].labelSize }));
    const fitted = fitAnnotatedProduct(scene.baseProductRect, measured, scene.fitArea);
    const fittedMeasured = fitted.annotations.map((annotation, i) => ({ annotation, labelSize: measured[i].labelSize }));
    const restored = adjustAnnotatedProduct(fitted.productRect, fittedMeasured, scene.safeArea, committed.adjustment);
    for (const key of ['scale', 'offsetX', 'offsetY'] as const) expect(restored.adjustment[key]).toBeCloseTo(committed.adjustment[key], 5);
    expect(restored.productRect.width).toBeLessThan(scene.productRect.width);
    const scale = restored.productRect.width / scene.productRect.width;
    for (const end of ['from', 'to'] as const) {
      expect(restored.annotations[0][end].x - restored.productRect.x).toBeCloseTo((changed[end].x - scene.productRect.x) * scale, 5);
      expect(restored.annotations[0][end].y - restored.productRect.y).toBeCloseTo((changed[end].y - scene.productRect.y) * scale, 5);
    }
    for (const rect of [restored.bounds, restored.productRect, annotationCollisionRects({ annotation: restored.annotations[0], labelSize: measured[0].labelSize }, restored.productRect)[0]]) {
      expect(rect.x).toBeGreaterThanOrEqual(scene.safeArea.x - .02);
      expect(rect.y).toBeGreaterThanOrEqual(scene.safeArea.y - .02);
      expect(rect.x + rect.width).toBeLessThanOrEqual(scene.safeArea.x + scene.safeArea.width + .02);
      expect(rect.y + rect.height).toBeLessThanOrEqual(scene.safeArea.y + scene.safeArea.height + .02);
    }
  });
  it('提交时按模板间距整体避让相邻对象，保存的是适配后的调整值', () => {
    const obstacleScene = { ...scene, obstacles: [{ x: 920, y: 500, width: 120, height: 150 }], minimumGap: 30 };
    const changed = previewDimensionEndpoint(scene.annotations[0].annotation, 'to', { x: 1000, y: 530 });
    const committed = commitDimensionEndpoint(obstacleScene, changed);
    const measured = committed.annotations.map((annotation, i) => ({ annotation: annotationFromProduct(annotation, scene.baseProductRect), labelSize: scene.annotations[i].labelSize }));
    const fitted = fitAnnotatedProduct(scene.baseProductRect, measured, scene.fitArea);
    const restored = adjustAnnotatedProductAroundObstacles(fitted.productRect, fitted.annotations.map((annotation, i) => ({ annotation, labelSize: measured[i].labelSize })), scene.safeArea, obstacleScene.obstacles, 30, committed.adjustment);
    expect(restored.adjustment.scale).toBeCloseTo(committed.adjustment.scale, 5);
    expect(restored.adjustment.offsetX).toBeCloseTo(committed.adjustment.offsetX, 5);
    expect(restored.adjustment.offsetY).toBeCloseTo(committed.adjustment.offsetY, 5);
    expect(restored.productRect.x).not.toBeCloseTo(scene.productRect.x, 5);
  });
  it('保存坐标后重新自动排版，补偿产品位置和缩放', () => {
    const changed = { ...scene.annotations[0].annotation, from: { x: 270, y: 555 } };
    const committed = commitDimensionEndpoint(scene, changed);
    const measured = committed.annotations.map((annotation, index) => ({
      annotation: { ...annotation, from: pointFromProduct(annotation.from, scene.baseProductRect), to: pointFromProduct(annotation.to, scene.baseProductRect) },
      labelSize: scene.annotations[index].labelSize,
    }));
    const fitted = fitAnnotatedProduct(scene.baseProductRect, measured, scene.fitArea);
    const restored = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((annotation, index) => ({ annotation, labelSize: measured[index].labelSize })), scene.safeArea, committed.adjustment);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(restored.productRect[key]).toBeCloseTo(scene.productRect[key], 5);
    expect(restored.annotations[0].from.x).toBeCloseTo(changed.from.x, 5);
    expect(restored.annotations[0].from.y).toBeCloseTo(changed.from.y, 5);
    expect(restored.annotations[0].to.x).toBeCloseTo(changed.to.x, 5);
  });
});
