import type { Point } from './dimensionGeometry';
import type { DimensionKind, ExtensionOffsets } from './dimensionAnnotations';

export const DIMENSION_STYLE = {
  // SKU 模板和导出的固定颜色；编辑高亮由网页覆盖层单独绘制。
  color: '#545454',
  lineWidth: 2,
  arrowLength: 15,
  arrowHeight: 9,
  tipGap: 1,
  extensionDashLength: 6,
  extensionGapLength: 3,
  extensionDashCount: 5,
} as const;

export type DimensionStyle = { [Key in keyof typeof DIMENSION_STYLE]: Key extends 'color' ? string : number };

type Segment = { from: Point; to: Point };
type Arrow = { tip: Point; baseCenter: Point; corners: [Point, Point] };

const clean = (value: number) => {
  const rounded = Math.round(value * 1e10) / 1e10;
  return Math.abs(rounded) < 1e-10 ? 0 : rounded;
};

const point = (x: number, y: number): Point => ({ x: clean(x), y: clean(y) });

function arrow(tip: Point, direction: Point, style: DimensionStyle): Arrow {
  const baseCenter = point(
    tip.x - direction.x * style.arrowLength,
    tip.y - direction.y * style.arrowLength,
  );
  const perpendicular = { x: -direction.y, y: direction.x };
  const halfHeight = style.arrowHeight / 2;
  return {
    tip,
    baseCenter,
    corners: [
      point(baseCenter.x + perpendicular.x * halfHeight, baseCenter.y + perpendicular.y * halfHeight),
      point(baseCenter.x - perpendicular.x * halfHeight, baseCenter.y - perpendicular.y * halfHeight),
    ],
  };
}

function extensionDashes(endpoint: Point, perpendicular: Point, style: DimensionStyle, offset?: number): Segment[] {
  const totalLength = style.extensionDashLength * style.extensionDashCount
    + style.extensionGapLength * (style.extensionDashCount - 1);
  const half = totalLength / 2;
  const start = offset === undefined ? -half : offset < 0 ? offset : -half;
  const end = offset === undefined ? half : offset < 0 ? half : offset;
  const step = style.extensionDashLength + style.extensionGapLength;
  const segments: Segment[] = [];
  // 固定虚线相位，拖动时只在末端增减，不拉伸原有线段。
  for (let position = -half + Math.floor((start + half) / step) * step; position < end; position += step) {
    const dashStart = Math.max(start, position);
    const dashEnd = Math.min(end, position + style.extensionDashLength);
    if (dashEnd <= dashStart) continue;
    segments.push({
      from: point(endpoint.x + perpendicular.x * dashStart, endpoint.y + perpendicular.y * dashStart),
      to: point(endpoint.x + perpendicular.x * dashEnd, endpoint.y + perpendicular.y * dashEnd),
    });
  }
  return segments;
}

export function getDimensionStyleGeometry(from: Point, to: Point, kind: DimensionKind, style: DimensionStyle = DIMENSION_STYLE, offsets?: ExtensionOffsets) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = { x: dx / length, y: dy / length };
  const extensionDirection = (kind === 'height' || kind === 'secondaryHeight') ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const line = {
    from: point(from.x + direction.x * style.tipGap, from.y + direction.y * style.tipGap),
    to: point(to.x - direction.x * style.tipGap, to.y - direction.y * style.tipGap),
  };
  return {
    color: style.color,
    lineWidth: style.lineWidth,
    line,
    arrows: [
      arrow(line.from, { x: -direction.x, y: -direction.y }, style),
      arrow(line.to, direction, style),
    ] as [Arrow, Arrow],
    extensions: [
      extensionDashes(from, extensionDirection, style, offsets?.from),
      extensionDashes(to, extensionDirection, style, offsets?.to),
    ] as [Segment[], Segment[]],
  };
}
