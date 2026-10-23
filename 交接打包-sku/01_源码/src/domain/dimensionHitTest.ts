import type { DimensionKind } from './dimensionAnnotations';
import type { Point, Rect } from './dimensionGeometry';

export type DimensionHitTarget = {
  ownerId: string;
  kind: DimensionKind;
  from: Point;
  to: Point;
  extensions?: { from: Point; to: Point };
  label: Rect;
  labelColor?: string;
};

export function hitTestDimension(point: Point, targets: DimensionHitTarget[], tolerance: number) {
  const reversed = [...targets].reverse();
  const label = reversed.find((target) => point.x >= target.label.x - tolerance
    && point.x <= target.label.x + target.label.width + tolerance
    && point.y >= target.label.y - tolerance && point.y <= target.label.y + target.label.height + tolerance);
  if (label) return { ...label, part: 'label' as const };
  const line = reversed.find(({ from, to }) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared)) : 0;
    return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy) <= tolerance;
  });
  return line ? { ...line, part: 'line' as const } : undefined;
}
