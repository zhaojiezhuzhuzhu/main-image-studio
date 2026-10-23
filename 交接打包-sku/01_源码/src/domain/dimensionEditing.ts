import { adjustAnnotatedProduct, adjustAnnotatedProductAroundObstacles, annotationFromProduct, annotationRelativeToProduct, fitAnnotatedProduct, type MeasuredDimensionAnnotation, type ProductSilhouette, type SubjectAdjustment } from './annotatedProductFit';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { getDimensionGeometry, type Point, type Rect } from './dimensionGeometry';
import { normalizeDimension, parseDimensionText, type DimensionPrecision } from './dimensions';
import { DIMENSION_STYLE } from './dimensionStyle';

export type DimensionEditScene = {
  productRect: Rect;
  baseProductRect: Rect;
  annotations: MeasuredDimensionAnnotation[];
  fitArea: Rect;
  safeArea: Rect;
  obstacles?: Rect[];
  minimumGap?: number;
  silhouette?: ProductSilhouette;
  adjustment?: SubjectAdjustment;
};
export type DimensionEndpoint = 'from' | 'to';

export function parseDimensionEdit(value: string, precision: DimensionPrecision = 'round', allowCompound = false, allowText = false): string | undefined {
  const trimmed = value.trim();
  if (allowText && (allowCompound || !/[~/～]/.test(trimmed))) return parseDimensionText(trimmed, precision, true)?.text;
  if (allowCompound && /^[\d.\s~/～]+$/.test(trimmed)) return parseDimensionText(trimmed, precision)?.text;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return;
  const number = normalizeDimension(Number(trimmed), precision);
  if (!Number.isFinite(number) || number <= 0) return;
  return String(number);
}

export function snapDimensionPoint(anchor: Point, point: Point, shift: boolean): Point {
  if (!shift) return point;
  return Math.abs(point.x - anchor.x) >= Math.abs(point.y - anchor.y)
    ? { x: point.x, y: anchor.y } : { x: anchor.x, y: point.y };
}

export function dimensionExtensionPoint(annotation: DimensionAnnotation, endpoint: DimensionEndpoint, product: Rect): Point {
  const axis = (annotation.kind === 'height' || annotation.kind === 'secondaryHeight') ? 'x' : 'y';
  const center = axis === 'x' ? product.x + product.width / 2 : product.y + product.height / 2;
  const half = (DIMENSION_STYLE.extensionDashLength * DIMENSION_STYLE.extensionDashCount
    + DIMENSION_STYLE.extensionGapLength * (DIMENSION_STYLE.extensionDashCount - 1)) / 2;
  const offset = annotation.extensionOffsets?.[endpoint] ?? (center >= annotation[endpoint][axis] ? half : -half);
  return { ...annotation[endpoint], [axis]: annotation[endpoint][axis] + offset };
}

export function previewDimensionEndpoint(current: DimensionAnnotation, endpoint: DimensionEndpoint, point: Point, shift = false) {
  const anchor = current[endpoint === 'from' ? 'to' : 'from'];
  return { ...current, [endpoint]: snapDimensionPoint(anchor, point, shift) };
}

export function previewDimensionTranslation(scene: DimensionEditScene, current: DimensionAnnotation, delta: Point, shift = false): DimensionAnnotation {
  const offset = snapDimensionPoint({ x: 0, y: 0 }, delta, shift);
  if (!offset.x && !offset.y) return current;
  const axis = (current.kind === 'height' || current.kind === 'secondaryHeight') ? 'x' : 'y';
  return {
    ...current,
    from: { x: current.from.x + offset.x, y: current.from.y + offset.y },
    to: { x: current.to.x + offset.x, y: current.to.y + offset.y },
    // 固定隐式辅助线的方向和长度，跨过产品中心时也随整条标注平移。
    extensionOffsets: {
      from: dimensionExtensionPoint(current, 'from', scene.adjustment?.dimensionFrame ?? scene.productRect)[axis] - current.from[axis],
      to: dimensionExtensionPoint(current, 'to', scene.adjustment?.dimensionFrame ?? scene.productRect)[axis] - current.to[axis],
    },
  };
}

export function previewDimensionExtension(scene: DimensionEditScene, current: DimensionAnnotation, endpoint: DimensionEndpoint, point: Point) {
  const axis = (current.kind === 'height' || current.kind === 'secondaryHeight') ? 'x' : 'y';
  const start = dimensionExtensionPoint(current, endpoint, scene.adjustment?.dimensionFrame ?? scene.productRect)[axis] - current[endpoint][axis];
  const desired = point[axis] - current[endpoint][axis];
  if (Math.abs(desired - start) < .001) return current;
  return { ...current, extensionOffsets: { ...current.extensionOffsets, [endpoint]: desired } };
}

// 已手动定位的文字，在编辑标注线时保持原画布锚点；自动文字继续跟随线条。
export function preserveManualLabelPosition(scene: DimensionEditScene, changed: DimensionAnnotation, productRect = scene.productRect): DimensionAnnotation {
  const original = scene.annotations.find((item) => item.annotation.kind === changed.kind);
  if (!original?.annotation.labelOffset) return changed;
  const before = original.annotation;
  if (productRect === scene.productRect && before.from.x === changed.from.x && before.from.y === changed.from.y
    && before.to.x === changed.to.x && before.to.y === changed.to.y) return changed;
  const fixed = getDimensionGeometry(before.from, before.to, `${before.value}cm`, scene.adjustment?.dimensionFrame ?? scene.productRect, original.labelSize, before.labelOffset).label;
  const automatic = getDimensionGeometry(changed.from, changed.to, `${changed.value}cm`, scene.adjustment?.dimensionFrame ?? productRect, original.labelSize).label;
  return { ...changed, labelOffset: { x: fixed.x - automatic.x, y: fixed.y - automatic.y } };
}

// 拖动只改变预览；提交时产品和标注线一起适配，手动文字保持原画布位置。
export function commitDimensionEndpoint(scene: DimensionEditScene, changed: DimensionAnnotation) {
  if (scene.adjustment?.dimensionFrame) {
    const frame = scene.adjustment.dimensionFrame;
    const labelSize = scene.annotations.find(({ annotation }) => annotation.kind === changed.kind)!.labelSize;
    // 固定模式只适配正在编辑的标注，产品和其他已排好的尺寸线不参与移动。
    const origin = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2, width: 0, height: 0 };
    const measured = [{ annotation: changed, labelSize }];
    const requested = { scale: 1, offsetX: 0, offsetY: 0 };
    const fitted = scene.obstacles?.length
      ? adjustAnnotatedProductAroundObstacles(origin, measured, scene.safeArea, scene.obstacles, scene.minimumGap ?? 20, requested)
      : adjustAnnotatedProduct(origin, measured, scene.safeArea, requested);
    const positioned = preserveManualLabelPosition(scene, fitted.annotations[0]);
    return { adjustment: scene.adjustment, annotations: scene.annotations.map(({ annotation }) =>
      annotationRelativeToProduct(annotation.kind === changed.kind ? positioned : annotation, frame)) };
  }
  const annotations = scene.annotations.map(({ annotation }) => {
    const absolute = annotation.kind === changed.kind ? changed : annotation;
    return annotationRelativeToProduct(absolute, scene.productRect);
  });
  const measured = annotations.map((annotation, index) => ({
    annotation: annotationFromProduct(annotation, scene.baseProductRect),
    labelSize: scene.annotations[index].labelSize,
  }));
  const fitted = fitAnnotatedProduct(scene.baseProductRect, measured, scene.fitArea);
  const fittedMeasured = fitted.annotations.map((annotation, index) => ({ annotation, labelSize: measured[index].labelSize }));
  const requested = {
    scale: scene.productRect.width / fitted.productRect.width,
    offsetX: scene.productRect.x - fitted.productRect.x,
    offsetY: scene.productRect.y - fitted.productRect.y,
  };
  const adjusted = scene.obstacles?.length
    ? adjustAnnotatedProductAroundObstacles(fitted.productRect, fittedMeasured, scene.safeArea, scene.obstacles, scene.minimumGap ?? 20, requested, scene.silhouette)
    : adjustAnnotatedProduct(fitted.productRect, fittedMeasured, scene.safeArea, requested);
  return {
    annotations: annotations.map((annotation, index) => {
      const positioned = preserveManualLabelPosition(scene, adjusted.annotations[index], adjusted.productRect);
      return positioned === adjusted.annotations[index] ? annotation : { ...annotation, labelOffset: positioned.labelOffset };
    }),
    adjustment: adjusted.adjustment,
  };
}

// 固定模式以画布上的参考矩形保存标注；重新联动时从当前产品位置重新建立相对坐标。
export function changeDimensionLink(scene: DimensionEditScene, fixed: boolean, storedAnnotations?: DimensionAnnotation[]) {
  const frame = fixed ? scene.adjustment?.dimensionFrame ?? scene.productRect : scene.productRect;
  const annotations = scene.annotations.map(({ annotation, labelSize }) => {
    const previousFrame = scene.adjustment?.dimensionFrame ?? scene.productRect;
    const previous = getDimensionGeometry(annotation.from, annotation.to, `${annotation.value}cm`, previousFrame, labelSize, annotation.labelOffset).label;
    const automatic = getDimensionGeometry(annotation.from, annotation.to, `${annotation.value}cm`, frame, labelSize).label;
    const offset = { x: previous.x - automatic.x, y: previous.y - automatic.y };
    const positioned = annotation.labelOffset || Math.abs(offset.x) > .001 || Math.abs(offset.y) > .001 ? { ...annotation, labelOffset: offset } : annotation;
    return annotationRelativeToProduct(positioned, frame);
  });
  const base = fixed ? scene.baseProductRect : fitAnnotatedProduct(scene.baseProductRect, annotations.map((annotation, i) => ({
    annotation: annotationFromProduct(annotation, scene.baseProductRect), labelSize: scene.annotations[i].labelSize,
  })), scene.fitArea).productRect;
  const adjustment: SubjectAdjustment = {
    scale: scene.productRect.width / base.width,
    offsetX: scene.productRect.x - base.x,
    offsetY: scene.productRect.y - base.y,
    ...(fixed ? { dimensionFrame: frame } : {}),
  };
  const stored = storedAnnotations?.map((annotation) => annotations.find((item) => item.kind === annotation.kind)
    ?? annotationRelativeToProduct(annotationFromProduct(annotation, scene.adjustment?.dimensionFrame ?? scene.productRect), frame));
  return { annotations: stored ? [...stored, ...annotations.filter((annotation) => !stored.some((item) => item.kind === annotation.kind))] : annotations, adjustment };
}
