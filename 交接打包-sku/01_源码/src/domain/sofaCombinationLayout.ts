import type { Rect } from './dimensionGeometry';

export type SofaCombinationKind = 'standard' | 'functional';

const CANVAS_SIZE = 1440;
const OPTIONAL_GAP = 50;

export function getSofaCombinationLayout(count: number, kind: SofaCombinationKind) {
  const itemCount = Math.max(0, Math.min(4, Math.floor(count)));
  const sideMargin = kind === 'functional' ? 120 : 130;
  const makeRow = (rowCount: number, y: number, height: number): Rect[] => {
    if (!rowCount) return [];
    const availableWidth = CANVAS_SIZE - sideMargin * 2 - OPTIONAL_GAP * Math.max(0, rowCount - 1);
    const width = rowCount === 1 ? Math.min(380, availableWidth) : availableWidth / rowCount;
    const startX = rowCount === 1 ? (CANVAS_SIZE - width) / 2 : sideMargin;
    return Array.from({ length: rowCount }, (_, index) => ({ x: startX + index * (width + OPTIONAL_GAP), y, width, height }));
  };
  const optionalGroups: Rect[] = itemCount === 4
    ? [
      { x: CANVAS_SIZE - sideMargin - 480, y: 780, width: 480, height: 190 },
      ...makeRow(3, 1020, 250),
    ]
    : makeRow(itemCount, 993, 277);

  return {
    sideMargin,
    modelBadge: { x: 70, y: 270, height: 78 },
    mainProductArea: { x: 70, y: 390, width: 1300, height: 380 } satisfies Rect,
    mainSubjectSafeArea: { x: 70, y: 360, width: 1300, height: 430 } satisfies Rect,
    mainMovementArea: { x: 70, y: 250, width: 1300, height: 1020 } satisfies Rect,
    optionalLabel: { x: sideMargin, y: itemCount === 4 ? 902 : 875, width: 300, height: 68 },
    optionalLabelRightY: itemCount === 4 ? 662 : 875,
    optionalGroups,
    note: { x: sideMargin, y: 1310, width: CANVAS_SIZE - sideMargin * 2, height: 40 },
  };
}

export function constrainOptionalLabelOffset(count: number, kind: SofaCombinationKind, side: 'left' | 'right', offset: number): number {
  const layout = getSofaCombinationLayout(count, kind);
  const baseY = side === 'right' ? layout.optionalLabelRightY : layout.optionalLabel.y;
  const nearestOptionalTop = count === 4
    ? layout.optionalGroups[side === 'right' ? 0 : 1].y
    : layout.optionalGroups[0]?.y ?? layout.note.y;
  const minimumOffset = 600 - baseY;
  const maximumOffset = nearestOptionalTop - layout.optionalLabel.height - 20 - baseY;
  return Math.max(minimumOffset, Math.min(maximumOffset, offset));
}
