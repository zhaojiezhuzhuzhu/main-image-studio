import { adjustAnnotatedProduct, previewAnnotatedProduct, fitAnnotatedProduct, annotationFromProduct, type MeasuredDimensionAnnotation, type SubjectAdjustment } from './annotatedProductFit';
import type { ProductImage } from '../project/productImage';
import type { SingleAccessorySlot, TextMeasure } from '../templates/types';
import type { Point, Rect } from './dimensionGeometry';

export type SingleAccessory = { id: string; image?: ProductImage; adjustment: SubjectAdjustment };
export type AccessoryPreview = { id: string; adjustment: SubjectAdjustment };
export const DEFAULT_ACCESSORY_ADJUSTMENT: SubjectAdjustment = { scale: 1, offsetX: 0, offsetY: 0 };

export function adjustAccessoryProduct(base: Rect, slot: SingleAccessorySlot, requested: SubjectAdjustment, annotations: MeasuredDimensionAnnotation[] = []) {
  if (slot.fit !== 'cover') return adjustAnnotatedProduct(base, annotations, slot.area, requested);
  const scale = Math.max(1, Math.min(5, Number.isFinite(requested.scale) ? requested.scale : 1));
  const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : 0));
  const adjustment = { scale,
    offsetX: clamp(requested.offsetX, slot.area.x + slot.area.width - base.width * scale - base.x, slot.area.x - base.x),
    offsetY: clamp(requested.offsetY, slot.area.y + slot.area.height - base.height * scale - base.y, slot.area.y - base.y) };
  return previewAnnotatedProduct(base, [], adjustment);
}

export function pointInAccessoryClip(point: Point, slot: SingleAccessorySlot) {
  if (slot.fit !== 'cover' && slot.clipRadius === undefined) return true;
  const { x, y, width, height } = slot.area;
  if (point.x < x || point.x > x + width || point.y < y || point.y > y + height) return false;
  const radius = Math.min(slot.clipRadius ?? 0, width / 2, height / 2);
  const centerX = Math.max(x + radius, Math.min(x + width - radius, point.x));
  const centerY = Math.max(y + radius, Math.min(y + height - radius, point.y));
  return Math.hypot(point.x - centerX, point.y - centerY) <= radius;
}

export function getAccessoryScenes(slots: SingleAccessorySlot[], items: SingleAccessory[], preview?: AccessoryPreview, context?: TextMeasure | null) {
  return slots.flatMap((slot) => {
    const item = items.find((candidate) => candidate.id === slot.id);
    if (!item?.image) return [];
    const source = item.image.visible, area = slot.area;
    const scale = (slot.fit === 'cover' ? Math.max : Math.min)(area.width / source.width, area.height / source.height);
    const width = source.width * scale, height = source.height * scale;
    const sourceBase = { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
    const measured = context && slot.dimensions ? slot.dimensions.annotations.map((annotation) => ({ annotation: annotationFromProduct(annotation, item.adjustment.dimensionFrame ?? sourceBase), labelSize: slot.dimensions!.label(context, annotation) })) : [];
    const fitted = measured.length ? fitAnnotatedProduct(sourceBase, measured, area, item.adjustment.dimensionFrame) : { productRect: sourceBase, annotations: [] };
    const base = fitted.productRect, baseAnnotations = fitted.annotations.map((annotation, i) => ({ annotation, labelSize: measured[i].labelSize }));
    const adjusted = preview?.id === slot.id ? previewAnnotatedProduct(base, baseAnnotations, preview.adjustment) : adjustAccessoryProduct(base, slot, item.adjustment, baseAnnotations);
    return [{ ...slot, image: item.image, sourceBase, base, baseAnnotations, ...adjusted }];
  });
}

export function drawAccessoryScenes(context: CanvasRenderingContext2D, scenes: ReturnType<typeof getAccessoryScenes>) {
  for (const { image, productRect, area, fit, clipRadius } of scenes) {
    const source = image.visible;
    const clipped = fit === 'cover' || clipRadius !== undefined;
    if (clipped) { context.save(); context.beginPath(); context.roundRect(area.x, area.y, area.width, area.height, clipRadius ?? 0); context.clip(); }
    context.drawImage(image.element, source.x, source.y, source.width, source.height, productRect.x, productRect.y, productRect.width, productRect.height);
    if (clipped) context.restore();
  }
}
