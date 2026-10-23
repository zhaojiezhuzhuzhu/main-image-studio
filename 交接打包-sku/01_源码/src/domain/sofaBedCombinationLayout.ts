import type { Rect } from './dimensionGeometry';
import type { SofaCombinationDraft } from '../storage/draftStorage';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';

// 单 SKU 卖点用专属字段，避免被公共存储识别成单品草稿。
export type SofaBedFeature = { enabled: boolean; text: string; x: number; y: number };
export const DEFAULT_SOFA_BED_FEATURE: SofaBedFeature = { enabled: false, text: '', x: 780, y: 530 };
export type SofaBedCombinationDraft = SofaCombinationDraft & { sofaBedSellingPoints?: string[]; sofaBedFeature?: SofaBedFeature };

export function getSofaBedFeatureBounds(feature: SofaBedFeature, textWidth: number, single: boolean): Rect {
  const width = Math.min(1300, textWidth + 100);
  return { x: Math.max(70, Math.min(1370 - width, feature.x)), y: Math.max(350, Math.min(single ? 1012 : 1160, feature.y)), width, height: 120 };
}

export function restoreSofaBedSellingPoints(draft: SofaBedCombinationDraft): string[] {
  const points = draft.sofaBedSellingPoints;
  return points?.length === 2 || points?.length === 3 ? [...points] : ['', '', ''];
}

export function sofaBedDimensionText(annotation: Pick<DimensionAnnotation, 'kind' | 'value'>, fields: DimensionFields): string {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`;
  return annotation.kind === 'height' ? text.replace('~', '~\n') : text;
}

export function parseSofaBedQuickDimensions(input: string): DimensionFields | null {
  const complete = parseDimensionFields(input, 'truncate');
  if (complete) return complete;
  const parts = input.trim() ? input.split(/[x×]/i) : ['', '', ''];
  if (parts.length !== 3) return null;
  const values = parts.map((part) => part.trim() ? parseDimensionText(part, 'truncate')?.text : '');
  if (values.some((value) => value === undefined)) return null;
  return { length: values[0]!, width: values[1]!, height: values[2]! };
}

export function sofaBedDimensionIssues(fields: DimensionFields, quickInput: string, owner: string): string[] {
  const issues: string[] = [];
  if (!parseSofaBedQuickDimensions(quickInput)) issues.push(`${owner}快速尺寸格式无效，请按长×宽×高填写`);
  for (const [kind, label] of [['length', '长'], ['width', '宽'], ['height', '高']] as const) {
    if (fields[kind].trim() && !parseDimensionText(fields[kind], 'truncate')) issues.push(`${owner}${label}尺寸无效，请填写正数、范围或并列规格`);
  }
  return issues;
}

/** 第 19 页：主图在左，可选规格纵向排列；型号、标签与备注位置固定。 */
export function getSofaBedCombinationLayout(count: number) {
  const itemCount = Math.max(0, Math.min(4, Math.floor(count)));
  const single = itemCount === 0;
  const groupHeight = Math.min(280, (816 - Math.max(0, itemCount - 1) * 50) / Math.max(1, itemCount));
  return {
    sideMargin: 70,
    modelBadge: { x: 70, y: 250, height: 78 },
    mainProductArea: { x: 70, y: 430, width: single ? 1300 : 990, height: single ? 680 : 790 } satisfies Rect,
    mainSubjectSafeArea: { x: 70, y: 350, width: single ? 1300 : 990, height: single ? 782 : 930 } satisfies Rect,
    mainMovementArea: { x: 70, y: 350, width: single ? 1300 : 990, height: single ? 782 : 930 } satisfies Rect,
    optionalLabel: { x: 1110, y: 378, width: 260, height: 56 },
    optionalLabelRightY: 378,
    optionalGroups: Array.from({ length: itemCount }, (_, index) => ({ x: 1110, y: 484 + index * (groupHeight + 50), width: 260, height: groupHeight })),
    note: { x: 70, y: 1340, width: 1300, height: 40 },
  };
}

/** 第 19 页右下单 SKU 样例；第 2 页允许两卖点，仍按既定 50px 字体绘制。 */
export function getSofaBedSellingPointLayout(textWidths: number[]) {
  const count = textWidths.length;
  const gap = 30;
  const available = 1300 - gap * Math.max(0, count - 1);
  const required = textWidths.map((width) => width + 48);
  const total = required.reduce((sum, width) => sum + width, 0);
  const widths = required.map((width) => total > available ? width / total * available : width + Math.min(52, (available - total) / count));
  let x = (1440 - widths.reduce((sum, width) => sum + width, 0) - gap * Math.max(0, count - 1)) / 2;
  return {
    issue: total > available ? '卖点总宽度超出安全区，请缩短文案' : null,
    boxes: widths.map((width) => { const box = { x, y: 1182, width, height: 98 }; x += width + gap; return box; }),
  };
}
