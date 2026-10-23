import type { Dimensions } from './dimensions';
import type { Point } from './dimensionGeometry';

export type DimensionKind = 'length' | 'width' | 'height' | 'headWidth' | 'footWidth' | 'diameter' | 'secondaryLength' | 'secondaryWidth' | 'secondaryHeight';
export type DimensionTask = { kind: DimensionKind; value: number; label: '长' | '宽' | '高' | '床头宽' | '床尾宽' | '直径' | '副柜长' | '副柜宽' | '副柜高' };
// 辅助线沿既有方向的有符号长度；保存时与端点一样使用产品相对坐标。
export type ExtensionOffsets = Partial<Record<'from' | 'to', number>>;
// 文字偏移以成品画布像素保存；存在时编辑线条会补偿偏移以固定文字，不参与产品自动排版。
export type DimensionLabelAdjustment = { labelOffset?: Point; labelColor?: 'dark' | 'white' };
export type DimensionAnnotation = DimensionTask & DimensionLabelAdjustment & { from: Point; to: Point; extensionOffsets?: ExtensionOffsets };

export function scaleExtensionOffsets(offsets: ExtensionOffsets | undefined, scale: number) {
  if (!offsets) return undefined;
  return Object.fromEntries(Object.entries(offsets).map(([key, value]) => [key, value * scale])) as ExtensionOffsets;
}

const ORDER: Array<Pick<DimensionTask, 'kind' | 'label'>> = [
  { kind: 'length', label: '长' },
  { kind: 'width', label: '宽' },
  { kind: 'height', label: '高' },
  { kind: 'headWidth', label: '床头宽' },
  { kind: 'footWidth', label: '床尾宽' },
  { kind: 'diameter', label: '直径' },
  { kind: 'secondaryLength', label: '副柜长' },
  { kind: 'secondaryWidth', label: '副柜宽' },
  { kind: 'secondaryHeight', label: '副柜高' },
];

export function dimensionTask(dimensions: Partial<Dimensions>, kind: DimensionKind): DimensionTask | null {
  const item = ORDER.find((candidate) => candidate.kind === kind);
  const value = dimensions[kind];
  return item && value !== undefined ? { ...item, value } : null;
}

export function nextDimension(dimensions: Partial<Dimensions>, annotations: DimensionAnnotation[]): DimensionTask | null {
  const item = ORDER.find((candidate) => dimensions[candidate.kind] !== undefined
    && !annotations.some((annotation) => annotation.kind === candidate.kind));
  return item ? { ...item, value: dimensions[item.kind]! } : null;
}

export function completeDimension(
  annotations: DimensionAnnotation[],
  dimensions: Partial<Dimensions>,
  from: Point,
  to: Point,
  requestedKind?: DimensionKind,
): DimensionAnnotation[] {
  const next = requestedKind ? dimensionTask(dimensions, requestedKind) : nextDimension(dimensions, annotations);
  if (!next) return annotations;
  const completed = { ...next, from, to };
  const existingIndex = annotations.findIndex((annotation) => annotation.kind === next.kind);
  return existingIndex < 0
    ? [...annotations, completed]
    : annotations.map((annotation, index) => index === existingIndex ? completed : annotation);
}

export function updateAnnotationValues(
  annotations: DimensionAnnotation[],
  dimensions: Partial<Dimensions>,
): DimensionAnnotation[] {
  return annotations.map((annotation) => {
    const value = dimensions[annotation.kind];
    return value === undefined ? annotation : { ...annotation, value };
  });
}
