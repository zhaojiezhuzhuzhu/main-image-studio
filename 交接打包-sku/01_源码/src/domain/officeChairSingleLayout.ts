import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { SingleTemplateOptions, TextMeasure } from '../templates/types';

export const OFFICE_CHAIR_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const OFFICE_CHAIR_MODEL_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const OFFICE_CHAIR_TEXT_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const OFFICE_CHAIR_MIN_GAP = 60;
export const OFFICE_CHAIR_MAX_GAP = 180;
export type OfficeChairOptions = Pick<SingleTemplateOptions, 'sellingPointCount' | 'dimensionGap'>;
export type OfficeChairDraft = WorkbenchDraft & { officeChair?: OfficeChairOptions };

export function normalizeOfficeChairOptions(value: unknown): SingleTemplateOptions {
  const saved = value && typeof value === 'object' ? value as Partial<OfficeChairOptions> : {};
  return {
    sizeLabels: ['', ''],
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap)
      ? Math.max(OFFICE_CHAIR_MIN_GAP, Math.min(OFFICE_CHAIR_MAX_GAP, saved.dimensionGap)) : OFFICE_CHAIR_MIN_GAP,
  };
}

export function getOfficeChairSingleLayout(pointWidths: number[], dimensionGap = OFFICE_CHAIR_MIN_GAP) {
  // 第46页参考图去除上、右各100px说明边后对应1440画布；下列坐标为图示推导。
  const side = 94, availableWidth = 1252, gap = 30, sellingY = 1210, borderHalf = 2;
  const equalWidth = (availableWidth - gap * (pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1) > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 50));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: sellingY, width, height: 98 }; x += width + gap; return box; });
  const bottom = sellingY - borderHalf - normalizeOfficeChairOptions({ dimensionGap }).dimensionGap;
  return {
    modelBadge: { x: side, y: 350, height: 72 },
    productArea: { x: 370, y: 470, width: 700, height: bottom - 520 },
    subjectSafeArea: { x: side, y: 452, width: availableWidth, height: bottom - 452 },
    sellingPoints,
    issue: total > availableWidth ? '卖点文案总宽度超出安全区，请调整文案' : null,
  };
}

export function officeChairModelBadge(context: TextMeasure, model: string) {
  const text = model.trim() || '产品型号及完整规格';
  context.font = canvasFontFromPs(45, OFFICE_CHAIR_MODEL_FONT);
  const fontSize = context.measureText(text).width + 48 > 700 ? 35 : 45;
  context.font = canvasFontFromPs(fontSize, OFFICE_CHAIR_MODEL_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize, box: { x: 94, y: 350, width, height: 72 }, issue: width > 1252 ? '型号及完整规格过长，请核对内容，不能省略规格' : null };
}

function parseOfficeChairDimension(value: string) {
  const parsed = parseDimensionText(value, 'truncate');
  return parsed && !/[~/]/.test(parsed.text) ? parsed : null;
}

export function parseOfficeChairDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate');
  return fields && OFFICE_CHAIR_DIMENSION_KINDS.every((kind) => parseOfficeChairDimension(fields[kind] ?? '')) ? fields : null;
}

export function officeChairDimensionIssue(fields: DimensionFields): string | null {
  const names = { length: '总长', width: '总宽', height: '总高' };
  for (const kind of ['length', 'width', 'height'] as const) {
    if (!fields[kind].trim()) return `请填写${names[kind]}尺寸`;
    if (!parseOfficeChairDimension(fields[kind])) return `${names[kind]}尺寸无效，请填写单个正数（cm）`;
  }
  return null;
}

export function officeChairDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields) {
  const value = parseOfficeChairDimension(fields[annotation.kind] ?? String(annotation.value))?.text ?? String(annotation.value);
  const name = annotation.kind === 'height' ? '总高' : annotation.kind === 'width' ? '总宽' : '总长';
  const lines = annotation.kind === 'height' ? [name, `${value}cm`] : [`${name}${value}cm`];
  const font = canvasFontFromPs(45, OFFICE_CHAIR_TEXT_FONT);
  context.font = font;
  // PPT的40pt字行距按基线间距处理，不额外叠加45pt字号。
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: lines.length === 2 ? 85 : 45,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}
