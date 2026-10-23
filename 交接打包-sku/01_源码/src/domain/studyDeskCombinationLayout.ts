import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const STUDY_DESK_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const STUDY_DESK_SET_DIMENSION_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const STUDY_DESK_SET_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const STUDY_DESK_SET_MIN_GAP = 60;
export const STUDY_DESK_SET_MAX_GAP = 180;
export const STUDY_DESK_SET_DEFAULT_GAP = 140;
export type StudyDeskCombinationOptions = { studyChairModel: string; sellingPointCount: 2 | 3; dimensionGap: number };
export type StudyDeskCombinationDraft = WorkbenchDraft & { studyDeskCombination?: StudyDeskCombinationOptions };

export function normalizeStudyDeskCombinationOptions(value: unknown): SingleTemplateOptions & StudyDeskCombinationOptions {
  const saved = value && typeof value === 'object' ? value as Partial<StudyDeskCombinationOptions> : {};
  return { sizeLabels: ['', ''], studyChairModel: typeof saved.studyChairModel === 'string' ? saved.studyChairModel : '',
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    dimensionGap: typeof saved.dimensionGap === 'number' && Number.isFinite(saved.dimensionGap)
      ? Math.max(STUDY_DESK_SET_MIN_GAP, Math.min(STUDY_DESK_SET_MAX_GAP, saved.dimensionGap)) : STUDY_DESK_SET_DEFAULT_GAP };
}

export function getStudyDeskCombinationLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const { dimensionGap } = normalizeStudyDeskCombinationOptions(options);
  const equalWidth = (1248 - 30 * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 40));
  if (widths.reduce((sum, width) => sum + width, 0) + 30 * Math.max(0, widths.length - 1) > 1248) widths = pointWidths.map((width) => Math.max(150, width + 40));
  const total = widths.reduce((sum, width) => sum + width, 0) + 30 * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1212, width, height: 98 }; x += width + 30; return box; });
  const bottom = 1210 - dimensionGap;
  // P47 组合图去掉上方100px说明边。矩形安全区同时保护学习椅的型号和图片。
  return { modelBadge: { x: 94, y: 350, height: 52 },
    productArea: { x: 235, y: 495, width: 615, height: bottom - 535 },
    subjectSafeArea: { x: 94, y: 432, width: 803, height: bottom - 432 }, sellingPoints,
    issue: total + 4 > 1252 ? '卖点文案总宽度超出安全区，请调整文案；50号字、98px框高和横向30px间距保持不变' : null };
}

export function studyDeskCombinationAccessories(options: SingleTemplateOptions, _layout: SingleLayout) {
  const { dimensionGap } = normalizeStudyDeskCombinationOptions(options);
  return [{ id: 'study-chair', label: '学习椅', area: { x: 937, y: 685, width: 409, height: 525 - dimensionGap } }];
}

function singleLineIssue(text: string, label: string) {
  return /[\r\n\t\u2028\u2029]/.test(text) ? `${label}请填写单行文字` : null;
}

export function studyDeskCombinationModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '儿童学习桌型号及完整规格';
  context.font = canvasFontFromPs(35, STUDY_DESK_SET_FONT);
  const width = context.measureText(text).width + 40;
  return { text, fontSize: 35, box: { ...layout.modelBadge, width },
    issue: singleLineIssue(text, '学习桌型号及完整规格') ?? (layout.modelBadge.x + width > 1346 ? '学习桌型号及完整规格过长，35号字已超出安全区，请核对内容，不能省略规格' : null) };
}

export function studyDeskCombinationChairBadge(context: TextMeasure, options: SingleTemplateOptions) {
  const { studyChairModel } = normalizeStudyDeskCombinationOptions(options), text = studyChairModel.trim() || '学习椅型号及完整规格';
  context.font = canvasFontFromPs(35, STUDY_DESK_SET_FONT);
  const width = context.measureText(text).width + 40;
  return { text, box: { x: 937, y: 603, width, height: 52 },
    issue: !studyChairModel.trim() ? '请填写学习椅的完整型号和规格，不能根据图片推测'
      : singleLineIssue(studyChairModel, '学习椅型号') ?? (width > 409 ? '学习椅型号过长，35号完整文字超出型号区域，请核对内容，不可省略型号或规格' : null) };
}

export const studyDeskCombinationNote = { text: '*学习椅为推荐搭配，产品发货数量以最终下单选择为准',
  font: canvasFontFromPs(40, '"方正兰亭准黑_GBK", sans-serif'), color: '#000000', x: 228, y: 1380 };

const labelWidths = { length: 620, width: 360, height: 190 };
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string) {
  context.font = canvasFontFromPs(35, STUDY_DESK_SET_DIMENSION_FONT);
  const lines: string[] = []; let line = '';
  for (const token of `${value}cm`.match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > labelWidths[kind]) { lines.push(line); line = ''; }
    line += token;
    if (kind === 'height' && token.endsWith('~')) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export function studyDeskCombinationExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const badgeIssue = studyDeskCombinationChairBadge(context, options).issue;
  const issues = badgeIssue ? [badgeIssue] : [];
  context.font = studyDeskCombinationNote.font;
  if (studyDeskCombinationNote.x + context.measureText(studyDeskCombinationNote.text).width > 1346) issues.push('底部搭配说明超出安全区，请检查规范字体是否正确加载');
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed) continue;
    const lines = dimensionLines(context, kind, parsed.text);
    if (lines.length > 4 || lines.some((line) => context.measureText(line).width > labelWidths[kind])) issues.push(`学习桌${{ length: '长', width: '宽', height: '高' }[kind]}尺寸过长或规格过多，折行后仍超出标注区域；请核对完整数据，必要时分成多张SKU，不可删减规格`);
  }
  return issues;
}

export function drawStudyDeskCombinationExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions, _layout: SingleLayout) {
  const { text, box } = studyDeskCombinationChairBadge(context, options);
  context.save(); context.textAlign = 'left'; context.textBaseline = 'middle';
  context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(box.x, box.y, box.width, box.height, 8); context.fill();
  context.font = canvasFontFromPs(35, STUDY_DESK_SET_FONT); context.fillStyle = '#ffffff'; context.fillText(text, box.x + 20, box.y + 26);
  context.restore();
}

export function parseStudyDeskCombinationDimensions(input: string): DimensionFields | null { return parseDimensionFields(input, 'truncate'); }

export function studyDeskCombinationDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind] ?? String(annotation.value), 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value);
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: lines.length * 40,
    runs: lines.map((text, index) => ({ text, font: canvasFontFromPs(35, STUDY_DESK_SET_DIMENSION_FONT), x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}

export function studyDeskCombinationDimensionIssue(fields: DimensionFields): string | null {
  for (const kind of ['length', 'width', 'height'] as const) {
    const name = { length: '长', width: '宽', height: '高' }[kind];
    if (!fields[kind].trim()) return `请填写学习桌${name}尺寸，不能根据图片推测真实尺寸`;
    if (!parseDimensionText(fields[kind], 'truncate')) return `学习桌${name}尺寸无效：须为正数，并列规格用 /、升降范围用 ~ 分隔（cm）`;
  }
  return null;
}
