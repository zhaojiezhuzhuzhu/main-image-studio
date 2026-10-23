import { multilineModelBadge } from './multilineModelBadge';
import { parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type DrawerChestSetOptions = { noteText: string; widthNote: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type DrawerChestSetDraft = WorkbenchDraft & { drawerChestSet?: DrawerChestSetOptions };
export const DRAWER_CHEST_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const DRAWER_CHEST_SET_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export function normalizeDrawerChestSet(input: unknown): DrawerChestSetOptions {
  const value = input && typeof input === 'object' ? input as Partial<DrawerChestSetOptions> : {};
  return { noteText: typeof value.noteText === 'string' ? value.noteText : '', widthNote: typeof value.widthNote === 'string' ? value.widthNote : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getDrawerChestSetLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeDrawerChestSet(options.drawerChestSet), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 300, height: 50 }, productArea: { x: 230, y: 560, width: 1000, height: bottom - 590 },
    subjectSafeArea: { x: 60, y: 500, width: 1320, height: bottom - 500 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function drawerChestSetModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, DRAWER_CHEST_SET_FONT);
}
export function parseDrawerChestSetDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((text) => parseDimensionText(text, 'truncate'));
  if (parts.length !== 4 || parts.some((part) => !part || part.text.split('/').length > 3 || part.text.includes('~'))) return null;
  return { length: parts[0]!.text, width: parts[1]!.text, height: parts[2]!.text, secondaryHeight: parts[3]!.text };
}
export function drawerChestSetDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const value = normalizeDrawerChestSet(options.drawerChestSet), suffix = annotation.kind === 'width' && value.widthNote.trim() ? `（${value.widthNote.trim()}）` : '';
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `35px ${DRAWER_CHEST_SET_FONT}`;
  context.font = font;
  return { orientation: annotation.kind === 'height' || annotation.kind === 'secondaryHeight' ? 'line' : undefined,
    width: Math.max(context.measureText(text).width, context.measureText(suffix).width), height: suffix ? 76 : 35,
    runs: [{ text, font, x: 0, y: suffix ? -20 : 0 }, ...(suffix ? [{ text: suffix, font, x: 0, y: 20 }] : [])] };
}
export function drawerChestSetIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeDrawerChestSet(options.drawerChestSet), issues: string[] = [];
  context.font = `38px ${DRAWER_CHEST_SET_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (/[\r\n\t\u2028\u2029]/.test(value.widthNote)) issues.push('宽度补充说明请填写单行文字');
  if (fields) for (const kind of ['length', 'width', 'height', 'secondaryHeight'] as const) {
    const parsed = parseDimensionText(fields[kind] ?? '', 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('斗柜长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else if (drawerChestSetDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields, options).width > 850) issues.push('斗柜完整尺寸及宽度说明超出标注区域，请核对；不能截断');
  }
  return issues;
}
export function drawDrawerChestSetNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeDrawerChestSet(options.drawerChestSet).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${DRAWER_CHEST_SET_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}

export function formatDrawerChestSetFields(fields: DimensionFields): string { return ['length', 'width', 'height', 'secondaryHeight'].map((kind) => fields[kind as keyof DimensionFields] ?? '').join('×'); }
