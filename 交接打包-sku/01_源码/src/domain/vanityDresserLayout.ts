import { parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type VanityDresserOptions = { noteText: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type VanityDresserDraft = WorkbenchDraft & { vanityDresser?: VanityDresserOptions };
export const VANITY_DRESSER_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const VANITY_DRESSER_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export function normalizeVanityDresser(input: unknown): VanityDresserOptions {
  const value = input && typeof input === 'object' ? input as Partial<VanityDresserOptions> : {};
  return { noteText: typeof value.noteText === 'string' ? value.noteText : '', sellingPointCount: value.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof value.dimensionGap === 'number' && Number.isFinite(value.dimensionGap) ? Math.max(30, Math.min(120, value.dimensionGap)) : 60 };
}
export function getVanityDresserLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeVanityDresser(options.vanityDresser), bottom = 1260 - value.dimensionGap;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 30 > 1376) widths = pointWidths.map((width) => width + 50);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 30; let x = (1440 - total) / 2;
  return { modelBadge: { x: 100, y: 300, height: 70 }, productArea: { x: 300, y: 540, width: 890, height: bottom - 540 },
    subjectSafeArea: { x: 60, y: 470, width: 1320, height: bottom - 470 },
    sellingPoints: widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + 30; return box; }),
    issue: total > 1376 ? '卖点完整文案超出安全区，请调整文案；框高98px和间隔30px不变' : null };
}
export function vanityDresserModel(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号及完整规格'; context.font = `45px ${VANITY_DRESSER_FONT}`; const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width }, issue: /[\r\n\t\u2028\u2029]/.test(text) || width > 856 ? '妆台完整型号和规格超出蓝标区域，请核对；不能缩小字号或截断' : null };
}
export function parseVanityDresserDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((text) => parseDimensionText(text, 'truncate'));
  if (parts.length !== 4 || parts.some((part, index) => !part || part.text.split('/').length > 3 || (index !== 0 && part.text.includes('~')) || part.text.split('/').some((segment) => { const pair = segment.split('~').map(Number); return pair.length > 2 || (pair.length === 2 && pair[0] >= pair[1]); }))) return null;
  return { length: parts[0]!.text, width: parts[1]!.text, height: parts[2]!.text, secondaryHeight: parts[3]!.text };
}
export function vanityDresserDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = `45px ${VANITY_DRESSER_FONT}`;
  context.font = font; return { orientation: annotation.kind === 'height' || annotation.kind === 'secondaryHeight' ? 'line' : undefined, width: context.measureText(text).width, height: 45, runs: [{ text, font, x: 0, y: 0 }] };
}
export function vanityDresserIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeVanityDresser(options.vanityDresser), issues: string[] = [];
  context.font = `38px ${VANITY_DRESSER_FONT}`;
  if (/[\r\n\t\u2028\u2029]/.test(value.noteText) || context.measureText(value.noteText).width > 1240) issues.push('图示备注须完整放入底部单行，请核对文字；不会截断内容');
  if (fields) for (const kind of ['length', 'width', 'height', 'secondaryHeight'] as const) {
    const parsed = parseDimensionText(fields[kind] ?? '', 'truncate');
    if (!parsed || (kind !== 'length' && parsed.text.includes('~')) || parsed.text.split('/').length > 3) issues.push('妆台长宽高须为正数，最多三种 / 并列规格，仅长度可用由小到大的 ~ 范围');
    else if (vanityDresserDimensionLabel(context, { kind, value: parsed.value } as DimensionAnnotation, fields).width > 850) issues.push('妆台完整尺寸超出标注区域，请拆分SKU或核对规格');
  }
  return issues;
}
export function drawVanityDresserNote(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const text = normalizeVanityDresser(options.vanityDresser).noteText; if (!text.trim()) return;
  context.save(); context.font = `38px ${VANITY_DRESSER_FONT}`; context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(text, 720, 1370); context.restore();
}

export function formatVanityDresserFields(fields: DimensionFields): string { return ['length', 'width', 'height', 'secondaryHeight'].map((kind) => fields[kind as keyof DimensionFields] ?? '').join('×'); }
