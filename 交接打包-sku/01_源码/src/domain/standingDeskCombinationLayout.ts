import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import type { Rect } from './dimensionGeometry';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const STANDING_DESK_SET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const STANDING_DESK_SET_DIMENSION_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const STANDING_DESK_SET_HEADLINE_FONT = '"Montserrat Semi Bold", "方正兰亭粗黑_GBK", sans-serif';
export const STANDING_DESK_SET_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export type StandingDeskCombinationOptions = {
  headline: string;
  standingDeskSet: { count: 2 | 3; riserModel: string; chairModel: string; riserNote: string };
};
export type StandingDeskCombinationDraft = WorkbenchDraft & { standingDeskCombination?: StandingDeskCombinationOptions };

export function normalizeStandingDeskCombinationOptions(value: unknown): SingleTemplateOptions & StandingDeskCombinationOptions {
  const saved = value && typeof value === 'object' ? value as Partial<StandingDeskCombinationOptions> : {};
  const set = saved.standingDeskSet;
  return {
    sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: set?.count === 3 ? 60 : 100,
    headline: typeof saved.headline === 'string' ? saved.headline : '',
    standingDeskSet: { count: set?.count === 3 ? 3 : 2,
      riserModel: typeof set?.riserModel === 'string' ? set.riserModel : '',
      chairModel: typeof set?.chairModel === 'string' ? set.chairModel : '',
      riserNote: typeof set?.riserNote === 'string' ? set.riserNote : '' },
  };
}

export function getStandingDeskCombinationLayout(pointWidths: number[], options: SingleTemplateOptions): SingleLayout {
  const three = normalizeStandingDeskCombinationOptions(options).standingDeskSet.count === 3;
  let widths = pointWidths.map((width) => Math.max(394, width + 40));
  if (widths.reduce((sum, width) => sum + width, 0) + 30 * Math.max(0, widths.length - 1) > 1248) widths = pointWidths.map((width) => Math.max(150, width + 40));
  const total = widths.reduce((sum, width) => sum + width, 0) + 30 * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1212, width, height: 98 }; x += width + 30; return box; });
  // 固定区域根据 P44–45 推导；保守矩形边界同时避开配件型号与图片。
  return { modelBadge: { x: 94, y: 410, height: 52 },
    productArea: three ? { x: 165, y: 548, width: 850, height: 414 } : { x: 150, y: 548, width: 690, height: 535 },
    subjectSafeArea: three ? { x: 94, y: 492, width: 946, height: 490 } : { x: 94, y: 492, width: 766, height: 620 },
    sellingPoints, issue: total + 4 > 1252 ? '卖点文案总宽度超出安全区，请调整文案；50号字、98px框高和横向30px间距保持不变' : null };
}

function accessoryPlacement(options: SingleTemplateOptions) {
  const { standingDeskSet: set } = normalizeStandingDeskCombinationOptions(options);
  if (set.count === 3) return [
    { id: 'riser', label: '增高架', model: set.riserModel, area: { x: 610, y: 1072, width: 590, height: 60 }, badgeArea: { x: 490, y: 992, width: 720, height: 52 } },
    { id: 'chair', label: '电脑椅', model: set.chairModel, area: { x: 1080, y: 608, width: 266, height: 354 }, badgeArea: { x: 1060, y: 526, width: 286, height: 52 } },
  ];
  return [{ id: 'riser', label: '增高架', model: set.riserModel, area: { x: 910, y: 1012, width: 436, height: 100 }, badgeArea: { x: 880, y: 932, width: 466, height: 52 } }];
}

export function standingDeskCombinationAccessories(options: SingleTemplateOptions, _layout: SingleLayout): Array<{ id: string; label: string; area: Rect }> {
  return accessoryPlacement(options).map(({ id, label, area }) => ({ id, label, area }));
}

function singleLineIssue(text: string, label: string) {
  return /[\r\n\t\u2028\u2029]/.test(text) ? `${label}请填写单行文字` : null;
}

export function standingDeskCombinationHeadlineIssue(context: TextMeasure, headline: string): string | null {
  if (!headline.trim()) return '请填写组合标题，按实际产品资料填写';
  const issue = singleLineIssue(headline, '组合标题');
  if (issue) return issue;
  context.font = canvasFontFromPs(80, STANDING_DESK_SET_HEADLINE_FONT);
  return context.measureText(headline.trim()).width > 1252 ? '组合标题过长，80号完整文字超出标题区域，请核对内容' : null;
}

export function standingDeskCombinationAccessoryBadges(context: TextMeasure, options: SingleTemplateOptions) {
  context.font = canvasFontFromPs(35, STANDING_DESK_SET_FONT);
  return accessoryPlacement(options).map(({ id, label, model, badgeArea }) => {
    const text = model.trim() || `${label}型号及完整规格`, width = context.measureText(text).width + 40;
    return { id, text, box: { ...badgeArea, width },
      issue: !model.trim() ? `请填写${label}的完整型号和规格，不能根据图片推测`
        : singleLineIssue(model, `${label}型号`) ?? (width > badgeArea.width || badgeArea.x + width > 1346 ? `${label}型号过长，35号完整文字超出型号区域，请核对内容，不可省略型号或规格` : null) };
  });
}

export function standingDeskCombinationModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '电动升降桌型号及完整规格';
  context.font = canvasFontFromPs(35, STANDING_DESK_SET_FONT);
  const width = context.measureText(text).width + 40;
  return { text, fontSize: 35, box: { ...layout.modelBadge, width },
    issue: singleLineIssue(text, '升降桌型号及完整规格') ?? (layout.modelBadge.x + width > 1346 ? '升降桌型号及完整规格过长，35号字已超出安全区，请核对内容，不能省略规格' : null) };
}

export function standingDeskCombinationNote(options: SingleTemplateOptions, _layout: SingleLayout) {
  const three = normalizeStandingDeskCombinationOptions(options).standingDeskSet.count === 3;
  return { text: three ? '*增高架/电脑椅为推荐搭配，产品发货数量以最终下单选择为准' : '*增高架为推荐搭配，产品发货数量以最终下单选择为准',
    font: canvasFontFromPs(40, '"方正兰亭准黑_GBK", sans-serif'), color: '#000000', x: three ? 94 : 180, y: 1380 };
}

const labelWidths = { length: 700, width: 360, height: 190 };
function dimensionLines(context: TextMeasure, kind: 'length' | 'width' | 'height', value: string) {
  context.font = canvasFontFromPs(35, STANDING_DESK_SET_DIMENSION_FONT);
  const lines: string[] = []; let line = '';
  for (const token of `${value}cm`.match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > labelWidths[kind]) { lines.push(line); line = ''; }
    line += token;
    if (kind === 'height' && token.endsWith('~')) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export function standingDeskCombinationExtraIssues(context: TextMeasure, options: SingleTemplateOptions, layout: SingleLayout, fields?: DimensionFields): string[] {
  const { headline, standingDeskSet } = normalizeStandingDeskCombinationOptions(options);
  const titleIssue = standingDeskCombinationHeadlineIssue(context, headline);
  const issues = titleIssue ? [titleIssue] : [];
  issues.push(...standingDeskCombinationAccessoryBadges(context, options).flatMap((badge) => badge.issue ? [badge.issue] : []));
  if (standingDeskSet.count === 3) {
    const noteIssue = singleLineIssue(standingDeskSet.riserNote, '增高架补充说明');
    context.font = canvasFontFromPs(20, STANDING_DESK_SET_FONT);
    if (noteIssue) issues.push(noteIssue);
    else if (context.measureText(standingDeskSet.riserNote).width > 720) issues.push('增高架补充说明过长，20号完整文字超出备注区域，请核对内容');
  }
  const note = standingDeskCombinationNote(options, layout);
  context.font = note.font;
  if (note.x + context.measureText(note.text).width > 1346) issues.push('底部搭配说明超出安全区，请检查规范字体是否正确加载');
  if (fields) for (const kind of STANDING_DESK_SET_DIMENSION_KINDS as Array<'length' | 'width' | 'height'>) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed) continue;
    const lines = dimensionLines(context, kind, parsed.text);
    if (lines.length > 4 || lines.some((line) => context.measureText(line).width > labelWidths[kind])) issues.push(`升降桌${{ length: '长', width: '宽', height: '高' }[kind]}尺寸过长或规格过多，折行后仍超出标注区域；请核对完整数据，必要时分成多张SKU，不可删减规格`);
  }
  return issues;
}

export function drawStandingDeskCombinationExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions, _layout: SingleLayout) {
  const { headline, standingDeskSet } = normalizeStandingDeskCombinationOptions(options);
  const badges = standingDeskCombinationAccessoryBadges(context, options);
  context.save(); context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillStyle = '#000000';
  context.font = canvasFontFromPs(80, STANDING_DESK_SET_HEADLINE_FONT);
  context.fillText(headline.trim(), 94, 340);
  for (const { text, box } of badges) {
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(box.x, box.y, box.width, box.height, 8); context.fill();
    context.font = canvasFontFromPs(35, STANDING_DESK_SET_FONT); context.fillStyle = '#ffffff'; context.fillText(text, box.x + 20, box.y + 26);
  }
  if (standingDeskSet.count === 3 && standingDeskSet.riserNote.trim()) {
    context.font = canvasFontFromPs(20, STANDING_DESK_SET_FONT); context.fillStyle = '#000000'; context.textBaseline = 'alphabetic';
    context.fillText(standingDeskSet.riserNote, 490, 1152);
  }
  context.restore();
}

export function parseStandingDeskCombinationDimensions(input: string): DimensionFields | null { return parseDimensionFields(input, 'truncate'); }

export function standingDeskCombinationDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields, _options: SingleTemplateOptions): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind] ?? String(annotation.value), 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, kind, value);
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: lines.length * 40,
    runs: lines.map((text, index) => ({ text, font: canvasFontFromPs(35, STANDING_DESK_SET_DIMENSION_FONT), x: 0, y: (index - (lines.length - 1) / 2) * 40 })) };
}

export function standingDeskCombinationDimensionIssue(fields: DimensionFields): string | null {
  for (const kind of STANDING_DESK_SET_DIMENSION_KINDS as Array<'length' | 'width' | 'height'>) {
    const name = { length: '长', width: '宽', height: '高' }[kind];
    if (!fields[kind].trim()) return `请填写升降桌${name}尺寸，不能根据图片推测真实尺寸`;
    if (!parseDimensionText(fields[kind], 'truncate')) return `升降桌${name}尺寸无效：须为正数，并列规格用 /、升降范围用 ~ 分隔（cm）`;
  }
  return null;
}
