import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type WoodDiningChairOptions = { quantity: 1 | 2; noteText: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type WoodDiningChairDraft = WorkbenchDraft & { woodDiningChair?: WoodDiningChairOptions };
export const WOOD_DINING_CHAIR_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const WOOD_DINING_CHAIR_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export function normalizeWoodDiningChair(input: unknown): WoodDiningChairOptions {
  const value = input && typeof input === 'object' ? input as Partial<WoodDiningChairOptions> : {};
  return { quantity: value.quantity === 2 ? 2 : 1, noteText: typeof value.noteText === 'string' ? value.noteText : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getWoodDiningChairLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeWoodDiningChair(options.woodDiningChair), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 300, height: 70 }, productArea: { x: 250, y: 520, width: 490, height: bottom - 580 },
    subjectSafeArea: { x: 60, y: 470, width: 700, height: bottom - 470 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function woodDiningChairModel(context: TextMeasure, model: string, layout: SingleLayout, options?: SingleTemplateOptions) {
  const text = `${model.trim() || '餐椅完整型号及规格'}×${normalizeWoodDiningChair(options?.woodDiningChair).quantity}`; context.font = `45px ${WOOD_DINING_CHAIR_FONT}`; const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width }, issue: /[\r\n\t\u2028\u2029]/.test(text) || width > 856 ? '餐椅完整型号和规格超出蓝标区域，请核对；不能缩小字号或截断' : null };
}
export function parseWoodDiningChairDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate');
  return fields && Object.values(fields).every((text) => !/[~/]/.test(text)) ? fields : null;
}
export function woodDiningChairDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const value = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `45px ${WOOD_DINING_CHAIR_FONT}`;
  const lines = annotation.kind === 'height' ? ['总高', value] : [`${annotation.kind === 'length' ? '总长' : '总宽'}${value}`];
  context.font = font; return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: lines.length === 2 ? 100 : 45,
    orientation: annotation.kind === 'length' ? 'line' : undefined, runs: lines.map((text, i) => ({ text, font, x: 0, y: (i - (lines.length - 1) / 2) * 55 })) };
}
export function woodDiningChairIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeWoodDiningChair(options.woodDiningChair), issues: string[] = [];
  context.font = `38px ${WOOD_DINING_CHAIR_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || /[~/]/.test(parsed.text)) issues.push('餐椅长宽高须为正数，每项填写一个正数，不使用范围或并列规格');
    else if (woodDiningChairDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields).width > 850) issues.push('餐椅完整尺寸超出标注区域，请拆分SKU或核对规格');
  }
  return issues;
}
export function drawWoodDiningChairNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeWoodDiningChair(options.woodDiningChair).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${WOOD_DINING_CHAIR_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}
