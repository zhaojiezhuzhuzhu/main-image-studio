import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const STUDY_DESK_SINGLE_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const STUDY_DESK_SINGLE_MODEL_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const STUDY_DESK_SINGLE_TEXT_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const STUDY_DESK_SINGLE_MIN_GAP = 60;
export const STUDY_DESK_SINGLE_MAX_GAP = 180;
export type StudyDeskSingleOptions = Pick<SingleTemplateOptions, 'sellingPointCount' | 'dimensionGap'>;
export type StudyDeskSingleDraft = WorkbenchDraft & { studyDeskSingle?: StudyDeskSingleOptions };

export function normalizeStudyDeskSingleOptions(value: unknown): SingleTemplateOptions {
  const saved = value && typeof value === 'object' ? value as Partial<StudyDeskSingleOptions> : {};
  return { sizeLabels: ['', ''], sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap)
      ? Math.max(STUDY_DESK_SINGLE_MIN_GAP, Math.min(STUDY_DESK_SINGLE_MAX_GAP, saved.dimensionGap)) : STUDY_DESK_SINGLE_MIN_GAP };
}

export function getStudyDeskSingleLayout(pointWidths: number[], dimensionGap = STUDY_DESK_SINGLE_MIN_GAP): SingleLayout {
  // P47去除上、右100px说明边后为1440画布；270/80/130留白来自图示，其余产品区域为图示推定。
  const side = 94, availableWidth = 1252, gap = 30, sellingY = 1210, borderHalf = 2;
  const equalWidth = (availableWidth - borderHalf * 2 - gap * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 40));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) + borderHalf * 2 > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 40));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: sellingY, width, height: 98 }; x += width + gap; return box; });
  const bottom = sellingY - borderHalf - normalizeStudyDeskSingleOptions({ dimensionGap }).dimensionGap;
  return { modelBadge: { x: side, y: 350, height: 72 },
    productArea: { x: 440, y: 535, width: 640, height: bottom - 535 },
    subjectSafeArea: { x: side, y: 452, width: availableWidth, height: bottom - 452 }, sellingPoints,
    issue: total + borderHalf * 2 > availableWidth ? '卖点文案总宽度超出安全区，请调整文案；框高98px和横向间距30px保持不变' : null };
}

export function studyDeskSingleModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号及完整规格';
  context.font = canvasFontFromPs(45, STUDY_DESK_SINGLE_MODEL_FONT);
  // P46允许完整型号过长时使用35号；700px切换阈值为图示推定，不删改型号。
  const fontSize = context.measureText(text).width + 48 > 700 ? 35 : 45;
  context.font = canvasFontFromPs(fontSize, STUDY_DESK_SINGLE_MODEL_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '型号及完整规格请填写在一行内'
      : layout.modelBadge.x + width > 1346 ? '型号及完整规格过长，35号字仍超出安全区，请核对内容，不能省略规格' : null };
}

export function parseStudyDeskSingleDimensions(input: string): DimensionFields | null {
  return parseDimensionFields(input, 'truncate');
}

const dimensionWidths = { length: 900, width: 460, height: 260 };
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string) {
  context.font = canvasFontFromPs(45, STUDY_DESK_SINGLE_TEXT_FONT);
  const lines: string[] = [];
  let line = '';
  for (const token of (`${value}cm`).match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > dimensionWidths[kind]) { lines.push(line); line = ''; }
    line += token;
    if (kind === 'height' && token.endsWith('~')) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export function studyDeskSingleDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind], 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value);
  const font = canvasFontFromPs(45, STUDY_DESK_SINGLE_TEXT_FONT);
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: 45 + (lines.length - 1) * 40,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}

export function studyDeskSingleDimensionIssue(fields: DimensionFields, context?: TextMeasure): string | null {
  const names = { length: '长', width: '宽', height: '高' };
  for (const kind of ['length', 'width', 'height'] as const) {
    if (!fields[kind].trim()) return `请填写儿童学习桌${names[kind]}尺寸，不能根据图片推测真实尺寸`;
    const value = parseDimensionText(fields[kind], 'truncate');
    if (!value) return `儿童学习桌${names[kind]}尺寸无效：须为正数，并列规格用 /、升降范围用 ~ 分隔（cm）`;
    if (context) {
      const lines = dimensionLines(context, kind, value.text);
      if (lines.length > 4 || lines.some((line) => context.measureText(line).width > dimensionWidths[kind])) {
        return `儿童学习桌${names[kind]}尺寸过长或规格过多，折行后仍超出标注区域，请核对完整数据或分成多张SKU，不可删减规格`;
      }
    }
  }
  return null;
}
