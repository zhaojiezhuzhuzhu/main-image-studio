import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

// 第39页独立规则：完整餐桌餐椅素材、桌型号左上、椅型号右下。
export const ROUND_TABLE_COMBINATION_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const ROUND_TABLE_COMBINATION_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const ROUND_TABLE_COMBINATION_DIMENSION_KINDS: DimensionKind[] = ['diameter', 'height'];
const CHAIR_BADGE = { right: 1346, y: 1120, height: 52 };
const NOTE_TOP = 1180;
const NOTE_WIDTH = 1252;

export type RoundExtendableTableCombinationOptions = {
  sellingPointCount: 2 | 3;
  noteText: string;
  heightNote: string;
  diameterPlacement: 'surface' | 'outside';
  diningChairs: NonNullable<SingleTemplateOptions['diningChairs']>;
};
export type RoundExtendableTableCombinationDraft = WorkbenchDraft & { roundExtendableTableCombination?: RoundExtendableTableCombinationOptions };

export function normalizeRoundTableCombinationOptions(value: unknown): SingleTemplateOptions & RoundExtendableTableCombinationOptions {
  const saved = value && typeof value === 'object' ? value as Partial<RoundExtendableTableCombinationOptions> : {};
  const chairModel = Array.isArray(saved.diningChairs?.models) ? saved.diningChairs.models[0] : '';
  return {
    sizeLabels: ['', ''], sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3, dimensionGap: 60,
    noteText: typeof saved.noteText === 'string' ? saved.noteText : '',
    heightNote: typeof saved.heightNote === 'string' ? saved.heightNote : '',
    diameterPlacement: saved.diameterPlacement === 'outside' ? 'outside' : 'surface',
    diningChairs: { count: 1, models: [typeof chairModel === 'string' ? chairModel : '', ''], markers: [{ x: .5, y: .5 }, { x: .5, y: .5 }] },
  };
}

function parseTableDimension(input: string, allowRange: boolean) {
  const parsed = parseDimensionText(input, 'truncate');
  return parsed && parsed.text.split('/').every((group) => {
    const values = group.split('~').map(Number);
    return values.length === 1 || allowRange && values.length === 2 && values[0] <= values[1];
  }) ? parsed : null;
}

export function parseRoundTableCombinationDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i);
  if (parts.length !== 2) return null;
  const diameter = parseTableDimension(parts[0], true), height = parseTableDimension(parts[1], false);
  if (!diameter || !height) return null;
  const fields = { length: '', width: '', diameter: diameter.text, height: height.text };
  return roundTableCombinationDimensionIssue(fields) ? null : fields;
}

export function formatRoundTableCombinationFields(fields: DimensionFields) {
  return `${fields.diameter ?? ''}×${fields.height}`;
}

export function roundTableCombinationDimensionIssue(fields: DimensionFields): string | null {
  if (!fields.diameter?.trim()) return '请填写餐桌直径；没有实物资料时请保持留空，不要估算';
  const diameter = parseTableDimension(fields.diameter, true);
  if (!diameter) return '直径无效：填写正数，伸缩范围由小到大用 ~，多规格用 / 分隔';
  if (!fields.height.trim()) return '请填写餐桌高度；没有实物资料时请保持留空，不要估算';
  const height = parseTableDimension(fields.height, false);
  if (!height) return '高度无效：填写正数，多规格用 / 分隔，高度不使用伸缩范围';
  const heightCount = height.text.split('/').length;
  return heightCount !== 1 && heightCount !== diameter.text.split('/').length ? '多规格高度须与直径逐项对应；共用高度只填一个数值' : null;
}

export function getRoundExtendableTableCombinationLayout(pointWidths: number[]): SingleLayout {
  const availableWidth = 1252, gap = 30;
  const equalWidth = (availableWidth - gap * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 50));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + gap; return box; });
  return {
    modelBadge: { x: 70, y: 350, height: 52 },
    productArea: { x: 180, y: 450, width: 1080, height: 600 },
    // 一个矩形同时约束整组素材和全部标注，距椅型号蓝标上沿保留30px。
    subjectSafeArea: { x: 30, y: 432, width: 1380, height: CHAIR_BADGE.y - 30 - 432 },
    sellingPoints,
    issue: total > availableWidth ? '卖点文案超出安全区，请调整完整文案或改用两个卖点' : null,
  };
}

export function roundTableCombinationModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '餐桌完整型号及规格';
  context.font = canvasFontFromPs(35, ROUND_TABLE_COMBINATION_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize: 35, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(model) ? '餐桌完整型号及规格须为单行，请将换行或制表符改为普通空格'
      : layout.modelBadge.x + width > 1410 ? '餐桌完整型号及规格超出安全区，请核对或拆分 SKU，不能省略规格' : null };
}

export function roundTableCombinationChairBadge(context: TextMeasure, options: SingleTemplateOptions) {
  const raw = normalizeRoundTableCombinationOptions(options).diningChairs.models[0];
  const text = raw.trim() || '餐椅完整型号';
  context.font = canvasFontFromPs(35, ROUND_TABLE_COMBINATION_FONT);
  const width = context.measureText(text).width + 40;
  return { text, box: { x: CHAIR_BADGE.right - width, y: CHAIR_BADGE.y, width, height: CHAIR_BADGE.height },
    issue: !raw.trim() ? '请填写组合中的餐椅完整型号，不从图片或文件名推测'
      : /[\r\n\t\u2028\u2029]/.test(raw) ? '餐椅完整型号须为单行，请将换行或制表符改为普通空格'
      : width > CHAIR_BADGE.right - 30 ? '餐椅完整型号超出安全区，请核对完整内容，不能省略型号' : null };
}

export function drawRoundTableCombinationChair(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const badge = roundTableCombinationChairBadge(context, options);
  context.beginPath();
  context.roundRect(badge.box.x, badge.box.y, badge.box.width, badge.box.height, 8);
  context.fillStyle = '#00586d'; context.fill();
  context.letterSpacing = '0px'; context.fillStyle = '#ffffff'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(badge.text, badge.box.x + badge.box.width / 2, badge.box.y + badge.box.height / 2);
}

function dimensionLines(context: TextMeasure, value: string, maximumWidth: number) {
  const lines: string[] = [];
  let line = '';
  value.split('/').forEach((group, index) => {
    const next = `${index ? ' / ' : ''}${group}cm`;
    if (line && context.measureText(line + next).width > maximumWidth) { lines.push(line); line = `/ ${group}cm`; }
    else line += next;
  });
  if (line) lines.push(line);
  return lines;
}

function wrapNote(context: TextMeasure, text: string, maximumWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const character of paragraph) {
      if (line && context.measureText(line + character).width > maximumWidth) { lines.push(line); line = ''; }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

export function roundTableCombinationDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const isHeight = annotation.kind === 'height';
  const value = parseTableDimension(fields[annotation.kind] ?? '', !isHeight)?.text ?? String(annotation.value);
  const font = canvasFontFromPs(35, ROUND_TABLE_COMBINATION_FONT);
  context.font = font;
  const lines = dimensionLines(context, value, isHeight ? 380 : 660);
  const heightNote = options.heightNote?.trim();
  if (isHeight && heightNote) lines.push(...wrapNote(context, /^[（(]/.test(heightNote) ? heightNote : `（${heightNote}）`, 380));
  const measuring = context as TextMeasure & Partial<Pick<CanvasRenderingContext2D, 'textBaseline'>>;
  const previousBaseline = measuring.textBaseline;
  if (previousBaseline) measuring.textBaseline = 'middle';
  const metrics = lines.map((line) => context.measureText(line));
  if (previousBaseline) measuring.textBaseline = previousBaseline;
  const lineHeight = Math.max(35, ...metrics.map((metric) => 2 * Math.max(metric.actualBoundingBoxAscent || 0, metric.actualBoundingBoxDescent || 0)));
  const step = lineHeight + 9;
  const onSurface = !isHeight && options.diameterPlacement !== 'outside';
  return { width: Math.max(...metrics.map((metric) => metric.width)), height: lineHeight + (lines.length - 1) * step,
    ...(onSurface ? { color: '#ffffff', lineColor: '#ffffff' } : {}),
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * step })) };
}

export function roundTableCombinationNote(options: SingleTemplateOptions) {
  const text = options.noteText?.trim();
  return text ? { text, font: canvasFontFromPs(38, ROUND_TABLE_COMBINATION_FONT), color: '#545454', x: 94, y: NOTE_TOP + 38 } : undefined;
}

export function roundTableCombinationTextIssues(context: TextMeasure, options: SingleTemplateOptions, fields?: DimensionFields): string[] {
  const issues: string[] = [];
  const chair = roundTableCombinationChairBadge(context, options);
  if (chair.issue) issues.push(chair.issue);
  const note = roundTableCombinationNote(options);
  if (note) {
    context.font = note.font;
    if (/[\r\n\t\u2028\u2029]/.test(options.noteText ?? '') || context.measureText(note.text).width > NOTE_WIDTH) issues.push('图示备注超出单行安全区，请调整为一行完整说明');
  }
  if (fields) for (const kind of ['diameter', 'height'] as const) {
    const parsed = parseTableDimension(fields[kind] ?? '', kind === 'diameter');
    if (!parsed) continue;
    const label = roundTableCombinationDimensionLabel(context, { kind, label: kind === 'diameter' ? '直径' : '高', value: parsed.value, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, fields, options);
    if (label.width > (kind === 'diameter' ? 660 : 380) || label.height > 300) issues.push(`${kind === 'diameter' ? '直径规格' : '高度及说明'}过长，已保留全部文字；请核对内容或拆分为独立 SKU`);
  }
  return issues;
}
