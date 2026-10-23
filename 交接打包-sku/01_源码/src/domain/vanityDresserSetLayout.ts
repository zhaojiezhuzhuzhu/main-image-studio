import { multilineModelBadge } from './multilineModelBadge';
import { parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type VanityDresserSetOptions = { noteText: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type VanityDresserSetDraft = WorkbenchDraft & { vanityDresserSet?: VanityDresserSetOptions };
export const VANITY_DRESSER_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const VANITY_DRESSER_SET_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export function normalizeVanityDresserSet(input: unknown): VanityDresserSetOptions {
  const value = input && typeof input === 'object' ? input as Partial<VanityDresserSetOptions> : {};
  return { noteText: typeof value.noteText === 'string' ? value.noteText : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getVanityDresserSetLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeVanityDresserSet(options.vanityDresserSet), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 300, height: 50 }, productArea: { x: 300, y: 540, width: 890, height: bottom - 540 },
    subjectSafeArea: { x: 60, y: 500, width: 1320, height: bottom - 500 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function vanityDresserSetModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, VANITY_DRESSER_SET_FONT);
}
export function parseVanityDresserSetDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((text) => parseDimensionText(text, 'truncate'));
  if (parts.length !== 4 || parts.some((part, index) => !part || part.text.split('/').length > 3 || (index !== 0 && part.text.includes('~')) || part.text.split('/').some((segment) => { const pair = segment.split('~').map(Number); return pair.length > 2 || (pair.length === 2 && pair[0] >= pair[1]); }))) return null;
  return { length: parts[0]!.text, width: parts[1]!.text, height: parts[2]!.text, secondaryHeight: parts[3]!.text };
}
export function vanityDresserSetDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `35px ${VANITY_DRESSER_SET_FONT}`;
  context.font = font; return { orientation: annotation.kind === 'height' || annotation.kind === 'secondaryHeight' ? 'line' : undefined, width: context.measureText(text).width, height: 35, runs: [{ text, font, x: 0, y: 0 }] };
}
export function vanityDresserSetIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeVanityDresserSet(options.vanityDresserSet), issues: string[] = [];
  context.font = `38px ${VANITY_DRESSER_SET_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (fields) for (const kind of ['length', 'width', 'height', 'secondaryHeight'] as const) {
    const parsed = parseDimensionText(fields[kind] ?? '', 'truncate');
    if (!parsed || (kind !== 'length' && parsed.text.includes('~')) || parsed.text.split('/').length > 3) issues.push('妆台长宽高须为正数，最多三种 / 并列规格，仅长度可用由小到大的 ~ 范围');
    else if (vanityDresserSetDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields).width > 850) issues.push('妆台完整尺寸超出标注区域，请拆分SKU或核对规格');
  }
  return issues;
}
export function drawVanityDresserSetNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeVanityDresserSet(options.vanityDresserSet).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${VANITY_DRESSER_SET_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}

export function formatVanityDresserSetFields(fields: DimensionFields): string { return ['length', 'width', 'height', 'secondaryHeight'].map((kind) => fields[kind as keyof DimensionFields] ?? '').join('×'); }
