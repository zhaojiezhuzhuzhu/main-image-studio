import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleAccessorySlot, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const ERGONOMIC_CHAIR_TEXT_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const ERGONOMIC_CHAIR_TITLE_FONT = '"Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif';
export const ERGONOMIC_CHAIR_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export type ErgonomicChairDetail = { title: string; description: string };
export type ErgonomicChairOptions = { ergonomicChairDetails: ErgonomicChairDetail[] };
export type ErgonomicChairDraft = WorkbenchDraft & { ergonomicChair?: { details: ErgonomicChairDetail[] } };

export function normalizeErgonomicChairOptions(value: unknown): SingleTemplateOptions & ErgonomicChairOptions {
  const saved = value && typeof value === 'object' ? value as Partial<ErgonomicChairOptions> : {};
  const details = Array.isArray(saved.ergonomicChairDetails) ? saved.ergonomicChairDetails : [];
  return { sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0,
    ergonomicChairDetails: Array.from({ length: 5 }, (_, index) => ({
      title: typeof details[index]?.title === 'string' ? details[index].title : '',
      description: typeof details[index]?.description === 'string' ? details[index].description : '',
    })) };
}

export function getErgonomicChairSingleLayout(): SingleLayout {
  // P50工学椅图为1440方图；左侧总高标注靠近x55，安全区不能沿用边桌的x94。
  return { modelBadge: { x: 90, y: 300, height: 72 }, productArea: { x: 245, y: 475, width: 440, height: 795 },
    subjectSafeArea: { x: 30, y: 412, width: 685, height: 928 }, sellingPoints: [] };
}

export function ergonomicChairDetailCards(): Rect[] {
  // 上下界按P50图示300..1340，四排等高且保持P49指定的10px间隔。
  return [0, 1, 2, 3, 4].map((index) => index < 3
    ? { x: 726, y: 300 + index * 262.5, width: 622, height: 252.5 }
    : { x: 726 + (index - 3) * 316, y: 1087.5, width: 306, height: 252.5 });
}

export function ergonomicChairAccessories(): SingleAccessorySlot[] {
  return ergonomicChairDetailCards().map((area, index) => ({ id: `ergonomic-detail-${index + 1}`, label: `细节${index + 1}`, area, fit: 'cover', clipRadius: 28 }));
}

export function ergonomicChairModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '工学椅型号及完整规格';
  context.font = canvasFontFromPs(45, ERGONOMIC_CHAIR_TEXT_FONT);
  const width = context.measureText(text).width + 40;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '工学椅型号及完整规格请填写单行文字'
      : layout.modelBadge.x + width > 715 ? '工学椅型号及完整规格过长，45号字已超出左侧型号区域，请核对内容，不能省略规格' : null };
}

function wrapText(context: TextMeasure, text: string, font: string, width: number): string[] {
  if (!text.trim()) return [];
  context.font = font;
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n').flatMap((paragraph) => {
    const lines: string[] = []; let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && context.measureText(line + char).width > width) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line); return lines;
  });
}

export function ergonomicChairDetailText(context: TextMeasure, detail: ErgonomicChairDetail, index: number) {
  const card = ergonomicChairDetailCards()[index], width = card.width - 80, availableHeight = card.height - 80;
  const titleSize = index < 3 ? 45 : 35;
  const titleFont = canvasFontFromPs(titleSize, ERGONOMIC_CHAIR_TITLE_FONT), descriptionFont = canvasFontFromPs(26, ERGONOMIC_CHAIR_TEXT_FONT);
  const titleLines = wrapText(context, detail.title, titleFont, width), descriptionLines = wrapText(context, detail.description, descriptionFont, width);
  const titleHeight = titleLines.length ? titleSize + (titleLines.length - 1) * 50 : 0;
  const descriptionHeight = descriptionLines.length ? 26 + (descriptionLines.length - 1) * 35 : 0;
  const descriptionY = card.y + 40 + titleHeight + (titleLines.length && descriptionLines.length ? 20 : 0);
  const issues: string[] = [];
  context.font = titleFont;
  if (!detail.title.trim()) issues.push(`请填写细节${index + 1}标题，内容须依据实际产品资料`);
  else if (titleHeight > availableHeight || titleLines.some((line) => context.measureText(line).width > width)) issues.push(`细节${index + 1}标题过长，${titleSize}号字折行后超出卡片区域，请核对完整文案，不可截断文字`);
  context.font = descriptionFont;
  if (descriptionLines.length && (descriptionY + descriptionHeight > card.y + card.height - 40 || descriptionLines.some((line) => context.measureText(line).width > width))) issues.push(`细节${index + 1}说明过长，26号字与标题排版后超出卡片区域，请核对完整文案，不可截断文字`);
  return { card, titleFont, descriptionFont, titleLines, descriptionLines, descriptionY, issues };
}

export function drawErgonomicChairDetails(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const { ergonomicChairDetails } = normalizeErgonomicChairOptions(options);
  context.save(); context.textAlign = 'left'; context.textBaseline = 'top'; context.fillStyle = '#000000';
  ergonomicChairDetails.forEach((detail, index) => {
    const text = ergonomicChairDetailText(context, detail, index);
    context.font = text.titleFont;
    text.titleLines.forEach((line, lineIndex) => context.fillText(line, text.card.x + 40, text.card.y + 40 + lineIndex * 50));
    context.font = text.descriptionFont;
    text.descriptionLines.forEach((line, lineIndex) => context.fillText(line, text.card.x + 40, text.descriptionY + lineIndex * 35));
  });
  context.restore();
}

const dimensionWidths = { length: 420, width: 360, height: 220 };
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string) {
  context.font = canvasFontFromPs(45, ERGONOMIC_CHAIR_TEXT_FONT);
  const lines: string[] = kind === 'height' ? ['总高'] : []; let line = '';
  const text = `${kind === 'length' ? '总长' : kind === 'width' ? '总宽' : ''}${value}cm`;
  for (const token of text.match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > dimensionWidths[kind]) { lines.push(line); line = ''; }
    line += token;
    if (kind === 'height' && token.endsWith('~')) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export function ergonomicChairDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind], 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value);
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: 45 + (lines.length - 1) * 40,
    runs: lines.map((text, index) => ({ text, font: canvasFontFromPs(45, ERGONOMIC_CHAIR_TEXT_FONT), x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}

export function parseErgonomicChairDimensions(input: string): DimensionFields | null { return parseDimensionFields(input, 'truncate'); }

export function ergonomicChairDimensionIssue(fields: DimensionFields, context?: TextMeasure): string | null {
  for (const kind of ['length', 'width', 'height'] as const) {
    const name = { length: '总长', width: '总宽', height: '总高' }[kind], value = parseDimensionText(fields[kind], 'truncate');
    if (!fields[kind].trim()) return `请填写工学椅${name}尺寸，不能根据图片推测真实尺寸`;
    if (!value) return `工学椅${name}尺寸无效：须为正数，并列规格用 /、升降范围用 ~ 分隔（cm）`;
    if (context) {
      const lines = dimensionLines(context, kind, value.text);
      if (lines.length > 4 || lines.some((line) => context.measureText(line).width > dimensionWidths[kind])) return `工学椅${name}尺寸过长或规格过多，折行后仍超出左侧标注区域，请核对完整数据或分成多张SKU，不可删减规格`;
    }
  }
  return null;
}

export function ergonomicChairExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const issues = normalizeErgonomicChairOptions(options).ergonomicChairDetails.flatMap((detail, index) => ergonomicChairDetailText(context, detail, index).issues);
  const dimensionIssue = fields ? ergonomicChairDimensionIssue(fields, context) : null;
  return dimensionIssue ? [...issues, dimensionIssue] : issues;
}
