import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const LONG_DINING_TABLE_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const LONG_DINING_TABLE_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const LONG_DINING_TABLE_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const LONG_DINING_TABLE_DEFAULT_GAP = 60;
export const LONG_DINING_TABLE_MIN_GAP = 30;
export const LONG_DINING_TABLE_MAX_GAP = 100;
export const LONG_DINING_TABLE_NOTE_LIMIT = 24;
export type LongDiningTableOptions = {
  noteText: string;
  heightNote: string;
  sellingPointCount: 2 | 3;
  dimensionGap: number;
};
export type LongDiningTableDraft = WorkbenchDraft & { longDiningTable?: LongDiningTableOptions };

export function normalizeLongDiningTableOptions(value: unknown): SingleTemplateOptions & LongDiningTableOptions {
  const saved = value && typeof value === 'object' ? value as Partial<LongDiningTableOptions> : {};
  return {
    sizeLabels: ['', ''],
    noteText: typeof saved.noteText === 'string' ? saved.noteText : '',
    heightNote: typeof saved.heightNote === 'string' ? saved.heightNote : '',
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap)
      ? Math.max(LONG_DINING_TABLE_MIN_GAP, Math.min(LONG_DINING_TABLE_MAX_GAP, saved.dimensionGap)) : LONG_DINING_TABLE_DEFAULT_GAP,
  };
}

export function longDiningTableNoteIssue(text: string): string | null {
  if (/[\r\n\t\u2028\u2029]/.test(text)) return '备注请填写单行文字，避免覆盖卖点';
  // 单行备注保守限制长度，为38pt中文及较宽英文字符留足空间；不截掉原始内容。
  return Array.from(text).length > LONG_DINING_TABLE_NOTE_LIMIT ? `备注过长，请控制在${LONG_DINING_TABLE_NOTE_LIMIT}个字符以内，避免超出画布或覆盖卖点` : null;
}

export function getLongDiningTableSingleLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const { dimensionGap, noteText } = normalizeLongDiningTableOptions(options);
  // 第35页原图的1440画布：底部30+50px留白、98px卖点框、上方30px备注间隔。
  const side = 30, availableWidth = 1380, gap = 30, sellingY = 1262;
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) > availableWidth - 4) {
    widths = pointWidths.map((width) => Math.max(150, width + 50));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: sellingY, width, height: 98 }; x += width + gap; return box; });
  // 备注字框50px含上下余量；与卖点边框相隔30px，产品及所有尺寸一起避让。
  const textTop = noteText.trim() ? sellingY - 2 - 30 - 50 : sellingY - 2;
  const bottom = textTop - dimensionGap;
  return {
    modelBadge: { x: 70, y: 344, height: 72 },
    productArea: { x: 230, y: 620, width: 1110, height: bottom - 620 },
    subjectSafeArea: { x: side, y: 466, width: availableWidth, height: bottom - 466 },
    sellingPoints,
    issue: total + 4 > availableWidth ? '卖点文案总宽度超出安全区，请调整文案；框高98px和横向间距30px保持不变' : null,
  };
}

export function longDiningTableNote(options: SingleTemplateOptions, layout: SingleLayout) {
  const { noteText } = normalizeLongDiningTableOptions(options);
  if (!noteText.trim() || longDiningTableNoteIssue(noteText)) return undefined;
  // 公共绘制采用alphabetic基线，38px字体加12px余量后仍与卖点边框相隔30px。
  return { text: noteText, font: canvasFontFromPs(38, LONG_DINING_TABLE_FONT), color: '#545454', x: 94, y: (layout.sellingPoints[0]?.y ?? 1262) - 2 - 30 - 12 };
}

export function longDiningTableModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号及完整规格';
  context.font = canvasFontFromPs(45, LONG_DINING_TABLE_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '型号及完整规格请填写在一行内，不能省略规格'
      : layout.modelBadge.x + width > 1410 ? '型号及完整规格过长，45号字已超出安全区，请核对内容，不能省略规格' : null };
}

export function parseLongDiningTableDimensions(input: string): DimensionFields | null {
  return parseDimensionFields(input, 'truncate');
}

const labelWidths = { length: 900, width: 420, height: 360 };

function wrapMeasuredText(context: TextMeasure, tokens: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    if (line && context.measureText(line + token).width > maxWidth) { lines.push(line); line = ''; }
    line += token;
  }
  if (line) lines.push(line);
  return lines;
}

function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string, heightNote: string) {
  context.font = canvasFontFromPs(45, LONG_DINING_TABLE_FONT);
  // 分隔符保留在上一行；不截断数字、不省略中间规格，拼接各行仍为完整原尺寸。
  const lines = wrapMeasuredText(context, (`${value}cm`).match(/[^~/]+[~/]?/g) ?? [], labelWidths[kind]);
  if (kind === 'height' && heightNote.trim()) {
    lines.push(...wrapMeasuredText(context, Array.from(`（${heightNote.trim()}）`), labelWidths.height));
  }
  return lines;
}

export function longDiningTableDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind] ?? String(annotation.value), 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value, options.heightNote ?? '');
  const font = canvasFontFromPs(45, LONG_DINING_TABLE_FONT), lineHeight = 54;
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: lines.length * lineHeight,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * lineHeight })) };
}

export function longDiningTableDimensionIssue(fields: DimensionFields, options: SingleTemplateOptions): string | null {
  const names = { length: '长', width: '宽', height: '高' };
  const heightNote = options.heightNote ?? '';
  if (/[\r\n\t\u2028\u2029]/.test(heightNote)) return '高度补充说明请填写连续文字，由模板自动折行';
  // 导出检查没有Canvas上下文，用每字符一个em的保守上界检查数字与中文排版容量。
  const measure: TextMeasure = { font: '', measureText: (text) => ({ width: Array.from(text).length * 45 } as TextMetrics) };
  for (const kind of ['length', 'width', 'height'] as const) {
    if (!fields[kind].trim()) return `请填写餐桌${names[kind]}尺寸，不能根据图片推测真实尺寸`;
    const value = parseDimensionText(fields[kind], 'truncate');
    if (!value) return `餐桌${names[kind]}尺寸无效：须为正数，并列规格用 /、范围用 ~ 分隔（cm）`;
    const lines = dimensionLines(measure, kind, value.text, heightNote);
    if (lines.some((line) => measure.measureText(line).width > labelWidths[kind]) || lines.length > 5) {
      return `餐桌${names[kind]}尺寸${kind === 'height' && heightNote.trim() ? '及高度说明' : ''}过长或规格过多，折行后仍超出标注区域；请核对完整数据，必要时分成多张SKU，不可删减规格`;
    }
  }
  return null;
}
