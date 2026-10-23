import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

// 第38页独立规范；坐标从1440方图区域推导，未借用品类模板常量。
export const ROUND_EXTENDABLE_TABLE_DIMENSION_KINDS: DimensionKind[] = ['diameter', 'height'];
export const ROUND_EXTENDABLE_TABLE_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const ROUND_EXTENDABLE_TABLE_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const ROUND_EXTENDABLE_TABLE_DEFAULT_GAP = 60;
export const ROUND_EXTENDABLE_TABLE_MIN_GAP = 30;
export const ROUND_EXTENDABLE_TABLE_MAX_GAP = 120;
const NOTE_FONT_SIZE = 38;
const DIMENSION_FONT_SIZE = 45;
const LABEL_MAX_HEIGHT = 300;
const NOTE_WIDTH = 1252;
// 备注预留50px字面高度，含alphabetic基线以下12px；距卖点外缘30px。
const NOTE_TOP = 1180;
const NOTE_BASELINE = NOTE_TOP + NOTE_FONT_SIZE;

export type RoundExtendableTableOptions = Pick<SingleTemplateOptions, 'sellingPointCount' | 'dimensionGap'> & { noteText: string; heightNote: string };
export type RoundExtendableTableDraft = WorkbenchDraft & { roundExtendableTable?: RoundExtendableTableOptions };

export function createRoundExtendableTableFields(): DimensionFields {
  return { length: '', width: '', height: '', diameter: '' };
}

export function normalizeRoundExtendableTableOptions(value: unknown): SingleTemplateOptions & RoundExtendableTableOptions {
  const saved = value && typeof value === 'object' ? value as Partial<RoundExtendableTableOptions> : {};
  return {
    sizeLabels: ['', ''],
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap)
      ? Math.max(ROUND_EXTENDABLE_TABLE_MIN_GAP, Math.min(ROUND_EXTENDABLE_TABLE_MAX_GAP, saved.dimensionGap)) : ROUND_EXTENDABLE_TABLE_DEFAULT_GAP,
    noteText: typeof saved.noteText === 'string' ? saved.noteText : '',
    heightNote: typeof saved.heightNote === 'string' ? saved.heightNote : '',
  };
}

function parseTableDimension(input: string, allowRange: boolean) {
  const parsed = parseDimensionText(input, 'truncate');
  if (!parsed) return null;
  const valid = parsed.text.split('/').every((group) => {
    const values = group.split('~').map(Number);
    return values.length === 1 || allowRange && values.length === 2 && values[0] <= values[1];
  });
  return valid ? parsed : null;
}

export function parseRoundExtendableTableDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i);
  if (parts.length !== 2) return null;
  const diameter = parseTableDimension(parts[0], true), height = parseTableDimension(parts[1], false);
  if (!diameter || !height) return null;
  const fields = { ...createRoundExtendableTableFields(), diameter: diameter.text, height: height.text };
  return roundExtendableTableDimensionIssue(fields) ? null : fields;
}

export function formatRoundExtendableTableFields(fields: DimensionFields) {
  return `${fields.diameter ?? ''}×${fields.height}`;
}

export function roundExtendableTableDimensionIssue(fields: DimensionFields): string | null {
  if (!fields.diameter?.trim()) return '请填写直径尺寸；没有产品资料时请保持留空，不要估算';
  if (!parseTableDimension(fields.diameter, true)) return '直径尺寸无效：填写正数，伸缩范围由小到大用 ~，多规格用 / 分隔';
  if (!fields.height.trim()) return '请填写高度尺寸；没有产品资料时请保持留空，不要估算';
  if (!parseTableDimension(fields.height, false)) return '高度尺寸无效：填写正数，多规格用 / 分隔';
  const diameterCount = parseTableDimension(fields.diameter, true)!.text.split('/').length;
  const heightCount = parseTableDimension(fields.height, false)!.text.split('/').length;
  if (heightCount !== 1 && heightCount !== diameterCount) return '多规格高度须与直径逐项对应；共用高度只填一个数值';
  return null;
}

export function getRoundExtendableTableSingleLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const normalized = normalizeRoundExtendableTableOptions(options);
  const availableWidth = 1252, gap = 30;
  const equalWidth = (availableWidth - gap * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 50));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + gap; return box; });
  const bottom = (normalized.noteText.trim() ? NOTE_TOP : 1260) - normalized.dimensionGap;
  return {
    modelBadge: { x: 70, y: 350, height: 72 },
    productArea: { x: 320, y: 535, width: 800, height: bottom - 535 },
    subjectSafeArea: { x: 30, y: 452, width: 1380, height: bottom - 452 },
    sellingPoints,
    issue: total > availableWidth ? '卖点文案超出安全区，请调整文案或改用两个卖点' : null,
  };
}

export function roundExtendableTableModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号及完整规格';
  context.font = canvasFontFromPs(45, ROUND_EXTENDABLE_TABLE_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t]/.test(model) ? '型号及完整规格须为单行，请将换行或制表符改为普通空格'
      : layout.modelBadge.x + width > 1410 ? '型号及完整规格超出单行安全区，请核对或拆分为独立 SKU，不能省略规格' : null };
}

function dimensionLines(context: TextMeasure, text: string, maximumWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  text.split('/').forEach((group, index) => {
    const next = `${index ? ' / ' : ''}${group}cm`;
    if (line && context.measureText(line + next).width > maximumWidth) {
      lines.push(line);
      line = `/ ${group}cm`;
    } else line += next;
  });
  if (line) lines.push(line);
  return lines;
}

function wrapHeightNote(context: TextMeasure, text: string, maximumWidth: number): string[] {
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

export function roundExtendableTableDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const isHeight = annotation.kind === 'height';
  const value = parseTableDimension(fields[annotation.kind] ?? '', !isHeight)?.text ?? String(annotation.value);
  const maximumWidth = isHeight ? 380 : 660;
  const font = canvasFontFromPs(DIMENSION_FONT_SIZE, ROUND_EXTENDABLE_TABLE_FONT);
  context.font = font;
  const lines = dimensionLines(context, value, maximumWidth);
  const heightNote = options.heightNote?.trim();
  if (isHeight && heightNote) {
    const text = /^[（(]/.test(heightNote) ? heightNote : `（${heightNote}）`;
    lines.push(...wrapHeightNote(context, text, maximumWidth));
  }
  // 绘制使用middle基线；按相同基线量字，完整高度也用于拖动、避让和命中范围。
  const measuring = context as TextMeasure & Partial<Pick<CanvasRenderingContext2D, 'textBaseline'>>;
  const previousBaseline = measuring.textBaseline;
  if (previousBaseline) measuring.textBaseline = 'middle';
  const metrics = lines.map((line) => context.measureText(line));
  if (previousBaseline) measuring.textBaseline = previousBaseline;
  const lineHeight = Math.max(DIMENSION_FONT_SIZE, ...metrics.map((metric) => 2 * Math.max(metric.actualBoundingBoxAscent || 0, metric.actualBoundingBoxDescent || 0)));
  const step = lineHeight + 9;
  return { width: Math.max(...metrics.map((metric) => metric.width)), height: lineHeight + (lines.length - 1) * step,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * step })) };
}

export function roundExtendableTableNote(options: SingleTemplateOptions) {
  const text = options.noteText?.trim();
  return text ? { text, font: canvasFontFromPs(NOTE_FONT_SIZE, ROUND_EXTENDABLE_TABLE_FONT), color: '#545454', x: 94, y: NOTE_BASELINE } : undefined;
}

export function roundExtendableTableTextIssues(context: TextMeasure, fields: DimensionFields, options: SingleTemplateOptions): string[] {
  const issues: string[] = [];
  const note = roundExtendableTableNote(options);
  if (note) {
    context.font = note.font;
    if (/[\r\n]/.test(note.text) || context.measureText(note.text).width > NOTE_WIDTH) issues.push('底部备注超出单行安全区，请调整为一行完整说明');
  }
  for (const kind of ['diameter', 'height'] as const) {
    const parsed = parseTableDimension(fields[kind] ?? '', kind === 'diameter');
    if (!parsed) continue;
    const label = roundExtendableTableDimensionLabel(context, { kind, label: kind === 'diameter' ? '直径' : '高', value: parsed.value, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, fields, options);
    if (label.width > (kind === 'diameter' ? 660 : 380) || label.height > LABEL_MAX_HEIGHT) {
      issues.push(`${kind === 'diameter' ? '直径规格' : '高度及说明'}过长，已保留全部文字；请核对内容或拆分为独立 SKU`);
    }
  }
  return issues;
}
