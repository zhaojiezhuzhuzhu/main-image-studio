import { parseDimensionText, parseDimensionFields, type DimensionFields } from './dimensions';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type PillowSingleOptions = { headline: string; subtitle: string; quantity: 1 | 2; zoneText: string; zoneX: number; zoneY: number; materials: Array<{ text: string; textColor: 'black' | 'white' }> };
export type PillowSingleDraft = WorkbenchDraft & { pillowSingle?: PillowSingleOptions };
export const PILLOW_TEXT_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const PILLOW_HEADLINE_FONT = '"Montserrat Semi Bold", "方正兰亭中黑_GBK", sans-serif';
export function normalizePillowSingle(input: unknown): PillowSingleOptions {
  const saved = input && typeof input === 'object' ? input as Partial<PillowSingleOptions> : {}, materials = Array.isArray(saved.materials) ? saved.materials : [];
  const position = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
  return { headline: typeof saved.headline === 'string' ? saved.headline : '', subtitle: typeof saved.subtitle === 'string' ? saved.subtitle : '', quantity: saved.quantity === 2 ? 2 : 1,
    zoneText: typeof saved.zoneText === 'string' ? saved.zoneText : '', zoneX: position(saved.zoneX, 50), zoneY: position(saved.zoneY, 30),
    materials: Array.from({ length: 3 }, (_, i) => ({ text: typeof materials[i]?.text === 'string' ? materials[i].text : '', textColor: materials[i]?.textColor === 'white' ? 'white' : 'black' })) };
}
export function getPillowSingleLayout(): SingleLayout {
  // 40px标题/产品间距、25px产品/卡片间距来自P12；右侧独立预留数量圆标。
  return { modelBadge: { x: 1000, y: 351, height: 60 }, productArea: { x: 220, y: 580, width: 900, height: 470 },
    subjectSafeArea: { x: 60, y: 550, width: 1120, height: 555 }, sellingPoints: [] };
}
export const pillowMaterialCards = () => Array.from({ length: 3 }, (_, i) => ({ x: 60 + i * 444, y: 1130, width: 432, height: 264 }));
export const pillowAccessories = () => pillowMaterialCards().map((area, i) => ({ id: `pillow-material-${i + 1}`, label: `材质卖点${i + 1}`, area, fit: 'cover' as const, clipRadius: 8 }));
export function pillowModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '枕头型号'; context.font = '45px Montserrat, sans-serif'; const width = context.measureText(text).width + 50;
  return { text, fontSize: 45, box: { ...layout.modelBadge, x: 1350 - width, width }, issue: /[\r\n\t]/.test(text) || width > 350 ? '枕头型号过长或包含换行，请核对完整型号，不能缩小或截断内容' : null };
}
export function parsePillowDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate'); return fields && !/[~/]/.test(Object.values(fields).join('')) ? fields : null;
}
export function pillowDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `50px ${PILLOW_TEXT_FONT}`; context.font = font;
  return { width: context.measureText(text).width, height: 50, runs: [{ text, font, x: 0, y: 0 }] };
}
function lineIssue(context: TextMeasure, text: string, font: string, width: number, name: string, required = true): string | null {
  context.font = font;
  if (!text.trim()) return required ? `请填写${name}，内容须依据真实产品资料` : null;
  return /[\r\n\t]/.test(text) || context.measureText(text).width > width ? `${name}需单行且不能超出规定字号区域，请核对完整内容` : null;
}
export function pillowExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizePillowSingle(options.pillowSingle);
  const issues = [lineIssue(context, value.headline, `100px ${PILLOW_HEADLINE_FONT}`, 900, '枕头标题'),
    lineIssue(context, value.subtitle, '33px "方正兰亭黑_GBK", sans-serif', 1250, '枕头说明', false),
    lineIssue(context, value.zoneText, `50px ${PILLOW_TEXT_FONT}`, 500, '局部尺寸说明', false),
    ...value.materials.map((m, i) => lineIssue(context, m.text, `35px ${PILLOW_TEXT_FONT}`, 392, `材质卖点${i + 1}文案`))];
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    issues.push(!parsed || /[~/]/.test(parsed.text) ? '请按真实资料填写枕头长、宽、高，不使用范围或多规格' : lineIssue(context, `${parsed.text}cm`, `50px ${PILLOW_TEXT_FONT}`, 350, '枕头尺寸'));
  }
  return issues.filter((issue): issue is string => Boolean(issue));
}
export function drawPillowExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions, layout: SingleLayout, productRect?: Rect): void {
  const value = normalizePillowSingle(options.pillowSingle);
  context.save(); context.letterSpacing = '0px'; context.textAlign = 'left'; context.textBaseline = 'top';
  context.fillStyle = '#000000'; context.font = `100px ${PILLOW_HEADLINE_FONT}`; context.fillText(value.headline, 85, 342);
  context.fillStyle = '#5e5e5e'; context.font = '33px "方正兰亭黑_GBK", sans-serif'; context.fillText(value.subtitle, 85, 472);
  if (value.quantity === 2) {
    context.beginPath(); context.arc(1270, 610, 50, 0, Math.PI * 2); context.fillStyle = '#00586d'; context.fill();
    context.fillStyle = '#ffffff'; context.font = '60px Montserrat, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('x2', 1270, 610);
  }
  if (value.zoneText && productRect) {
    context.font = `50px ${PILLOW_TEXT_FONT}`; context.fillStyle = '#000000'; context.textAlign = 'center'; context.textBaseline = 'top';
    const halfWidth = Math.min(500, context.measureText(value.zoneText).width) / 2, safe = layout.subjectSafeArea;
    const x = Math.max(safe.x + halfWidth, Math.min(safe.x + safe.width - halfWidth, productRect.x + productRect.width * value.zoneX / 100));
    const y = Math.max(safe.y, Math.min(safe.y + safe.height - 50, productRect.y + productRect.height * value.zoneY / 100));
    context.fillText(value.zoneText, x, y);
  }
  context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.font = `35px ${PILLOW_TEXT_FONT}`;
  pillowMaterialCards().forEach((card, i) => {
    context.fillStyle = value.materials[i].textColor === 'white' ? '#ffffff' : '#000000'; context.fillText(value.materials[i].text, card.x + card.width / 2, card.y + card.height - 25);
  });
  context.restore();
}
