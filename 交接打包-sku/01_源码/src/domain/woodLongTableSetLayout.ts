import { multilineModelBadge } from './multilineModelBadge';
import type { Rect } from './dimensionGeometry';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type WoodLongTableSetOptions = { noteText: string; sellingPointCount: 2 | 3; dimensionGap: number; chairCount: 1 | 2; chairs: Array<{ model: string; x: number; y: number }>; markers: Array<{ x: number; y: number }> };
export type WoodLongTableSetDraft = WorkbenchDraft & { woodLongTableSet?: WoodLongTableSetOptions };
export const WOOD_LONG_TABLE_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const WOOD_LONG_TABLE_SET_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
function coordinate(value: unknown, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback; }
export function normalizeWoodLongTableSet(input: unknown): WoodLongTableSetOptions {
  const value = input && typeof input === 'object' ? input as Partial<WoodLongTableSetOptions> : {};
  return {
    chairCount: value.chairCount === 2 ? 2 : 1,
    chairs: [{ x: 1, y: .9 }, { x: 1, y: 1 }].map((fallback, index) => ({ model: typeof value.chairs?.[index]?.model === 'string' ? value.chairs[index].model : '', x: coordinate(value.chairs?.[index]?.x, fallback.x), y: coordinate(value.chairs?.[index]?.y, fallback.y) })),
    markers: [{ x: .25, y: .45 }, { x: .75, y: .45 }].map((fallback, index) => ({ x: coordinate(value.markers?.[index]?.x, fallback.x), y: coordinate(value.markers?.[index]?.y, fallback.y) })),
    noteText: typeof value.noteText === 'string' ? value.noteText : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getWoodLongTableSetLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeWoodLongTableSet(options.woodLongTableSet), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 320, height: 50 }, productArea: { x: 200, y: 510, width: 1100, height: bottom - 510 },
    subjectSafeArea: { x: 60, y: 400, width: 1320, height: bottom - 400 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function woodLongTableSetModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, WOOD_LONG_TABLE_SET_FONT);
}
export function parseWoodLongTableSetDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate');
  return fields && Object.values(fields).every((text) => !text.includes('~') && text.split('/').length <= 3) ? fields : null;
}
export function woodLongTableSetDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const value = parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? String(annotation.value);
  const prefix = annotation.kind === 'length' && value.includes('/') ? '尺寸可选:' : '';
  const text = `${prefix}${value}cm`, font = `35px ${WOOD_LONG_TABLE_SET_FONT}`;
  context.font = font; return { orientation: annotation.kind === 'length' ? 'line' : undefined, width: context.measureText(text).width, height: 35, runs: [{ text, font, x: 0, y: 0 }] };
}
export function woodLongTableSetIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeWoodLongTableSet(options.woodLongTableSet), badges = woodLongTableSetBadges(context, options), issues: string[] = badges.flatMap((badge) => badge.issue ? [badge.issue] : []);
  for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) {
    const a = badges[i].box, b = badges[j].box;
    if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) issues.push(`第${i + 1}款与第${j + 1}款搭配标签重叠，请调整位置`);
  }
  context.font = `38px ${WOOD_LONG_TABLE_SET_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('长餐桌长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else if (woodLongTableSetDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields).width > 850) issues.push('长餐桌完整尺寸超出标注区域，请拆分SKU或核对规格');
  }
  return issues;
}
function drawWoodLongTableSetNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeWoodLongTableSet(options.woodLongTableSet).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${WOOD_LONG_TABLE_SET_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}

export function woodLongTableSetBadges(context: TextMeasure, options: SingleTemplateOptions) {
  const value = normalizeWoodLongTableSet(options.woodLongTableSet); context.font = `35px ${WOOD_LONG_TABLE_SET_FONT}`;
  return value.chairs.slice(0, value.chairCount).map((chair, index) => {
    const text = chair.model.trim() || `第${index + 1}款搭配型号`, number = value.chairCount === 2 ? String(index + 1) : '';
    const width = context.measureText(text).width + (number ? 76 : 40), height = 50;
    const box = { x: 60 + Math.max(0, 1320 - width) * chair.x, y: 400 + (1260 - value.dimensionGap - 400 - height) * chair.y, width, height };
    return { text, number, box, issue: !chair.model.trim() ? `请填写第${index + 1}款搭配完整型号`
      : /[\r\n\t\u2028\u2029]/.test(chair.model) || width > 600 ? `第${index + 1}款搭配完整型号超出单行标签区域，请核对；不会缩字或截断` : null };
  });
}
export function drawWoodLongTableSetExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions, _layout: SingleLayout, productRect?: Rect) {
  const badges = woodLongTableSetBadges(context, options);
  context.save(); context.textBaseline = 'middle';
  badges.forEach(({ text, number, box }) => {
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(box.x, box.y, box.width, box.height, 8); context.fill();
    if (number) {
      context.fillStyle = '#ffffff'; context.beginPath(); context.arc(box.x + 30, box.y + 25, 15, 0, Math.PI * 2); context.fill();
      context.font = '25px Montserrat, sans-serif'; context.textAlign = 'center'; context.fillStyle = '#00586d'; context.fillText(number, box.x + 30, box.y + 25);
    }
    context.font = `35px ${WOOD_LONG_TABLE_SET_FONT}`; context.textAlign = 'left'; context.fillStyle = '#ffffff'; context.fillText(text, box.x + (number ? 56 : 20), box.y + 25);
  });
  const value = normalizeWoodLongTableSet(options.woodLongTableSet);
  if (value.chairCount === 2 && productRect) value.markers.forEach((marker, index) => {
    const insetX = Math.min(20, productRect.width / 2), insetY = Math.min(20, productRect.height / 2);
    const x = productRect.x + Math.max(insetX, Math.min(productRect.width - insetX, marker.x * productRect.width));
    const y = productRect.y + Math.max(insetY, Math.min(productRect.height - insetY, marker.y * productRect.height));
    context.fillStyle = '#00586d'; context.beginPath(); context.arc(x, y, 20, 0, Math.PI * 2); context.fill();
    context.font = '35px Montserrat, sans-serif'; context.textAlign = 'center'; context.fillStyle = '#ffffff'; context.fillText(String(index + 1), x, y);
  });
  context.restore(); drawWoodLongTableSetNote(context, options);
}
