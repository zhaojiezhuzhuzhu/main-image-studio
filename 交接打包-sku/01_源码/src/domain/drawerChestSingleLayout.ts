import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type DrawerChestOptions = { noteText: string; widthNote: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type DrawerChestDraft = WorkbenchDraft & { drawerChest?: DrawerChestOptions };
export const DRAWER_CHEST_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const DRAWER_CHEST_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export function normalizeDrawerChest(input: unknown): DrawerChestOptions {
  const value = input && typeof input === 'object' ? input as Partial<DrawerChestOptions> : {};
  return { noteText: typeof value.noteText === 'string' ? value.noteText : '', widthNote: typeof value.widthNote === 'string' ? value.widthNote : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getDrawerChestLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeDrawerChest(options.drawerChest), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 300, height: 70 }, productArea: { x: 230, y: 560, width: 1000, height: bottom - 590 },
    subjectSafeArea: { x: 60, y: 470, width: 1320, height: bottom - 470 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function drawerChestModel(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号及完整规格'; context.font = `45px ${DRAWER_CHEST_FONT}`; const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width }, issue: /[\r\n\t\u2028\u2029]/.test(text) || width > 856 ? '斗柜完整型号和规格超出蓝标区域，请核对；不能缩小字号或截断' : null };
}
export function parseDrawerChestDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate');
  return fields && Object.values(fields).every((text) => !text.includes('~') && text.split('/').length <= 3) ? fields : null;
}
export function drawerChestDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const value = normalizeDrawerChest(options.drawerChest), suffix = annotation.kind === 'width' && value.widthNote.trim() ? `（${value.widthNote.trim()}）` : '';
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm${suffix}`, font = `45px ${DRAWER_CHEST_FONT}`;
  context.font = font; return { width: context.measureText(text).width, height: 45, runs: [{ text, font, x: 0, y: 0 }] };
}
export function drawerChestIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeDrawerChest(options.drawerChest), issues: string[] = [];
  context.font = `38px ${DRAWER_CHEST_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (/[\r\n\t\u2028\u2029]/.test(value.widthNote)) issues.push('宽度补充说明请填写单行文字');
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('斗柜长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else if (drawerChestDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields, options).width > 850) issues.push('斗柜完整尺寸及宽度说明超出标注区域，请核对；不能截断');
  }
  return issues;
}
export function drawDrawerChestNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeDrawerChest(options.drawerChest).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${DRAWER_CHEST_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}
