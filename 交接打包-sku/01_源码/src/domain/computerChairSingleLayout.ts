import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleAccessorySlot, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const COMPUTER_CHAIR_TEXT_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const COMPUTER_CHAIR_TITLE_FONT = '"Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif';
export const COMPUTER_CHAIR_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export type ComputerChairDetail = { title: string; description: string; textColor: 'black' | 'white' };
export type ComputerChairOptions = Omit<SingleTemplateOptions, 'computerChairDetails'> & { computerChairDetails: ComputerChairDetail[] };
export type ComputerChairDraft = WorkbenchDraft & { computerChair?: { details: ComputerChairDetail[] } };

export function computerChairDefaultTextColor(index: number): ComputerChairDetail['textColor'] { return index === 1 ? 'white' : 'black'; }

export function normalizeComputerChairOptions(value: unknown): ComputerChairOptions {
  const saved = value && typeof value === 'object' ? value as Partial<ComputerChairOptions> : {};
  const details = Array.isArray(saved.computerChairDetails) ? saved.computerChairDetails : [];
  return { sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0,
    computerChairDetails: Array.from({ length: 5 }, (_, index) => ({
      title: typeof details[index]?.title === 'string' ? details[index].title : '',
      description: typeof details[index]?.description === 'string' ? details[index].description : '',
      textColor: details[index]?.textColor === 'black' || details[index]?.textColor === 'white' ? details[index].textColor : computerChairDefaultTextColor(index),
    })) };
}

export function getComputerChairSingleLayout(): SingleLayout {
  // P50的image104已为1440画布，主图比P49边桌更高；以下区域由这张电脑椅图推定。
  return { modelBadge: { x: 90, y: 300, height: 72 }, productArea: { x: 224, y: 523, width: 460, height: 725 },
    subjectSafeArea: { x: 30, y: 412, width: 676, height: 928 }, sellingPoints: [] };
}

export function computerChairDetailCards(): Rect[] {
  return [
    { x: 726, y: 300, width: 622, height: 252 },
    { x: 726, y: 562, width: 622, height: 253 },
    { x: 726, y: 825, width: 622, height: 253 },
    { x: 726, y: 1088, width: 306, height: 252 },
    { x: 1042, y: 1088, width: 306, height: 252 },
  ];
}

export function computerChairAccessories(): SingleAccessorySlot[] {
  return computerChairDetailCards().map((area, index) => ({ id: `computer-detail-${index + 1}`, label: `细节图${index + 1}`, area, fit: 'cover', clipRadius: 28 }));
}

export function computerChairModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '电脑椅型号及完整规格';
  context.font = canvasFontFromPs(45, COMPUTER_CHAIR_TEXT_FONT);
  const width = context.measureText(text).width + 40;
  return { text, fontSize: 45, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '电脑椅型号及完整规格请填写单行文字'
      : layout.modelBadge.x + width > 686 ? '电脑椅型号及完整规格过长，45号字已超出左侧型号区域，请核对内容，不能省略规格' : null };
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

export function computerChairDetailText(context: TextMeasure, detail: ComputerChairDetail, index: number) {
  const card = computerChairDetailCards()[index], width = card.width - 80, availableHeight = card.height - 80;
  const titleSize = index < 3 ? 45 : 35;
  const titleFont = canvasFontFromPs(titleSize, COMPUTER_CHAIR_TITLE_FONT), descriptionFont = canvasFontFromPs(26, COMPUTER_CHAIR_TEXT_FONT);
  const titleLines = wrapText(context, detail.title, titleFont, width), descriptionLines = wrapText(context, detail.description, descriptionFont, width);
  const titleHeight = titleLines.length ? titleSize + (titleLines.length - 1) * 50 : 0;
  const descriptionHeight = descriptionLines.length ? 26 + (descriptionLines.length - 1) * 35 : 0;
  const descriptionY = card.y + 40 + titleHeight + (titleLines.length && descriptionLines.length ? 20 : 0);
  const issues: string[] = [];
  context.font = titleFont;
  if (!detail.title.trim()) issues.push(`请填写细节${index + 1}标题，内容须依据实际产品资料`);
  else if (titleHeight > availableHeight || titleLines.some((line) => context.measureText(line).width > width)) issues.push(`细节${index + 1}标题过长，${titleSize}号字折行后超出卡片区域，请核对完整文案，不可截断文字`);
  context.font = descriptionFont;
  if (descriptionY + descriptionHeight > card.y + card.height - 40 || descriptionLines.some((line) => context.measureText(line).width > width)) {
    if (descriptionLines.length) issues.push(`细节${index + 1}说明过长，26号字与标题排版后超出卡片区域，请核对完整文案，不可截断文字`);
  }
  return { card, titleFont, descriptionFont, titleLines, descriptionLines, descriptionY, color: detail.textColor === 'white' ? '#ffffff' : '#000000', issues };
}

export function drawComputerChairDetails(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const { computerChairDetails } = normalizeComputerChairOptions(options);
  context.save(); context.textAlign = 'left'; context.textBaseline = 'top';
  computerChairDetails.forEach((detail, index) => {
    const text = computerChairDetailText(context, detail, index);
    context.fillStyle = text.color; context.font = text.titleFont;
    text.titleLines.forEach((line, lineIndex) => context.fillText(line, text.card.x + 40, text.card.y + 40 + lineIndex * 50));
    context.font = text.descriptionFont;
    text.descriptionLines.forEach((line, lineIndex) => context.fillText(line, text.card.x + 40, text.descriptionY + lineIndex * 35));
  });
  context.restore();
}

const dimensionWidths = { length: 390, width: 390, height: 200 };
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string) {
  context.font = canvasFontFromPs(45, COMPUTER_CHAIR_TEXT_FONT);
  const lines: string[] = kind === 'height' ? ['总高'] : [];
  let line = kind === 'length' ? '总长' : kind === 'width' ? '总宽' : '';
  for (const token of `${value}cm`.match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > dimensionWidths[kind]) { lines.push(line); line = ''; }
    line += token;
    if (kind === 'height' && token.endsWith('~')) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export function computerChairDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind], 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value);
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: 45 + (lines.length - 1) * 40,
    runs: lines.map((text, index) => ({ text, font: canvasFontFromPs(45, COMPUTER_CHAIR_TEXT_FONT), x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}

export function parseComputerChairDimensions(input: string): DimensionFields | null { return parseDimensionFields(input, 'truncate'); }

export function computerChairDimensionIssue(fields: DimensionFields, context?: TextMeasure): string | null {
  for (const kind of ['length', 'width', 'height'] as const) {
    const name = { length: '总长', width: '总宽', height: '总高' }[kind], value = parseDimensionText(fields[kind], 'truncate');
    if (!fields[kind].trim()) return `请填写电脑椅${name}尺寸，不能根据图片推测真实尺寸`;
    if (!value) return `电脑椅${name}尺寸无效：须为正数，并列规格用 /、升降范围用 ~ 分隔（cm）`;
    if (context) {
      const lines = dimensionLines(context, kind, value.text);
      if (lines.length > 4 || lines.some((line) => context.measureText(line).width > dimensionWidths[kind])) return `电脑椅${name}尺寸过长或规格过多，折行后仍超出左侧标注区域，请核对完整数据或分成多张SKU，不可删减规格`;
    }
  }
  return null;
}

export function computerChairExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const issues = normalizeComputerChairOptions(options).computerChairDetails.flatMap((detail, index) => computerChairDetailText(context, detail, index).issues);
  const dimensionIssue = fields ? computerChairDimensionIssue(fields, context) : null;
  return dimensionIssue ? [...issues, dimensionIssue] : issues;
}
