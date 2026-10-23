import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';

export const SOFT_BED_DIMENSION_KINDS = ['length', 'headWidth', 'footWidth', 'height'] satisfies DimensionKind[];
export const SOFT_BED_FONT_FAMILY = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export type SoftBedOptions = { sizeLabels: [string, string]; sellingPointCount: 2 | 3; dimensionGap: number };
export const DEFAULT_SOFT_BED_OPTIONS: SoftBedOptions = { sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60 };

export function formatSoftBedModel(model: string) {
  const text = model.trim();
  return text ? /床$/.test(text) ? text : `${text}床` : '产品型号床';
}

export function parseSoftBedDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((part) => parseDimensionText(part, 'truncate'));
  if (parts.length !== 4 || parts.some((part) => !part)) return null;
  return { length: parts[0]!.text, headWidth: parts[1]!.text, footWidth: parts[2]!.text, height: parts[3]!.text, width: '' };
}

export function formatSoftBedDimensions(fields: DimensionFields) {
  return SOFT_BED_DIMENSION_KINDS.map((kind) => fields[kind] ?? '').join('×');
}

export function getSoftBedSingleLayout(pointWidths: number[], dimensionGap = 60) {
  const gap = 30, height = 98, safeWidth = 1380;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1) > safeWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 50));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1262, width, height }; x += width + gap; return box; });
  const bottom = 1262 - Math.max(25, Math.min(60, dimensionGap));
  return {
    modelBadge: { x: 1020, y: 450, height: 72 },
    productArea: { x: 165, y: 565, width: 1110, height: bottom - 620 },
    subjectSafeArea: { x: 30, y: 540, width: safeWidth, height: bottom - 540 },
    sellingPoints,
    issue: total > safeWidth ? '卖点总宽度超出安全区，请调整文案，排骨架名称须保留完整' : null,
  };
}

export function softBedModelBadge(context: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>, model: string) {
  const text = formatSoftBedModel(model);
  context.font = canvasFontFromPs(45, SOFT_BED_FONT_FAMILY);
  const fontSize = context.measureText(text).width + 48 > 500 ? 35 : 45;
  context.font = canvasFontFromPs(fontSize, SOFT_BED_FONT_FAMILY);
  const width = context.measureText(text).width + 48;
  return { text, fontSize, box: { x: 1310 - width, y: 450, width, height: 72 }, issue: width > 1280 ? '型号及规格过长，请核对内容' : null };
}

type LabelRun = { text: string; font: string; x: number; y: number };
// 单独测量数字、斜线、规格说明，几何避让与最终绘制共用同一尺寸。
export function softBedDimensionLabel(context: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>, annotation: DimensionAnnotation, fields: DimensionFields, options: SoftBedOptions) {
  const text = parseDimensionText(fields[annotation.kind] ?? String(annotation.value), 'truncate')?.text ?? String(annotation.value);
  const values = text.split('/');
  const labels = annotation.kind === 'headWidth' ? options.sizeLabels.slice(0, values.length) : [];
  const hasLabels = labels.some((label) => label.trim());
  const measure = (text: string, size: number) => { context.font = canvasFontFromPs(size, SOFT_BED_FONT_FAMILY); return context.measureText(text).width; };
  const widths = values.map((value, index) => Math.max(measure(`${value}cm`, 45), labels[index]?.trim() ? measure(`(${labels[index].trim()})`, 37) : 0));
  const separatorWidth = measure(' / ', 30);
  const width = widths.reduce((sum, item) => sum + item, 0) + separatorWidth * (values.length - 1);
  const height = hasLabels ? 90 : 45;
  const runs: LabelRun[] = [];
  let x = -width / 2;
  values.forEach((value, index) => {
    runs.push({ text: `${value}cm`, font: canvasFontFromPs(45, SOFT_BED_FONT_FAMILY), x: x + widths[index] / 2, y: hasLabels ? 22.5 : 0 });
    if (labels[index]?.trim()) runs.push({ text: `(${labels[index].trim()})`, font: canvasFontFromPs(37, SOFT_BED_FONT_FAMILY), x: x + widths[index] / 2, y: -26.5 });
    x += widths[index];
    if (index < values.length - 1) {
      runs.push({ text: ' / ', font: canvasFontFromPs(30, SOFT_BED_FONT_FAMILY), x: x + separatorWidth / 2, y: hasLabels ? 22.5 : 0 });
      x += separatorWidth;
    }
  });
  return { width, height, runs };
}

export function softBedDimensionIssue(fields: DimensionFields, options: SoftBedOptions): string | null {
  const labels = { length: '长', headWidth: '床头宽', footWidth: '床尾宽', height: '高', width: '宽' };
  for (const kind of SOFT_BED_DIMENSION_KINDS) {
    if (!fields[kind]?.trim()) return `请填写${labels[kind]}尺寸`;
    if (!parseDimensionText(fields[kind]!, 'truncate')) return `${labels[kind]}尺寸无效：须为正数，并列规格用 / 分隔`;
  }
  const head = parseDimensionText(fields.headWidth ?? '', 'truncate')?.text.split('/') ?? [];
  const foot = parseDimensionText(fields.footWidth ?? '', 'truncate')?.text.split('/') ?? [];
  if (head.length > 2 || foot.length > 2) return '软床单品最多同时展示两种宽度规格';
  if (head.length === 2 || foot.length === 2) {
    if (head.length !== foot.length) return '两种规格请同时填写床头宽和床尾宽';
    if (options.sizeLabels.some((label) => !label.trim())) return '请填写两种床宽对应的规格说明';
  }
  return null;
}
