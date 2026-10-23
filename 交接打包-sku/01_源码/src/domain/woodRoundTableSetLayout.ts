import { multilineModelBadge } from './multilineModelBadge';
import { parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type WoodRoundTableSetOptions = { noteText: string; sellingPointCount: 2 | 3; dimensionGap: number; chairCount: 1 | 2 | 3 | 4; chairs: Array<{ model: string; x: number; y: number }>; diameterPlacement: 'surface' | 'outside' };
export type WoodRoundTableSetDraft = WorkbenchDraft & { woodRoundTableSet?: WoodRoundTableSetOptions };
export const WOOD_ROUND_TABLE_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const WOOD_ROUND_TABLE_SET_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
function coordinate(value: unknown, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback; }
export function normalizeWoodRoundTableSet(input: unknown): WoodRoundTableSetOptions {
  const value = input && typeof input === 'object' ? input as Partial<WoodRoundTableSetOptions> : {};
  return {
    chairCount: [2, 3, 4].includes(value.chairCount ?? 0) ? value.chairCount! : 1,
    chairs: [{ x: 1, y: .04 }, { x: 0, y: .22 }, { x: 0, y: 1 }, { x: 1, y: 1 }].map((fallback, index) => ({ model: typeof value.chairs?.[index]?.model === 'string' ? value.chairs[index].model : '', x: coordinate(value.chairs?.[index]?.x, fallback.x), y: coordinate(value.chairs?.[index]?.y, fallback.y) })),
    diameterPlacement: value.diameterPlacement === 'outside' ? 'outside' : 'surface',
    noteText: typeof value.noteText === 'string' ? value.noteText : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getWoodRoundTableSetLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeWoodRoundTableSet(options.woodRoundTableSet), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 320, height: 50 }, productArea: { x: 250, y: 490, width: 950, height: bottom - 490 },
    subjectSafeArea: { x: 60, y: 400, width: 1320, height: bottom - 400 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function woodRoundTableSetModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, WOOD_ROUND_TABLE_SET_FONT);
}
export function parseWoodRoundTableSetDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i);
  if (parts.length !== 2) return null;
  const diameter = parseDimensionText(parts[0], 'truncate'), height = parseDimensionText(parts[1], 'truncate');
  if (!diameter || !height || [diameter.text, height.text].some((text) => text.includes('~') || text.split('/').length > 3)) return null;
  const heightCount = height.text.split('/').length;
  if (heightCount !== 1 && heightCount !== diameter.text.split('/').length) return null;
  return { length: '', width: '', diameter: diameter.text, height: height.text };
}
export function formatWoodRoundTableSetFields(fields: DimensionFields): string {
  return `${fields.diameter ?? ''}×${fields.height}`;
}
export function woodRoundTableSetDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `35px ${WOOD_ROUND_TABLE_SET_FONT}`;
  const surface = annotation.kind === 'diameter' && normalizeWoodRoundTableSet(options.woodRoundTableSet).diameterPlacement === 'surface';
  context.font = font; return { color: surface ? '#ffffff' : undefined, lineColor: surface ? '#ffffff' : undefined, width: context.measureText(text).width, height: 35, runs: [{ text, font, x: 0, y: 0 }] };
}
export function woodRoundTableSetIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeWoodRoundTableSet(options.woodRoundTableSet), badges = woodRoundTableSetBadges(context, options), issues: string[] = badges.flatMap((badge) => badge.issue ? [badge.issue] : []);
  for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) {
    const a = badges[i].box, b = badges[j].box;
    if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) issues.push(`第${i + 1}款与第${j + 1}款搭配标签重叠，请调整位置`);
  }
  context.font = `38px ${WOOD_ROUND_TABLE_SET_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (fields) for (const kind of ['diameter', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind] ?? '', 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('圆餐桌直径和高度须为正数，最多三种 / 并列规格，不使用范围');
    else if (woodRoundTableSetDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields, options).width > 850) issues.push('圆餐桌完整尺寸超出标注区域，请拆分SKU或核对规格');
  }
  return issues;
}
function drawWoodRoundTableSetNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeWoodRoundTableSet(options.woodRoundTableSet).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${WOOD_ROUND_TABLE_SET_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}

export function woodRoundTableSetBadges(context: TextMeasure, options: SingleTemplateOptions) {
  const value = normalizeWoodRoundTableSet(options.woodRoundTableSet); context.font = `35px ${WOOD_ROUND_TABLE_SET_FONT}`;
  return value.chairs.slice(0, value.chairCount).map((chair, index) => {
    const text = chair.model.trim() || `第${index + 1}款搭配型号`;
    const width = context.measureText(text).width + 40, height = 50;
    const box = { x: 60 + Math.max(0, 1320 - width) * chair.x, y: 400 + (1260 - value.dimensionGap - 400 - height) * chair.y, width, height };
    return { text, box, issue: !chair.model.trim() ? `请填写第${index + 1}款搭配完整型号`
      : /[\r\n\t\u2028\u2029]/.test(chair.model) || width > 480 ? `第${index + 1}款搭配完整型号超出单行标签区域，请核对；不会缩字或截断` : null };
  });
}
export function drawWoodRoundTableSetExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const badges = woodRoundTableSetBadges(context, options);
  context.save(); context.textBaseline = 'middle';
  badges.forEach(({ text, box }) => {
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(box.x, box.y, box.width, box.height, 8); context.fill();
    context.font = `35px ${WOOD_ROUND_TABLE_SET_FONT}`; context.textAlign = 'left'; context.fillStyle = '#ffffff'; context.fillText(text, box.x + 20, box.y + 25);
  });
  context.restore(); drawWoodRoundTableSetNote(context, options);
}
