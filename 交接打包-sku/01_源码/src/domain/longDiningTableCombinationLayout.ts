import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const LONG_DINING_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const LONG_DINING_SET_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const LONG_DINING_SET_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const LONG_DINING_SET_NOTE_INLINE_LIMIT = 16;
export const LONG_DINING_SET_DEFAULT_GAP = 60;
export type LongDiningTableCombinationOptions = {
  noteText: string;
  heightNote: string;
  sellingPointCount: 2 | 3;
  dimensionGap: number;
  diningChairs: NonNullable<SingleTemplateOptions['diningChairs']>;
};
export type LongDiningTableCombinationDraft = WorkbenchDraft & { longDiningTableCombination?: LongDiningTableCombinationOptions };

function coordinate(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export function normalizeLongDiningTableCombinationOptions(value: unknown): SingleTemplateOptions & LongDiningTableCombinationOptions {
  const saved = value && typeof value === 'object' ? value as Partial<LongDiningTableCombinationOptions> : {};
  const chairs = saved.diningChairs;
  const marker = (index: 0 | 1, x: number, y: number) => ({ x: coordinate(chairs?.markers?.[index]?.x, x), y: coordinate(chairs?.markers?.[index]?.y, y) });
  return {
    sizeLabels: ['', ''], noteText: typeof saved.noteText === 'string' ? saved.noteText : '', heightNote: typeof saved.heightNote === 'string' ? saved.heightNote : '',
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap) ? Math.max(30, Math.min(100, saved.dimensionGap)) : LONG_DINING_SET_DEFAULT_GAP,
    diningChairs: { count: chairs?.count === 2 ? 2 : 1,
      models: [typeof chairs?.models?.[0] === 'string' ? chairs.models[0] : '', typeof chairs?.models?.[1] === 'string' ? chairs.models[1] : ''],
      markers: [marker(0, .2, .15), marker(1, .5, .8)] },
  };
}

export function longDiningTableCombinationNoteIssue(text: string): string | null {
  if (/[\r\n\t\u2028\u2029]/.test(text)) return '图示备注请填写连续文字，长备注会自动在底部居中排版';
  return null;
}

export function longDiningTableCombinationFooterLines(options: SingleTemplateOptions, context?: TextMeasure): string[] {
  const text = options.noteText ?? '';
  if (Array.from(text).length <= LONG_DINING_SET_NOTE_INLINE_LIMIT || !text.trim() || longDiningTableCombinationNoteIssue(text)) return [];
  if (context) context.font = canvasFontFromPs(38, LONG_DINING_SET_FONT);
  // 非绘图调用没有字体度量时，按每字38px保守预留；画布使用实际字体。
  const measure = context ?? { font: '', measureText: (line: string) => ({ width: Array.from(line).length * 38 } as TextMetrics) };
  return wrap(measure, Array.from(text), 1320);
}

function footerShift(options: SingleTemplateOptions, context?: TextMeasure) {
  return Math.max(0, longDiningTableCombinationFooterLines(options, context).length - 1) * 44;
}

function chairRows(options: SingleTemplateOptions, context: TextMeasure) {
  const { count } = normalizeLongDiningTableCombinationOptions(options).diningChairs;
  const shift = Math.min(412, footerShift(options, context));
  return Array.from({ length: count }, (_, index) => ({ y: 1196 - shift - count * 52 - (count - 1) * 15 + index * 67, height: 52 }));
}

export function getLongDiningTableCombinationLayout(pointWidths: number[], options: SingleTemplateOptions, context?: TextMeasure): SingleLayout {
  const { dimensionGap } = normalizeLongDiningTableCombinationOptions(options);
  let widths = pointWidths.map((width) => Math.max(394, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + 30 * Math.max(0, widths.length - 1) > 1376) widths = pointWidths.map((width) => Math.max(150, width + 50));
  const total = widths.reduce((sum, width) => sum + width, 0) + 30 * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const shift = footerShift(options, context), sellingY = Math.max(850, 1262 - shift);
  const sellingPoints = widths.map((width) => { const box = { x, y: sellingY, width, height: 98 }; x += width + 30; return box; });
  // 餐椅型号可覆盖主图；只为卖点及仍在其上方的短备注保留空间。
  const inlineNote = Boolean(options.noteText?.trim()) && Array.from(options.noteText!).length <= LONG_DINING_SET_NOTE_INLINE_LIMIT;
  const bottom = sellingY - (inlineNote ? 82 : 2) - dimensionGap;
  return { modelBadge: { x: 70, y: 344, height: 52 }, productArea: { x: 200, y: 510, width: 1120, height: bottom - 510 },
    subjectSafeArea: { x: 30, y: 446, width: 1380, height: bottom - 446 }, sellingPoints,
    issue: shift > 412 ? '图示备注行数过多，已保留全文；请精简说明或拆分SKU，避免挤占产品区域'
      : total + 4 > 1380 ? '卖点文案总宽度超出安全区，请调整文案；框高98px和横向间距30px保持不变' : null };
}

export function longDiningTableCombinationNote(options: SingleTemplateOptions, layout: SingleLayout) {
  const text = options.noteText ?? '';
  if (!text.trim() || longDiningTableCombinationNoteIssue(text) || Array.from(text).length > LONG_DINING_SET_NOTE_INLINE_LIMIT) return undefined;
  return { text, font: canvasFontFromPs(38, LONG_DINING_SET_FONT), color: '#545454', x: 94, y: (layout.sellingPoints[0]?.y ?? 1262) - 44 };
}

export function longDiningTableCombinationModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '餐桌型号及完整规格';
  context.font = canvasFontFromPs(35, LONG_DINING_SET_FONT);
  const width = context.measureText(text).width + 40;
  return { text, fontSize: 35, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '餐桌型号及完整规格请填写在一行内，不能省略规格'
      : layout.modelBadge.x + width > 1410 ? '餐桌型号及完整规格过长，35号字已超出安全区，请核对内容，不能省略规格' : null };
}

export function longDiningTableCombinationChairBadges(context: TextMeasure, options: SingleTemplateOptions) {
  const { diningChairs } = normalizeLongDiningTableCombinationOptions(options);
  const rows = chairRows(options, context);
  context.font = canvasFontFromPs(35, LONG_DINING_SET_FONT);
  return rows.map((row, index) => {
    const raw = diningChairs.models[index], text = raw.trim() || `第${index + 1}款餐椅/长凳型号`;
    const width = context.measureText(text).width + (diningChairs.count === 2 ? 76 : 40);
    return { text, number: diningChairs.count === 2 ? String(index + 1) : '', box: { ...row, x: 1340 - width, width },
      issue: !raw.trim() ? `请填写第${index + 1}款餐椅/长凳的完整型号，不要根据图片推测`
        : /[\r\n\t\u2028\u2029]/.test(raw) ? `第${index + 1}款餐椅/长凳型号请填写在一行内`
          : width > 560 ? `第${index + 1}款餐椅/长凳型号过长，35号完整文字超出右下型号区域，请核对内容，不可省略型号` : null };
  });
}

export function longDiningTableCombinationExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const issues = longDiningTableCombinationChairBadges(context, options).flatMap((badge) => badge.issue ? [badge.issue] : []);
  if (fields) {
    const names = { length: '长', width: '宽', height: '高' };
    for (const kind of ['length', 'width', 'height'] as const) {
      const parsed = parseDimensionText(fields[kind], 'truncate', true);
      if (!parsed) continue;
      const lines = dimensionLines(context, kind, parsed.text, options.heightNote ?? '');
      if (lines.length > 5 || lines.some((line) => context.measureText(line).width > labelWidths[kind])) issues.push(`餐桌${names[kind]}尺寸${kind === 'height' && options.heightNote?.trim() ? '及高度说明' : ''}过长或规格过多，折行后仍超出标注区域；请核对完整数据，必要时分成多张SKU，不可删减规格`);
    }
  }
  return issues;
}

export function drawLongDiningTableCombinationExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions, layout: SingleLayout, productRect?: Rect) {
  const { diningChairs } = normalizeLongDiningTableCombinationOptions(options);
  const badges = longDiningTableCombinationChairBadges(context, options);
  context.save();
  context.textBaseline = 'middle';
  badges.forEach(({ box, text, number }) => {
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(box.x, box.y, box.width, box.height, 8); context.fill();
    if (number) {
      context.fillStyle = '#ffffff'; context.beginPath(); context.arc(box.x + 30, box.y + 26, 15, 0, Math.PI * 2); context.fill();
      context.font = canvasFontFromPs(25, 'Montserrat, sans-serif'); context.textAlign = 'center'; context.fillStyle = '#00586d'; context.fillText(number, box.x + 30, box.y + 26);
    }
    context.font = canvasFontFromPs(35, LONG_DINING_SET_FONT); context.textAlign = 'left'; context.fillStyle = '#ffffff'; context.fillText(text, box.x + (number ? 56 : 20), box.y + 26);
  });
  if (diningChairs.count === 2 && productRect) {
    diningChairs.markers.forEach((marker, index) => {
      const insetX = Math.min(20, productRect.width / 2), insetY = Math.min(20, productRect.height / 2);
      const x = productRect.x + Math.min(productRect.width - insetX, Math.max(insetX, marker.x * productRect.width));
      const y = productRect.y + Math.min(productRect.height - insetY, Math.max(insetY, marker.y * productRect.height));
      context.fillStyle = '#00586d'; context.beginPath(); context.arc(x, y, 20, 0, Math.PI * 2); context.fill();
      context.font = canvasFontFromPs(35, 'Montserrat, sans-serif'); context.textAlign = 'center'; context.fillStyle = '#ffffff'; context.fillText(String(index + 1), x, y);
    });
  }
  const footer = longDiningTableCombinationFooterLines(options, context);
  context.fillStyle = '#545454'; context.textAlign = 'center'; context.textBaseline = 'alphabetic';
  const footerY = (layout.sellingPoints[0]?.y ?? 1262) + 142;
  footer.forEach((line, index) => context.fillText(line, 720, footerY + index * 44));
  context.restore();
}

export function parseLongDiningTableCombinationDimensions(input: string): DimensionFields | null { return parseDimensionFields(input, 'truncate', true); }

const labelWidths = { length: 900, width: 360, height: 300 };
function wrap(context: TextMeasure, tokens: string[], width: number) {
  const lines: string[] = []; let line = '';
  for (const token of tokens) { if (line && context.measureText(line + token).width > width) { lines.push(line); line = ''; } line += token; }
  if (line) lines.push(line);
  return lines;
}
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string, heightNote: string) {
  context.font = canvasFontFromPs(35, LONG_DINING_SET_FONT);
  const text = value.replace(/(\d)([^\d]*)$/, '$1cm$2');
  const tokens = /\p{Script=Han}/u.test(value) ? Array.from(text) : text.match(/[^~/]+[~/]?/g) ?? [];
  const lines = wrap(context, tokens, labelWidths[kind]);
  if (kind === 'height' && heightNote.trim()) lines.push(...wrap(context, Array.from(`（${heightNote.trim()}）`), labelWidths.height));
  return lines;
}

export function longDiningTableCombinationDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, options: SingleTemplateOptions): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind] ?? String(annotation.value), 'truncate', true)?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value, options.heightNote ?? '');
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: lines.length * 44,
    runs: lines.map((text, index) => ({ text, font: canvasFontFromPs(35, LONG_DINING_SET_FONT), x: 0, y: (index - (lines.length - 1) / 2) * 44 })) };
}

export function longDiningTableCombinationDimensionIssue(fields: DimensionFields, options: SingleTemplateOptions): string | null {
  const names = { length: '长', width: '宽', height: '高' }, heightNote = options.heightNote ?? '';
  if (/[\r\n\t\u2028\u2029]/.test(heightNote)) return '高度补充说明请填写连续文字，由模板自动折行';
  for (const kind of ['length', 'width', 'height'] as const) {
    if (!fields[kind].trim()) return `请填写餐桌${names[kind]}尺寸，不能根据图片推测真实尺寸`;
    const parsed = parseDimensionText(fields[kind], 'truncate', true);
    if (!parsed) return `餐桌${names[kind]}尺寸无效：请保留正数，可在前后添加中文说明；并列规格用 /、范围用 ~ 分隔（cm）`;
  }
  return null;
}
