import { parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';

export function parseFunctionalSofaCombinationDimensions(input: string): DimensionFields | null {
  const parts = input.trim() ? input.split(/[x×]/i) : ['', '', ''];
  if (parts.length !== 3) return null;
  const parsed = parts.map((text) => text.trim() ? parseDimensionText(text, 'truncate')?.text : '');
  if (parsed.some((text) => text === undefined || text.split('/').length > 3 || text.split('/').some((part) => part.split('~').length > 2))) return null;
  return { length: parsed[0]!, width: parsed[1]!, height: parsed[2]! };
}
export function functionalSofaCombinationText(annotation: Pick<DimensionAnnotation, 'kind' | 'value'>, fields: DimensionFields) {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`;
  return annotation.kind === 'height' ? text.replace('~', '~\n') : text;
}
export function getFunctionalSofaCombinationLayout(count: number) {
  const itemCount = Math.max(0, Math.min(4, Math.floor(count))), margin = 70;
  const makeRow = (n: number, y: number, height: number): Rect[] => Array.from({ length: n }, (_, i) => ({ x: margin + i * (1300 / Math.max(n, 1)), y, width: 1300 / Math.max(n, 1) - 50, height }));
  return { sideMargin: margin, modelBadge: { x: 70, y: 250, height: 78 },
    mainProductArea: { x: 120, y: 445, width: 1120, height: 430 },
    mainSubjectSafeArea: { x: 70, y: 350, width: 1300, height: itemCount === 4 ? 520 : 600 },
    mainMovementArea: { x: 70, y: 350, width: 1300, height: 960 },
    optionalLabel: { x: 70, y: itemCount === 4 ? 900 : 980, width: 300, height: 56 }, optionalLabelRightY: 900,
    optionalGroups: itemCount === 4 ? [{ x: 900, y: 870, width: 400, height: 150 }, ...makeRow(3, 1080, 230)] : makeRow(itemCount, 1080, 230),
    note: { x: 70, y: 1340, width: 1300, height: 40 } };
}
export function constrainFunctionalSofaLabel(count: number, _kind: unknown, side: 'left' | 'right', offset: number) {
  const layout = getFunctionalSofaCombinationLayout(count), base = side === 'right' ? layout.optionalLabelRightY : layout.optionalLabel.y;
  const nextTop = count === 4 && side === 'right' ? 870 : 1080;
  return Math.max(600 - base, Math.min(nextTop - layout.optionalLabel.height - 20 - base, offset));
}
