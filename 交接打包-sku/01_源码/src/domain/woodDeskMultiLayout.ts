import { multilineModelBadge } from './multilineModelBadge';
import { parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type WoodDeskMultiOptions = { noteText: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type WoodDeskMultiDraft = WorkbenchDraft & { woodDeskMulti?: WoodDeskMultiOptions };
export const WOOD_DESK_MULTI_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const WOOD_DESK_MULTI_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export function normalizeWoodDeskMulti(input: unknown): WoodDeskMultiOptions {
  const value = input && typeof input === 'object' ? input as Partial<WoodDeskMultiOptions> : {};
  return { noteText: typeof value.noteText === 'string' ? value.noteText : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getWoodDeskMultiLayout(_pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  void options; const bottom = 1350;
  const pointWidths: number[] = [];
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 300, height: 50 }, productArea: { x: 300, y: 540, width: 890, height: bottom - 540 },
    subjectSafeArea: { x: 60, y: 500, width: 1320, height: bottom - 500 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function woodDeskMultiModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, WOOD_DESK_MULTI_FONT);
}
export function parseWoodDeskMultiDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((text) => parseDimensionText(text, 'truncate'));
  if (parts.length !== 6 || parts.some((part) => !part || part.text.split('/').length > 3 || part.text.includes('~'))) return null;
  return { length: parts[0]!.text, width: parts[1]!.text, height: parts[2]!.text, secondaryLength: parts[3]!.text, secondaryWidth: parts[4]!.text, secondaryHeight: parts[5]!.text };
}
export function woodDeskMultiDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `35px ${WOOD_DESK_MULTI_FONT}`;
  context.font = font; return { orientation: annotation.kind === 'height' || annotation.kind === 'secondaryHeight' ? 'line' : undefined, width: context.measureText(text).width, height: 35, runs: [{ text, font, x: 0, y: 0 }] };
}
export function woodDeskMultiIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeWoodDeskMulti(options.woodDeskMulti), issues: string[] = [];
  context.font = `38px ${WOOD_DESK_MULTI_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (fields) for (const kind of ['length', 'width', 'height', 'secondaryLength', 'secondaryWidth', 'secondaryHeight'] as const) {
    const parsed = parseDimensionText(fields[kind] ?? '', 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('书桌长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else if (woodDeskMultiDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields).width > 850) issues.push('书桌完整尺寸超出标注区域，请拆分SKU或核对规格');
  }
  return issues;
}
export function drawWoodDeskMultiNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeWoodDeskMulti(options.woodDeskMulti).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${WOOD_DESK_MULTI_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}

export function formatWoodDeskMultiFields(fields: DimensionFields): string { return ['length', 'width', 'height', 'secondaryLength', 'secondaryWidth', 'secondaryHeight'].map((kind) => fields[kind as keyof DimensionFields] ?? '').join('×'); }
