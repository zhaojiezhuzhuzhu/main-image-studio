import { scaleExtensionOffsets, type DimensionAnnotation } from './dimensionAnnotations';
import { getDimensionGeometry, dimensionLabelBounds, type DimensionLabelSize, type Point, type Rect } from './dimensionGeometry';
import { DIMENSION_STYLE, getDimensionStyleGeometry } from './dimensionStyle';

export type MeasuredDimensionAnnotation = {
  annotation: DimensionAnnotation;
  labelSize: DimensionLabelSize;
};

type Transform = { scale: number; offsetX: number; offsetY: number };
export type SubjectAdjustment = { scale: number; offsetX: number; offsetY: number; dimensionFrame?: Rect };
export type ProductSilhouette = Array<{ top: number; bottom: number; left: number; right: number }>;

const ARROW_AND_STROKE_PADDING = (
  DIMENSION_STYLE.extensionDashLength * DIMENSION_STYLE.extensionDashCount
  + DIMENSION_STYLE.extensionGapLength * (DIMENSION_STYLE.extensionDashCount - 1)
) / 2 + DIMENSION_STYLE.lineWidth / 2;

export function silhouetteFromAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  visible: Rect,
  bandCount = 32,
): ProductSilhouette {
  if (visible.width <= 0 || visible.height <= 0) return [];
  const bands = Math.max(1, Math.min(bandCount, Math.ceil(visible.height)));
  const bandHeight = visible.height / bands;
  const result: ProductSilhouette = [];
  for (let band = 0; band < bands; band += 1) {
    const startY = Math.max(0, Math.floor(visible.y + band * bandHeight));
    const endY = Math.min(height, Math.ceil(visible.y + (band + 1) * bandHeight));
    let minimumX = width;
    let maximumX = -1;
    for (let y = startY; y < endY; y += 1) {
      for (let x = Math.max(0, Math.floor(visible.x)); x < Math.min(width, Math.ceil(visible.x + visible.width)); x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 8) {
          minimumX = Math.min(minimumX, x);
          maximumX = Math.max(maximumX, x);
        }
      }
    }
    if (maximumX >= minimumX) result.push({
      top: (startY - visible.y) / visible.height,
      bottom: (endY - visible.y) / visible.height,
      left: (minimumX - visible.x) / visible.width,
      right: (maximumX + 1 - visible.x) / visible.width,
    });
  }
  return result;
}

function silhouetteRects(silhouette: ProductSilhouette | undefined, product: Rect): Rect[] {
  if (!silhouette?.length) return [product];
  return silhouette.map((band) => ({
    x: product.x + band.left * product.width,
    y: product.y + band.top * product.height,
    width: (band.right - band.left) * product.width,
    height: (band.bottom - band.top) * product.height,
  }));
}

function segmentRects(from: Point, to: Point, padding = 4): Rect[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const count = Math.max(1, Math.ceil(length / 28));
  return Array.from({ length: count }, (_, index) => {
    const start = index / count;
    const end = (index + 1) / count;
    const x1 = from.x + (to.x - from.x) * start;
    const y1 = from.y + (to.y - from.y) * start;
    const x2 = from.x + (to.x - from.x) * end;
    const y2 = from.y + (to.y - from.y) * end;
    return {
      x: Math.min(x1, x2) - padding,
      y: Math.min(y1, y2) - padding,
      width: Math.abs(x2 - x1) + padding * 2,
      height: Math.abs(y2 - y1) + padding * 2,
    };
  });
}

export function annotationCollisionRects(item: MeasuredDimensionAnnotation, product: Rect): Rect[] {
  const { annotation, labelSize } = item;
  const bounds = dimensionLabelBounds(annotation.from, annotation.to, labelSize);
  const geometry = getDimensionGeometry(annotation.from, annotation.to, `${annotation.value}cm`, product, labelSize);
  const style = getDimensionStyleGeometry(annotation.from, annotation.to, annotation.kind, undefined, annotation.extensionOffsets);
  const rectangles: Rect[] = [
    { x: geometry.label.x - bounds.width / 2, y: geometry.label.y - bounds.height / 2, width: bounds.width, height: bounds.height },
    ...segmentRects(style.line.from, style.line.to),
    ...style.extensions.flatMap((segments) => segments.flatMap((segment) => segmentRects(segment.from, segment.to))),
  ];
  style.arrows.forEach((arrow) => {
    const points = [arrow.tip, ...arrow.corners];
    const left = Math.min(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const right = Math.max(...points.map((point) => point.x));
    const bottom = Math.max(...points.map((point) => point.y));
    rectangles.push({ x: left, y: top, width: right - left, height: bottom - top });
  });
  return rectangles;
}

export function annotatedProductCollisionRects(
  product: Rect,
  annotations: MeasuredDimensionAnnotation[],
  silhouette?: ProductSilhouette,
): Rect[] {
  return [
    ...silhouetteRects(silhouette, product),
    ...annotations.flatMap((item) => annotationCollisionRects(item, product)),
  ];
}

export function pointHitsProductSilhouette(point: Point, product: Rect, silhouette?: ProductSilhouette): boolean {
  if (point.x < product.x || point.x > product.x + product.width || point.y < product.y || point.y > product.y + product.height) return false;
  if (!silhouette?.length) return true;
  const relativeX = (point.x - product.x) / product.width;
  const relativeY = (point.y - product.y) / product.height;
  return silhouette.some((band) => relativeY >= band.top && relativeY <= band.bottom
    && relativeX >= band.left && relativeX <= band.right);
}

export function pointRelativeToProduct(point: Point, product: Rect): Point {
  return {
    x: (point.x - product.x) / product.width,
    y: (point.y - product.y) / product.height,
  };
}

export function pointFromProduct(point: Point, product: Rect): Point {
  return {
    x: product.x + point.x * product.width,
    y: product.y + point.y * product.height,
  };
}

export function transformPoint(point: Point, transform: Transform): Point {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

export function annotationFromProduct(annotation: DimensionAnnotation, product: Rect): DimensionAnnotation {
  return { ...annotation, from: pointFromProduct(annotation.from, product), to: pointFromProduct(annotation.to, product),
    ...(annotation.extensionOffsets && { extensionOffsets: scaleExtensionOffsets(annotation.extensionOffsets, annotation.kind === 'height' ? product.width : product.height) }) };
}

export function annotationRelativeToProduct(annotation: DimensionAnnotation, product: Rect): DimensionAnnotation {
  return { ...annotation, from: pointRelativeToProduct(annotation.from, product), to: pointRelativeToProduct(annotation.to, product),
    ...(annotation.extensionOffsets && { extensionOffsets: scaleExtensionOffsets(annotation.extensionOffsets, 1 / (annotation.kind === 'height' ? product.width : product.height)) }) };
}

function transformAnnotation(annotation: DimensionAnnotation, transform: Transform): DimensionAnnotation {
  return {
    ...annotation,
    from: transformPoint(annotation.from, transform),
    to: transformPoint(annotation.to, transform),
    ...(annotation.extensionOffsets && { extensionOffsets: scaleExtensionOffsets(annotation.extensionOffsets, transform.scale) }),
  };
}

function unionBounds(rectangles: Rect[]): Rect {
  const left = Math.min(...rectangles.map((rect) => rect.x));
  const top = Math.min(...rectangles.map((rect) => rect.y));
  const right = Math.max(...rectangles.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function visualBounds(product: Rect, annotations: MeasuredDimensionAnnotation[]): Rect {
  const rectangles: Rect[] = [product];
  annotations.forEach(({ annotation, labelSize }) => {
    const bounds = dimensionLabelBounds(annotation.from, annotation.to, labelSize);
    const geometry = getDimensionGeometry(
      annotation.from,
      annotation.to,
      `${annotation.value}cm`,
      product,
      labelSize,
    );
    const left = Math.min(annotation.from.x, annotation.to.x) - ARROW_AND_STROKE_PADDING;
    const top = Math.min(annotation.from.y, annotation.to.y) - ARROW_AND_STROKE_PADDING;
    const right = Math.max(annotation.from.x, annotation.to.x) + ARROW_AND_STROKE_PADDING;
    const bottom = Math.max(annotation.from.y, annotation.to.y) + ARROW_AND_STROKE_PADDING;
    rectangles.push({ x: left, y: top, width: right - left, height: bottom - top });
    if (annotation.extensionOffsets) {
      const style = getDimensionStyleGeometry(annotation.from, annotation.to, annotation.kind, undefined, annotation.extensionOffsets);
      rectangles.push(...style.extensions.flatMap((segments) => segments.flatMap((segment) => segmentRects(segment.from, segment.to))));
    }
    rectangles.push({
      x: geometry.label.x - bounds.width / 2,
      y: geometry.label.y - bounds.height / 2,
      width: bounds.width,
      height: bounds.height,
    });
  });
  return unionBounds(rectangles);
}

function scaledGeometry(
  product: Rect,
  annotations: MeasuredDimensionAnnotation[],
  scale: number,
): { productRect: Rect; measured: MeasuredDimensionAnnotation[]; bounds: Rect } {
  const transform = {
    scale,
    offsetX: -product.x * scale,
    offsetY: -product.y * scale,
  };
  const productRect = { x: 0, y: 0, width: product.width * scale, height: product.height * scale };
  const measured = annotations.map((item) => ({
    ...item,
    annotation: transformAnnotation(item.annotation, transform),
  }));
  return { productRect, measured, bounds: visualBounds(productRect, measured) };
}

function adjustedGeometry(
  product: Rect,
  annotations: MeasuredDimensionAnnotation[],
  adjustment: SubjectAdjustment,
) {
  const transform = {
    scale: adjustment.scale,
    offsetX: product.x + adjustment.offsetX - product.x * adjustment.scale,
    offsetY: product.y + adjustment.offsetY - product.y * adjustment.scale,
  };
  const productRect = {
    x: product.x + adjustment.offsetX,
    y: product.y + adjustment.offsetY,
    width: product.width * adjustment.scale,
    height: product.height * adjustment.scale,
  };
  const measured = annotations.map((item) => ({
    ...item,
    annotation: transformAnnotation(item.annotation, transform),
  }));
  return { productRect, measured, bounds: visualBounds(productRect, measured) };
}

export function previewAnnotatedProduct(product: Rect, annotations: MeasuredDimensionAnnotation[], requested: SubjectAdjustment) {
  if (requested.dimensionFrame) {
    const geometry = adjustedGeometry(product, [], requested);
    return { adjustment: requested, productRect: geometry.productRect, annotations: annotations.map(({ annotation }) => annotation),
      bounds: unionBounds([geometry.productRect, visualBounds(requested.dimensionFrame, annotations)]) };
  }
  const geometry = adjustedGeometry(product, annotations, requested);
  return { adjustment: requested, productRect: geometry.productRect, annotations: geometry.measured.map(({ annotation }) => annotation), bounds: geometry.bounds };
}

export function adjustAnnotatedProduct(
  product: Rect,
  annotations: MeasuredDimensionAnnotation[],
  safeArea: Rect,
  requested: SubjectAdjustment,
): ReturnType<typeof previewAnnotatedProduct> {
  if (requested.dimensionFrame) {
    const { dimensionFrame, ...placement } = requested;
    const result = adjustAnnotatedProduct(product, [], safeArea, placement);
    return previewAnnotatedProduct(product, annotations, { ...result.adjustment, dimensionFrame });
  }
  const requestedScale = Number.isFinite(requested.scale) && requested.scale > 0 ? requested.scale : 1;
  const fitsAtScale = (scale: number) => {
    const bounds = adjustedGeometry(product, annotations, { scale, offsetX: 0, offsetY: 0 }).bounds;
    return bounds.width <= safeArea.width && bounds.height <= safeArea.height;
  };

  let scale = requestedScale;
  if (!fitsAtScale(scale)) {
    let low = 0;
    let high = scale;
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const candidate = (low + high) / 2;
      if (fitsAtScale(candidate)) low = candidate;
      else high = candidate;
    }
    scale = low;
  }

  const initial = adjustedGeometry(product, annotations, {
    scale,
    offsetX: requested.offsetX,
    offsetY: requested.offsetY,
  });
  let correctionX = 0;
  let correctionY = 0;
  if (initial.bounds.x < safeArea.x) correctionX = safeArea.x - initial.bounds.x;
  else if (initial.bounds.x + initial.bounds.width > safeArea.x + safeArea.width) {
    correctionX = safeArea.x + safeArea.width - initial.bounds.x - initial.bounds.width;
  }
  if (initial.bounds.y < safeArea.y) correctionY = safeArea.y - initial.bounds.y;
  else if (initial.bounds.y + initial.bounds.height > safeArea.y + safeArea.height) {
    correctionY = safeArea.y + safeArea.height - initial.bounds.y - initial.bounds.height;
  }

  const adjustment = {
    scale,
    offsetX: requested.offsetX + correctionX,
    offsetY: requested.offsetY + correctionY,
  };
  const adjusted = adjustedGeometry(product, annotations, adjustment);
  return {
    adjustment,
    productRect: adjusted.productRect,
    annotations: adjusted.measured.map(({ annotation }) => annotation),
    bounds: adjusted.bounds,
  };
}

function expandedRect(rect: Rect, gap: number): Rect {
  return { x: rect.x - gap, y: rect.y - gap, width: rect.width + gap * 2, height: rect.height + gap * 2 };
}

function overlaps(left: Rect, right: Rect): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

export function adjustAnnotatedProductAroundObstacles(
  product: Rect,
  annotations: MeasuredDimensionAnnotation[],
  safeArea: Rect,
  obstacles: Rect[],
  minimumGap: number,
  requested: SubjectAdjustment,
  silhouette?: ProductSilhouette,
): ReturnType<typeof previewAnnotatedProduct> & { constrained: boolean } {
  if (requested.dimensionFrame) {
    const { dimensionFrame, ...placement } = requested;
    const result = adjustAnnotatedProductAroundObstacles(product, [], safeArea, obstacles, minimumGap, placement, silhouette);
    return { ...previewAnnotatedProduct(product, annotations, { ...result.adjustment, dimensionFrame }), constrained: result.constrained };
  }
  const requestedScale = Number.isFinite(requested.scale) && requested.scale > 0 ? requested.scale : 1;
  const expandedObstacles = obstacles.map((obstacle) => expandedRect(obstacle, minimumGap));

  const placementAtScale = (scale: number): SubjectAdjustment | null => {
    const zero = adjustedGeometry(product, annotations, { scale, offsetX: 0, offsetY: 0 });
    const minimumX = safeArea.x - zero.bounds.x;
    const maximumX = safeArea.x + safeArea.width - zero.bounds.x - zero.bounds.width;
    const minimumY = safeArea.y - zero.bounds.y;
    const maximumY = safeArea.y + safeArea.height - zero.bounds.y - zero.bounds.height;
    if (minimumX > maximumX || minimumY > maximumY) return null;

    const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
    const desiredX = clamp(requested.offsetX, minimumX, maximumX);
    const desiredY = clamp(requested.offsetY, minimumY, maximumY);
    const xCandidates = new Set<number>([desiredX, minimumX, maximumX]);
    const yCandidates = new Set<number>([desiredY, minimumY, maximumY]);
    const zeroCollisionRects = annotatedProductCollisionRects(zero.productRect, zero.measured, silhouette);
    zeroCollisionRects.forEach((component) => {
      const desiredComponent = { ...component, x: component.x + desiredX, y: component.y + desiredY };
      expandedObstacles.forEach((obstacle) => {
        if (!overlaps(desiredComponent, obstacle)) return;
        xCandidates.add(clamp(obstacle.x - component.width - component.x, minimumX, maximumX));
        xCandidates.add(clamp(obstacle.x + obstacle.width - component.x, minimumX, maximumX));
        yCandidates.add(clamp(obstacle.y - component.height - component.y, minimumY, maximumY));
        yCandidates.add(clamp(obstacle.y + obstacle.height - component.y, minimumY, maximumY));
      });
    });

    let best: { adjustment: SubjectAdjustment; distance: number } | null = null;
    for (const offsetX of xCandidates) {
      for (const offsetY of yCandidates) {
        const geometry = adjustedGeometry(product, annotations, { scale, offsetX, offsetY });
        const collisionRects = annotatedProductCollisionRects(geometry.productRect, geometry.measured, silhouette);
        if (collisionRects.some((component) => expandedObstacles.some((obstacle) => overlaps(component, obstacle)))) continue;
        const distance = (offsetX - requested.offsetX) ** 2 + (offsetY - requested.offsetY) ** 2;
        if (!best || distance < best.distance) best = { adjustment: { scale, offsetX, offsetY }, distance };
      }
    }
    return best?.adjustment ?? null;
  };

  let adjustment = placementAtScale(requestedScale);
  if (!adjustment) {
    let low = 0;
    let high = requestedScale;
    let best = placementAtScale(0.0001);
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const candidateScale = (low + high) / 2;
      const candidate = placementAtScale(candidateScale);
      if (candidate) { low = candidateScale; best = candidate; }
      else high = candidateScale;
    }
    adjustment = best ?? { scale: 0.0001, offsetX: 0, offsetY: 0 };
  }

  const adjusted = adjustedGeometry(product, annotations, adjustment);
  return {
    adjustment,
    productRect: adjusted.productRect,
    annotations: adjusted.measured.map(({ annotation }) => annotation),
    bounds: adjusted.bounds,
    constrained: adjustment.scale < requestedScale - 0.0001
      || Math.abs(adjustment.offsetX - requested.offsetX) > 0.01
      || Math.abs(adjustment.offsetY - requested.offsetY) > 0.01,
  };
}

export function fitAnnotatedProduct(product: Rect, annotations: MeasuredDimensionAnnotation[], safeArea: Rect, dimensionFrame?: Rect) {
  if (dimensionFrame) return { scale: 1, productRect: product, annotations: annotations.map(({ annotation }) => annotation),
    bounds: unionBounds([product, visualBounds(dimensionFrame, annotations)]), transform: { scale: 1, offsetX: 0, offsetY: 0 } };
  if (annotations.length === 0) {
    return {
      scale: 1,
      productRect: product,
      annotations: [] as DimensionAnnotation[],
      bounds: product,
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
    };
  }

  const fits = (scale: number) => {
    const bounds = scaledGeometry(product, annotations, scale).bounds;
    return bounds.width <= safeArea.width && bounds.height <= safeArea.height;
  };

  let scale = 1;
  if (!fits(scale)) {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const candidate = (low + high) / 2;
      if (fits(candidate)) low = candidate;
      else high = candidate;
    }
    scale = low;
  }

  const scaled = scaledGeometry(product, annotations, scale);
  const offsetX = safeArea.x + (safeArea.width - scaled.bounds.width) / 2 - scaled.bounds.x;
  const offsetY = safeArea.y + (safeArea.height - scaled.bounds.height) / 2 - scaled.bounds.y;
  const translation = { scale: 1, offsetX, offsetY };
  const productRect = {
    ...transformPoint({ x: scaled.productRect.x, y: scaled.productRect.y }, translation),
    width: scaled.productRect.width,
    height: scaled.productRect.height,
  };
  const fittedAnnotations = scaled.measured.map(({ annotation }) => transformAnnotation(annotation, translation));
  const bounds = { ...scaled.bounds, x: scaled.bounds.x + offsetX, y: scaled.bounds.y + offsetY };

  return {
    scale,
    productRect,
    annotations: fittedAnnotations,
    bounds,
    transform: {
      scale,
      offsetX: offsetX - product.x * scale,
      offsetY: offsetY - product.y * scale,
    },
  };
}
