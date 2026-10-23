import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { getDimensionStyleGeometry } from './dimensionStyle';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const DINING_CHAIR_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const DINING_CHAIR_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const DINING_CHAIR_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const DINING_CHAIR_MIN_GAP = 60;
export const DINING_CHAIR_MAX_GAP = 180;
export const DINING_CHAIR_LINE_STYLE = { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 };
export type DiningChairSettings = { quantity: 1 | 2; widthMode: 'standard' | 'outside'; heightNote: string; outerWidth: string };
export type DiningChairSavedOptions = DiningChairSettings & { sellingPointCount: 2 | 3; dimensionGap: number };
export type DiningChairOptions = SingleTemplateOptions & { diningChair: DiningChairSettings };
export type DiningChairDraft = WorkbenchDraft & { diningChair?: DiningChairSavedOptions };

export function normalizeDiningChairOptions(value: unknown): DiningChairOptions {
  const saved = value && typeof value === 'object' ? value as Partial<DiningChairOptions> : {};
  const chair = saved.diningChair;
  return { sizeLabels: ['', ''], sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap)
      ? Math.max(DINING_CHAIR_MIN_GAP, Math.min(DINING_CHAIR_MAX_GAP, saved.dimensionGap)) : DINING_CHAIR_MIN_GAP,
    diningChair: { quantity: chair?.quantity === 2 ? 2 : 1, widthMode: chair?.widthMode === 'outside' ? 'outside' : 'standard',
      heightNote: typeof chair?.heightNote === 'string' ? chair.heightNote : '', outerWidth: typeof chair?.outerWidth === 'string' ? chair.outerWidth : '' } };
}

export function getDiningChairSingleLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const normalized = normalizeDiningChairOptions(options);
  const availableWidth = 1252, gap = 30, sellingY = 1262, borderHalf = 2;
  const equalWidth = (availableWidth - borderHalf * 2 - gap * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 40));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) + borderHalf * 2 > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 40));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: sellingY, width, height: 98 }; x += width + gap; return box; });
  const bottom = sellingY - borderHalf - normalized.dimensionGap;
  // P41新版图已为1440画布：型号与图片坐标由图推定，不套用P40旧图的370px价格区。
  return { modelBadge: { x: 70, y: 343, height: 72 },
    productArea: { x: 120, y: 485, width: 490, height: Math.min(650, bottom - 555) },
    subjectSafeArea: { x: 70, y: 445, width: 750, height: bottom - 445 }, sellingPoints,
    issue: total + borderHalf * 2 > availableWidth ? '卖点文案总宽度超出安全区，请调整完整文案；50号字、98px框高和30px横向间距保持不变' : null };
}

export function diningChairAccessories(options: SingleTemplateOptions, layout: SingleLayout) {
  const bottom = layout.sellingPoints[0]?.y ?? 1262;
  const { dimensionGap, diningChair } = normalizeDiningChairOptions(options);
  const reserve = diningChair.widthMode === 'outside' ? 90 : 0;
  return [{ id: 'chair-rear', label: '第二视图', area: { x: 850, y: 455, width: 494, height: Math.min(650, bottom - 2 - dimensionGap - reserve - 455) } }];
}

export function diningChairModelBadge(context: TextMeasure, model: string, layout: SingleLayout, options?: SingleTemplateOptions) {
  const text = `${model.trim() || '餐椅完整型号及规格'}x${normalizeDiningChairOptions(options).diningChair.quantity}`;
  context.font = canvasFontFromPs(45, DINING_CHAIR_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(model) ? '餐椅型号及规格请填写在一行内'
      : layout.modelBadge.x + width > 956 ? '餐椅完整型号、规格及数量过长，45号字超出左侧型号区域，请核对内容，不可省略规格' : null };
}

function parseChairDimension(value: string) {
  const parsed = parseDimensionText(value, 'truncate');
  return parsed && !/[~/]/.test(parsed.text) ? parsed : null;
}

export function parseDiningChairDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate');
  return fields && ['length', 'width', 'height'].every((kind) => parseChairDimension(fields[kind as keyof DimensionFields] ?? '')) ? fields : null;
}

function dimensionLines(kind: 'length' | 'width' | 'height', value: string, options: SingleTemplateOptions) {
  const { heightNote, widthMode } = normalizeDiningChairOptions(options).diningChair;
  const names = { length: '总长', width: '总宽', height: '总高' };
  const lines = [`${kind === 'width' && widthMode === 'outside' ? '' : names[kind]}${value}cm`];
  if (kind === 'height' && heightNote.trim()) lines.push(`（${heightNote.trim()}）`);
  return lines;
}

export function diningChairDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseChairDimension(fields[kind])?.text ?? String(annotation.value);
  const lines = dimensionLines(kind, value, options);
  const font = canvasFontFromPs(45, DINING_CHAIR_FONT);
  context.font = font;
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: 45 + (lines.length - 1) * 55,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * 55 })) };
}

export function diningChairDimensionIssue(fields: DimensionFields, options: SingleTemplateOptions): string | null {
  const { widthMode, outerWidth } = normalizeDiningChairOptions(options).diningChair;
  for (const [kind, name] of [['length', '总长'], ['width', '总宽'], ['height', '总高']] as const) {
    const label = kind === 'width' && widthMode === 'outside' ? '腿间宽' : name;
    if (!fields[kind].trim()) return `请填写餐椅${label}尺寸，不能根据图片推测真实尺寸`;
    if (!parseChairDimension(fields[kind])) return `餐椅${label}尺寸无效，请填写一个正数（cm）`;
  }
  if (widthMode === 'outside' && !outerWidth.trim()) return '请填写第二视图总宽，不能根据腿间宽或图片推测真实总宽';
  if (widthMode === 'outside' && !parseChairDimension(outerWidth)) return '第二视图总宽无效，请填写一个正数（cm）';
  return null;
}

export function diningChairExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const issues: string[] = [], { heightNote, outerWidth, widthMode } = normalizeDiningChairOptions(options).diningChair;
  if (/[\r\n\t\u2028\u2029]/.test(heightNote)) issues.push('高度补充说明请填写单行文字');
  context.font = canvasFontFromPs(45, DINING_CHAIR_FONT);
  if (heightNote.trim() && context.measureText(`（${heightNote.trim()}）`).width > 280) issues.push('高度补充说明过长，45号字超出标注区域，请核对完整说明');
  if (widthMode === 'outside') {
    const value = parseChairDimension(outerWidth);
    if (value && context.measureText(`总宽${value.text}cm`).width > 360) issues.push('第二视图总宽文字过长，45号字超出标注区域，请核对真实数值');
  }
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const value = parseChairDimension(fields[kind]);
    if (!value) continue;
    if (context.measureText(dimensionLines(kind, value.text, options)[0]).width > (kind === 'height' ? 280 : 360)) issues.push(`餐椅${{ length: '总长', width: '总宽', height: '总高' }[kind]}尺寸过长，45号完整文字超出标注区域，请核对真实数值`);
  }
  return issues;
}

export function drawDiningChairExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions, _layout: SingleLayout, _mainRect?: Rect, accessoryRects: readonly { id: string; productRect: Rect }[] = []) {
  const { widthMode, outerWidth } = normalizeDiningChairOptions(options).diningChair;
  const rect = accessoryRects.find((item) => item.id === 'chair-rear')?.productRect;
  const value = parseChairDimension(outerWidth);
  if (widthMode !== 'outside' || !rect || !value) return;
  const y = rect.y + rect.height + 18;
  const geometry = getDimensionStyleGeometry({ x: rect.x, y }, { x: rect.x + rect.width, y }, 'width', DINING_CHAIR_LINE_STYLE);
  context.save();
  context.strokeStyle = geometry.color; context.fillStyle = geometry.color; context.lineWidth = geometry.lineWidth;
  context.lineCap = 'butt'; context.lineJoin = 'miter';
  context.beginPath(); context.moveTo(geometry.line.from.x, geometry.line.from.y); context.lineTo(geometry.line.to.x, geometry.line.to.y); context.stroke();
  context.beginPath();
  geometry.extensions.flat().forEach((segment) => { context.moveTo(segment.from.x, segment.from.y); context.lineTo(segment.to.x, segment.to.y); });
  context.stroke();
  for (const arrow of geometry.arrows) {
    context.beginPath(); context.moveTo(arrow.tip.x, arrow.tip.y);
    context.lineTo(arrow.corners[0].x, arrow.corners[0].y); context.lineTo(arrow.corners[1].x, arrow.corners[1].y);
    context.closePath(); context.fill();
  }
  context.font = canvasFontFromPs(45, DINING_CHAIR_FONT); context.fillStyle = '#000000'; context.textAlign = 'center'; context.textBaseline = 'middle';
  const text = `总宽${value.text}cm`, halfWidth = context.measureText(text).width / 2;
  const centerX = Math.max(850 + halfWidth, Math.min(1346 - halfWidth, rect.x + rect.width / 2));
  context.fillText(text, centerX, y + 40.5);
  context.restore();
}
