import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const STANDING_DESK_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const STANDING_DESK_HEADLINE_FONT = '"Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif';
export const STANDING_DESK_MODEL_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const STANDING_DESK_TEXT_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const STANDING_DESK_HEADLINE = { x: 94, y: 300, width: 1252, height: 80 };
export type StandingDeskOptions = { headline: string; sellingPointCount: 2 | 3 };
export type StandingDeskDraft = WorkbenchDraft & { standingDesk?: StandingDeskOptions };

export function normalizeStandingDeskOptions(value: unknown): SingleTemplateOptions & StandingDeskOptions {
  const saved = value && typeof value === 'object' ? value as Partial<StandingDeskOptions> : {};
  return { sizeLabels: ['', ''], dimensionGap: 60,
    headline: typeof saved.headline === 'string' ? saved.headline : '',
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3 };
}

export function standingDeskHeadlineIssue(text: string, context?: TextMeasure): string | null {
  if (!text.trim()) return '请填写主标题，内容须依据当前产品资料';
  if (/[\r\n\t\u2028\u2029]/.test(text)) return '主标题请填写单行文字';
  if (context) {
    context.font = canvasFontFromPs(80, STANDING_DESK_HEADLINE_FONT);
    if (context.measureText(text.trim()).width > STANDING_DESK_HEADLINE.width) return '主标题过长，80号字已超出安全区，请核对文案';
  }
  return null;
}

export function getStandingDeskSingleLayout(pointWidths: number[]): SingleLayout {
  // P43图示去除上、右100px说明边后对应1440画布；字号及270/30/130留白来自规范，其余位置由原图推定。
  const side = 94, availableWidth = 1252, gap = 30, sellingY = 1210;
  const equalWidth = (availableWidth - 4 - gap * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 40));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) + 4 > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 40));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: sellingY, width, height: 98 }; x += width + gap; return box; });
  return { modelBadge: { x: side, y: 410, height: 72 },
    productArea: { x: 340, y: 605, width: 760, height: 515 },
    subjectSafeArea: { x: side, y: 512, width: availableWidth, height: sellingY - 2 - 60 - 512 }, sellingPoints,
    issue: total + 4 > availableWidth ? '卖点文案总宽度超出安全区，请调整文案；框高98px和横向间距30px保持不变' : null };
}

export function standingDeskModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号及完整规格';
  context.font = canvasFontFromPs(45, STANDING_DESK_MODEL_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '型号及完整规格请填写在一行内'
      : layout.modelBadge.x + width > 1346 ? '型号及完整规格过长，45号字已超出安全区，请核对内容，不能省略规格' : null };
}

export function parseStandingDeskDimensions(input: string): DimensionFields | null {
  return parseDimensionFields(input, 'truncate');
}

const dimensionWidths = { length: 900, width: 460, height: 260 };
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string) {
  context.font = canvasFontFromPs(45, STANDING_DESK_TEXT_FONT);
  const lines: string[] = [];
  let line = '';
  for (const token of (`${value}cm`).match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > dimensionWidths[kind]) { lines.push(line); line = ''; }
    line += token;
    // P43的升降高度将范围上限另起一行，保留~，不拆开数字或省略尺寸。
    if (kind === 'height' && token.endsWith('~')) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export function standingDeskDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind], 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value);
  const font = canvasFontFromPs(45, STANDING_DESK_TEXT_FONT);
  // 40为基线间距，不与45号字高相加。
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: 45 + (lines.length - 1) * 40,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}

export function standingDeskDimensionIssue(fields: DimensionFields, context?: TextMeasure): string | null {
  const names = { length: '长', width: '宽', height: '高' };
  for (const kind of ['length', 'width', 'height'] as const) {
    if (!fields[kind].trim()) return `请填写电动升降桌${names[kind]}尺寸，不能根据图片推测真实尺寸`;
    const value = parseDimensionText(fields[kind], 'truncate');
    if (!value) return `电动升降桌${names[kind]}尺寸无效：须为正数，并列规格用 /、升降范围用 ~ 分隔（cm）`;
    if (context) {
      const lines = dimensionLines(context, kind, value.text);
      if (lines.length > 4 || lines.some((line) => context.measureText(line).width > dimensionWidths[kind])) {
        return `电动升降桌${names[kind]}尺寸过长或规格过多，折行后仍超出标注区域，请核对完整数据或分成多张SKU，不可删减规格`;
      }
    }
  }
  return null;
}

export function drawStandingDeskHeadline(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const headline = normalizeStandingDeskOptions(options).headline;
  context.save();
  if (standingDeskHeadlineIssue(headline, context)) { context.restore(); return; }
  context.font = canvasFontFromPs(80, STANDING_DESK_HEADLINE_FONT);
  context.fillStyle = '#000000'; context.textAlign = 'left'; context.textBaseline = 'middle';
  context.fillText(headline.trim(), STANDING_DESK_HEADLINE.x, STANDING_DESK_HEADLINE.y + STANDING_DESK_HEADLINE.height / 2);
  context.restore();
}
